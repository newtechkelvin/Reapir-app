'use client';

import React, { useState } from 'react';

export interface WorkOrdersSummaryProps {
  vehicles?: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function WorkOrdersSummary({
  vehicles = [],
  isLoading = false,
  onRefresh = () => {},
}: WorkOrdersSummaryProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 計算車輛停修天數、可用率與即時權威保固展延精算
  const getVehicleStats = (vehicle: any) => {
    const orders = vehicle.workOrders || vehicle.work_orders || [];
    let totalOpenDays = 0;
    let openCount = 0;
    const openOrders: any[] = [];

    const now = new Date();

    orders.forEach((wo: any) => {
      const isCompleted = (wo.status || '').toLowerCase() === 'completed';

      if (!isCompleted) {
        openCount++;
        const sStr = wo.claim_form_date || wo.created_at;
        let days = 0;
        if (sStr) {
          const start = new Date(sStr);
          const diffTime = Math.max(0, now.getTime() - start.getTime());
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalOpenDays += days;
        }
        openOrders.push({
          ...wo,
          openDays: days,
        });
      } else {
        if (wo.claim_form_date && wo.completed_date) {
          const s = new Date(wo.claim_form_date);
          const e = new Date(wo.completed_date);
          const diffTime = Math.max(0, e.getTime() - s.getTime());
          totalOpenDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
    });

    const availability = Math.max(
      0,
      parseFloat((100 - (totalOpenDays / 365) * 100).toFixed(2))
    );

    // 🎯 權威展延邏輯精算 (確保 AM7633 顯示 +18 個月 / 2027-01-28)
    const deliveryDateStr = vehicle.delivery_date || vehicle.created_at;
    const projectWarrantyYears = Number(vehicle.warranty_period_years) || 3;
    const maxExtCount = vehicle.max_extension_count !== undefined && vehicle.max_extension_count !== null 
      ? Number(vehicle.max_extension_count) 
      : 3;

    let origExpiryStr = '未設定';
    let finalExpiryStr = '未設定';
    let extensionMonths = 0;

    if (deliveryDateStr) {
      const startDate = new Date(deliveryDateStr);
      const originalEndDate = new Date(startDate);
      originalEndDate.setFullYear(originalEndDate.getFullYear() + projectWarrantyYears);
      origExpiryStr = originalEndDate.toISOString().split('T')[0];

      let extensionCount = 0;

      for (let yr = 0; yr < projectWarrantyYears; yr++) {
        if (extensionCount >= maxExtCount) break;

        const periodStart = new Date(startDate);
        periodStart.setFullYear(periodStart.getFullYear() + yr);
        const periodEnd = new Date(periodStart);
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        let periodRepairDays = 0;
        orders.forEach((wo: any) => {
          const sStr = wo.claim_form_date || wo.created_at;
          if (!sStr) return;
          const oStart = new Date(sStr);
          const isCompleted = (wo.status || '').toLowerCase() === 'completed';
          const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;

          if (oStart < periodEnd && oEnd >= periodStart) {
            const overlapStart = new Date(Math.max(oStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(oEnd.getTime(), periodEnd.getTime()));
            periodRepairDays += Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          }
        });

        if (periodRepairDays > 18.25) extensionCount++;
      }

      let currentExtStart = new Date(originalEndDate);
      for (let ext = 0; ext < maxExtCount; ext++) {
        if (extensionCount <= ext || extensionCount >= maxExtCount) break;

        const periodStart = new Date(currentExtStart);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 6);

        let periodRepairDays = 0;
        orders.forEach((wo: any) => {
          const sStr = wo.claim_form_date || wo.created_at;
          if (!sStr) return;
          const oStart = new Date(sStr);
          const isCompleted = (wo.status || '').toLowerCase() === 'completed';
          const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : now;

          if (oStart < periodEnd && oEnd >= periodStart) {
            const overlapStart = new Date(Math.max(oStart.getTime(), periodStart.getTime()));
            const overlapEnd = new Date(Math.min(oEnd.getTime(), periodEnd.getTime()));
            periodRepairDays += Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          }
        });

        if (periodRepairDays > 9.125) extensionCount++;
        currentExtStart = periodEnd;
      }

      extensionMonths = extensionCount * 6;
      const finalExpiryDate = new Date(originalEndDate);
      if (extensionMonths > 0) {
        finalExpiryDate.setMonth(finalExpiryDate.getMonth() + extensionMonths);
      }
      finalExpiryStr = finalExpiryDate.toISOString().split('T')[0];
    }

    return {
      totalOpenDays,
      availability,
      orderCount: orders.length,
      openCount,
      openOrders,
      origExpiryStr,
      finalExpiryStr,
      extensionMonths,
    };
  };

  // 過濾政府車輛
  const governmentVehicles = (vehicles || []).filter(
    (v) => (v.warranty_type || 'government').toLowerCase() === 'government'
  );

  // 對數報表（< 95%）
  const lowAvailabilityVehicles = governmentVehicles
    .map((v) => ({ ...v, stats: getVehicleStats(v) }))
    .filter((v) => v.stats.availability < 95)
    .sort((a, b) => b.stats.totalOpenDays - a.stats.totalOpenDays);

  // 搜尋過濾
  const filteredVehicles = governmentVehicles.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.plate_number?.toLowerCase().includes(term) ||
      v.project?.toLowerCase().includes(term) ||
      v.brand?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-black">
      {/* 搜尋與頂部工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋車牌、專案、品牌..."
            className="w-full p-2.5 border rounded-xl text-sm font-semibold bg-white text-black focus:ring-2 focus:ring-blue-500 border-slate-300"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            📋 保固展延對數報表 (可用率 &lt; 95%)
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl shadow-xs cursor-pointer border border-slate-300 whitespace-nowrap"
          >
            🔄 重新整理
          </button>
        </div>
      </div>

      {/* 🖼️ 原汁原味 3 欄式卡片列表 (完全還原截圖) */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">
          ⏳ 正在載入車輛工單資料...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500">
          <p className="text-base font-bold">沒有對應的政府車輛資料</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredVehicles.map((vehicle, idx) => {
            const stats = getVehicleStats(vehicle);

            // 邊框狀態判斷 (嚴格按照截圖)
            const isCritical = stats.availability < 95;
            const isWarning = stats.availability >= 95 && stats.availability <= 96;

            let cardBorderClass = 'border-slate-200';
            if (isCritical) cardBorderClass = 'border-red-300 ring-1 ring-red-300';
            if (isWarning) cardBorderClass = 'border-amber-400 ring-2 ring-amber-400';

            return (
              <div
                key={vehicle.id || idx}
                className={`bg-white border-2 rounded-2xl p-5 shadow-2xs space-y-4 hover:shadow-md transition-all ${cardBorderClass}`}
              >
                {/* 1. 車牌與類別標籤 */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      🚘 {vehicle.plate_number}
                    </h3>
                    <span className="text-[11px] text-gray-400 block mt-0.5 font-medium">
                      VIN: {vehicle.vin || '未設定'}
                    </span>
                  </div>

                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                    🏛️ 政府合約
                  </span>
                </div>

                <hr className="border-slate-100" />

                {/* 2. 停修天數與可用率 (雙圓角方框) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <span className="text-[11px] text-gray-400 font-bold block">累積停修總天數</span>
                    <strong className="text-xl font-black text-red-600 block mt-1">
                      {stats.totalOpenDays} 天
                    </strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl relative">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] text-gray-400 font-bold block">Availability (可用率)</span>
                      {isWarning && (
                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black">
                          ⚠️ 接近 95%
                        </span>
                      )}
                    </div>
                    <strong className={`text-xl font-black block mt-1 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                      {stats.availability}%
                    </strong>
                  </div>
                </div>

                {/* 3. 專案名稱與 Open 工單數 */}
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-800 font-extrabold truncate max-w-[200px]" title={vehicle.project}>
                    專案 : {vehicle.project || '預設專案'}
                  </span>
                  <span className="text-slate-700 font-bold">
                    Open 工單數 : <strong className="text-red-600">{stats.openCount} 張</strong>
                  </span>
                </div>

                <hr className="border-slate-100" />

                {/* 4. Open 工單清單區塊 */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs text-slate-800 font-bold block">Open 工單清單:</span>

                  {stats.openOrders.length === 0 ? (
                    <div className="text-xs text-gray-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center font-medium">
                      目前無進行中的工單
                    </div>
                  ) : (
                    stats.openOrders.map((wo, wIdx) => (
                      <div
                        key={wo.id || wIdx}
                        className="bg-blue-50/50 border border-blue-100 p-2.5 rounded-xl flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-900">{wo.work_order_number || wo.id || `WO-${wIdx + 1}`}</span>
                          <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                            Open ({wo.openDays}天)
                          </span>
                        </div>

                        <span className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                          檢視明細 &rarr;
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📋 保固展延對數報表 Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 text-center tracking-wide">
                  新力機械有限公司
                </h2>
                <p className="text-xs text-center text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                  NEW TECH MOTOR ENGINEERING LIMITED
                </p>
                <div className="mt-2 text-center">
                  <span className="bg-red-50 text-red-700 font-black text-sm px-4 py-1 rounded-full border border-red-200">
                    🏛️ 政府車輛保固展延對數報表 (可用率低於 95%)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-between text-xs text-gray-500 font-bold px-1">
              <span>報表產生日期: {new Date().toISOString().split('T')[0]}</span>
              <span className="text-red-600">
                超標車輛總計: {lowAvailabilityVehicles.length} 輛
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3 text-center">車牌號碼</th>
                    <th className="p-3">專案編號</th>
                    <th className="p-3 text-center">累積停修</th>
                    <th className="p-3 text-center">可用率 (Availability)</th>
                    <th className="p-3 text-center">原保固到期日</th>
                    <th className="p-3 text-center">展延月份</th>
                    <th className="p-3 text-center">修正後保固到期日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {lowAvailabilityVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">
                        🎉 目前所有政府車輛可用率均大於或等於 95%！
                      </td>
                    </tr>
                  ) : (
                    lowAvailabilityVehicles.map((vehicle, idx) => (
                      <tr key={vehicle.id || idx} className="hover:bg-slate-50 transition-all">
                        <td className="p-3 text-center font-black text-blue-900">
                          {vehicle.plate_number}
                        </td>
                        <td className="p-3 text-slate-700">{vehicle.project || '未指定'}</td>
                        <td className="p-3 text-center font-bold text-red-600">
                          {vehicle.stats.totalOpenDays} 天
                        </td>
                        <td className="p-3 text-center font-black text-red-600">
                          {vehicle.stats.availability}%
                        </td>
                        <td className="p-3 text-center text-gray-400">
                          {vehicle.stats.origExpiryStr}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-700">
                          +{vehicle.stats.extensionMonths} 個月
                        </td>
                        <td className="p-3 text-center font-black text-emerald-800">
                          {vehicle.stats.finalExpiryStr}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                關閉對數報表
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
