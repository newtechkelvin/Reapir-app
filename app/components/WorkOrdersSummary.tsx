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
        
        // 1. 計算該車輛在當前合約年度累積停修總天數
        const deliveryDate = vehicle.delivery_date ? new Date(vehicle.delivery_date) : null;
        let currentYearStart = new Date(today.getFullYear(), 0, 1);
        
        if (deliveryDate) {
          currentYearStart = new Date(deliveryDate);
          currentYearStart.setFullYear(today.getFullYear());
          if (currentYearStart > today) {
            currentYearStart.setFullYear(today.getFullYear() - 1);
          }
        }

        let totalAnnualRepairDays = 0;

        if (Array.isArray(orders)) {
          orders.forEach((wo: any) => {
            const woStart = new Date(wo.created_at || wo.createdAt || Date.now());
            const woEnd = wo.completed_date ? new Date(wo.completed_date) : today;

            if (woEnd >= currentYearStart) {
              const effectiveStart = woStart < currentYearStart ? currentYearStart : woStart;
              const diff = Math.ceil((woEnd.getTime() - effectiveStart.getTime()) / (1000 * 3600 * 24));
              totalAnnualRepairDays += diff > 0 ? diff : 0;
            }
          });

          // 2. 篩選出 Open 進行中工單
          orders.forEach((wo: any) => {
            const statusStr = (wo.status || 'open').toString().trim().toLowerCase();
            const isClosed = statusStr === 'completed' || statusStr === 'closed' || statusStr === '已完成';

            if (!isClosed) {
              const createdDate = new Date(wo.created_at || wo.createdAt || Date.now());
              createdDate.setHours(0, 0, 0, 0);

              const diffTime = today.getTime() - createdDate.getTime();
              const daysOpen = Math.floor(diffTime / (1000 * 3600 * 24)) + 1;

              // 計算剩餘安全額度 (上限 18.25 天 = 365 * 5%)
              const maxAllowedDays = 18.25;
              const remainingDays = Math.max(0, maxAllowedDays - totalAnnualRepairDays);
              const isWarrantyExtendedTriggered = totalAnnualRepairDays >= maxAllowedDays;

              // 計算推延後的保固到期日
              let newWarrantyExpiryStr = '未設定';
              if (vehicle.warranty_expiry_date) {
                const origExpiry = new Date(vehicle.warranty_expiry_date);
                if (isWarrantyExtendedTriggered) {
                  origExpiry.setMonth(origExpiry.getMonth() + 6);
                }
                newWarrantyExpiryStr = origExpiry.toLocaleDateString();
              }

              list.push({
                ...wo,
                vehiclePlate: vehicle.plate_number || wo.plate_number || '未設定',
                vehicleProject: vehicle.project || wo.project || '未設定',
                vehicleLocation: vehicle.location || wo.location || '未設定',
                deliveryDateStr: deliveryDate ? deliveryDate.toLocaleDateString() : '未設定',
                daysOpen: daysOpen < 1 ? 1 : daysOpen,
                totalAnnualRepairDays,
                remainingDays,
                isWarrantyExtendedTriggered,
                newWarrantyExpiryStr,
                createdDateObj: createdDate,
                itemsCount: wo.work_order_items?.length || 0,
              });
            }
          });
        }
      });

      // 排序邏輯：剩餘額度少者優先排最頂，天數相同者開單最久優先
      list.sort((a, b) => {
        if (a.remainingDays !== b.remainingDays) {
          return a.remainingDays - b.remainingDays;
        }
        return a.createdDateObj.getTime() - b.createdDateObj.getTime();
      });

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
          <h2 className="text-xl font-bold">📊 工單即時總覽與可用率 (Availability Summary)</h2>
          <p className="text-xs text-slate-300 mt-1">目前全廠進行中 (Open) 工單共有 <span className="font-bold text-amber-400 text-sm">{openOrders.length}</span> 張（系統依可用率風險自動排列處理優先順序）</p>
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
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在向資料庫讀取所有進行中 (Open) 的工單與可用率...</div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 space-y-2">
          <p className="text-lg font-bold">🎉 目前資料庫中沒有任何狀態為 Open 的工單！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {openOrders.map((order, idx) => {
            let badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
            let riskLabel = '合約可用率正常';

            if (order.isWarrantyExtendedTriggered) {
              badgeBg = 'bg-red-600 text-white border-red-700 font-black animate-pulse';
              riskLabel = '⚠️ 已逾 5% 限額！保固自動延長 6 個月';
            } else if (order.remainingDays <= 3) {
              badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
              riskLabel = `⚠️ 臨界警示 (額度剩 ${order.remainingDays} 天)`;
            }

            return (
              <div
                key={order.id || idx}
                onClick={() => onSelectWorkOrder && onSelectWorkOrder(order)}
                className="bg-white border rounded-xl p-4 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-2 flex-1">
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
                    <span>交車日期: <strong>{order.deliveryDateStr}</strong></span>
                    <span>本年合約累積停修: <strong className="text-red-600">{order.totalAnnualRepairDays} 天</strong> / 18.25 天</span>
                    <span>保固到期日: <strong>{order.newWarrantyExpiryStr}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 self-end md:self-center">
                  <div className={`px-4 py-2 rounded-lg border text-center ${badgeBg}`}>
                    <div className="text-xs">本單累積停修</div>
                    <div className="text-lg font-black">{order.daysOpen} 天</div>
                  </div>
                  <span className="text-xs font-bold text-slate-600">{riskLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}