import { NextResponse } from 'next/server';
import { calculateAvailability } from '@/lib/availability';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  try {
    const { data: vehicles, error } = await supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*)');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const updatedRecords = [];
    for (const vehicle of vehicles || []) {
      const calculation = calculateAvailability(vehicle);
      const { error: updateError } = await supabaseAdmin
        .from('vehicles')
        .update({
          total_repair_days: calculation.repairDays,
          availability_percentage: calculation.availability,
          extension_count: Math.floor(calculation.extensionMonths / 6),
          extension_months: calculation.extensionMonths,
          warranty_expiry_date: calculation.finalExpiryDate,
        })
        .eq('id', vehicle.id);
      if (updateError) throw updateError;

      updatedRecords.push({
        plate_number: vehicle.plate_number,
        availability: calculation.availability,
        repairDays: calculation.repairDays,
        extensionMonths: calculation.extensionMonths,
        warranty_expiry_date: calculation.finalExpiryDate,
      });
    }

    return NextResponse.json({ success: true, count: updatedRecords.length, data: updatedRecords });
  } catch (error: any) {
    console.error('同步車輛統計 API 錯誤:', error);
    return NextResponse.json({ error: error.message || '同步統計失敗' }, { status: 500 });
  }
}
