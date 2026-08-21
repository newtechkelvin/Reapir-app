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

    if (vError) console.error('Supabase vehicles 查詢錯誤:', vError.message);

    if (vehicles && vehicles.length > 0) {
      return NextResponse.json({ vehicles });
    }

    // Fallback: 直接從 work_orders 抓取
    const { data: rawOrders } = await supabase
      .from('work_orders')
      .select(`*, work_order_items(*)`)
      .order('created_at', { ascending: false });

    if (rawOrders && rawOrders.length > 0) {
      const vehicleMap: { [key: string]: any } = {};

      rawOrders.forEach((wo: any) => {
        const vId = wo.vehicle_id || wo.plate_number || 'unknown';
        if (!vehicleMap[vId]) {
          vehicleMap[vId] = {
            id: vId,
            plate_number: wo.plate_number || '未設定',
            project: wo.project || '未設定',
            location: wo.location || '未設定',
            delivery_date: null,
            warranty_expiry_date: null,
            workOrders: [],
          };
        }
        vehicleMap[vId].workOrders.push(wo);
      });

      return NextResponse.json({ vehicles: Object.values(vehicleMap) });
    }

    return NextResponse.json({ vehicles: [] });
  } catch (err: any) {
    console.error('API 錯誤:', err);
    return NextResponse.json({ message: '伺服器內部錯誤', vehicles: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plate_number, vin, project, brand, model, location, claim_form_date, description, items } = body;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 檢查或建立/更新車輛位置資訊
    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('plate_number', plate_number)
      .single();

    if (!vehicle) {
      const { data: newV, error: vErr } = await supabase
        .from('vehicles')
        .insert([{ plate_number, vin, project, brand, model, location, claim_form_date }])
        .select()
        .single();

      if (vErr) throw vErr;
      vehicle = newV;
    } else {
      // 填寫新工單時更新車輛的位置與 Claim Form 日期
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

    // 2. 建立新工單 (寫入 location 與 claim_form_date)
    const order_number = `WO-${Date.now().toString().slice(-6)}`;
    const { data: order, error: oErr } = await supabase
      .from('work_orders')
      .insert([{
        vehicle_id: vehicle.id,
        order_number,
        description,
        location,
        claim_form_date,
        status: 'Open',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (oErr) throw oErr;

    // 3. 建立工單項目
    if (items && items.length > 0) {
      const itemsToInsert = items.map((i: any) => ({
        work_order_id: order.id,
        type: i.type,
        item_name: i.item_name
      }));
      await supabase.from('work_order_items').insert(itemsToInsert);
    }

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error('新建工單錯誤:', err);
    return NextResponse.json({ error: err.message || '建立工單失敗' }, { status: 500 });
  }
}