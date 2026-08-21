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
    const { status, completed_date, staff_name, items } = body;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();

    // 1. 更新工單項目 (備註與勾選進度)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await supabase
            .from('work_order_items')
            .update({
              is_completed: !!item.is_completed,
              notes: item.notes || '',
            })
            .eq('id', item.id);
        }
      }
    }

    // 2. 更新工單本體
    const updatePayload: any = { updated_at: now };
    if (status) updatePayload.status = status;
    if (completed_date) updatePayload.completed_date = completed_date;
    if (staff_name) updatePayload.staff_name = staff_name;

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

    return NextResponse.json({ success: true, order: updatedOrder, updated_at: now });
  } catch (err: any) {
    console.error('更新工單 API 錯誤:', err);
    return NextResponse.json({ error: err.message || '更新失敗' }, { status: 500 });
  }
}