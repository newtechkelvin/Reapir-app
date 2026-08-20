import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 直接從環境變數初始化 Supabase Client（無需外部 import）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || searchParams.get('query')?.trim() || '';

    // 1. 先嘗試以 vehicles 為主表連表查詢
    let dbQuery = supabase
      .from('vehicles')
      .select(`
        *,
        workOrders:work_orders(
          *,
          work_order_items(*)
        )
      `)
      .order('created_at', { ascending: false });

    // 只有在輸入特定關鍵字時過濾
    if (query && query !== '%') {
      dbQuery = dbQuery.or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`);
    }

    const { data: vehicles, error } = await dbQuery;

    if (error) {
      console.error('Supabase 查詢 vehicles 錯誤:', error);
    }

    if (vehicles && vehicles.length > 0) {
      return NextResponse.json({ vehicles });
    }

    // 2. 備用方案：如果連表沒資料，直接單獨查詢 work_orders 表
    const { data: rawOrders, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_items(*),
        vehicles(*)
      `)
      .order('created_at', { ascending: false });

    if (woError) {
      console.error('Supabase 查詢 work_orders 錯誤:', woError);
      return NextResponse.json({ vehicles: [] });
    }

    if (rawOrders && rawOrders.length > 0) {
      const vehicleMap: Record<string, any> = {};

      rawOrders.forEach((wo: any) => {
        const v = wo.vehicles || {};
        const vId = v.id || wo.vehicle_id || 'unknown';

        if (!vehicleMap[vId]) {
          vehicleMap[vId] = {
            id: vId,
            plate_number: v.plate_number || wo.plate_number || '未設定',
            project: v.project || wo.project || '未設定',
            location: v.location || wo.location || '未設定',
            workOrders: [],
          };
        }
        vehicleMap[vId].workOrders.push(wo);
      });

      return NextResponse.json({ vehicles: Object.values(vehicleMap) });
    }

    return NextResponse.json({ vehicles: [] });
  } catch (err: any) {
    console.error('API 伺服器內部錯誤:', err);
    return NextResponse.json({ message: '伺服器內部錯誤', vehicles: [] }, { status: 500 });
  }
}