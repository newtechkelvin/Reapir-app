'use client';

import React, { useState, useEffect } from 'react';

interface WorkOrdersSummaryProps {
  onSelectWorkOrder?: (order: any) => void;
}

export default function WorkOrdersSummary({ onSelectWorkOrder }: WorkOrdersSummaryProps) {
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOpenWorkOrders();
  }, []);

  const fetchOpenWorkOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (!res.ok) {
        setOpenOrders([]);
        return;
      }

      const data = await res.json();
      const vehicles = data.vehicles || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const list: any[] = [];

      vehicles.forEach((vehicle: any) => {
        const orders = vehicle.workOrders || vehicle.work_orders || [];
        if (Array.isArray(orders)) {
          orders.forEach((wo: any) => {
            const statusStr = (wo.status || 'open').toString().trim().toLowerCase();

            // 只要狀態不是 completed / closed / 已完成，皆視為 Open 進行中的工單
            const isClosed = statusStr === 'completed' || statusStr === 'closed' || statusStr === '已完成';

            if (!isClosed) {
              const createdDateStr = wo.created_at || wo.createdAt || Date.now();
              const createdDate = new Date(createdDateStr);
              createdDate.setHours(0, 0, 0, 0);

              // 計算累積開單天數 (開單當天算第 1 天)
              const diffTime = today.getTime() - createdDate.getTime();
              const daysOpen = Math.floor(diffTime / (1000 * 3600 * 24)) + 1;

              list.push({
                ...wo,
                vehiclePlate: vehicle.plate_number || wo.plate_number || '未設定',
                vehicleProject: vehicle.project || wo.project || '未設定',
                vehicleLocation: vehicle.location || wo.location || '未設定',
                daysOpen: daysOpen < 1 ? 1 : daysOpen,
                createdDateObj: createdDate,
                itemsCount: wo.work_order_items?.length || 0,
              });
            }
          });
        }
      });

      // 按開單日期最遠（最久以前）排最頂端
      list.sort((a, b) => a.createdDateObj.getTime() - b.createdDateObj.getTime());

      setOpenOrders(list);
    } catch (err) {
      console.error('抓取 Open 工單失敗:', err);
      setOpenOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center bg-slate-800 text-white p-4 rounded-xl shadow-sm gap-2">
        <div>
          <h2 className="text-xl font-bold">📊 工單即時總覽 (Real-time Summary)</h2>
          <p className="text-xs text-slate-300 mt-1">
            目前全廠進行中 (Open) 的工單共有 <span className="font-bold text-amber-400 text-sm">{openOrders.length}</span> 張（按開單時間最久的優先排序）
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOpenWorkOrders}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
        >
          🔄 重新整理
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">
          ⏳ 正在向資料庫讀取所有進行中 (Open) 的工單...
        </div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 space-y-2">
          <p className="text-lg font-bold">🎉 目前資料庫中沒有任何狀態為 Open 的工單！</p>
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
                    <span className="font-extrabold text-blue-900 text-lg">📋 {order.order_number || 'WO-未知'}</span>
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