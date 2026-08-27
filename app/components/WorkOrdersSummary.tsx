'use client';

import React, { useState } from 'react';

interface WorkOrdersSummaryProps {
  vehicles: any[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function WorkOrdersSummary({
  vehicles,
  isLoading,
  onRefresh,
}: WorkOrdersSummaryProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 計算個別車輛的累積停修天數與可用率
  const getVehicleStats = (vehicle: any) => {
    const orders = vehicle.workOrders || vehicle.work_orders || [];
    let totalOpenDays = 0;
    let openCount = 0;

    const now = new Date();

    orders.forEach((wo: any) => {
      const isCompleted = (wo.status || '').toLowerCase() === 'completed';

      if (!isCompleted) {
        openCount++;
        const sStr = wo.claim_form_date || wo.created_at;
        if (sStr) {
          const start = new Date(sStr);
          const diffTime = Math.max(0, now.getTime() - start.getTime());
          const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalOpenDays += days;
        }
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

    return {
      totalOpenDays,
      availability,
      orderCount: orders.length,
      openCount,
    };
  };

  // 2. 過濾可用率低於 95% 的政府車輛 (用於對數報表 Modal)
  const lowAvailabilityVehicles = vehicles
    .filter((v) => (v.warranty_type || 'government') === 'government')
    .map((v) => {
      const stats = getVehicleStats(v);
      return { ...v, stats };
    })
    .filter((v) => v.stats.availability < 95)
    .sort((a, b) => b.stats.totalOpenDays - a.stats.totalOpenDays);

  // 3. 一般搜尋過濾
  const filteredVehicles = vehicles.filter((v) => {
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
      {/* 頂部工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
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

      {/* 車輛工單 Summary 列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">
          ⏳ 正在載入工單 Summary 資料...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500">
          <p className="text-base font-bold">沒有對應的車輛工單資料</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVehicles.map((vehicle, idx) => {
            const stats = getVehicleStats(vehicle);
            const deliveryStr = vehicle.delivery_date || vehicle.created_at;
            let origExpiry = '未設定';

            if (deliveryStr) {
              const d = new Date(deliveryStr);
              d.setFullYear(d.getFullYear() + (vehicle.warranty_period_years || 3));
              origExpiry = d.toISOString().split('T')[0];
            }

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3 hover:shadow-sm transition-all"
              >
                <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-blue-950">
                      🚘 {vehicle.plate_number}
                    </span>
                    {vehicle.project && (
                      <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                        {vehicle.project}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-black px-3 py-1 rounded-full ${
                      stats.availability < 95
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    可用率: {stats.availability}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-gray-400 block font-medium">累積停修天數</span>
                    <strong className="text-base font-black text-red-600">
                      {stats.totalOpenDays} 天
                    </strong>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-gray-400 block font-medium">保固到期日</span>
                    <strong className="text-base font-black text-amber-700">
                      {vehicle.warranty_expiry_date || origExpiry}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📋 政府車輛保固展延對數報表 Modal */}
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
                      <td
                        colSpan={7}
                        className="p-8 text-center text-gray-400 font-bold"
                      >
                        🎉 目前所有政府車輛可用率均大於或等於 95%！
                      </td>
                    </tr>
                  ) : (
                    lowAvailabilityVehicles.map((vehicle, idx) => {
                      const deliveryStr = vehicle.delivery_date || vehicle.created_at;
                      let origExpiryStr = '未設定';

                      if (deliveryStr) {
                        const d = new Date(deliveryStr);
                        d.setFullYear(d.getFullYear() + (vehicle.warranty_period_years || 3));
                        origExpiryStr = d.toISOString().split('T')[0];
                      }

                      // 推算備用展延月份
                      let calcExtMonths = 0;
                      if (vehicle.warranty_expiry_date && origExpiryStr !== '未設定') {
                        const origDate = new Date(origExpiryStr);
                        const currDate = new Date(vehicle.warranty_expiry_date);
                        const diffMs = currDate.getTime() - origDate.getTime();
                        if (diffMs > 0) {
                          calcExtMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
                        }
                      }

                      const finalExtMonths =
                        vehicle.extension_months !== undefined && vehicle.extension_months !== null
                          ? vehicle.extension_months
                          : calcExtMonths;

                      return (
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
                          <td className="p-3 text-center text-gray-400">{origExpiryStr}</td>

                          {/* 🎯 直讀 Supabase 權威展延月份 (例如 AM7633 顯示 +18 個月) */}
                          <td className="p-3 text-center font-bold text-amber-700">
                            +{finalExtMonths} 個月
                          </td>

                          {/* 🎯 直讀 Supabase 權威修正後到期日 (例如 AM7633 顯示 2027-01-28) */}
                          <td className="p-3 text-center font-black text-emerald-800">
                            {vehicle.warranty_expiry_date || origExpiryStr}
                          </td>
                        </tr>
                      );
                    })
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
