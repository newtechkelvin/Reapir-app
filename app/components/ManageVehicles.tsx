'use client';

import React, { useState } from 'react';

interface ManageVehiclesProps {
  vehicles: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onEditVehicle?: (vehicle: any) => void;
}

export default function ManageVehicles({
  vehicles,
  isLoading,
  onRefresh,
  onEditVehicle,
}: ManageVehiclesProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 內建編輯 Modal 相關 State
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editVin, setEditVin] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editWarrantyType, setEditWarrantyType] = useState('government');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editGarageLocation, setEditGarageLocation] = useState('');
  const [editVehicleLocation, setEditVehicleLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 計算累積停修天數與工單數
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

  // 🎯 2. 修復：完全對齊動態逐年審查規則，單一年度上限僅算 +6 個月
  const getWarrantyYearInfo = (vehicle: any) => {
    const deliveryDateStr = vehicle.delivery_date || vehicle.created_at || vehicle.claim_form_date;
    if (!deliveryDateStr) {
      return {
        yearText: '第 1 年',
        startDateText: '未設定',
        endDateText: vehicle.warranty_expiry_date || vehicle.warranty_end_date || '未設定',
        extensionMonths: 0,
      };
    }

    const startDate = new Date(deliveryDateStr);
    const now = new Date();
    
    // 計算當前保固年度
    let diffYears = now.getFullYear() - startDate.getFullYear();
    const monthDiff = now.getMonth() - startDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < startDate.getDate())) {
      diffYears--;
    }

    const yearNum = Math.max(1, diffYears + 1);

    // 取出原始到期日
    let originalEndDate: Date;
    if (vehicle.warranty_expiry_date || vehicle.warranty_end_date) {
      originalEndDate = new Date(vehicle.warranty_expiry_date || vehicle.warranty_end_date);
    } else {
      originalEndDate = new Date(startDate);
      originalEndDate.setFullYear(originalEndDate.getFullYear() + 3);
    }

    const totalOriginalDays = Math.max(365, (originalEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const originalWarrantyYears = Math.round(totalOriginalDays / 365);

    const allOrders = vehicle.workOrders || vehicle.work_orders || [];
    let currentAssessmentStart = new Date(startDate);
    let totalExtensionMonths = 0;
    let extensionCount = 0;

    const maxPeriods = originalWarrantyYears + 3;

    // 逐期審核 (年度: 365天 / 展延期: 182.5天)
    for (let period = 1; period <= maxPeriods; period++) {
      if (extensionCount >= 3) break;

      const isExtensionPeriod = period > originalWarrantyYears;
      const periodDays = isExtensionPeriod ? 182.5 : 365;
      const thresholdDays = periodDays * 0.05;

      const periodStart = new Date(currentAssessmentStart);
      const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);

      let periodRepairDays = 0;
      allOrders.forEach((wo: any) => {
        const sStr = wo.claim_form_date || wo.created_at;
        if (!sStr) return;

        const oStart = new Date(sStr);
        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
        const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : new Date();

        if (oStart < periodEnd && oEnd > periodStart) {
          const overlapStart = new Date(Math.max(oStart.getTime(), periodStart.getTime()));
          const overlapEnd = new Date(Math.min(oEnd.getTime(), periodEnd.getTime()));
          const diffDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          periodRepairDays += diffDays;
        }
      });

      // 該期超標僅觸發 1 次 +6 個月
      if (periodRepairDays > thresholdDays) {
        extensionCount++;
        totalExtensionMonths += 6;
      }

      currentAssessmentStart = periodEnd;
    }

    const updatedEndDate = new Date(originalEndDate);
    if (totalExtensionMonths > 0) {
      updatedEndDate.setMonth(updatedEndDate.getMonth() + totalExtensionMonths);
    }

    return {
      yearText: `第 ${yearNum} 年`,
      startDateText: startDate.toISOString().split('T')[0],
      endDateText: updatedEndDate.toISOString().split('T')[0],
      extensionMonths: totalExtensionMonths,
    };
  };

  const handleOpenEditModal = (e: React.MouseEvent, vehicle: any) => {
    e.preventDefault();
    e.stopPropagation();

    setEditingVehicle(vehicle);
    setEditPlateNumber(vehicle.plate_number || '');
    setEditVin(vehicle.vin || '');
    setEditProject(vehicle.project || '');
    setEditBrand(vehicle.brand || '');
    setEditModel(vehicle.model || '');
    setEditWarrantyType(vehicle.warranty_type || 'government');
    setEditDeliveryDate(vehicle.delivery_date || '');
    setEditGarageLocation(vehicle.garage_location || vehicle.location || '');
    setEditVehicleLocation(vehicle.vehicle_location || '');

    if (onEditVehicle) {
      onEditVehicle(vehicle);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle?.id) return;

    try {
      setIsSubmitting(true);
      const payload = {
        plate_number: editPlateNumber.trim(),
        vin: editVin.trim(),
        project: editProject.trim(),
        brand: editBrand.trim(),
        model: editModel.trim(),
        warranty_type: editWarrantyType,
        delivery_date: editDeliveryDate,
        garage_location: editGarageLocation.trim(),
        vehicle_location: editVehicleLocation.trim(),
      };

      const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('車輛資訊已順利更新！');
        setEditingVehicle(null);
        onRefresh();
      } else {
        const errData = await res.json().catch(() => null);
        alert(`更新失敗: ${errData?.error || errData?.message || '請檢查 API 設定'}`);
      }
    } catch (err) {
      console.error('更新車輛資訊失敗:', err);
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
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
            const wInfo = getWarrantyYearInfo(vehicle);

            const brandModelStr = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border rounded-2xl p-6 shadow-2xs border-slate-200 space-y-5 hover:shadow-sm transition-all"
              >
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

                  <button
                    type="button"
                    onClick={(e) => handleOpenEditModal(e, vehicle)}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    ✏️ 編輯車輛資訊
                  </button>
                </div>

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
                    {/* 🎯 正確顯示實際精算的展延月份 */}
                    {wInfo.extensionMonths > 0 ? (
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

      {/* 內建編輯車輛 Modal 彈窗 */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">✏️ 編輯車輛主表資訊</h3>
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">車牌號碼 *</label>
                  <input
                    type="text"
                    value={editPlateNumber}
                    onChange={(e) => setEditPlateNumber(e.target.value.toUpperCase())}
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">VIN 碼</label>
                  <input
                    type="text"
                    value={editVin}
                    onChange={(e) => setEditVin(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">專案名稱</label>
                  <input
                    type="text"
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">型號</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">合約類型</label>
                  <select
                    value={editWarrantyType}
                    onChange={(e) => setEditWarrantyType(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="government">🏛️ 政府合約 (EMSD)</option>
                    <option value="general">🚗 散車保固 / 一般</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">交車日期 (Delivery)</label>
                  <input
                    type="date"
                    value={editDeliveryDate}
                    onChange={(e) => setEditDeliveryDate(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">車房位置</label>
                  <input
                    type="text"
                    value={editGarageLocation}
                    onChange={(e) => setEditGarageLocation(e.target.value)}
                    placeholder="例如：機電 - 九龍灣1/F"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">車輛位置</label>
                  <input
                    type="text"
                    value={editVehicleLocation}
                    onChange={(e) => setEditVehicleLocation(e.target.value)}
                    placeholder="例如：泊位 B2"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-bold hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? '儲存中...' : '💾 儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
