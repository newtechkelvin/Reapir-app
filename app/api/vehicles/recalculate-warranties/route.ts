import { NextRequest, NextResponse } from 'next/server';
import { calculateAvailability } from '@/lib/availability';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(_request: NextRequest) {
  try {
    const { data: vehicles, error } = await supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*)');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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

    return NextResponse.json({ success: true, count: updateResults.length, data: updateResults });
  } catch (error: any) {
    console.error('重新精算全庫保固到期日失敗:', error);
    return NextResponse.json({ error: error.message || '重新精算失敗' }, { status: 500 });
  }
}
