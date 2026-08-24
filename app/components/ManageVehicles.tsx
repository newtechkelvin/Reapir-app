'use client';

import React, { useState } from 'react';

interface ManageVehiclesProps {
  vehicles: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onEditVehicle?: (vehicle: any) => void;
}

export default function ManageVehicles(props: ManageVehiclesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // 編輯 Modal State
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editVin, setEditVin] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editGarageLocation, setEditGarageLocation] = useState('');
  const [editWarrantyType, setEditWarrantyType] = useState('Government');
  const [isSaving, setIsSaving] = useState(false);

  // 打開編輯視窗
  const handleOpenEditModal = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setEditPlateNumber(vehicle.plate_number || '');
    setEditVin(vehicle.vin || '');
    setEditBrand(vehicle.brand || '');
    setEditModel(vehicle.model || '');
    setEditProject(vehicle.project || '');
    setEditGarageLocation(vehicle.garage_location || vehicle.location || '');
    setEditWarrantyType(vehicle.warranty_type || (vehicle.project?.includes('散車') ? 'General' : 'Government'));
  };

  // 關閉編輯視窗
  const handleCloseEditModal = () => {
    setEditingVehicle(null);
  };

  // 儲存車輛修改
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle?.id) return;

    try {
      setIsSaving(true);
      const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: editPlateNumber,
          vin: editVin,
          brand: editBrand,
          model: editModel,
          project: editProject,
          garage_location: editGarageLocation,
          warranty_type: editWarrantyType,
        }),
      });

      if (res.ok) {
        alert('車輛資訊已成功更新！');
        handleCloseEditModal();
        props.onRefresh();
      } else {
        const errData = await res.json().catch(() => null);
        alert(`更新失敗: ${errData?.error || errData?.message || '請檢查網路連線'}`);
      }
    } catch (err) {
      console.error('更新車輛資訊失敗:', err);
      alert('更新失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  // 搜尋過濾
  const filteredVehicles = props.vehicles.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.plate_number?.toLowerCase().includes(term) ||
      v.vin?.toLowerCase().includes(term) ||
      v.brand?.toLowerCase().includes(term) ||
      v.model?.toLowerCase().includes(term) ||
      v.project?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-black">
      {/* 標頭與搜尋列 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="在車輛主表中搜尋車牌、VIN、品牌、型號或專案..."
            className="flex-1 p-2.5 border rounded-xl text-sm bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={props.onRefresh}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          🔄 重新整理車輛主表
        </button>
      </div>

      {/* 車輛主表卡片清單 */}
      {props.isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入車輛主表資料...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">
          <p className="text-base font-bold">無對應的車輛主表資料</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle, idx) => {
            const isSanChe = vehicle.warranty_type === 'General' || vehicle.project?.includes('散車');
            const orders = vehicle.workOrders || vehicle.work_orders || [];

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all border-slate-200 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xl font-black text-blue-900 block">🚘 {vehicle.plate_number}</span>
                      <span className="text-xs text-gray-500">VIN: {vehicle.vin || '未填寫'}</span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        isSanChe
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {isSanChe ? '🚗 散車保固' : '🏛️ 政府合約'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                    <div>品牌：<strong className="text-slate-900">{vehicle.brand || '未設定'}</strong></div>
                    <div>型號：<strong className="text-slate-900">{vehicle.model || '未設定'}</strong></div>
                    <div className="col-span-2">專案：<strong className="text-slate-900">{vehicle.project || '未設定'}</strong></div>
                    <div className="col-span-2">
                      車房位置：
                      <strong className="text-slate-900">{vehicle.garage_location || vehicle.location || '未設定'}</strong>
                    </div>
                    <div className="col-span-2">歷史工單總數：<strong className="text-blue-900 font-bold">{orders.length} 張</strong></div>
                  </div>
                </div>

                <div className="pt-2 border-t flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(vehicle)}
                    className="flex-1 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    ✏️ 編輯車輛資訊
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編輯車輛資訊 Modal 彈窗 */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 text-black">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">✏️ 編輯車輛主表資訊 ({editingVehicle.plate_number})</h3>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">保固 / 車輛類別 *</label>
                <select
                  value={editWarrantyType}
                  onChange={(e) => setEditWarrantyType(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white font-bold text-black focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Government">🏛️ 政府合約專案</option>
                  <option value="General">🚗 散車保固</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">車牌號碼 *</label>
                  <input
                    type="text"
                    required
                    value={editPlateNumber}
                    onChange={(e) => setEditPlateNumber(e.target.value)}
                    className="w-full p-2.5 border rounded-xl font-bold text-black focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">VIN 碼</label>
                  <input
                    type="text"
                    value={editVin}
                    onChange={(e) => setEditVin(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-black focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">車輛品牌 (Brand)</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    placeholder="例如：Toyota / Isuzu"
                    className="w-full p-2.5 border rounded-xl text-black focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">車輛型號 (Model)</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    placeholder="例如：Coaster / N-Series"
                    className="w-full p-2.5 border rounded-xl text-black focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">專案名稱 / 備註</label>
                <input
                  type="text"
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-black focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">車房位置</label>
                <select
                  value={editGarageLocation}
                  onChange={(e) => setEditGarageLocation(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white font-bold text-black focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 請選擇車房位置 --</option>
                  <option value="機電 - 九龍灣1/F">機電 - 九龍灣1/F</option>
                  <option value="機電 - 九龍灣2/F">機電 - 九龍灣2/F</option>
                  <option value="機電 - 屯門">機電 - 屯門</option>
                  <option value="機電 - 小蠔灣">機電 - 小蠔灣</option>
                  <option value="機電 - 柴灣">機電 - 柴灣</option>
                  <option value="車行">車行</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? '保存中...' : '💾 儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
