'use client';

import React, { useState, useEffect } from 'react';

export default function WorkOrdersSummary() {
  const [vehiclesData, setVehiclesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'open' | 'completed'>('open');

  useEffect(() => {
    fetchGovernmentWorkOrders();
  }, []);

  const fetchGovernmentWorkOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (!res.ok) {
        setVehiclesData([]);
        return;
      }

      const data = await res.json();
      const rawVehicles = data.vehicles || [];

      // 保留所有非散車的政府合約車輛與舊紀錄
      const filteredList = rawVehicles.filter((v: any) => {
        const wType = (v.warranty_type || '').toString().toLowerCase();
        const project = (v.project || '').toString().toLowerCase();
        if (wType === 'general' || project.includes('散車')) {
          return false;
        }
        return true;
      });

      setVehiclesData(filteredList);
    } catch (err) {
      console.error('抓取政府合約工單資料失敗:', err);
      setVehiclesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 整理 Open 與 Completed 工單
  const openOrders: any[] = [];
  const completedOrders: any[] = [];

  vehiclesData.forEach((v) => {
    const orders = v.workOrders || v.work_orders || [];
    orders.forEach((wo: any) => {
      const statusStr = (wo.status || 'open').toString().trim().toLowerCase();
      const isCompleted = statusStr === 'completed' || statusStr === 'closed' || statusStr === '已完成';
      const wType = (wo.warranty_type || v.warranty_type || '').toString().toLowerCase();

      if (wType !== 'general') {
        const formattedOrder = {
          ...wo,
          vehiclePlate: v.plate_number || wo.plate_number,
          vehicleProject: v.project || wo.project || '政府合約專案',
          garageLocation: wo.garage_location || wo.location || v.garage_location || '未設定',
          vehicleLocation: wo.vehicle_location || v.vehicle_location || '未設定',
          claimDateStr: wo.claim_form_date || v.claim_form_date || '未設定',
          completedDateStr: wo.completed_date || '未設定',
          itemsList: wo.work_order_items || wo.items || [],
        };

        if (isCompleted) {
          completedOrders.push(formattedOrder);
        } else {
          openOrders.push(formattedOrder);
        }
      }
    });
  });

  const displayOrders = activeSubTab === 'open' ? openOrders : completedOrders;

  return (
    <div className="space-y-6 text-black">
      {/* 頂部數據看板 */}
      <div className="bg-blue-900 text-white p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              🏛️ 政府合約維修工單 Summary
            </h2>
            <p className="text-xs text-blue-200 mt-1">
              彙整政府合約車輛與歷史維修保固紀錄
            </p>
          </div>

          <button
            type="button"
            onClick={fetchGovernmentWorkOrders}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            🔄 重新整理
          </button>
        </div>

        {/* 狀態切換頁籤卡片 */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div
            onClick={() => setActiveSubTab('open')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSubTab === 'open'
                ? 'bg-white text-blue-900 border-white shadow-md'
                : 'bg-blue-800/60 text-blue-100 border-blue-700 hover:bg-blue-800'
            }`}
          >
            <span className="text-xs font-bold block">Open 處理中工單</span>
            <strong className="text-2xl font-black">{openOrders.length} <span className="text-xs font-normal">張</span></strong>
          </div>

          <div
            onClick={() => setActiveSubTab('completed')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSubTab === 'completed'
                ? 'bg-white text-blue-900 border-white shadow-md'
                : 'bg-blue-800/60 text-blue-100 border-blue-700 hover:bg-blue-800'
            }`}
          >
            <span className="text-xs font-bold block">Completed 歷史完工工單</span>
            <strong className="text-2xl font-black">{completedOrders.length} <span className="text-xs font-normal">張</span></strong>
          </div>
        </div>
      </div>

      {/* 清單區塊 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入政府合約工單資料...</div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500 space-y-2">
          <p className="text-lg font-bold text-slate-800">
            {activeSubTab === 'open' ? '目前沒有 Open 處理中的政府工單' : '目前沒有 Completed 完工紀錄'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayOrders.map((order, idx) => (
            <div
              key={order.id || idx}
              onClick={() => setSelectedOrder(order)}
              className="bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-blue-900 text-lg group-hover:text-blue-600">
                    📋 {order.order_number || 'WO-未知'}
                  </span>
                  <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-slate-300">
                    車牌: {order.vehiclePlate}
                  </span>
                  {order.vehicleProject && (
                    <span className="bg-purple-50 text-purple-700 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-purple-200">
                      專案: {order.vehicleProject}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-700 line-clamp-2">
                  <span className="font-bold text-slate-900">狀況描述：</span>
                  {order.description || '無描述'}
                </p>

                <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-1">
                  <span>車房位置: <strong className="text-slate-900">{order.garageLocation}</strong></span>
                  <span>Claim Form 日期: <strong className="text-blue-900">{order.claimDateStr}</strong></span>
                  {activeSubTab === 'completed' && (
                    <span>完工日期: <strong className="text-emerald-700">{order.completedDateStr}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 self-end md:self-center">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold border ${
                    activeSubTab === 'open'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {activeSubTab === 'open' ? 'Open 處理中' : 'Completed 已完工'}
                </span>
                <span className="text-xs text-blue-600 font-bold group-hover:underline">
                  檢視明細 →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 工單彈窗 Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 text-black">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-xs font-bold text-blue-600">🏛️ 政府合約工單</span>
                <h3 className="text-xl font-black text-slate-900">📋 {selectedOrder.order_number}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>車牌號碼：</strong> {selectedOrder.vehiclePlate}</p>
              <p><strong>專案名稱：</strong> {selectedOrder.vehicleProject}</p>
              <p><strong>車房位置：</strong> {selectedOrder.garageLocation}</p>
              <p><strong>Claim Form 日期：</strong> {selectedOrder.claimDateStr}</p>
              <p><strong>完工日期：</strong> {selectedOrder.completedDateStr}</p>
              <p><strong>故障與維修描述：</strong> {selectedOrder.description}</p>
            </div>
            <div className="flex justify-end pt-3 border-t">
              <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-200">關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}