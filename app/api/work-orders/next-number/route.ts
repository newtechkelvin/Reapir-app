import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ORDER_NUMBER_PATTERN = /^NTL-WO-(\d{6})$/i;

function getNextNumber(orderNumbers: Array<{ order_number: string | null }>) {
  let max = 0;
  for (const row of orderNumbers as Array<{ order_number?: string | null }>) {
    const match = String(row.order_number || '').trim().match(ORDER_NUMBER_PATTERN);
    if (match) max = Math.max(max, Number(match[1]));
  }
  if (max >= 999999) throw new Error('工單編號已達六位數上限');
  return `NTL-WO-${String(max + 1).padStart(6, '0')}`;
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('work_orders').select('order_number');
    if (error) throw error;

    return NextResponse.json({ order_number: getNextNumber(data || []) });
  } catch (error: any) {
    console.error('取得下一個工單編號失敗:', error);
    return NextResponse.json({ error: error.message || '無法取得工單編號' }, { status: 500 });
  }
}
