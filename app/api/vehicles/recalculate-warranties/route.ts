import { NextRequest, NextResponse } from 'next/server';
import { calculateAvailability } from '@/lib/availability';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedIds = Array.isArray(body?.vehicle_ids)
      ? body.vehicle_ids.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];
    const requestedPlates = Array.isArray(body?.plate_numbers)
      ? body.plate_numbers.map((plate: unknown) => String(plate).trim().toUpperCase()).filter(Boolean)
      : [];

    const { data: allVehicles, error } = await supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*)');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const vehicles = (allVehicles || []).filter((vehicle: any) => {
      if (requestedIds.length === 0 && requestedPlates.length === 0) return true;
      return requestedIds.includes(String(vehicle.id)) || requestedPlates.includes(String(vehicle.plate_number || '').trim().toUpperCase());
    });
    if ((requestedIds.length > 0 || requestedPlates.length > 0) && vehicles.length === 0) {
      return NextResponse.json({ error: '找不到指定的車輛' }, { status: 404 });
    }

    const updateResults = [];
    for (const vehicle of vehicles || []) {
      const calculation = calculateAvailability(vehicle);
      const updatePayload = {
        total_repair_days: calculation.repairDays,
        availability_percentage: calculation.availability,
        extension_count: Math.floor(calculation.extensionMonths / 6),
        extension_months: calculation.extensionMonths,
        warranty_expiry_date: calculation.finalExpiryDate,
      };
      const { error: updateError } = await supabaseAdmin
        .from('vehicles')
        .update(updatePayload)
        .eq('id', vehicle.id);
      if (updateError) throw updateError;

      updateResults.push({
        plate_number: vehicle.plate_number,
        project: vehicle.project || '未設定專案',
        availability: calculation.availability,
        repairDays: calculation.repairDays,
        extensionMonths: calculation.extensionMonths,
        originalExpiryDate: calculation.originalExpiryDate,
        finalExpiryDate: calculation.finalExpiryDate,
      });
    }

    return NextResponse.json({
      success: true,
      scope: requestedIds.length > 0 || requestedPlates.length > 0 ? 'selected' : 'all',
      count: updateResults.length,
      data: updateResults,
    });
  } catch (error: any) {
    console.error('重新精算全庫保固到期日失敗:', error);
    return NextResponse.json({ error: error.message || '重新精算失敗' }, { status: 500 });
  }
}
