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
  
  // 項目勾選與備註狀態紀錄
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});
  const [itemNotes, setItemNotes] = useState<{ [key: number]: string }>({});

  // 簽核/結案欄位 State
  const [completedDateInput, setCompletedDateInput] = useState('');
  const [staffNameInput, setStaffNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenDetailModal = (vehicle: any, order: any) => {
    setSelectedVehicle(vehicle);
    setSelectedOrder(order);
    setCompletedDateInput('');
    setStaffNameInput('');

    const items = order.work_order_items || order.items || [];
    const isCompleted = order.status?.toLowerCase() === 'completed';
    const initialChecked: { [key: number]: boolean } = {};
    items.forEach((_: any, idx: number) => {
      initialChecked[idx] = isCompleted;
    });
    setCheckedItems(initialChecked);
    setItemNotes({});
  };

  const handleCloseDetailModal = () => {
    setSelectedOrder(null);
    setSelectedVehicle(null);
    setCheckedItems({});
    setItemNotes({});
  };

  const handleToggleCheck = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleNoteChange = (index: number, val: string) => {
    setItemNotes((prev) => ({
      ...prev,
      [index]: val,
    }));
  };

  const handlePrintModal = () => {
    window.print();
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
      {/* 搜尋列與按鈕 (列印時隱藏) */}
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
            🖨️ 列印此頁面
          </button>
        </div>
      </div>

      {/* 車輛與工單清單 */}
      {props.isSearching ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse print:hidden">⏳ 正在搜尋車輛與工單資料...</div>
      ) : props.searchVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500 print:hidden">
          <p className="text-base font-bold">無對應的車輛與工單紀錄</p>
        </div>
      ) : (
        <div className="space-y-6 print:hidden">
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
                    <span>車輛位置: <strong className="text-amber-300">{vehicle.location || '未設定'}</strong></span>
                    <span>Claim Form 日期: <strong className="text-emerald-300">{vehicle.claim_form_date || woClaimDate(orders) || '未設定'}</strong></span>
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
                        const claimDateStr = wo.claim_form_date || vehicle.claim_form_date || '未設定';
                        const locationStr = wo.location || vehicle.location || '未設定';

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
                              <div className="text-[11px] text-gray-500 flex flex-wrap gap-4 pt-1">
                                <span>車輛位置: <strong className="text-gray-800">{locationStr}</strong></span>
                                <span>Claim Form 日期: <strong className="text-gray-800">{claimDateStr}</strong></span>
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

      {/* 工單詳細明細 Modal (完美限制為單頁 A4 列印) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 print:bg-white print:static flex items-center justify-center p-4 print:p-0 z-50">
          <div className="bg-white rounded-2xl print:rounded-none shadow-2xl print:shadow-none max-w-3xl w-full p-6 print:p-0 space-y-4 print:space-y-2 max-h-[90vh] print:max-h-none overflow-y-auto print:overflow-visible text-black print:text-xs">
            
            {/* 公司正式 Header */}
            <div className="text-center border-b-2 border-slate-800 pb-2 print:pb-1">
              <h1 className="text-2xl print:text-xl font-black text-slate-900 tracking-wide">新力機械有限公司</h1>
              <p className="text-xs print:text-[10px] text-slate-600 font-bold tracking-widest mt-0.5">NEW TECH MOTOR ENGINEERING LIMITED</p>
              <p className="text-sm print:text-xs font-extrabold text-blue-900 mt-1 bg-slate-100 py-0.5 rounded">車輛維修工單 (Repair Job Sheet)</p>
            </div>

            {/* Header 控制區 (列印時隱藏) */}
            <div className="flex justify-between items-center border-b pb-2 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-900 text-lg">📋 {selectedOrder.order_number || 'WO-未知'}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedOrder.status?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  狀態: {selectedOrder.status || 'Open'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  🖨️ 列印此工單 (自動適應1頁)
                </button>
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 1. 車輛與合約資訊欄 */}
            <div className="border border-slate-300 rounded-xl print:rounded-md p-3 print:p-2 bg-slate-50/50 print:bg-white space-y-1">
              <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider border-b pb-0.5">🚘 車輛與合約基本資訊</h4>
              <div className="grid grid-cols-3 gap-2 text-xs print:text-[11px]">
                <div><span className="text-gray-500">工單編號：</span><strong className="text-blue-900 font-black">{selectedOrder.order_number || 'WO-未知'}</strong></div>
                <div><span className="text-gray-500">車牌號碼：</span><strong className="text-blue-900 font-black">{selectedVehicle?.plate_number || selectedOrder.plate_number || '未設定'}</strong></div>
                <div><span className="text-gray-500">VIN 碼：</span><strong>{selectedVehicle?.vin || selectedOrder.vin || '無'}</strong></div>
                <div><span className="text-gray-500">專案名稱：</span><strong>{selectedVehicle?.project || selectedOrder.project || '未設定'}</strong></div>
                <div><span className="text-gray-500">車輛位置：</span><strong>{selectedOrder.location || selectedVehicle?.location || '未設定'}</strong></div>
                <div><span className="text-gray-500">Claim Form 日期：</span><strong>{selectedOrder.claim_form_date || selectedVehicle?.claim_form_date || '未設定'}</strong></div>
              </div>
            </div>

            {/* 2. 工單狀況敘述 */}
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">📝 狀況與故障描述</h4>
              <p className="text-xs text-gray-800 bg-gray-50 print:bg-white p-2 rounded-lg border leading-snug">{selectedOrder.description || '無詳細描述'}</p>
            </div>

            {/* 3. 維修項目清單 */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">🛠️ 維修與零件項目明細</h4>
              {(selectedOrder.work_order_items || selectedOrder.items || []).length > 0 ? (
                <div className="border rounded-lg overflow-hidden border-slate-300">
                  <table className="w-full text-xs print:text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 print:p-1 w-10 text-center print:hidden">完成</th>
                        <th className="p-2 print:p-1 w-20">類別</th>
                        <th className="p-2 print:p-1 w-1/2">項目名稱</th>
                        <th className="p-2 print:p-1">備註欄位 (Notes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(selectedOrder.work_order_items || selectedOrder.items || []).map((item: any, i: number) => {
                        const isChecked = !!checkedItems[i];

                        return (
                          <tr key={i} className={isChecked ? 'bg-emerald-50/50' : ''}>
                            <td className="p-2 print:p-1 text-center print:hidden">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCheck(i)}
                                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2 print:p-1 font-bold">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-300 text-[10px]">
                                {item.type || '進廠維修'}
                              </span>
                            </td>
                            <td className={`p-2 print:p-1 text-slate-800 font-medium ${isChecked ? 'line-through text-gray-400' : ''}`}>
                              {item.item_name}
                            </td>
                            <td className="p-1 print:p-0.5">
                              <input
                                type="text"
                                value={itemNotes[i] || ''}
                                onChange={(e) => handleNoteChange(i, e.target.value)}
                                className="w-full p-0.5 border-b border-slate-400 print:border-b print:border-slate-800 rounded-none text-xs print:text-[11px] bg-transparent focus:outline-none"
                              />
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

            {/* 4. 簽核與結案欄位 (螢幕顯示) */}
            {selectedOrder.status?.toLowerCase() !== 'completed' && (
              <div className="border-t pt-2 space-y-2 bg-slate-50 print:bg-white p-3 print:p-0 rounded-xl border-slate-200 print:hidden">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">✍️ 工單完工簽核與結案設定</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">完成日期 *</label>
                    <input
                      type="date"
                      value={completedDateInput}
                      onChange={(e) => setCompletedDateInput(e.target.value)}
                      className="w-full p-2 border rounded-lg text-xs text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">簽核員工姓名</label>
                    <input
                      type="text"
                      value={staffNameInput}
                      onChange={(e) => setStaffNameInput(e.target.value)}
                      placeholder=""
                      className="w-full p-2 border rounded-lg text-xs text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 列印專屬簽名與結案欄 (僅在紙本列印時呈現，壓縮間距防止分頁) */}
            <div className="hidden print:grid grid-cols-2 gap-4 pt-4 text-[11px] border-t border-slate-400">
              <div>完工日期：____________________</div>
              <div>簽核員工：____________________</div>
              <div className="pt-2">維修主管簽署：____________________</div>
              <div className="pt-2">客戶 / 技師簽署：____________________</div>
            </div>

            {/* Footer 操作按鈕 (列印時隱藏) */}
            <div className="flex justify-between items-center border-t pt-3 print:hidden">
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

      {/* 列印專用 CSS 樣式：強制設定 A4 尺寸並縮放到一頁 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            background-color: white !important;
            font-size: 11px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function woClaimDate(orders: any[]) {
  if (!orders || orders.length === 0) return null;
  for (const o of orders) {
    if (o.claim_form_date) return o.claim_form_date;
  }
  return null;
}