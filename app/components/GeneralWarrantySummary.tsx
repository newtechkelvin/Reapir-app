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
        // 篩選屬性為 General / 散車 或非 Government 專案的車輛
        const wType = vehicle.warranty_type || 'General';
        const orders = vehicle.workOrders || vehicle.work_orders || [];

        if (wType === 'General' || vehicle.project?.includes('散車') || vehicle.project?.includes('Call-in')) {
          orders.forEach((wo: any) => {
            const statusStr = (wo.status || 'open').toString().trim().toLowerCase();
            const isOpen = statusStr !== 'completed' && statusStr !== 'closed' && statusStr !== '已完成';

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
      <div className="flex flex-wrap justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-sm gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🚗 散車保固 Summary (1-2年保固)
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            目前處理中的散車工單共有 <span className="font-bold text-amber-400 text-sm">{openOrders.length}</span> 張（散車類別無條約可用率限制）
          </p>
        </div>
        <button
          type="button"
          onClick={fetchGeneralOrders}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
        >
          🔄 重新整理
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入散車保固工單...</div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
          <p className="text-lg font-bold">目前沒有任何進行中的散車工單！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {openOrders.map((order, idx) => (
            <div
              key={order.id || idx}
              onClick={() => setSelectedOrder(order)}
              className="bg-white border rounded-xl p-4 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-blue-900 text-lg group-hover:text-blue-600">
                    📋 {order.order_number || 'WO-未知'}
                  </span>
                  <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded font-bold border">
                    車牌: {order.vehiclePlate}
                  </span>
                  <span className="bg-amber-50 text-amber-800 text-xs px-2.5 py-0.5 rounded font-bold border border-amber-200">
                    🚗 散車維修
                  </span>
                </div>

                <p className="text-sm text-gray-600 line-clamp-1">
                  <span className="font-semibold text-gray-700">狀況描述：</span>
                  {order.description || '無描述'}
                </p>

                <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-1">
                  <span>車房位置: <strong className="text-gray-800">{order.garageLocation}</strong></span>
                  <span>報修時間: <strong>{order.createdDateStr}</strong></span>
                  <span>保固到期日: <strong className={order.isExpired ? 'text-red-600' : 'text-emerald-700'}>{order.warrantyExpiryStr}</strong></span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {order.isExpired ? (
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-lg font-bold text-xs border border-red-200">
                    ⚠️ 保固已過期
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-bold text-xs border border-emerald-200">
                    ✅ 保固期內 (剩 {order.daysUntilExpiry} 天)
                  </span>
                )}
                <span className="text-xs text-blue-600 underline font-semibold mt-1">檢視詳情 →</span>
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
              <h3 className="text-xl font-extrabold text-blue-900">📋 {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 text-2xl font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <p><strong>車牌：</strong> {selectedOrder.vehiclePlate}</p>
              <p><strong>車房位置：</strong> {selectedOrder.garageLocation}</p>
              <p><strong>狀況描述：</strong> {selectedOrder.description}</p>
              <p><strong>保固到期日：</strong> {selectedOrder.warrantyExpiryStr}</p>
            </div>
            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}