import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定', vehicles: [] }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || searchParams.get('query')?.trim() || '';

    // 1. 優先從 vehicles 資料表做聯表查詢 (包含車牌、VIN、專案、工單號)
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

    if (query && query !== '%') {
      dbQuery = dbQuery.or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`);
    }

    const { data: vehicles, error: vError } = await dbQuery;

    // 2. 如果透過 vehicles 表找不到，改從 work_orders 表依工單號 (order_number) 搜尋並反查 vehicles
    if (query && query !== '%' && (!vehicles || vehicles.length === 0)) {
      const { data: matchedOrders } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicles(*),
          work_order_items(*)
        `)
        .ilike('order_number', `%${query}%`);

      if (matchedOrders && matchedOrders.length > 0) {
        const vehicleMap: { [key: string]: any } = {};

        matchedOrders.forEach((wo: any) => {
          const v = wo.vehicles || {};
          const vKey = v.id || wo.vehicle_id || wo.plate_number || 'unknown';

          if (!vehicleMap[vKey]) {
            vehicleMap[vKey] = {
              id: v.id || vKey,
              plate_number: v.plate_number || wo.plate_number || '未設定',
              vin: v.vin || wo.vin || '無',
              project: v.project || wo.project || '未設定',
              location: v.location || wo.location || '未設定',
              claim_form_date: v.claim_form_date || wo.claim_form_date || null,
              delivery_date: v.delivery_date || null,
              warranty_expiry_date: v.warranty_expiry_date || null,
              workOrders: [],
            };
          }
          vehicleMap[vKey].workOrders.push(wo);
        });

        return NextResponse.json({ vehicles: Object.values(vehicleMap) });
      }
    }

    if (vehicles && vehicles.length > 0) {
      return NextResponse.json({ vehicles });
    }

    return NextResponse.json({ vehicles: [] });
  } catch (err: any) {
    console.error('API 錯誤:', err);
    return NextResponse.json({ message: '伺服器內部錯誤', vehicles: [] }, { status: 500 });
  }
}