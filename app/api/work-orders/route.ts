import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('環境變數缺失：請確認已設定 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('plate');

    if (!query || !query.trim()) {
      return NextResponse.json({ success: false, error: '請輸入搜尋關鍵字' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const keyword = `%${query.trim()}%`;

    const { data: matchedWorkOrders } = await supabase
      .from('work_orders')
      .select('vehicle_id')
      .ilike('order_number', keyword);

    const matchedVehicleIdsFromOrders = matchedWorkOrders?.map(wo => wo.vehicle_id) || [];

    let orCondition = `plate_number.ilike.${keyword},vin.ilike.${keyword},project.ilike.${keyword}`;
    if (matchedVehicleIdsFromOrders.length > 0) {
      orCondition += `,id.in.(${matchedVehicleIdsFromOrders.join(',')})`;
    }

    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('*')
      .or(orCondition)
      .order('created_at', { ascending: false });

    if (vErr) throw vErr;
    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json({ success: true, vehicles: [] });
    }

    const vehicleIds = vehicles.map(v => v.id);
    const { data: workOrders, error: woErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_items (*)
      `)
      .in('vehicle_id', vehicleIds)
      .order('created_at', { ascending: false });

    if (woErr) throw woErr;

    const results = vehicles.map(vehicle => {
      const vWorkOrders = workOrders?.filter(wo => wo.vehicle_id === vehicle.id) || [];
      const lastRepairDate = vWorkOrders.length > 0 ? vWorkOrders[0].created_at : null;
      const allItems = Array.from(
        new Set(vWorkOrders.flatMap(wo => wo.work_order_items?.map((i: any) => i.item_name) || []))
      );

      return {
        ...vehicle,
        last_repair_date: lastRepairDate,
        maintenance_items_summary: allItems,
        workOrders: vWorkOrders
      };
    });

    return NextResponse.json({ success: true, vehicles: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { plate_number, vin, project, brand, model, location, claim_form_date, description, items } = body;

    const formattedPlate = plate_number.trim().toUpperCase();

    let { data: vehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate_number', formattedPlate)
      .maybeSingle();

    if (!vehicle) {
      const { data: newVehicle, error: vErr } = await supabase
        .from('vehicles')
        .insert({
          plate_number: formattedPlate,
          vin: vin || null,
          project: project || null,
          brand: brand || null,
          model: model || null,
          location: location || null,
          claim_form_date: claim_form_date || null
        })
        .select()
        .single();

      if (vErr || !newVehicle) throw new Error(vErr?.message || '車輛建立失敗');
      vehicle = newVehicle;
    } else {
      const updateData: any = {};
      if (vin) updateData.vin = vin;
      if (project) updateData.project = project;
      if (brand) updateData.brand = brand;
      if (model) updateData.model = model;
      if (location) updateData.location = location;
      if (claim_form_date) updateData.claim_form_date = claim_form_date;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('vehicles').update(updateData).eq('id', vehicle.id);
      }
    }

    if (!vehicle) throw new Error('無法取得車輛資料');

    const order_number = `WO-${Date.now().toString().slice(-8)}`;

    const { data: workOrder, error: woErr } = await supabase
      .from('work_orders')
      .insert({
        order_number,
        vehicle_id: vehicle.id,
        project: project || null,
        mileage: 0,
        description,
        total_cost: 0,
        status: 'Open'
      })
      .select()
      .single();

    if (woErr || !workOrder) throw new Error(woErr?.message || '工單建立失敗');

    const formattedItems = items.map((item: any) => ({
      work_order_id: workOrder.id,
      part_id: item.part_id || null,
      item_name: item.item_name,
      type: item.type || 'Labor',
      quantity: 1,
      unit_price: 0,
      subtotal: 0
    }));

    const { error: itemErr } = await supabase.from('work_order_items').insert(formattedItems);
    if (itemErr) throw itemErr;

    return NextResponse.json({ success: true, order_number });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}