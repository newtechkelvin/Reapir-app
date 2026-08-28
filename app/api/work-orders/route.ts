import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ORDER_NUMBER_PATTERN = /^NTL-WO-(\d{6})$/i;

type Vehicle = Record<string, any>;

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizePlate(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeVin(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeWarrantyType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'general' || normalized === '散車' || normalized === '散車保固'
    ? 'General'
    : 'Government';
}

async function getNextOrderNumber(supabase: any) {
  const { data, error } = await supabase.from('work_orders').select('order_number');
  if (error) throw error;

  let max = 0;
  for (const row of (data || []) as Array<{ order_number?: string | null }>) {
    const match = normalizeText(row.order_number).match(ORDER_NUMBER_PATTERN);
    if (match) max = Math.max(max, Number(match[1]));
  }
  if (max >= 999999) throw new Error('工單編號已達六位數上限');
  return `NTL-WO-${String(max + 1).padStart(6, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    let vehiclesData: any[] = [];

    if (!query) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, work_orders(*, work_order_items(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      vehiclesData = data || [];
    } else {
      const { data: vData, error: vErr } = await supabase
        .from('vehicles')
        .select('*, work_orders(*, work_order_items(*))')
        .or(`plate_number.ilike.%${query}%,vin.ilike.%${query}%,project.ilike.%${query}%,brand.ilike.%${query}%,model.ilike.%${query}%`)
        .order('created_at', { ascending: false });
      if (vErr) console.warn('車輛關聯搜尋警告:', vErr.message);

      const { data: woData, error: woErr } = await supabase
        .from('work_orders')
        .select('vehicle_id')
        .or(`order_number.ilike.%${query}%,plate_number.ilike.%${query}%`);
      if (woErr) console.warn('工單號碼搜尋警告:', woErr.message);

      const vehicleIdsFromWo = (woData || []).map((w: any) => w.vehicle_id).filter(Boolean);
      if (vehicleIdsFromWo.length > 0) {
        const { data: vMatched, error: vmErr } = await supabase
          .from('vehicles')
          .select('*, work_orders(*, work_order_items(*))')
          .in('id', vehicleIdsFromWo);
        if (!vmErr && vMatched) {
          const combinedMap = new Map();
          (vData || []).forEach((v: any) => combinedMap.set(v.id, v));
          (vMatched || []).forEach((v: any) => combinedMap.set(v.id, v));
          vehiclesData = Array.from(combinedMap.values());
        } else {
          vehiclesData = vData || [];
        }
      } else {
        vehiclesData = vData || [];
      }
    }

    return NextResponse.json({
      vehicles: vehiclesData.map((v: any) => ({ ...v, workOrders: v.work_orders || [] })),
    });
  } catch (err: any) {
    console.error('API GET 錯誤:', err);
    return NextResponse.json({ error: err.message || '伺服器內部錯誤' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const plateNumber = normalizePlate(body.plate_number);
    const vin = normalizeVin(body.vin);
    const project = normalizeText(body.project);
    const brand = normalizeText(body.brand);
    const model = normalizeText(body.model);
    const warrantyType = normalizeWarrantyType(body.warranty_type);
    const requestedOrderNumber = normalizeText(body.order_number).toUpperCase();

    if (!plateNumber) return NextResponse.json({ error: '請輸入車牌號碼' }, { status: 400 });
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
      return NextResponse.json({ error: 'VIN 必須為 17 位有效字元' }, { status: 400 });
    }
    if (requestedOrderNumber && !ORDER_NUMBER_PATTERN.test(requestedOrderNumber)) {
      return NextResponse.json({ error: '工單編號格式必須為 NTL-WO- 加 6 位數字' }, { status: 400 });
    }
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const [{ data: plateVehicle, error: plateError }, { data: vinVehicle, error: vinError }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('plate_number', plateNumber).maybeSingle(),
      vin ? supabase.from('vehicles').select('*').eq('vin', vin).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (plateError) throw plateError;
    if (vinError) throw vinError;

    if (plateVehicle && vinVehicle && plateVehicle.id !== vinVehicle.id) {
      return NextResponse.json({ error: '車牌與 VIN 分別匹配到不同車輛，請先人工選擇或整理車輛資料' }, { status: 409 });
    }
    if (plateVehicle && vin && normalizeVin(plateVehicle.vin) && normalizeVin(plateVehicle.vin) !== vin) {
      return NextResponse.json({ error: '輸入的 VIN 與此車牌現有資料不一致，請先人工確認' }, { status: 409 });
    }

    let vehicle: Vehicle = plateVehicle || vinVehicle;
    if (!vehicle) {
      const insertPayload: Vehicle = {
        plate_number: plateNumber,
        vin,
        project: project || (warrantyType === 'General' ? '散車保固' : ''),
        brand,
        model,
        garage_location: normalizeText(body.location) || '機電 - 九龍灣1/F',
        vehicle_location: warrantyType === 'General' ? normalizeText(body.location) : '',
        claim_form_date: body.claim_form_date || null,
        pickup_return_date: body.pickup_return_date || null,
        warranty_type: warrantyType,
      };
      let insertResult = await supabase.from('vehicles').insert([insertPayload]).select().single();
      if (insertResult.error?.message?.includes('warranty_type')) {
        delete insertPayload.warranty_type;
        insertResult = await supabase.from('vehicles').insert([insertPayload]).select().single();
      }
      if (insertResult.error) {
        return NextResponse.json({ error: `建立車輛資料失敗: ${insertResult.error.message}` }, { status: 500 });
      }
      vehicle = insertResult.data;
    } else {
      const updateData: Vehicle = { warranty_type: warrantyType };
      if (vin && !normalizeVin(vehicle.vin)) updateData.vin = vin;
      if (plateNumber !== normalizePlate(vehicle.plate_number)) updateData.plate_number = plateNumber;
      if (brand) updateData.brand = brand;
      if (model) updateData.model = model;
      if (project) updateData.project = project;
      const { error } = await supabase.from('vehicles').update(updateData).eq('id', vehicle.id);
      if (error) return NextResponse.json({ error: `更新車輛資料失敗: ${error.message}` }, { status: 500 });
      vehicle = { ...vehicle, ...updateData };
    }

    const orderNumber = requestedOrderNumber || await getNextOrderNumber(supabase);
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('work_orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (existingOrderError) throw existingOrderError;
    if (existingOrder) return NextResponse.json({ error: `工單編號 ${orderNumber} 已存在，請重新取得編號` }, { status: 409 });

    const orderPayload: Vehicle = {
      vehicle_id: vehicle.id,
      plate_number: vehicle.plate_number || plateNumber,
      order_number: orderNumber,
      description: normalizeText(body.description),
      garage_location: warrantyType === 'General' ? '' : (normalizeText(body.location) || vehicle.garage_location || '機電 - 九龍灣1/F'),
      vehicle_location: warrantyType === 'General' ? normalizeText(body.location) : '',
      claim_form_date: body.claim_form_date || null,
      pickup_return_date: body.pickup_return_date || null,
      status: 'Open',
      warranty_type: warrantyType,
    };

    let orderResult = await supabase.from('work_orders').insert([orderPayload]).select().single();
    if (orderResult.error?.message?.includes('warranty_type')) {
      delete orderPayload.warranty_type;
      orderResult = await supabase.from('work_orders').insert([orderPayload]).select().single();
    }
    if (orderResult.error) {
      return NextResponse.json({ error: `建立工單失敗: ${orderResult.error.message}` }, { status: 500 });
    }

    const itemsToInsert = Array.isArray(body.items)
      ? body.items.map((item: any) => ({
          work_order_id: orderResult.data.id,
          type: normalizeText(item.type) || '進廠維修',
          item_name: normalizeText(item.item_name),
          notes: normalizeText(item.notes) || null,
          is_completed: false,
        })).filter((item: any) => item.item_name)
      : [];
    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('work_order_items').insert(itemsToInsert);
      if (error) return NextResponse.json({ error: `建立工單項目失敗: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: { ...orderResult.data, order_number: orderNumber } });
  } catch (err: any) {
    console.error('建立工單失敗:', err);
    return NextResponse.json({ error: err.message || '建立工單失敗' }, { status: 500 });
  }
}
