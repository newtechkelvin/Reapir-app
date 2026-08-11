'use client';

import React from 'react';

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
  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2 print:hidden">
        <input
          type="text"
          placeholder="輸入車牌、VIN 車架號或 Project 專案名稱 (支援模糊搜尋)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black text-base md:text-lg"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer whitespace-nowrap"
        >
          {isSearching ? '搜尋中...' : '搜尋'}
        </button>
      </form>

      {hasSearched && (
        <div className="mt-6 border-t pt-4">
          {searchVehicles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              查無符合搜尋條件的車輛或保養紀錄。
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-100 p-3 rounded-lg print:hidden">
                <p className="text-sm text-gray-700 font-semibold">
                  找到 {searchVehicles.length} 筆符合條件的車輛紀錄
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    📊 匯出 CSV 試算表
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-slate-700 text-white text-sm font-bold rounded-lg hover:bg-slate-800 cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    🖨️ 列印履歷與存為 PDF
                  </button>
                </div>
              </div>

              {searchVehicles.map((vehicle: any) => {
                const status = getMaintenanceStatus(vehicle.next_maintenance_date);
                const hasSummary = vehicle.maintenance_items_summary && vehicle.maintenance_items_summary.length > 0;
                const hasOrders = vehicle.workOrders && vehicle.workOrders.length > 0;

                return (
                  <div key={vehicle.id} className="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 p-5 rounded-xl text-black shadow-sm space-y-4 print:border-gray-300 print:bg-none print:shadow-none print:break-inside-avoid">
                    <div className="flex flex-wrap justify-between items-center border-b border-blue-200 pb-2 gap-2">
                      <h3 className="text-xl font-extrabold text-blue-900">
                        車牌：{vehicle.plate_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                        保養狀態：{status.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">車架號碼 (VIN)：</span>
                        <span className="font-mono font-bold text-gray-800">{vehicle.vin || '未設定'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">所屬項目 (Project)：</span>
                        <span className="font-bold text-blue-800">{vehicle.project || '未設定'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">品牌與車型：</span>
                        <span className="font-bold text-gray-800">
                          {(vehicle.brand || '未設定') + ' - ' + (vehicle.model || '未設定')}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">保養到期日：</span>
                        <span className="font-bold text-gray-800">
                          {vehicle.next_maintenance_date || '未設定'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">最後維修時間：</span>
                        <span className="font-bold text-gray-800">
                          {vehicle.last_repair_date
                            ? new Date(vehicle.last_repair_date).toLocaleString()
                            : '無歷史紀錄'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">最新記錄里程：</span>
                        <span className="font-bold text-gray-800">{vehicle.mileage} km</span>
                      </div>
                    </div>

                    {hasSummary && (
                      <div className="pt-2 border-t border-blue-100">
                        <span className="font-semibold text-gray-700 block mb-1 text-xs">過往曾維修與更換項目彙整：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                            <span key={idx} className="bg-white border text-gray-700 text-xs px-2.5 py-1 rounded-md shadow-xs">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasOrders && (
                      <div className="pt-2">
                        <h4 className="font-bold text-gray-800 text-sm mb-2">歷史工單紀錄 ({vehicle.workOrders.length} 筆)：</h4>
                        <div className="space-y-3">
                          {vehicle.workOrders.map((wo: any) => (
                            <div key={wo.id} className="border rounded-lg p-3 bg-white text-black shadow-xs text-sm">
                              <div className="flex justify-between items-center mb-1 border-b pb-1">
                                <div>
                                  <span className="font-bold text-blue-700">{wo.order_number}</span>
                                  {wo.project && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded ml-2 font-medium">
                                      {wo.project}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(wo.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mb-1">備註描述：{wo.description || '無'}</p>
                              <div className="text-xs text-gray-700">
                                <span className="font-semibold">維修項目：</span>
                                {wo.work_order_items?.map((i: any) => i.item_name).join('、 ') || '無'}
                              </div>
                            </div>
                          ))}
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
    </div>
  );
}
