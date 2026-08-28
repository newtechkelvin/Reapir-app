'use client';

import React, { useState } from 'react';
import { calculateAvailability } from '@/lib/availability';

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

  // 編輯 Modal State
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editVin, setEditVin] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editWarrantyType, setEditWarrantyType] = useState('government');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editMaintenanceExpiryDate, setEditMaintenanceExpiryDate] = useState('');
  const [editWarrantyPeriodYears, setEditWarrantyPeriodYears] = useState('3');
  const [editMaxExtensionCount, setEditMaxExtensionCount] = useState('3');
  const [editMaxExtensionMonths, setEditMaxExtensionMonths] = useState('18');
  const [editGarageLocation, setEditGarageLocation] = useState('');
  const [editVehicleLocation, setEditVehicleLocation] = useState('');

  // 新增車輛 Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [warrantyType, setWarrantyType] = useState('government');
  const [project, setProject] = useState('');
  const [vin, setVin] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [warrantyPeriodYears, setWarrantyPeriodYears] = useState('3');
  const [maxExtensionCount, setMaxExtensionCount] = useState('3');
  const [maxExtensionMonths, setMaxExtensionMonths] = useState('18');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('');
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

    return {
      totalOpenDays,
      orderCount: orders.length,
      openCount,
    };
  };

  // 2. 資訊計算與資料庫讀取：保固展延必須使用統一的即時計算結果，不能只讀舊的 DB expiry 欄位。
  const getWarrantyYearInfo = (vehicle: any) => {
    const deliveryDateStr = vehicle.delivery_date || vehicle.created_at;
    if (!deliveryDateStr) {
      return {
        yearText: '第 1 年',
        startDateText: '未設定',
        endDateText: vehicle.warranty_expiry_date || '未設定',
        extensionMonths: Number(vehicle.extension_months) || 0,
      };
    }

    const startDate = new Date(deliveryDateStr);
    const now = new Date();
    let diffYears = now.getFullYear() - startDate.getFullYear();
    const monthDiff = now.getMonth() - startDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < startDate.getDate())) diffYears--;
    const yearNum = Math.max(1, diffYears + 1);
    const calculation = calculateAvailability(vehicle, now);

    return {
      yearText: `第 ${yearNum} 年`,
      startDateText: calculation.currentPeriod?.start || startDate.toISOString().split('T')[0],
      endDateText: calculation.finalExpiryDate || vehicle.warranty_expiry_date || '未設定',
      extensionMonths: calculation.extensionMonths,
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
    setEditDeliveryDate(vehicle.maintenance_start_date || vehicle.delivery_date || '');
    setEditMaintenanceExpiryDate(vehicle.maintenance_expiry_date || vehicle.warranty_expiry_date || '');
    setEditWarrantyPeriodYears(String(vehicle.warranty_period_years || '3'));
    setEditMaxExtensionCount(String(vehicle.max_extension_count !== undefined ? vehicle.max_extension_count : '3'));
    setEditMaxExtensionMonths(String(vehicle.max_extension_months !== undefined ? vehicle.max_extension_months : '18'));
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
        maintenance_start_date: editWarrantyType === 'general' ? editDeliveryDate : null,
        maintenance_expiry_date: editWarrantyType === 'general' ? editMaintenanceExpiryDate : null,
        warranty_period_years: editWarrantyType === 'general' ? 1 : Number(editWarrantyPeriodYears),
        max_extension_count: Number(editMaxExtensionCount),
        max_extension_months: Number(editMaxExtensionMonths) || 18,
        garage_location: editGarageLocation.trim(),
        vehicle_location: editVehicleLocation.trim(),
      };

      const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('車輛資訊與保固條款已順利更新！');
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

  const handleDeliveryDateChange = (dateVal: string, periodVal: string) => {
    setDeliveryDate(dateVal);
    if (dateVal && periodVal) {
      const d = new Date(dateVal);
      d.setFullYear(d.getFullYear() + Number(periodVal));
      setWarrantyExpiryDate(d.toISOString().split('T')[0]);
    }
  };

  const handlePeriodChange = (periodVal: string) => {
    setWarrantyPeriodYears(periodVal);
    if (deliveryDate && periodVal) {
      const d = new Date(deliveryDate);
      d.setFullYear(d.getFullYear() + Number(periodVal));
      setWarrantyExpiryDate(d.toISOString().split('T')[0]);
    }
  };

  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      alert('請填寫車牌號碼');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        warranty_type: warrantyType,
        project: project.trim(),
        vin: vin.trim(),
        plate_number: plateNumber.trim().toUpperCase(),
        brand: brand.trim(),
        model: model.trim(),
        delivery_date: deliveryDate,
        maintenance_start_date: warrantyType === 'general' ? deliveryDate : null,
        maintenance_expiry_date: warrantyType === 'general' ? warrantyExpiryDate : null,
        warranty_period_years: warrantyType === 'general' ? 1 : Number(warrantyPeriodYears),
        max_extension_count: Number(maxExtensionCount),
        max_extension_months: Number(maxExtensionMonths) || 18,
        warranty_expiry_date: warrantyExpiryDate,
      };

      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('新車資料已成功新增並寫入資料庫！');
        setShowAddModal(false);
        resetAddForm();
        onRefresh();
      } else {
        const errData = await res.json().catch(() => null);
        alert(`新增失敗: ${errData?.error || '請檢查格式'}`);
      }
    } catch (err) {
      console.error('新增車輛錯誤:', err);
      alert('網路連線失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setWarrantyType('government');
    setProject('');
    setVin('');
    setPlateNumber('');
    setBrand('');
    setModel('');
    setDeliveryDate('');
    setWarrantyPeriodYears('3');
    setMaxExtensionCount('3');
    setWarrantyExpiryDate('');
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== '');
        if (lines.length < 2) {
          alert('CSV 檔案無資料內容');
          return;
        }

        const parsedVehicles = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          if (!cols[3]) continue;

          const rawCategory = cols[0]?.toLowerCase() || '';
          const wType = rawCategory.includes('散車') || rawCategory === 'general' ? 'general' : 'government';
          const delDate = cols[6] || null;
          const periodYears = cols[7] ? Number(cols[7]) : 3;
          const maxExt = cols[8] ? Number(cols[8]) : 3;

          let expDate = cols[9] || null;
          if (!expDate && delDate && periodYears) {
            const d = new Date(delDate);
            d.setFullYear(d.getFullYear() + periodYears);
            expDate = d.toISOString().split('T')[0];
          }

          parsedVehicles.push({
            warranty_type: wType,
            project: cols[1] || null,
            vin: cols[2] || null,
            plate_number: cols[3].toUpperCase(),
            brand: cols[4] || null,
            model: cols[5] || null,
            delivery_date: delDate,
            warranty_period_years: periodYears,
            max_extension_count: maxExt,
            warranty_expiry_date: expDate,
          });
        }

        if (parsedVehicles.length === 0) {
          alert('未解析到有效的車輛資料');
          return;
        }

        const res = await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedVehicles),
        });

        if (res.ok) {
          alert(`成功匯入 ${parsedVehicles.length} 輛車資料！`);
          onRefresh();
        } else {
          const errData = await res.json().catch(() => null);
          alert(`CSV 匯入失敗: ${errData?.error || '請檢查 CSV 格式'}`);
        }
      } catch (err) {
        console.error('CSV 匯入錯誤:', err);
        alert('讀取 CSV 檔案失敗');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
      {/* 頂部工具列 */}
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

        <div className="flex gap-2">
          <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
            📥 CSV 批次匯入
            <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setShowAddModal(false)}
            className="hidden"
          ></button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            ➕ 新增車輛
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
                    <span className="text-xs text-gray-500 font-bold block">合約歷來累積停修天數</span>
                    <div className="flex items-baseline gap-1">
                      <strong className={`text-2xl font-black ${stats.totalOpenDays > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {stats.totalOpenDays} 天
                      </strong>
                    </div>
                    {wInfo.extensionMonths > 0 ? (
                      <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 pt-1">
                        ⚠️ 已觸發保固延長 ({wInfo.extensionMonths} 個月)
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-bold block pt-1">
                        可用率符合 &gt; 95% 標準
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

      {/* ✏️ 編輯車輛 Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">✏️ 編輯車輛主表資訊</h3>
              <button type="button" onClick={() => setEditingVehicle(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer">✕</button>
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

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">{editWarrantyType === 'general' ? '保養期開始日' : '交車日期 (Delivery)'}</label>
                  <input
                    type="date"
                    value={editDeliveryDate}
                                            onChange={(e) => setEditDeliveryDate(e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {editWarrantyType === 'general' && <div className="col-span-2"><label className="block font-bold text-gray-700 mb-1">保養期到期日</label><input type="date" value={editMaintenanceExpiryDate} onChange={(e) => setEditMaintenanceExpiryDate(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500" /></div>}

                    {/* 🎯 專案與保固條款設定欄位 */}
                <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-300 space-y-2">
                  <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1">
                    🏛️ 專案與保固條款設定
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">專案保固年期 (年)</label>
                      <input
                        type="number"
                        value={editWarrantyPeriodYears}
                        onChange={(e) => setEditWarrantyPeriodYears(e.target.value)}
                        min="1"
                        max="10"
                        className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-800 mb-1">總展延月數上限</label>
                      <input
                        type="number"
                        value={editMaxExtensionMonths}
                        onChange={(e) => setEditMaxExtensionMonths(e.target.value)}
                        min="0"
                        max="120"
                        step="6"
                        className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">展延上限次數（相容舊資料）</label>
                      <input
                        type="number"
                        value={editMaxExtensionCount}
                        onChange={(e) => setEditMaxExtensionCount(e.target.value)}
                        min="0"
                        max="5"
                        className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
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

                <div>
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

      {/* ➕ 新增車輛 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">➕ 新增車輛資料</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 text-xl font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddVehicleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">車輛類別 *</label>
                  <select
                    value={warrantyType}
                    onChange={(e) => setWarrantyType(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="government">🏛️ 政府車</option>
                    <option value="general">🚗 散車</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">車牌號碼 *</label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="例如：AM6493"
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">專案名稱</label>
                  <input
                    type="text"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="例如：AD200542019"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">VIN 碼</label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                    placeholder="輸入車身號碼..."
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="例如：Mitsubishi"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">型號</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="例如：Fuso Canter"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">{warrantyType === 'general' ? '保養期開始日' : '交車日期 (Delivery)'}</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => handleDeliveryDateChange(e.target.value, warrantyPeriodYears)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 🎯 醒目專區：專案與保固條款設定 */}
                <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-300 space-y-2">
                  <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1">
                    🏛️ 專案與保固條款設定
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1">專案保固年期 (年)</label>
                      <input
                        type="number"
                        value={warrantyPeriodYears}
                        onChange={(e) => handlePeriodChange(e.target.value)}
                        min="1"
                        max="10"
                        className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-800 mb-1">展延上限次數 (0=不展延)</label>
                      <input
                        type="number"
                        value={maxExtensionCount}
                        onChange={(e) => setMaxExtensionCount(e.target.value)}
                        min="0"
                        max="5"
                        className="w-full p-2 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">{warrantyType === 'general' ? '保養期到期日 (可自動推算或手動填寫)' : '保固到期日 (可自動推算或手動填寫)'}</label>
                  <input
                    type="date"
                    value={warrantyExpiryDate}
                    onChange={(e) => setWarrantyExpiryDate(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-emerald-50 text-emerald-900 font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-bold hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? '儲存中...' : '💾 儲存並同步至 DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
