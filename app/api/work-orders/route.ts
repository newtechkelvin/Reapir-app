import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('環境變數缺失：請確認已設定 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// 🔍 【GET】根據車牌號碼查詢車輛與過往維修紀錄
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = searchParams.get('plate');

    if (!plate) {
      return NextResponse.json({ success: false, error: '請提供車牌號碼' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 查詢車輛基本資料
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate.trim().toUpperCase())
      .maybeSingle();

    if (vErr) throw vErr;
    if (!vehicle) {
      return NextResponse.json({ success: true, vehicle: null, workOrders: [] });
    }

    // 2. 查詢該車輛的所有歷史工單與項目明細
    const { data: workOrders, error: woErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_items (*)
      `)
      .eq('vehicle_id', vehicle.id)
      .order('created_at', { ascending: false });

    if (woErr) throw woErr;

    return NextResponse.json({ success: true, vehicle, workOrders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ➕ 【POST】開立新工單並自動扣減庫存
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { plate_number, model, mileage, description, items } = body;

    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, mileage')
      .eq('plate_number', plate_number.trim().toUpperCase())
      .maybeSingle();

    if (!vehicle) {
      const { data: newVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({ plate_number: plate_number.trim().toUpperCase(), model, mileage })
        .select()
        .single();

      if (vErr || !newVehicle) throw new Error(vErr?.message || '車輛建立失敗');
      vehicle = newVehicle;
    } else if (mileage > vehicle.mileage) {
      await supabase.from('vehicles').update({ mileage }).eq('id', vehicle.id);
    }

    if (!vehicle) throw new Error('無法取得車輛資料');

    const total_cost = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    const order_number = `WO-${Date.now().toString().slice(-8)}`;

    const { data: workOrder, error: woErr } = await supabase
      .from('work_orders')
      .insert({
        order_number,
        vehicle_id: vehicle.id,
        mileage,
        description,
        total_cost,
        status: 'Completed'
      })
      .select()
      .single();

    if (woErr || !workOrder) throw new Error(woErr?.message || '工單建立失敗');

    const formattedItems = items.map((item: any) => ({
      work_order_id: workOrder.id,
      part_id: item.part_id || null,
      item_name: item.item_name,
      type: item.type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price
    }));

    const { error: itemErr } = await supabase.from('work_order_items').insert(formattedItems);
    if (itemErr) throw itemErr;

    return NextResponse.json({ success: true, order_number, total_cost });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
