'use client';

import React, { useState } from 'react';

interface ManageVehiclesProps {
  vehicles: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onEditVehicle: (vehicle: any) => void;
}

export default function ManageVehicles({
  vehicles,
  isLoading,
  onRefresh,
  onEditVehicle,
}: ManageVehiclesProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 計算本年合約累積停修天數與工單數
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

    const isExceeded = totalOpenDays > 18.25;
    const remainingDays = Math.max(0, parseFloat((18.25 - totalOpenDays).toFixed(1)));

    return {
      totalOpenDays,
      isExceeded,
      remainingDays,
      orderCount: orders.length,
      openCount,
    };
  };

  // 2. 計算保固年度與自動加上展延月份的保固到期日
  const getWarrantyYearInfo = (vehicle: any, totalOpenDays: number) => {
    const deliveryDateStr = vehicle.delivery_date || vehicle.created_at || vehicle.claim_form_date;
    if (!deliveryDateStr) {
      return {
        yearText: '第 1 年',
        startDateText: '未設定',
        endDateText: vehicle.warranty_end_date || '未設定',
        extensionMonths: 0,
      };
    }

    const startDate = new Date(deliveryDateStr);
    const now = new Date();
    
    let diffYears = now.getFullYear() - startDate.getFullYear();
    const monthDiff = now.getMonth() - startDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < startDate.getDate())) {
      diffYears--;
    }

    const yearNum = Math.max(1, Math.min(5, diffYears + 1));

    let extensionMonths = 0;
    if (totalOpenDays > 18.25) {
      const extensionCount = Math.min(3, Math.floor(totalOpenDays / 18.25));
      extensionMonths = extensionCount * 6;
    }

    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 4);
    if (extensionMonths > 0) {
      endDate.setMonth(endDate.getMonth() + extensionMonths);
    }

    return {
      yearText: `第 ${yearNum} 年`,
      startDateText: startDate.toISOString().split('T')[0],
      endDateText: vehicle.warranty_end_date || endDate.toISOString().split('T')[0],
      extensionMonths,
    };
  };

  const handleEditClick = (e: React.MouseEvent, vehicle: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onEditVehicle === 'function') {
      onEditVehicle(vehicle);
    } else {
      console.warn('onEditVehicle function is not provided in props');
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.plate_number?.toLowerCase().includes(term) ||
      v.vin?.toLowerCase().includes(term) ||
      v.project?.toLowerCase().includes(term) ||
      v.brand?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-black">
      {/* 頂部搜尋與重新整理列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋車牌、VIN、專案或品牌..."
            className="w-full p-2.5 border rounded-xl text-sm font-semibold bg-white text-black focus:ring-2 focus:ring-blue-500 border-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        >
          🔄 重新整理
        </button>
      </div>

      {/* 車輛卡片列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入車輛主表資料...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500">
          <p className="text-base font-bold">沒有對應的車輛主表資料</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredVehicles.map((vehicle, idx) => {
            const stats = getVehicleStats(vehicle);
            const wInfo = getWarrantyYearInfo(vehicle, stats.totalOpenDays);

            const brandModelStr = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border rounded-2xl p-6 shadow-2xs border-slate-200 space-y-5 hover:shadow-sm transition-all"
              >
                {/* 1. 車牌與專案標頭 */}
                <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-4 border-slate-200">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-black text-blue-900 flex items-center gap-2">
                      🚘 {vehicle.plate_number}
                    </span>
                    {vehicle.project && (
                      <span className="bg-purple-100 text-purple-900 border border-purple-200 text-xs px-3 py-1 rounded-full font-bold">
                        專案: {vehicle.project}
                      </span>
                    )}
                    {brandModelStr && (
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3 py-1 rounded-full font-semibold">
                        {brandModelStr}
                      </span>
                    )}
                  </div>

                  {/* 🎯 修正處：防止事件冒泡並確保呼叫 onEditVehicle */}
                  <button
                    type="button"
                    onClick={(e) => handleEditClick(e, vehicle)}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    ✏️ 編輯車輛資訊
                  </button>
                </div>

                {/* 2. 三大核心數據統計卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-gray-500 font-bold block">當前保固年度</span>
                    <strong className="text-2xl font-black text-blue-900 block">{wInfo.yearText}</strong>
                    <span className="text-[11px] text-gray-400 block pt-1">起算日: {wInfo.startDateText}</span>
                  </div>

                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-gray-500 font-bold block">本年合約累積停修天數</span>
                    <div className="flex items-baseline gap-1">
                      <strong className={`text-2xl font-black ${stats.totalOpenDays > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {stats.totalOpenDays} 天
                      </strong>
                      <span className="text-xs text-gray-400 font-bold">/ 18.25 天</span>
                    </div>
                    {stats.isExceeded ? (
                      <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 pt-1">
                        ⚠️ 已觸發保固延長 ({wInfo.extensionMonths} 個月)
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 block pt-1">
                        剩餘額度: {stats.remainingDays} 天
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-1">
                    <span className="text-xs text-gray-500 font-bold block">本年度已開工單數目</span>
                    <div className="flex items-baseline gap-1">
                      <strong className="text-2xl font-black text-amber-600">{stats.orderCount} 張</strong>
                      <span className="text-xs text-gray-500 font-semibold">({stats.openCount} Open)</span>
                    </div>
                    <span className="text-[11px] text-gray-400 block pt-1">歷史總工單: {stats.orderCount} 張</span>
                  </div>
                </div>

                {/* 3. 車輛詳細資訊 8 欄位網格 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-xs border-t pt-4 border-slate-100">
                  <div>
                    <span className="text-gray-400 block font-medium">VIN 碼</span>
                    <strong className="text-slate-800 font-mono font-bold block mt-0.5">{vehicle.vin || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">車房位置</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{vehicle.garage_location || vehicle.location || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">車輛位置</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{vehicle.vehicle_location || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">交車日期 (Delivery)</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{vehicle.delivery_date || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">保固到期日</span>
                    <strong className="text-amber-700 font-bold block mt-0.5">{wInfo.endDateText}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">取車/回廠日期</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{vehicle.pickup_return_date || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">Claim Form 日期</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">{vehicle.claim_form_date || '未設定'}</strong>
                  </div>

                  <div>
                    <span className="text-gray-400 block font-medium">建立時間</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">
                      {vehicle.created_at ? new Date(vehicle.created_at).toISOString().split('T')[0] : '未設定'}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}