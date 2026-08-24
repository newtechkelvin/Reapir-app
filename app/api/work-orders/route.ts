import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';

    let vehiclesData: any[] = [];

    if (!query) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, work_orders(*, work_order_items(*))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      vehiclesData = data || [];
    } else {
      const { data: vData, error: vErr } = await supabase
        .from('vehicles')
        .select('*, work_orders(*, work_order_items(*))')
        .or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (vErr) console.warn('車輛關聯搜尋警告:', vErr.message);

      const { data: woData, error: woErr } = await supabase
        .from('work_orders')
        .select('vehicle_id')
        .or(`order_number.ilike.%${query}%,plate_number.ilike.%${query}%`);

      if (woErr) console.warn('工單號碼搜尋警告:', woErr.message);

      const vehicleIdsFromWo = (woData || []).map((w: any) => w.vehicle_id).filter(Boolean);

      if (vehicleIdsFromWo.length > 0) {
        const { data: vMatched, error: vmErr } = await supabase
          .from('vehicles')
          .select('*, work_orders(*, work_order_items(*))')
          .in('id', vehicleIdsFromWo);

        if (!vmErr && vMatched) {
          const combinedMap = new Map();
          (vData || []).forEach((v: any) => combinedMap.set(v.id, v));
          (vMatched || []).forEach((v: any) => combinedMap.set(v.id, v));
          vehiclesData = Array.from(combinedMap.values());
        } else {
          vehiclesData = vData || [];
        }
      } else {
        vehiclesData = vData || [];
      }
    }

    const formattedVehicles = vehiclesData.map((v: any) => ({
      ...v,
      workOrders: v.work_orders || [],
    }));

    return NextResponse.json({ vehicles: formattedVehicles });
  } catch (err: any) {
    console.error('API GET 錯誤:', err);
    return NextResponse.json({ error: err.message || '伺服器內部錯誤' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      plate_number,
      vin,
      project,
      brand,
      model,
      location,
      claim_form_date,
      pickup_return_date,
      description,
      items,
      warranty_type
    } = body;

    if (!plate_number) {
      return NextResponse.json({ error: '請輸入車牌號碼' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const targetWarrantyType = warranty_type || (project?.includes('散車') ? 'General' : 'Government');

    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate_number.trim())
      .maybeSingle();

    if (!vehicle) {
      const insertPayload: Record<string, any> = {
        plate_number: plate_number.trim(),
        vin: vin || '',
        project: project || (targetWarrantyType === 'General' ? '散車保固' : ''),
        brand: brand || '',
        model: model || '',
        garage_location: location || '機電 - 九龍灣1/F',
        vehicle_location: targetWarrantyType === 'General' ? (location || '') : '',
        claim_form_date: claim_form_date || null,
        pickup_return_date: pickup_return_date || null,
        warranty_type: targetWarrantyType
      };

      let { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert([insertPayload])
        .select()
        .single();

      if (vErr && vErr.message?.includes('warranty_type')) {
        delete insertPayload.warranty_type;
        const retryRes = await supabase
          .from('vehicles')
          .insert([insertPayload])
          .select()
          .single();
        newV = retryRes.data;
        vErr = retryRes.error;
      }

      if (vErr) {
        return NextResponse.json({ error: `建立車輛資料失敗: ${vErr.message}` }, { status: 500 });
      }
      vehicle = newV;
    } else {
      const updateData: Record<string, any> = {
        warranty_type: targetWarrantyType
      };
      if (brand) updateData.brand = brand;
      if (model) updateData.model = model;
      if (vin) updateData.vin = vin;
      if (project) updateData.project = project;

      try {
        await supabase
          .from('vehicles')
          .update(updateData)
          .eq('id', vehicle.id);
      } catch (e) {
        console.warn('更新車輛屬性失敗 (非致命):', e);
      }
    }

    if (!vehicle) {
      return NextResponse.json({ error: '無法取得或建立車輛資料' }, { status: 500 });
    }

    const orderNumber = `WO-${Date.now().toString().slice(-6)}`;
    const orderPayload: Record<string, any> = {
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number,
      order_number: orderNumber,
      description: description || '',
      garage_location: targetWarrantyType === 'General' ? '' : (location || vehicle.garage_location || '機電 - 九龍灣1/F'),
      vehicle_location: targetWarrantyType === 'General' ? (location || '') : '',
      claim_form_date: claim_form_date || null,
      pickup_return_date: pickup_return_date || null,
      status: 'Open',
      warranty_type: targetWarrantyType
    };

    let { data: order, error: oErr } = await supabase
      .from('work_orders')
      .insert([orderPayload])
      .select()
      .single();

    if (oErr && oErr.message?.includes('warranty_type')) {
      delete orderPayload.warranty_type;
      const retryOrderRes = await supabase
        .from('work_orders')
        .insert([orderPayload])
        .select()
        .single();
      order = retryOrderRes.data;
      oErr = retryOrderRes.error;
    }

    if (oErr) {
      return NextResponse.json({ error: `建立工單失敗: ${oErr.message}` }, { status: 500 });
    }

    if (Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((i: any) => ({
        work_order_id: order.id,
        type: i.type || '進廠維修',
        item_name: i.item_name || '',
        is_completed: false
      }));
      await supabase.from('work_order_items').insert(itemsToInsert);
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error('建立工單失敗:', err);
    return NextResponse.json({ error: err.message || '建立工單失敗' }, { status: 500 });
  }
}
