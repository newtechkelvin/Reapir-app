import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: 讀取車輛主表及其工單履歷
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    let builder = supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*, work_order_items(*))')
      .order('created_at', { ascending: false });
    if (query) {
      builder = builder.or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`);
    }
    const { data, error } = await builder;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ vehicles: (data || []).map((vehicle: any) => ({ ...vehicle, workOrders: vehicle.work_orders || [] })) });
  } catch (error: any) {
    console.error('API GET 車輛失敗:', error);
    return NextResponse.json({ error: error.message || '讀取車輛資料失敗' }, { status: 500 });
  }
}

// POST: 新增單筆或批次車輛資料
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = Array.isArray(body) ? body : [body];

    const formattedPayload = payload.map((v) => {
      const warrantyType = String(v.warranty_type || 'government').toLowerCase() === 'general' ? 'general' : 'government';
      const maintenanceStartDate = v.maintenance_start_date || (warrantyType === 'general' ? v.delivery_date || null : null);
      let maintenanceExpiryDate = v.maintenance_expiry_date || (warrantyType === 'general' ? v.warranty_expiry_date || null : null);
      if (warrantyType === 'general' && !maintenanceExpiryDate && maintenanceStartDate) {
        const date = new Date(`${maintenanceStartDate}T00:00:00Z`);
        date.setUTCFullYear(date.getUTCFullYear() + 1);
        maintenanceExpiryDate = date.toISOString().slice(0, 10);
      }
      return {
      warranty_type: warrantyType,
      project: v.project?.trim() || null,
      vin: v.vin?.trim() || null,
      plate_number: v.plate_number?.trim().toUpperCase(),
      brand: v.brand?.trim() || null,
      model: v.model?.trim() || null,
      delivery_date: v.delivery_date || null,
      warranty_period_years: v.warranty_period_years ? Number(v.warranty_period_years) : 3,
      max_extension_count: v.max_extension_count !== undefined ? Number(v.max_extension_count) : 3,
      max_extension_months: v.max_extension_months !== undefined ? Number(v.max_extension_months) : 18,
      warranty_expiry_date: warrantyType === 'general' ? maintenanceExpiryDate : (v.warranty_expiry_date || null),
      maintenance_start_date: maintenanceStartDate,
      maintenance_expiry_date: maintenanceExpiryDate,
      maintenance_period_source: warrantyType === 'general' ? (v.maintenance_start_date ? 'manual' : 'default_1_year') : null,
      created_at: new Date().toISOString(),
      };
    });

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