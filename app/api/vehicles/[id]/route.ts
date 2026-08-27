import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH: 更新特定車輛資訊 (包含保固年期與展延上限)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const updatePayload: any = {};
    if (plate_number !== undefined) updatePayload.plate_number = plate_number.toUpperCase();
    if (vin !== undefined) updatePayload.vin = vin;
    if (project !== undefined) updatePayload.project = project;
    if (brand !== undefined) updatePayload.brand = brand;
    if (model !== undefined) updatePayload.model = model;
    if (warranty_type !== undefined) updatePayload.warranty_type = warranty_type;
    if (delivery_date !== undefined) updatePayload.delivery_date = delivery_date;
    if (warranty_period_years !== undefined) updatePayload.warranty_period_years = Number(warranty_period_years);
    if (max_extension_count !== undefined) updatePayload.max_extension_count = Number(max_extension_count);
    if (garage_location !== undefined) updatePayload.garage_location = garage_location;
    if (vehicle_location !== undefined) updatePayload.vehicle_location = vehicle_location;

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .update(updatePayload)
      .eq('id', params.id)
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
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('vehicles')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
