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
    const body = await request.json();
    const { status, completed_date } = body;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: status || 'Completed',
        completed_date: completed_date || new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('更新工單狀態失敗:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('API 錯誤:', err);
    return NextResponse.json({ message: '伺服器內部錯誤' }, { status: 500 });
  }
}