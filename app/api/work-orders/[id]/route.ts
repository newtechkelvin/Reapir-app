import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// -------------------------------------------------------------
// GET: 讀取單張工單詳細資料
// -------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: '未提供工單 ID' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('work_orders')
      .select('*, work_order_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('API GET 錯誤:', err);
    return NextResponse.json({ error: '伺服器內部錯誤' }, { status: 500 });
  }
}

// -------------------------------------------------------------
// PATCH: 更新工單內容、關聯項目或進行結案 (Completed)
// -------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: '未提供工單 ID' }, { status: 400 });
    }

    // 分離 items 與主工單欄位
    const { items, ...orderPayload } = body;

    // 1. 更新主工單資料
    const { data: updatedOrder, error: orderError } = await supabaseAdmin
      .from('work_orders')
      .update({
        ...orderPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (orderError) {
      console.error('更新工單主表失敗:', orderError);
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    // 2. 若有傳入 items，進行維修項目同步 (刪除舊的，重新寫入)
    if (Array.isArray(items)) {
      await supabaseAdmin
        .from('work_order_items')
        .delete()
        .eq('work_order_id', id);

      if (items.length > 0) {
        const formattedItems = items.map((it: any) => ({
          work_order_id: id,
          type: it.type || '進廠維修',
          item_name: it.item_name || '',
          is_completed: !!it.is_completed,
          notes: it.notes || '',
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('work_order_items')
          .insert(formattedItems);

        if (itemsError) {
          console.error('更新工單明細失敗:', itemsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '工單更新成功',
      data: updatedOrder,
    });
  } catch (err) {
    console.error('API PATCH 錯誤:', err);
    return NextResponse.json({ error: '伺服器內部錯誤' }, { status: 500 });
  }
}

// -------------------------------------------------------------
// DELETE: 安全刪除工單 (高風險操作，自動 Bypass RLS)
// -------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: '未提供工單 ID' }, { status: 400 });
    }

    // 1. 先刪除關聯的維修明細項目 (work_order_items)
    await supabaseAdmin
      .from('work_order_items')
      .delete()
      .eq('work_order_id', id);

    // 2. 刪除主工單紀錄 (work_orders)
    const { error } = await supabaseAdmin
      .from('work_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('刪除工單失敗:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '工單已成功刪除' });
  } catch (err) {
    console.error('API DELETE 錯誤:', err);
    return NextResponse.json({ error: '伺服器內部錯誤' }, { status: 500 });
  }
}