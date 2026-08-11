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

// 🔍 【GET】查詢車牌詳細保養資訊與維修歷史
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const plate = searchParams.get('plate');

    if (!plate) {
      return NextResponse.json({ success: false, error: '請提供車牌號碼' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 查詢車輛資料（含品牌與保養到期日）
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate.trim().toUpperCase())
      .maybeSingle();

    if (vErr) throw vErr;
    if (!vehicle) {
      return NextResponse.json({ success: true, vehicle: null, workOrders: [] });
    }

    // 2. 查詢歷史工單（按時間倒序排序）
    const { data: workOrders, error: woErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_items (*)
      `)
      .eq('vehicle_id', vehicle.id)
      .order('created_at', { ascending: false });

    if (woErr) throw woErr;

    // 計算「最後一次維修時間」
    const lastRepairDate = workOrders && workOrders.length > 0 ? workOrders[0].created_at : null;

    // 彙整所有維修過的「項目」
    const allItems = workOrders
      ? Array.from(new Set(workOrders.flatMap(wo => wo.work_order_items?.map((i: any) => i.item_name) || [])))
      : [];

    return NextResponse.json({
      success: true,
      vehicle: {
        ...vehicle,
        last_repair_date: lastRepairDate,
        maintenance_items_summary: allItems
      },
      workOrders
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ➕ 【POST】開立工單並更新車輛品牌與保養到期日
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { plate_number, brand, model, mileage, next_maintenance_date, description, items } = body;

    const formattedPlate = plate_number.trim().toUpperCase();

    // 1. 取得或更新/建立車輛
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, mileage')
      .eq('plate_number', formattedPlate)
      .maybeSingle();

    if (!vehicle) {
      const { data: newVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({
          plate_number: formattedPlate,
          brand,
          model,
          mileage,
          next_maintenance_date: next_maintenance_date || null
        })
        .select()
        .single();

      if (vErr || !newVehicle) throw new Error(vErr?.message || '車輛建立失敗');
      vehicle = newVehicle;
    } else {
      // 更新車輛最新資訊
      const updateData: any = {};
      if (brand) updateData.brand = brand;
      if (model) updateData.model = model;
      if (mileage > vehicle.mileage) updateData.mileage = mileage;
      if (next_maintenance_date) updateData.next_maintenance_date = next_maintenance_date;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('vehicles').update(updateData).eq('id', vehicle.id);
      }
    }

    if (!vehicle) throw new Error('無法取得車輛資料');

    // 2. 建立工單
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

    // 3. 寫入工單明細
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
