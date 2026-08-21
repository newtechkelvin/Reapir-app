'use client';

import React, { useState } from 'react';

interface ManageVehiclesProps {
  vehicles: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onEditVehicle?: (vehicle: any) => void;
}

export default function ManageVehicles({ vehicles, isLoading, onRefresh, onEditVehicle }: ManageVehiclesProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 篩選車輛
  const filteredVehicles = vehicles.filter((v) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (v.plate_number && v.plate_number.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.project && v.project.toLowerCase().includes(q)) ||
      (v.brand && v.brand.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* 頂部搜尋與重新整理 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-100 p-4 rounded-xl">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋車牌、VIN、專案或品牌..."
            className="flex-1 p-2.5 border rounded-xl text-sm text-black focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          🔄 重新整理
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入車輛主表資料...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">
          <p className="text-base font-bold">沒有符合條件的車輛紀錄</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredVehicles.map((vehicle, idx) => {
            const orders = vehicle.workOrders || vehicle.work_orders || [];
            const stats = calculateVehicleWarrantyStats(vehicle, orders);

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 hover:shadow-md transition-all space-y-4"
              >
                {/* 1. 卡片頂部資訊 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-black text-blue-900">🚘 {vehicle.plate_number}</span>
                    {vehicle.project && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-1 rounded-lg font-bold">
                        專案: {vehicle.project}
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-700 border border-slate-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                      {vehicle.brand || '品牌未定'} {vehicle.model || ''}
                    </span>
                  </div>

                  {onEditVehicle && (
                    <button
                      type="button"
                      onClick={() => onEditVehicle(vehicle)}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer self-end md:self-auto"
                    >
                      ✏️ 編輯車輛資訊
                    </button>
                  )}
                </div>

                {/* 2. 保固年限與停修統計資訊區 (關鍵指標) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  {/* 第幾保固年度 */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs text-center md:text-left">
                    <span className="text-xs font-bold text-slate-500 block">當前保固年度</span>
                    <strong className="text-lg font-black text-blue-900 mt-0.5 block">
                      {stats.warrantyYearStr}
                    </strong>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      起算日: {stats.yearStartStr}
                    </span>
                  </div>

                  {/* 本年合約累積停修 */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs text-center md:text-left">
                    <span className="text-xs font-bold text-slate-500 block">本年合約累積停修天數</span>
                    <strong className={`text-lg font-black mt-0.5 block ${stats.annualDays >= 18.25 ? 'text-red-600' : 'text-slate-800'}`}>
                      {stats.annualDays} 天 <span className="text-xs text-gray-400 font-normal">/ 18.25 天</span>
                    </strong>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      {stats.annualDays >= 18.25 ? '⚠️ 已觸發保固延長' : `剩餘額度: ${(18.25 - stats.annualDays).toFixed(1)} 天`}
                    </span>
                  </div>

                  {/* 本年度已開工單數目 */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs text-center md:text-left">
                    <span className="text-xs font-bold text-slate-500 block">本年度已開工單數目</span>
                    <strong className="text-lg font-black text-amber-600 mt-0.5 block">
                      {stats.annualOrderCount} 張 <span className="text-xs text-slate-500 font-normal">({stats.openOrderCount} Open)</span>
                    </strong>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      歷史總工單: {orders.length} 張
                    </span>
                  </div>
                </div>

                {/* 3. 車輛基本詳細資料 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700 pt-1">
                  <div><span className="text-gray-400 block">VIN 碼</span><strong>{vehicle.vin || '無'}</strong></div>
                  <div><span className="text-gray-400 block">車房位置</span><strong>{vehicle.garage_location || vehicle.location || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">車輛位置</span><strong>{vehicle.vehicle_location || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">交車日期 (Delivery)</span><strong>{vehicle.delivery_date || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">保固到期日</span><strong>{vehicle.warranty_expiry_date || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">取車/回廠日期</span><strong>{vehicle.pickup_return_date || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">Claim Form 日期</span><strong>{vehicle.claim_form_date || '未設定'}</strong></div>
                  <div><span className="text-gray-400 block">建立時間</span><strong>{vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString() : '未設定'}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 輔助計算車輛當前保固年度、本年累積停修天數與本年度工單數量
 */
function calculateVehicleWarrantyStats(vehicle: any, orders: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deliveryDateRaw = vehicle.delivery_date ? new Date(vehicle.delivery_date) : null;

  if (!deliveryDateRaw || isNaN(deliveryDateRaw.getTime())) {
    return {
      warrantyYearStr: '未設定交車日',
      yearStartStr: '未設定',
      annualDays: 0,
      annualOrderCount: 0,
      openOrderCount: 0,
    };
  }

  deliveryDateRaw.setHours(0, 0, 0, 0);

  // 1. 計算第幾個保固年度
  let yearNum = today.getFullYear() - deliveryDateRaw.getFullYear();
  let currentYearStart = new Date(deliveryDateRaw);
  currentYearStart.setFullYear(deliveryDateRaw.getFullYear() + yearNum);

  if (currentYearStart > today) {
    yearNum -= 1;
    currentYearStart = new Date(deliveryDateRaw);
    currentYearStart.setFullYear(deliveryDateRaw.getFullYear() + yearNum);
  }

  const warrantyYearIndex = Math.max(1, yearNum + 1);

  // 2. 統計當前保固年度內的工單停修天數與數量
  let annualDays = 0;
  let annualOrderCount = 0;
  let openOrderCount = 0;

  if (Array.isArray(orders)) {
    orders.forEach((wo: any) => {
      const rawClaimDate = wo.claim_form_date || vehicle.claim_form_date;
      const woStart = rawClaimDate
        ? new Date(rawClaimDate)
        : new Date(wo.created_at || wo.createdAt || Date.now());

      const woEnd = wo.completed_date ? new Date(wo.completed_date) : today;
      const statusStr = (wo.status || 'open').toString().trim().toLowerCase();
      const isOpen = statusStr !== 'completed' && statusStr !== 'closed' && statusStr !== '已完成';

      if (woEnd >= currentYearStart) {
        annualOrderCount += 1;
        if (isOpen) openOrderCount += 1;

        const effectiveStart = woStart < currentYearStart ? currentYearStart : woStart;
        const diff = Math.ceil((woEnd.getTime() - effectiveStart.getTime()) / (1000 * 3600 * 24));
        annualDays += diff > 0 ? diff : 0;
      }
    });
  }

  return {
    warrantyYearStr: `第 ${warrantyYearIndex} 年`,
    yearStartStr: currentYearStart.toLocaleDateString(),
    annualDays,
    annualOrderCount,
    openOrderCount,
  };
}