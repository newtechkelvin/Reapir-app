import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  try {
    // 1. 撈取所有車輛與歷來工單
    const { data: vehicles, error: vError } = await supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*)');

    if (vError) {
      return NextResponse.json({ error: vError.message }, { status: 400 });
    }

    const updatedRecords = [];

    for (const vehicle of vehicles) {
      const deliveryDateStr = vehicle.delivery_date || vehicle.created_at;
      if (!deliveryDateStr) continue;

      const startDate = new Date(deliveryDateStr);
      let originalEndDate = new Date(startDate);
      const originalYears = vehicle.warranty_period_years || 3;
      originalEndDate.setFullYear(originalEndDate.getFullYear() + originalYears);

      const allOrders = vehicle.work_orders || [];
      
      // 計算總停修天數
      let totalRepairDays = 0;
      const now = new Date();
      allOrders.forEach((wo: any) => {
        const sStr = wo.claim_form_date || wo.created_at;
        if (!sStr) return;
        const s = new Date(sStr);
        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
        const e = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;
        totalRepairDays += Math.max(0, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
      });

      // 計算可用率
      const availability = Math.max(0, parseFloat((100 - (totalRepairDays / 365) * 100).toFixed(2)));

      // 兩階段展延精算
      let extensionCount = 0;
      // 階段 1: 原保固期年度
      for (let yr = 0; yr < originalYears; yr++) {
        if (extensionCount >= 3) break;
        const pStart = new Date(startDate);
        pStart.setFullYear(pStart.getFullYear() + yr);
        const pEnd = new Date(pStart);
        pEnd.setFullYear(pEnd.getFullYear() + 1);

        let rDays = 0;
        allOrders.forEach((wo: any) => {
          const sStr = wo.claim_form_date || wo.created_at;
          if (!sStr) return;
          const s = new Date(sStr);
          const isCompleted = (wo.status || '').toLowerCase() === 'completed';
          const e = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;
          if (s < pEnd && e >= pStart) {
            const overlapStart = new Date(Math.max(s.getTime(), pStart.getTime()));
            const overlapEnd = new Date(Math.min(e.getTime(), pEnd.getTime()));
            rDays += Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          }
        });

        if (rDays > 18.25) extensionCount++;
      }

      // 階段 2: 展延期
      let currentExtStart = new Date(originalEndDate);
      for (let ext = 0; ext < 3; ext++) {
        if (extensionCount <= ext || extensionCount >= 3) break;
        const pStart = new Date(currentExtStart);
        const pEnd = new Date(pStart);
        pEnd.setMonth(pEnd.getMonth() + 6);

        let rDays = 0;
        allOrders.forEach((wo: any) => {
          const sStr = wo.claim_form_date || wo.created_at;
          if (!sStr) return;
          const s = new Date(sStr);
          const isCompleted = (wo.status || '').toLowerCase() === 'completed';
          const e = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;
          if (s < pEnd && e >= pStart) {
            const overlapStart = new Date(Math.max(s.getTime(), pStart.getTime()));
            const overlapEnd = new Date(Math.min(e.getTime(), pEnd.getTime()));
            rDays += Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          }
        });

        if (rDays > 9.125) extensionCount++;
        currentExtStart = pEnd;
      }

      const extensionMonths = extensionCount * 6;
      const finalExpiryDate = new Date(originalEndDate);
      if (extensionMonths > 0) {
        finalExpiryDate.setMonth(finalExpiryDate.getMonth() + extensionMonths);
      }

      // 回寫寫入 Supabase
      await supabaseAdmin
        .from('vehicles')
        .update({
          total_repair_days: totalRepairDays,
          availability_percentage: availability,
          extension_count: extensionCount,
          extension_months: extensionMonths,
          warranty_expiry_date: finalExpiryDate.toISOString().split('T')[0],
        })
        .eq('id', vehicle.id);

      updatedRecords.push({
        plate_number: vehicle.plate_number,
        availability,
        extensionMonths,
        warranty_expiry_date: finalExpiryDate.toISOString().split('T')[0],
      });
    }

    return NextResponse.json({ success: true, count: updatedRecords.length, data: updatedRecords });
  } catch (err: any) {
    console.error('同步車輛統計 API 錯誤:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}