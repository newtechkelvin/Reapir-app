'use client';

import React, { useState } from 'react';

interface SearchVehiclesProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  isSearching: boolean;
  hasSearched: boolean;
  searchVehicles: any[];
  getMaintenanceStatus: (dateStr: string) => { label: string; color: string };
  exportToCSV: () => void;
  handlePrint: () => void;
}

export default function SearchVehicles(props: SearchVehiclesProps) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  
  // 項目勾選狀態紀錄
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});

  // 簽核/結案欄位 State (完成日期預設為空白)
  const [completedDateInput, setCompletedDateInput] = useState('');
  const [staffNameInput, setStaffNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenDetailModal = (vehicle: any, order: any) => {
    setSelectedVehicle(vehicle);
    setSelectedOrder(order);
    setCompletedDateInput('');
    setStaffNameInput('');

    // 初始化勾選狀態：已 Completed 的預設全部勾選，Open 的預設未勾選
    const items = order.work_order_items || order.items || [];
    const isCompleted = order.status?.toLowerCase() === 'completed';
    const initialChecked: { [key: number]: boolean } = {};
    items.forEach((_: any, idx: number) => {
      initialChecked[idx] = isCompleted;
    });
    setCheckedItems(initialChecked);
  };

  const handleCloseDetailModal = () => {
    setSelectedOrder(null);
    setSelectedVehicle(null);
    setCheckedItems({});
  };

  const handleToggleCheck = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleMarkAsCompleted = async () => {
    if (!selectedOrder?.id) return;
    if (!completedDateInput) {
      alert('請選擇或輸入完成日期');
      return;
    }

    if (!confirm('確定要提交結案並將此工單狀態標示為【Completed】嗎？')) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/work-orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Completed',
          completed_date: completedDateInput,
          staff_name: staffNameInput,
        }),
      });

      if (res.ok) {
        alert('工單已順利標示為結案 (Completed)！');
        handleCloseDetailModal();
        props.handleSearch();
      } else {
        alert('結案失敗，請稍後再試');
      }
    } catch (err) {
      console.error('結案操作錯誤:', err);
      alert('網路連線失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 搜尋列與按鈕 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-100 p-4 rounded-xl print:hidden">
        <form onSubmit={props.handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={props.searchQuery}
            onChange={(e) => props.setSearchQuery(e.target.value)}
            placeholder="搜尋車牌、VIN、專案或品牌..."
            className="flex-1 p-2.5 border rounded-xl text-sm text-black focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            type="submit"
            disabled={props.isSearching}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {props.isSearching ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </form>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={props.exportToCSV}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            📊 匯出 CSV
          </button>
          <button
            type="button"
            onClick={props.handlePrint}
            className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            🖨️ 列印頁面
          </button>
        </div>
      </div>

      {/* 車輛與工單清單 */}
      {props.isSearching ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在搜尋車輛與工單資料...</div>
      ) : props.searchVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">
          <p className="text-base font-bold">無對應的車輛與工單紀錄</p>
        </div>
      ) : (
        <div className="space-y-6">
          {props.searchVehicles.map((vehicle, vIdx) => {
            const orders = vehicle.workOrders || vehicle.work_orders || [];

            return (
              <div key={vehicle.id || vIdx} className="bg-white border rounded-xl shadow-xs overflow-hidden border-slate-200">
                {/* 車輛抬頭卡片 */}
                <div className="bg-slate-800 text-white p-4 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-extrabold text-amber-400">🚘 {vehicle.plate_number}</span>
                    {vehicle.project && (
                      <span className="bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded font-medium">
                        專案: {vehicle.project}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 flex flex-wrap gap-4">
                    <span>VIN: <strong>{vehicle.vin || '無'}</strong></span>
                    <span>品牌/車型: <strong>{vehicle.brand || ''} {vehicle.model || ''}</strong></span>
                    <span>位置: <strong>{vehicle.location || '未設定'}</strong></span>
                  </div>
                </div>

                {/* 車輛關聯工單清單 */}
                <div className="p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">維修工單履歷 (共有 {orders.length} 張)</h4>
                  {orders.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">此車輛目前無維修工單紀錄</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {orders.map((wo: any, oIdx: number) => {
                        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
                        const items = wo.work_order_items || wo.items || [];

                        return (
                          <div
                            key={wo.id || oIdx}
                            onClick={() => handleOpenDetailModal(vehicle, wo)}
                            className="bg-slate-50 border rounded-lg p-3 hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-3 group"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-900 group-hover:text-blue-700">📋 {wo.order_number || 'WO-未知'}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                                  {isCompleted ? 'Completed' : 'Open'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-1">{wo.description || '無描述'}</p>
                              <div className="text-[11px] text-gray-400 flex gap-4 pt-0.5">
                                <span>開單日期: {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '未設定'}</span>
                                <span>項目: {items.length} 項</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-blue-600 group-hover:underline self-end md:self-center">
                              點擊檢視工單明細表 →
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 工單詳細明細 Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-extrabold text-blue-900">📋 {selectedOrder.order_number || 'WO-未知'}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedOrder.status?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {selectedOrder.status || 'Open'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  車牌: <strong>{selectedVehicle?.plate_number}</strong> | 專案: {selectedVehicle?.project || '無'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 工單敘述 */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">📝 狀況與描述</h4>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border">{selectedOrder.description || '無詳細描述'}</p>
            </div>

            {/* 維修項目清單 (含勾選框) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">🛠️ 維修與零件項目明細 (點擊即可勾選進度)</h4>
              {(selectedOrder.work_order_items || selectedOrder.items || []).length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold border-b">
                      <tr>
                        <th className="p-2.5 w-12 text-center">狀態</th>
                        <th className="p-2.5 w-24">類別</th>
                        <th className="p-2.5">項目名稱</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(selectedOrder.work_order_items || selectedOrder.items || []).map((item: any, i: number) => {
                        const isChecked = !!checkedItems[i];

                        return (
                          <tr
                            key={i}
                            onClick={() => handleToggleCheck(i)}
                            className={`cursor-pointer transition-colors ${isChecked ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCheck(i)}
                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${item.type === 'Part' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                {item.type === 'Part' ? '零件' : '工時'}
                              </span>
                            </td>
                            <td className={`p-2.5 text-gray-800 ${isChecked ? 'line-through text-gray-400 font-medium' : ''}`}>
                              {item.item_name}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">無詳細明細項目</p>
              )}
            </div>

            {/* 簽核與完成日期 (僅對 Open 工單顯示) */}
            {selectedOrder.status?.toLowerCase() !== 'completed' && (
              <div className="border-t pt-4 space-y-4 bg-slate-50 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">✍️ 工單完工簽核與結案設定</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">完成日期 *</label>
                    <input
                      type="date"
                      value={completedDateInput}
                      onChange={(e) => setCompletedDateInput(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">負責員工姓名</label>
                    <input
                      type="text"
                      value={staffNameInput}
                      onChange={(e) => setStaffNameInput(e.target.value)}
                      placeholder=""
                      className="w-full p-2 border rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer 操作按鈕 */}
            <div className="flex justify-between items-center border-t pt-4">
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                關閉
              </button>
              {selectedOrder.status?.toLowerCase() !== 'completed' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleMarkAsCompleted}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? '提交中...' : '✅ 提交結案 (Mark as Completed)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}