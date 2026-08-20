'use client';

import React, { useMemo } from 'react';

interface WorkOrdersSummaryProps {
  allVehicles: any[];
  onSelectWorkOrder?: (order: any) => void;
}

export default function WorkOrdersSummary({ allVehicles, onSelectWorkOrder }: WorkOrdersSummaryProps) {
  // 自動解析與篩選進行中的工單
  const openOrders = useMemo(() => {
    const list: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!Array.isArray(allVehicles)) return list;

    allVehicles.forEach((item) => {
      // 情況 A: item 是車輛 (Vehicle)，裡面包含歷史工單陣列
      const orders = item.workOrders || item.work_orders || item.workOrdersList;
      
      if (Array.isArray(orders)) {
        orders.forEach((wo: any) => {
          checkAndAddWorkOrder(wo, item);
        });
      } 
      // 情況 B: item 本身就是一張工單 (Work Order)
      else if (item.order_number || item.orderNumber || item.id) {
        checkAndAddWorkOrder(item, item);
      }
    });

    function checkAndAddWorkOrder(wo: any, vehicleContext: any) {
      if (!wo) return;

      const rawStatus = (wo.status || '').toString().trim().toLowerCase();
      
      // 只要不是已完成/已關閉 (completed / closed / 已完成)，一律視為進行中 (Open) 工單
      const isClosed = rawStatus === 'completed' || rawStatus === 'closed' || rawStatus === '已完成';

      if (!isClosed) {
        const createdDateStr = wo.created_at || wo.createdAt || wo.date || Date.now();
        const createdDate = new Date(createdDateStr);
        createdDate.setHours(0, 0, 0, 0);

        // 計算開單至今積壓的天數 (開單當天算第 1 天)
        const diffTime = today.getTime() - createdDate.getTime();
        const daysOpen = Math.floor(diffTime / (1000 * 3600 * 24)) + 1;

        list.push({
          ...wo,
          vehiclePlate: vehicleContext.plate_number || vehicleContext.plateNumber || wo.plate_number || '未設定',
          vehicleProject: vehicleContext.project || wo.project || '未設定',
          vehicleLocation: vehicleContext.location || wo.location || '未設定',
          daysOpen: daysOpen < 1 ? 1 : daysOpen,
          createdDateObj: createdDate,
          itemsCount: wo.work_order_items?.length || wo.items?.length || 0,
        });
      }
    }

    // 依開單時間由遠到近（最早開單的排最頂端）
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
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 space-y-2">
          <p className="text-lg font-bold">🎉 目前沒有任何進行中 (Open) 的工單！</p>
          <p className="text-xs text-gray-400">（如果剛建立了工單，請確認 API 回傳資料或重新整理頁面）</p>
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
                    <span className="font-extrabold text-blue-900 text-lg">📋 {order.order_number || order.orderNumber || 'WO-未知'}</span>
                    <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded font-bold border">
                      車牌: {order.vehiclePlate}
                    </span>
                    {order.vehicleProject !== '未設定' && (
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
                    <span>車輛位置: <strong>{order.vehicleLocation}</strong></span>
                    <span>開單日期: <strong>{order.createdDateObj.toLocaleDateString()}</strong></span>
                    <span>維修項目: <strong>{order.itemsCount} 項</strong></span>
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