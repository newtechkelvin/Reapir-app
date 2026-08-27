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

    // 2. 逐輛車根據專案年期、最新工單與展延上限進行全量審核
    for (const vehicle of vehicles) {
      const deliveryDateStr = vehicle.delivery_date || vehicle.created_at;
      if (!deliveryDateStr) continue;

      const startDate = new Date(deliveryDateStr);
      
      // 🎯 考慮條件 1：讀取專案指定的保固年期 (預設為 3 年，可自訂 1~10 年)
      const projectWarrantyYears = Number(vehicle.warranty_period_years) || 3;
      
      // 推算原始標準保固到期日
      let originalEndDate = new Date(startDate);
      originalEndDate.setFullYear(originalEndDate.getFullYear() + projectWarrantyYears);

      const allOrders = vehicle.work_orders || [];
      
      // 計算總停修天數與當前可用率
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

      // 🎯 考慮條件 2：滾動展延期審查與「上限管控 (Max 3次 / Max 18個月)」
      let currentAssessmentStart = new Date(startDate);
      let extensionCount = 0;

      // 審查階段 1：專案原保固期（依據專案保固年數，每年 365 天，超標 18.25 天 觸發 +6 個月）
      for (let yr = 0; yr < projectWarrantyYears; yr++) {
        if (extensionCount >= 3) break; // 🔒 封頂：最多 3 次展延

        const periodStart = new Date(startDate);
        periodStart.setFullYear(periodStart.getFullYear() + yr);

        const periodEnd = new Date(periodStart);
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);

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

        if (periodRepairDays > 18.25) {
          extensionCount++;
        }
      }

      // 審查階段 2：滾動展延期審查（每期 6 個月/182.5天，超標 9.125 天 觸發下一期）
      let currentExtStart = new Date(originalEndDate);

      for (let ext = 0; ext < 3; ext++) {
        if (extensionCount <= ext || extensionCount >= 3) break; // 🔒 封頂限制

        const periodStart = new Date(currentExtStart);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 6);

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

        if (periodRepairDays > 9.125) {
          extensionCount++;
        }

        currentExtStart = periodEnd;
      }

      // 🔒 硬上限控制：展延次數最多 3 次 (上限 18 個月)
      const finalExtensionCount = Math.min(3, extensionCount);
      const finalExtensionMonths = finalExtensionCount * 6;

      // 最終修正後保固到期日
      const finalExpiryDate = new Date(originalEndDate);
      if (finalExtensionMonths > 0) {
        finalExpiryDate.setMonth(finalExpiryDate.getMonth() + finalExtensionMonths);
      }

      const finalExpiryStr = finalExpiryDate.toISOString().split('T')[0];

      // 3. 寫回 Supabase 資料庫做為權威資料
      const { error: updateErr } = await supabaseAdmin
        .from('vehicles')
        .update({
          warranty_period_years: projectWarrantyYears,
          total_repair_days: totalRepairDays,
          availability_percentage: availability,
          extension_count: finalExtensionCount,
          extension_months: finalExtensionMonths,
          warranty_expiry_date: finalExpiryStr,
        })
        .eq('id', vehicle.id);

      if (!updateErr) {
        updateResults.push({
          plate_number: vehicle.plate_number,
          project: vehicle.project || '預設專案',
          projectWarrantyYears,
          totalRepairDays,
          availability,
          extensionCount: finalExtensionCount,
          extensionMonths: finalExtensionMonths,
          originalEndDate: originalEndDate.toISOString().split('T')[0],
          newWarrantyExpiryDate: finalExpiryStr,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `已精算並更新全庫 ${updateResults.length} 輛車的最終保固到期日 (包含專案年期與上限管制)！`,
      details: updateResults,
    });
  } catch (err: any) {
    console.error('重新精算全庫保固到期日失敗:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}