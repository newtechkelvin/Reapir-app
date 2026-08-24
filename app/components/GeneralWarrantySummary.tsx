'use client';

import React, { useState, useEffect } from 'react';

export default function GeneralWarrantySummary() {
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    fetchGeneralOrders();
  }, []);

  const fetchGeneralOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (!res.ok) {
        setOpenOrders([]);
        return;
      }

      const data = await res.json();
      const vehicles = data.vehicles || [];

      const list: any[] = [];

      vehicles.forEach((vehicle: any) => {
        const vWType = (vehicle.warranty_type || '').toString().trim().toLowerCase();
        const vProject = (vehicle.project || '').toString().trim().toLowerCase();

        // 嚴格過濾：只有明確標示為 General/散車 類別的車輛或專案才納入散車 Summary
        const isSanCheVehicle = vWType === 'general' || vWType === '散車' || vProject.includes('散車');

        if (isSanCheVehicle) {
          const orders = vehicle.workOrders || vehicle.work_orders || [];

          orders.forEach((wo: any) => {
            const statusStr = (wo.status || 'open').toString().trim().toLowerCase();
            const isOpen = statusStr !== 'completed' && statusStr !== 'closed' && statusStr !== '已完成';
            const oWType = (wo.warranty_type || '').toString().trim().toLowerCase();

            if (oWType === 'government') return;

            if (isOpen) {
              const expiryDate = vehicle.warranty_expiry_date ? new Date(vehicle.warranty_expiry_date) : null;
              const today = new Date();
              let daysUntilExpiry = null;
              let isExpired = false;

              if (expiryDate && !isNaN(expiryDate.getTime())) {
                const diffTime = expiryDate.getTime() - today.getTime();
                daysUntilExpiry = Math.ceil(diffTime / (1000 * 3600 * 24));
                if (daysUntilExpiry < 0) isExpired = true;
              }

              list.push({
                ...wo,
                vehiclePlate: vehicle.plate_number || wo.plate_number,
                vehicleVin: vehicle.vin || wo.vin,
                vehicleProject: vehicle.project || '散車項目',
                garageLocation: wo.garage_location || wo.location || vehicle.garage_location || '未設定',
                vehicleLocation: wo.vehicle_location || vehicle.vehicle_location || '未設定',
                warrantyExpiryStr: expiryDate ? expiryDate.toLocaleDateString() : '未設定',
                daysUntilExpiry,
                isExpired,
                createdDateStr: wo.created_at ? new Date(wo.created_at).toLocaleDateString() : '未設定',
                itemsList: wo.work_order_items || wo.items || [],
              });
            }
          });
        }
      });

      setOpenOrders(list);
    } catch (err) {
      console.error('抓取散車工單失敗:', err);
      setOpenOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-black">
      {/* Header Bar */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900 text-white p-5 rounded-2xl shadow-sm gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            🚗 散車保固 Summary
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            目前進行中的散車工單共有 <span className="font-extrabold text-amber-400 text-base">{openOrders.length}</span> 張
          </p>
        </div>
        <button
          type="button"
          onClick={fetchGeneralOrders}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs"
        >
          🔄 重新整理
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入散車保固工單...</div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 space-y-2">
          <p className="text-lg font-bold text-slate-800">目前沒有任何進行中的散車工單 (0張)</p>
          <p className="text-xs text-gray-400">當您開立標記為「🚗 散車保固」的新工單時，將會獨立在此頁面顯示</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {openOrders.map((order, idx) => (
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
                  <span className="bg-amber-50 text-amber-800 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-amber-200">
                    🚗 散車維修
                  </span>
                </div>

                <p className="text-sm text-gray-700 line-clamp-2">
                  <span className="font-bold text-slate-900">狀況描述：</span>
                  {order.description || '無描述'}
                </p>

                <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-1">
                  <span>車房位置: <strong className="text-slate-900">{order.garageLocation}</strong></span>
                  <span>報修時間: <strong>{order.createdDateStr}</strong></span>
                  <span>保固到期日: <strong className={order.isExpired ? 'text-red-600' : 'text-emerald-700'}>{order.warrantyExpiryStr}</strong></span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {order.isExpired ? (
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-xs border border-red-200">
                    ⚠️ 保固已過期
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">
                    ✅ 保固期內 (剩 {order.daysUntilExpiry} 天)
                  </span>
                )}
                <span className="text-xs text-blue-600 font-bold group-hover:underline mt-1">檢視詳情 →</span>
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
                <span className="text-xs font-bold text-amber-600">🚗 散車保固工單</span>
                <h3 className="text-xl font-black text-slate-900">📋 {selectedOrder.order_number}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>車牌號碼：</strong> {selectedOrder.vehiclePlate}</p>
              <p><strong>車房位置：</strong> {selectedOrder.garageLocation}</p>
              <p><strong>狀況描述：</strong> {selectedOrder.description}</p>
              <p><strong>保固到期日：</strong> {selectedOrder.warrantyExpiryStr}</p>
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
