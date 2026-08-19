'use client';

import React, { useState } from 'react';

interface SearchVehiclesProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  isSearching: boolean;
  hasSearched: boolean;
  searchVehicles: any[];
  getMaintenanceStatus: (dateStr: string) => { label: string; color: string; daysRemainingText?: string };
  exportToCSV: () => void;
  handlePrint: () => void;
}

export default function SearchVehicles({
  searchQuery,
  setSearchQuery,
  handleSearch,
  isSearching,
  hasSearched,
  searchVehicles,
  getMaintenanceStatus,
  exportToCSV,
  handlePrint,
}: SearchVehiclesProps) {
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any | null>(null);
  const [orderStatusMap, setOrderStatusMap] = useState<Record<string, { completed: boolean; workerName: string }>>({});

  const toggleOrderCompletion = (orderId: string, completed: boolean) => {
    setOrderStatusMap(prev => ({
      ...prev,
      [orderId]: {
        completed,
        workerName: prev[orderId]?.workerName || ''
      }
    }));
  };

  const updateWorkerName = (orderId: string, name: string) => {
    setOrderStatusMap(prev => ({
      ...prev,
      [orderId]: {
        completed: prev[orderId]?.completed ?? true,
        workerName: name
      }
    }));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2 print:hidden">
        <input type="text" placeholder="輸入車牌、工單編號 (WO-xxx)、VIN 或 Project 專案名稱" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black text-base md:text-lg" />
        <button type="submit" disabled={isSearching} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer whitespace-nowrap">
          {isSearching ? '搜尋中...' : '搜尋'}
        </button>
      </form>

      {hasSearched && (
        <div className="mt-6 border-t pt-4">
          {searchVehicles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">查無符合搜尋條件的車輛或工單紀錄。</div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-100 p-3 rounded-lg print:hidden">
                <p className="text-sm text-gray-700 font-semibold">找到 {searchVehicles.length} 筆符合條件的車輛紀錄</p>
                <div className="flex gap-2">
                  <button type="button" onClick={exportToCSV} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1">📊 匯出 CSV 試算表</button>
                  <button type="button" onClick={handlePrint} className="px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800 cursor-pointer shadow-xs flex items-center gap-1">🖨️ 列印履歷與存為 PDF</button>
                </div>
              </div>

              {searchVehicles.map((vehicle: any) => {
                const status = getMaintenanceStatus(vehicle.next_maintenance_date);
                const hasSummary = vehicle.maintenance_items_summary && vehicle.maintenance_items_summary.length > 0;
                const hasOrders = vehicle.workOrders && vehicle.workOrders.length > 0;

                return (
                  <div key={vehicle.id} className="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 p-5 rounded-xl text-black shadow-sm space-y-4 print:border-gray-300 print:bg-none print:shadow-none print:break-inside-avoid">
                    <div className="flex flex-wrap justify-between items-center border-b border-blue-200 pb-2 gap-2">
                      <h3 className="text-xl font-extrabold text-blue-900">車牌：{vehicle.plate_number}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>保養狀態：{status.label}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div><span className="font-semibold text-gray-600">車架號碼 (VIN)：</span><span className="font-mono font-bold text-gray-800">{vehicle.vin || '未設定'}</span></div>
                      <div><span className="font-semibold text-gray-600">所屬項目 (Project)：</span><span className="font-bold text-blue-800">{vehicle.project || '未設定'}</span></div>
                      <div><span className="font-semibold text-gray-600">品牌與車型：</span><span className="font-bold text-gray-800">{(vehicle.brand || '未設定') + ' - ' + (vehicle.model || '未設定')}</span></div>
                      <div><span className="font-semibold text-gray-600">車輛位置：</span><span className="font-bold text-gray-800">{vehicle.location || '未設定'}</span></div>
                      <div><span className="font-semibold text-gray-600">Claim Form 日期：</span><span className="font-bold text-gray-800">{vehicle.claim_form_date || '未設定'}</span></div>
                      <div><span className="font-semibold text-gray-600">最後維修時間：</span><span className="font-bold text-gray-800">{vehicle.last_repair_date ? new Date(vehicle.last_repair_date).toLocaleString() : '無歷史紀錄'}</span></div>
                    </div>

                    {hasSummary && (
                      <div className="pt-2 border-t border-blue-100">
                        <span className="font-semibold text-gray-700 block mb-1 text-xs">過往曾維修與更換項目彙整：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                            <span key={idx} className="bg-white border text-gray-700 text-xs px-2.5 py-1 rounded-md shadow-xs">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasOrders && (
                      <div className="pt-2">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">歷史工單紀錄 (點擊可檢視詳細內容)：</h4>
                        <div className="space-y-3">
                          {vehicle.workOrders.map((wo: any) => {
                            const currentStatus = orderStatusMap[wo.id];
                            const isDone = currentStatus?.completed ?? false;

                            return (
                              <div key={wo.id} onClick={() => setSelectedWorkOrder({ ...wo, plate_number: vehicle.plate_number, location: vehicle.location })} className="border rounded-lg p-3 bg-white text-black shadow-xs hover:border-blue-500 hover:shadow-md cursor-pointer transition-all text-sm group">
                                <div className="flex justify-between items-center mb-1 border-b pb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-700 group-hover:underline">📋 {wo.order_number}</span>
                                    {wo.project && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium">{wo.project}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isDone ? <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded">✓ 員工已確認完成</span> : <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">點擊開啟完整工單</span>}
                                    <span className="text-xs text-gray-500">{new Date(wo.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600 mb-1">描述：{wo.description || '無'}</p>
                                <div className="text-xs text-gray-700"><span className="font-semibold">維修項目：</span>{wo.work_order_items?.map((i: any) => i.item_name).join('、 ') || '無'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 print:p-0">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5 print:shadow-none print:w-full print:max-w-full">
            <div className="flex justify-between items-center border-b pb-3 print:border-black">
              <div>
                <h2 className="text-xl font-bold text-blue-900">工單明細表：{selectedWorkOrder.order_number}</h2>
                <p className="text-xs text-gray-500">開單時間：{new Date(selectedWorkOrder.created_at).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => setSelectedWorkOrder(null)} className="text-gray-400 hover:text-gray-700 font-bold text-2xl cursor-pointer print:hidden">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg border">
              <div><span className="font-semibold">車牌號碼：</span>{selectedWorkOrder.plate_number}</div>
              <div><span className="font-semibold">專案項目：</span>{selectedWorkOrder.project || '無'}</div>
              <div><span className="font-semibold">車輛位置：</span>{selectedWorkOrder.location || '未設定'}</div>
              <div><span className="font-semibold">工單狀態：</span>{selectedWorkOrder.status || '已開單'}</div>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-1 text-sm">維修狀況描述：</h3>
              <p className="text-sm text-gray-700 bg-amber-50/50 p-2.5 rounded border border-amber-200">{selectedWorkOrder.description || '無描述備註'}</p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 text-sm">維修與更換項目清單：</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700">
                      <th className="p-2.5 font-semibold w-24">類別</th>
                      <th className="p-2.5 font-semibold">項目與零件名稱</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkOrder.work_order_items && selectedWorkOrder.work_order_items.length > 0 ? (
                      selectedWorkOrder.work_order_items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2.5"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.type === 'Part' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{item.type === 'Part' ? '零件與耗材' : '工時與服務'}</span></td>
                          <td className="p-2.5 font-medium text-gray-800">{item.item_name}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={2} className="p-4 text-center text-gray-500">無細項紀錄</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t pt-4 bg-slate-50 p-4 rounded-lg space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">✍️ 員工維修完成填寫與確認欄位：</h3>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                  <input type="checkbox" checked={orderStatusMap[selectedWorkOrder.id]?.completed ?? false} onChange={(e) => toggleOrderCompletion(selectedWorkOrder.id, e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                  <span>此工單所有維修項目已全部完成</span>
                </label>

                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">負責員工姓名：</span>
                  <input type="text" placeholder="請輸入姓名" value={orderStatusMap[selectedWorkOrder.id]?.workerName || ''} onChange={(e) => updateWorkerName(selectedWorkOrder.id, e.target.value)} className="p-1.5 border rounded text-xs w-full text-black bg-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 print:hidden">
              <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 text-sm">🖨️ 列印此單據</button>
              <button type="button" onClick={() => setSelectedWorkOrder(null)} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm">關閉並儲存進度</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}