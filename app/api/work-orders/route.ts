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

    let vehicleQuery = supabase
      .from('vehicles')
      .select('*, work_orders(*, work_order_items(*))')
      .order('created_at', { ascending: false });

    if (query) {
      vehicleQuery = vehicleQuery.or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`);
    }

    const { data: vehiclesData, error: vErr } = await vehicleQuery;

    if (vErr) {
      console.error('讀取車輛資料失敗:', vErr);
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }

    const formattedVehicles = (vehiclesData || []).map((v: any) => ({
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
      description,
      items,
      warranty_type
    } = body;

    if (!plate_number) {
      return NextResponse.json({ error: '請輸入車牌號碼' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const targetWarrantyType = warranty_type || (project?.includes('散車') ? 'General' : 'Government');

    // 1. 檢查並更新/新增車輛主表（包含 brand 與 model）
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate_number.trim())
      .maybeSingle();

    if (!vehicle) {
      const insertPayload: any = {
        plate_number: plate_number.trim(),
        vin: vin || '',
        project: project || (targetWarrantyType === 'General' ? '散車保固' : ''),
        brand: brand || '',
        model: model || '',
        vehicle_location: location || '',
        claim_form_date: claim_form_date || null,
        warranty_type: targetWarrantyType
      };

      let { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert([insertPayload])
        .select()
        .single();

      // 若資料庫缺乏特定選填欄位，進行降級防禦重試
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
      // 若車輛已存在，更新品牌、型號與位置等資訊
      const updatePayload: any = {};
      if (brand) updatePayload.brand = brand;
      if (model) updatePayload.model = model;
      if (vin) updatePayload.vin = vin;
      if (location) updatePayload.vehicle_location = location;
      updatePayload.warranty_type = targetWarrantyType;

      await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('id', vehicle.id)
        .then(() => {})
        .catch(() => {});
    }

    // 2. 建立新工單
    const orderNumber = `WO-${Date.now().toString().slice(-6)}`;
    const orderPayload: any = {
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number,
      order_number: orderNumber,
      description: description || '',
      vehicle_location: location || vehicle.vehicle_location || '',
      claim_form_date: claim_form_date || null,
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

    // 3. 建立工單項目
    if (Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((i) => ({
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
