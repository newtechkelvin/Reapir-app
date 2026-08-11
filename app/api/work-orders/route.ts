import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plate_number, model, mileage, description, items } = body;

    // 1. 取得或建立車輛
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('id, mileage')
      .eq('plate_number', plate_number)
      .maybeSingle();

    if (!vehicle) {
      const { data: newVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({ plate_number, model, mileage })
        .select()
        .single();
      
      if (vErr || !newVehicle) {
        throw new Error(vErr?.message || '車輛建立失敗');
      }
      vehicle = newVehicle;
    } else if (mileage > vehicle.mileage) {
      // 更新車輛最新里程數
      await supabase
        .from('vehicles')
        .update({ mileage })
        .eq('id', vehicle.id);
    }

    // 💡 關鍵修復：向 TypeScript 保證 vehicle 絕不為 null
    if (!vehicle) {
      throw new Error('無法取得或建立車輛資料');
    }

    // 2. 計算總金額
    const total_cost = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
    const order_number = `WO-${Date.now().toString().slice(-8)}`;

    // 3. 建立工單
    const { data: workOrder, error: woErr } = await supabase
      .from('work_orders')
      .insert({
        order_number,
        vehicle_id: vehicle.id, // 此時 TS 已確定 vehicle 必定存在
        mileage,
        description,
        total_cost,
        status: 'Completed'
      })
      .select()
      .single();

    if (woErr || !workOrder) {
      throw new Error(woErr?.message || '工單建立失敗');
    }

    // 4. 寫入工單明細（自動觸發庫存扣減 Trigger）
    const formattedItems = items.map((item: any) => ({
      work_order_id: workOrder.id,
      part_id: item.part_id || null,
      item_name: item.item_name,
      type: item.type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price
    }));

    const { error: itemErr } = await supabase
      .from('work_order_items')
      .insert(formattedItems);

    if (itemErr) {
      throw itemErr;
    }

    return NextResponse.json({ success: true, order_number, total_cost });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}