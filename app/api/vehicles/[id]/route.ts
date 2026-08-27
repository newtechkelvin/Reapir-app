import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH: 更新特定車輛資訊 (相容 Async Params)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: '未提供車輛 ID' }, { status: 400 });
    }
    const body = await request.json();
    const {
      plate_number,
      vin,
      project,
      brand,
      model,
      warranty_type,
      delivery_date,
      warranty_period_years,
      max_extension_count,
      garage_location,
      vehicle_location,
    } = body;

    const updatePayload: Record<string, unknown> = {};
    if (plate_number !== undefined) {
      const normalizedPlate = String(plate_number).trim().toUpperCase();
      if (!normalizedPlate) {
        return NextResponse.json({ error: '車牌號碼不可為空白' }, { status: 400 });
      }
      updatePayload.plate_number = normalizedPlate;
    }
    if (vin !== undefined) updatePayload.vin = vin;
    if (project !== undefined) updatePayload.project = project;
    if (brand !== undefined) updatePayload.brand = brand;
    if (model !== undefined) updatePayload.model = model;
    if (warranty_type !== undefined) updatePayload.warranty_type = warranty_type;
    if (delivery_date !== undefined) updatePayload.delivery_date = delivery_date;
    if (warranty_period_years !== undefined) {
      const years = Number(warranty_period_years);
      if (!Number.isFinite(years) || years < 0) {
        return NextResponse.json({ error: '保固年限必須是有效的非負數字' }, { status: 400 });
      }
      updatePayload.warranty_period_years = years;
    }
    if (max_extension_count !== undefined) {
      const count = Number(max_extension_count);
      if (!Number.isInteger(count) || count < 0) {
        return NextResponse.json({ error: '延長次數必須是有效的非負整數' }, { status: 400 });
      }
      updatePayload.max_extension_count = count;
    }
    if (garage_location !== undefined) updatePayload.garage_location = garage_location;
    if (vehicle_location !== undefined) updatePayload.vehicle_location = vehicle_location;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: '沒有可更新的車輛資料' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

// DELETE: 刪除特定車輛
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: '未提供車輛 ID' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
