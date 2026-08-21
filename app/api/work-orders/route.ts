import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 取得車輛與工單資料 (GET)
export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定', vehicles: [] }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || searchParams.get('query')?.trim() || '';

    // 1. 優先從 vehicles 資料表做聯表查詢
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

    const { data: vehicles } = await dbQuery;

    // 2. 若找不到，改從 work_orders 表依工單號 (order_number) 搜尋並反查 vehicles
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

// 開立新工單 (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plate_number, vin, project, brand, model, location, claim_form_date, description, items } = body;

    if (!plate_number) {
      return NextResponse.json({ error: '車牌號碼為必填欄位' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 檢查車輛主表，若不存在則建立新車輛，存在則更新位置與 Claim Form 日期
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate_number)
      .maybeSingle();

    if (!vehicle) {
      const { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert([{ plate_number, vin, project, brand, model, location, claim_form_date }])
        .select()
        .single();

      if (vErr) throw vErr;
      vehicle = newV;
    } else {
      const updateData: any = {};
      if (location) updateData.location = location;
      if (claim_form_date) updateData.claim_form_date = claim_form_date;
      if (project) updateData.project = project;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('vehicles')
          .update(updateData)
          .eq('id', vehicle.id);
      }
    }

    // 2. 建立新工單
    const order_number = `WO-${Date.now().toString().slice(-6)}`;
    const orderInsertPayload: any = {
      vehicle_id: vehicle.id,
      order_number,
      description,
      location,
      claim_form_date,
      status: 'Open',
      created_at: new Date().toISOString()
    };

    if (vehicle.plate_number) {
      orderInsertPayload.plate_number = vehicle.plate_number;
    }

    const { data: order, error: oErr } = await supabase
      .from('work_orders')
      .insert([orderInsertPayload])
      .select()
      .single();

    if (oErr) throw oErr;

    // 3. 建立工單內的維修與零件項目
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((i: any) => ({
        work_order_id: order.id,
        type: i.type || '進廠維修',
        item_name: i.item_name,
        is_completed: false,
        notes: ''
      }));
      await supabase.from('work_order_items').insert(itemsToInsert);
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error('新建工單錯誤:', err);
    return NextResponse.json({ error: err.message || '建立工單失敗' }, { status: 500 });
  }
}