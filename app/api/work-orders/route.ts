import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    // 1. 檢查並更新/建立車輛主表
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate_number.trim())
      .maybeSingle();

    if (!vehicle) {
      const { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert([{
          plate_number: plate_number.trim(),
          vin: vin || '',
          project: project || (targetWarrantyType === 'General' ? '散車保固' : ''),
          brand: brand || '',
          model: model || '',
          garage_location: location || '機電 - 九龍灣1/F',
          claim_form_date: claim_form_date || null,
          warranty_type: targetWarrantyType
        }])
        .select()
        .single();

      if (vErr) {
        return NextResponse.json({ error: `建立車輛資料失敗: ${vErr.message}` }, { status: 500 });
      }
      vehicle = newV;
    } else {
      // 若車輛已存在，更新保固類別
      await supabase
        .from('vehicles')
        .update({ warranty_type: targetWarrantyType })
        .eq('id', vehicle.id);
    }

    // 2. 建立新工單
    const orderNumber = `WO-${Date.now().toString().slice(-6)}`;
    const { data: order, error: oErr } = await supabase
      .from('work_orders')
      .insert([{
        vehicle_id: vehicle.id,
        plate_number: vehicle.plate_number,
        order_number: orderNumber,
        description: description || '',
        garage_location: location || vehicle.garage_location || '機電 - 九龍灣1/F',
        claim_form_date: claim_form_date || null,
        status: 'Open',
        warranty_type: targetWarrantyType
      }])
      .select()
      .single();

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