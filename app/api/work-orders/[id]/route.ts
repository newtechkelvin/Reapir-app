import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calculateAvailability } from '@/lib/availability';

// 輔助函數：將空字串 "" 或無效日期字串轉為 null，避免 PostgreSQL 日期型別崩潰
const sanitizeDate = (val: any) => {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return null;
  }
  return val.trim();
};

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

    // 🎯 核心修復：清理所有日期欄位，避免將 "" 傳給 DB date 型別
    if ('completed_date' in orderPayload) {
      orderPayload.completed_date = sanitizeDate(orderPayload.completed_date);
    }
    if ('pickup_return_date' in orderPayload) {
      orderPayload.pickup_return_date = sanitizeDate(orderPayload.pickup_return_date);
    }
    if ('claim_form_date' in orderPayload) {
      orderPayload.claim_form_date = sanitizeDate(orderPayload.claim_form_date);
    }
    if (orderPayload.status === 'Completed' && !orderPayload.completed_date) {
      return NextResponse.json({ error: 'Completed 工單必須填寫完成日期' }, { status: 400 });
    }
    if (orderPayload.completed_date && !orderPayload.status) {
      orderPayload.status = 'Completed';
    }

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
          return NextResponse.json({ error: `更新工單明細失敗: ${itemsError.message}` }, { status: 400 });
        }
      }
    }

    // 工單日期或狀態改變後，立即同步車輛的當期可用率及展延結果。
    if (updatedOrder.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabaseAdmin
        .from('vehicles')
        .select('*, work_orders(*)')
        .eq('id', updatedOrder.vehicle_id)
        .single();
      if (vehicleError) throw vehicleError;
      const calculation = calculateAvailability(vehicle);
      const { error: statsError } = await supabaseAdmin
        .from('vehicles')
        .update({
          total_repair_days: calculation.repairDays,
          availability_percentage: calculation.availability,
          extension_count: Math.floor(calculation.extensionMonths / 6),
          extension_months: calculation.extensionMonths,
          warranty_expiry_date: calculation.finalExpiryDate,
        })
        .eq('id', updatedOrder.vehicle_id);
      if (statsError) throw statsError;
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