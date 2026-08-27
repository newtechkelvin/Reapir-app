import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    // 1. 撈取全庫所有車輛及其對應的所有工單紀錄
    const { data: vehicles, error: vError } = await supabaseAdmin
      .from('vehicles')
      .select('*, work_orders(*)');

    if (vError) {
      return NextResponse.json({ error: vError.message }, { status: 400 });
    }

    const updateResults = [];
    const now = new Date();

    // 2. 逐輛車根據最新工單進行全量審核
    for (const vehicle of vehicles) {
      const deliveryDateStr = vehicle.delivery_date || vehicle.created_at;
      if (!deliveryDateStr) continue;

      const startDate = new Date(deliveryDateStr);
      const originalYears = vehicle.warranty_period_years || 3;
      
      let originalEndDate = new Date(startDate);
      originalEndDate.setFullYear(originalEndDate.getFullYear() + originalYears);

      const allOrders = vehicle.work_orders || [];
      
      // 計算總停修天數與可用率
      let totalRepairDays = 0;
      allOrders.forEach((wo: any) => {
        const sStr = wo.claim_form_date || wo.created_at;
        if (!sStr) return;

        const oStart = new Date(sStr);
        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
        const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;

        const diffDays = Math.max(0, Math.ceil((oEnd.getTime() - oStart.getTime()) / (1000 * 60 * 60 * 24)));
        totalRepairDays += diffDays;
      });

      const availability = Math.max(0, parseFloat((100 - (totalRepairDays / 365) * 100).toFixed(2)));

      // 動態滾動展延期精算法 (最多 3 次，上限 +18 個月)
      let currentAssessmentStart = new Date(startDate);
      let totalExtensionMonths = 0;
      let extensionCount = 0;

      for (let period = 1; period <= 10; period++) { // 設定足夠迴圈涵蓋所有歷史展延期
        if (extensionCount >= 3) break;

        const isExtensionPeriod = extensionCount > 0 || period > originalYears;
        const periodStart = new Date(currentAssessmentStart);
        const periodEnd = new Date(periodStart);

        if (isExtensionPeriod) {
          periodEnd.setMonth(periodEnd.getMonth() + 6);
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        }

        const thresholdDays = isExtensionPeriod ? 9.125 : 18.25;

        let periodRepairDays = 0;
        allOrders.forEach((wo: any) => {
          const sStr = wo.claim_form_date || wo.created_at;
          if (!sStr) return;

          const oStart = new Date(sStr);
          const isCompleted = (wo.status || '').toLowerCase() === 'completed';
          const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;

          if (oStart < periodEnd && oEnd >= periodStart) {
            const overlapStart = new Date(Math.max(oStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(oEnd.getTime(), periodEnd.getTime()));
            const diffDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
            periodRepairDays += diffDays;
          }
        });

        if (periodRepairDays > thresholdDays) {
          extensionCount++;
          totalExtensionMonths += 6;
        }

        currentAssessmentStart = periodEnd;
      }

      // 推算修正後保固到期日
      const finalExpiryDate = new Date(originalEndDate);
      if (totalExtensionMonths > 0) {
        finalExpiryDate.setMonth(finalExpiryDate.getMonth() + totalExtensionMonths);
      }

      const finalExpiryStr = finalExpiryDate.toISOString().split('T')[0];

      // 3. 寫回 Supabase 資料庫做為權威資料
      const { error: updateErr } = await supabaseAdmin
        .from('vehicles')
        .update({
          total_repair_days: totalRepairDays,
          availability_percentage: availability,
          extension_count: extensionCount,
          extension_months: totalExtensionMonths,
          warranty_expiry_date: finalExpiryStr,
        })
        .eq('id', vehicle.id);

      if (!updateErr) {
        updateResults.push({
          plate_number: vehicle.plate_number,
          totalRepairDays,
          availability,
          extensionMonths: totalExtensionMonths,
          newWarrantyExpiryDate: finalExpiryStr,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `已成功重新審核並更新全庫 ${updateResults.length} 輛車的最終保固到期日！`,
      details: updateResults,
    });
  } catch (err: any) {
    console.error('重新精算全庫保固到期日失敗:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
