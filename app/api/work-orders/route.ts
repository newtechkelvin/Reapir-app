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

// 🔍 【GET】多條件模糊查詢（車牌 / VIN / Project 專案）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('plate');

    if (!query || !query.trim()) {
      return NextResponse.json({ success: false, error: '請輸入搜尋關鍵字' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const keyword = `%${query.trim()}%`;

    // 1. 同時對 plate_number, vin, project 進行不區分大小寫的模糊比對
    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('*')
      .or(`plate_number.ilike.${keyword},vin.ilike.${keyword},project.ilike.${keyword}`)
      .order('updated_at', { ascending: false });

    if (vErr) throw vErr;
    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json({ success: true, vehicles: [] });
    }

    // 2. 抓取這批車輛的所有歷史工單
    const vehicleIds = vehicles.map(v => v.id);
    const { data: workOrders, error: woErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_items (*)
      `)
      .in('vehicle_id', vehicleIds)
      .order('created_at', { ascending: false });

    if (woErr) throw woErr;

    // 3. 組合車輛履歷與工單紀錄
    const results = vehicles.map(vehicle => {
      const vWorkOrders = workOrders?.filter(wo => wo.vehicle_id === vehicle.id) || [];
      const lastRepairDate = vWorkOrders.length > 0 ? vWorkOrders[0].created_at : null;
      const allItems = Array.from(
        new Set(vWorkOrders.flatMap(wo => wo.work_order_items?.map((i: any) => i.item_name) || []))
      );

      return {
        ...vehicle,
        last_repair_date: lastRepairDate,
        maintenance_items_summary: allItems,
        workOrders: vWorkOrders
      };
    });

    return NextResponse.json({ success: true, vehicles: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ➕ 【POST】開立工單
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { plate_number, vin, project, brand, model, mileage, next_maintenance_date, description, items } = body;

    const formattedPlate = plate_number.trim().toUpperCase();

    // 1. 取得或建立/更新車輛
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
          vin: vin || null,
          project: project || null,
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
      const updateData: any = {};
      if (vin) updateData.vin = vin;
      if (project) updateData.project = project;
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
    const order_number = `WO-${Date.now().toString().slice(-8)}`;

    const { data: workOrder, error: woErr } = await supabase
      .from('work_orders')
      .insert({
        order_number,
        vehicle_id: vehicle.id,
        project: project || null,
        mileage,
        description,
        total_cost: 0,
        status: 'Completed'
      })
      .select()
      .single();

    if (woErr || !workOrder) throw new Error(woErr?.message || '工單建立失敗');

    // 3. 寫入明細
    const formattedItems = items.map((item: any) => ({
      work_order_id: workOrder.id,
      part_id: item.part_id || null,
      item_name: item.item_name,
      type: item.type || 'Labor',
      quantity: 1,
      unit_price: 0,
      subtotal: 0
    }));

    const { error: itemErr } = await supabase.from('work_order_items').insert(formattedItems);
    if (itemErr) throw itemErr;

    return NextResponse.json({ success: true, order_number });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
