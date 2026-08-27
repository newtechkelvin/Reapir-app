import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST: 新增單筆或批次車輛資料
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = Array.isArray(body) ? body : [body];

    const formattedPayload = payload.map((v) => ({
      warranty_type: v.warranty_type || 'government', // government 或 general
      project: v.project?.trim() || null,
      vin: v.vin?.trim() || null,
      plate_number: v.plate_number?.trim().toUpperCase(),
      brand: v.brand?.trim() || null,
      model: v.model?.trim() || null,
      delivery_date: v.delivery_date || null,
      warranty_period_years: v.warranty_period_years ? Number(v.warranty_period_years) : null,
      warranty_expiry_date: v.warranty_expiry_date || null,
      created_at: new Date().toISOString(),
    }));

    // 檢查車牌號碼必填
    if (formattedPayload.some((v) => !v.plate_number)) {
      return NextResponse.json({ error: '車牌號碼為必填欄位' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .insert(formattedPayload)
      .select();

    if (error) {
      console.error('新增車輛資料失敗:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('API POST 錯誤:', err);
    return NextResponse.json({ error: '伺服器內部錯誤' }, { status: 500 });
  }
}