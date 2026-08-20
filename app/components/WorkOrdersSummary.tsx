'use client';

import React, { useMemo } from 'react';

interface WorkOrdersSummaryProps {
  allVehicles: any[];
  onSelectWorkOrder?: (order: any) => void;
}

export default function WorkOrdersSummary({ allVehicles, onSelectWorkOrder }: WorkOrdersSummaryProps) {
  // 精準篩選出狀態為 Open 的工單，並計算開單至今的天數，最後按開單時間最遠（最久以前）排最頂
  const openOrders = useMemo(() => {
    const list: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allVehicles.forEach((vehicle) => {
      // 支援 API 回傳的 workOrders 或 work_orders 兩種欄位命名
      const orders = vehicle.workOrders || vehicle.work_orders;
      if (orders && Array.isArray(orders)) {
        orders.forEach((wo: any) => {
          // 檢查狀態：如果不帶 status 欄位，預設視為 Open；如果有 status，不分大小寫比對是否為 'open'
          const statusStr = (wo.status || 'open').toString().toLowerCase().trim();
          
          if (statusStr === 'open') {
            const createdDate = new Date(wo.created_at || wo.createdAt || Date.now());
            createdDate.setHours(0, 0, 0, 0);

            // 計算距離今天的日數 (開單當天計為 1 天)
            const diffTime = today.getTime() - createdDate.getTime();
            const daysOpen = Math.floor(diffTime / (1000 * 3600 * 24)) + 1;

            list.push({
              ...wo,
              vehiclePlate: vehicle.plate_number,
              vehicleProject: vehicle.project || wo.project,
              vehicleLocation: vehicle.location || wo.location,
              daysOpen: daysOpen < 1 ? 1 : daysOpen,
              createdDateObj: createdDate,
            });
          }
        });
      }
    });

    // 依開單日期由最遠（最早）排序至最近
    list.sort((a, b) => a.createdDateObj.getTime() - b.createdDateObj.getTime());

    return list;
  }, [allVehicles]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 text-white p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold">📊 工單即時總覽 (Real-time Summary)</h2>
          <p className="text-xs text-slate-300 mt-1">
            目前全廠進行中 (Open) 的工單共有 <span className="font-bold text-amber-400 text-sm">{openOrders.length}</span> 張（按開單日期最久的優先排序）
          </p>
        </div>
      </div>

      {openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
          🎉 目前沒有任何進行中 (Open) 的工單！
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {openOrders.map((order, idx) => {
            let badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
            if (order.daysOpen >= 7) {
              badgeBg = 'bg-red-100 text-red-800 border-red-300 font-extrabold animate-pulse';
            } else if (order.daysOpen >= 3) {
              badgeBg = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
            }

            return (
              <div
                key={order.id || idx}
                onClick={() => onSelectWorkOrder && onSelectWorkOrder(order)}
                className="bg-white border rounded-xl p-4 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-blue-900 text-lg">📋 {order.order_number}</span>
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded font-bold border">
                      車牌: {order.vehiclePlate}
                    </span>
                    {order.vehicleProject && (
                      <span className="bg-purple-50 text-purple-700 text-xs px-2.5 py-0.5 rounded font-medium border border-purple-200">
                        專案: {order.vehicleProject}
                      </span>
                    )}
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-bold border border-amber-200">
                      狀態: Open
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-1">
                    <span className="font-semibold text-gray-700">狀況描述：</span>
                    {order.description || '無描述備註'}
                  </p>

                  <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-1">
                    <span>車輛位置: <strong>{order.vehicleLocation || '未設定'}</strong></span>
                    <span>開單日期: <strong>{order.createdDateObj.toLocaleDateString()}</strong></span>
                    <span>維修項目: <strong>{order.work_order_items?.length || 0} 項</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <div className={`px-4 py-2 rounded-lg border text-center ${badgeBg}`}>
                    <div className="text-xs">已開單累積</div>
                    <div className="text-lg font-black">{order.daysOpen} 天</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}