import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: '缺少工單 ID' }, { status: 400 });

    const body = await request.json();
    const { 
      status, 
      completed_date, 
      staff_name, 
      garage_location, 
      vehicle_location, 
      pickup_return_date, 
      claim_form_date,
      items 
    } = body;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();

    // 1. 更新工單項目 (包含 type, notes, is_completed)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await supabase
            .from('work_order_items')
            .update({
              type: item.type || '進廠維修',
              is_completed: !!item.is_completed,
              notes: item.notes || '',
            })
            .eq('id', item.id);
        }
      }
    }

    // 2. 更新工單本體與關聯車輛欄位
    const updatePayload: any = { updated_at: now };
    if (status !== undefined) updatePayload.status = status;
    if (completed_date !== undefined) updatePayload.completed_date = completed_date;
    if (staff_name !== undefined) updatePayload.staff_name = staff_name;
    if (garage_location !== undefined) updatePayload.garage_location = garage_location;
    if (vehicle_location !== undefined) updatePayload.vehicle_location = vehicle_location;
    if (pickup_return_date !== undefined) updatePayload.pickup_return_date = pickup_return_date;
    if (claim_form_date !== undefined) updatePayload.claim_form_date = claim_form_date;

    const { data: updatedOrder, error } = await supabase
      .from('work_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase 更新工單失敗:', error.message);
      throw new Error(error.message);
    }

    // 3. 同步更新至 vehicles 表格
    if (updatedOrder && updatedOrder.vehicle_id) {
      const vUpdatePayload: any = {};
      if (garage_location !== undefined) vUpdatePayload.garage_location = garage_location;
      if (vehicle_location !== undefined) vUpdatePayload.vehicle_location = vehicle_location;
      if (pickup_return_date !== undefined) vUpdatePayload.pickup_return_date = pickup_return_date;
      if (claim_form_date !== undefined) vUpdatePayload.claim_form_date = claim_form_date;

      if (Object.keys(vUpdatePayload).length > 0) {
        await supabase
          .from('vehicles')
          .update(vUpdatePayload)
          .eq('id', updatedOrder.vehicle_id);
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder, updated_at: now });
  } catch (err: any) {
    console.error('更新工單 API 錯誤:', err);
    return NextResponse.json({ error: err.message || '更新失敗' }, { status: 500 });
  }
}