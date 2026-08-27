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

  // 編輯 Modal
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  // 新增車輛 Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [warrantyType, setWarrantyType] = useState('government');
  const [project, setProject] = useState('');
  const [vin, setVin] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [warrantyPeriodYears, setWarrantyPeriodYears] = useState('3');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自動計算保固到期日
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

  // 提交單筆新增
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
        warranty_period_years: Number(warrantyPeriodYears),
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
    setWarrantyExpiryDate('');
  };

  // CSV 批次匯入處理
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

        // 格式預期標頭: 車輛類別,專案,VIN,車牌,品牌,型號,交車日期,保固年期,保固到期日
        const parsedVehicles = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          if (!cols[3]) continue; // 車牌號碼不可為空

          const rawCategory = cols[0]?.toLowerCase() || '';
          const wType = rawCategory.includes('散車') || rawCategory === 'general' ? 'general' : 'government';
          const delDate = cols[6] || null;
          const periodYears = cols[7] ? Number(cols[7]) : 3;

          let expDate = cols[8] || null;
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
      v.brand?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-black">
      {/* 工具列 */}
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
          {/* CSV 批次匯入 */}
          <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
            📥 CSV 批次匯入
            <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
          </label>

          {/* 手動新增按鈕 */}
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

      {/* 車輛列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入車輛主表資料...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500">
          <p className="text-base font-bold">沒有對應的車輛主表資料</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredVehicles.map((vehicle, idx) => (
            <div key={vehicle.id || idx} className="bg-white border rounded-2xl p-6 shadow-2xs border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-blue-900">🚘 {vehicle.plate_number}</span>
                  <span className="bg-purple-100 text-purple-900 text-xs px-3 py-1 rounded-full font-bold">
                    {vehicle.warranty_type === 'general' ? '🚗 散車' : '🏛️ 政府車'} | {vehicle.project || '無專案'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div><span className="text-gray-400 block">品牌 / 型號</span><strong>{vehicle.brand || '-'} {vehicle.model || '-'}</strong></div>
                <div><span className="text-gray-400 block">VIN 碼</span><strong className="font-mono">{vehicle.vin || '-'}</strong></div>
                <div><span className="text-gray-400 block">交車日期</span><strong>{vehicle.delivery_date || '-'}</strong></div>
                <div><span className="text-gray-400 block">保固到期日</span><strong className="text-amber-700">{vehicle.warranty_expiry_date || vehicle.warranty_end_date || '-'}</strong></div>
              </div>
            </div>
          ))}
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
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold"
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
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold"
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
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">VIN 碼</label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value)}
                    placeholder="輸入車身號碼..."
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">品牌</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="例如：Mitsubishi"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">型號</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="例如：Fuso Canter"
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">交車日期 (Delivery)</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => handleDeliveryDateChange(e.target.value, warrantyPeriodYears)}
                    className="w-full p-2 border rounded-lg bg-white text-black font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">保固年期 (年)</label>
                  <input
                    type="number"
                    value={warrantyPeriodYears}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    min="1"
                    max="10"
                    className="w-full p-2 border rounded-lg bg-white text-black font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">保固到期日 (可自動推算或手動填寫)</label>
                  <input
                    type="date"
                    value={warrantyExpiryDate}
                    onChange={(e) => setWarrantyExpiryDate(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-emerald-50 text-emerald-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 font-bold"
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