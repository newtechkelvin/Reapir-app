import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '缺少工單 ID' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updatePayload: Record<string, any> = {};
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.garage_location !== undefined) updatePayload.garage_location = body.garage_location;
    if (body.vehicle_location !== undefined) updatePayload.vehicle_location = body.vehicle_location;
    if (body.pickup_return_date !== undefined) updatePayload.pickup_return_date = body.pickup_return_date || null;
    if (body.claim_form_date !== undefined) updatePayload.claim_form_date = body.claim_form_date || null;
    if (body.completed_date !== undefined) updatePayload.completed_date = body.completed_date || null;
    if (body.staff_name !== undefined) updatePayload.staff_name = body.staff_name;
    updatePayload.updated_at = new Date().toISOString();

    // 1. 更新工單主表格
    const { data: orderData, error: orderErr } = await supabase
      .from('work_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    // 2. 如果傳入 items，同步更新/新增維修項目列表
    if (Array.isArray(body.items)) {
      // 先刪除舊項目重新寫入，確保新增與刪除操作 100% 同步
      await supabase.from('work_order_items').delete().eq('work_order_id', id);

      if (body.items.length > 0) {
        const itemsToInsert = body.items.map((item: any) => ({
          work_order_id: id,
          type: item.type || '進廠維修',
          item_name: item.item_name || '',
          is_completed: !!item.is_completed,
          notes: item.notes || '',
        }));

        await supabase.from('work_order_items').insert(itemsToInsert);
      }
    }

    return NextResponse.json({ success: true, order: orderData });
  } catch (err: any) {
    console.error('更新工單失敗:', err);
    return NextResponse.json({ error: err.message || '伺服器內部錯誤' }, { status: 500 });
  }
}