'use client';

import React, { useState, useEffect } from 'react';

interface WorkOrdersSummaryProps {
  onSelectWorkOrder?: (order: any) => void;
}

export default function WorkOrdersSummary({ onSelectWorkOrder }: WorkOrdersSummaryProps) {
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
        
        // 1. 合約年度起算日：固定以 delivery_date（交車日期）作爲基準
        const deliveryDate = vehicle.delivery_date ? new Date(vehicle.delivery_date) : null;
        let currentYearStart = new Date(today.getFullYear(), 0, 1);
        
        if (deliveryDate && !isNaN(deliveryDate.getTime())) {
          currentYearStart = new Date(deliveryDate);
          currentYearStart.setFullYear(today.getFullYear());
          if (currentYearStart > today) {
            currentYearStart.setFullYear(today.getFullYear() - 1);
          }
        }

        let totalAnnualRepairDays = 0;

        if (Array.isArray(orders)) {
          orders.forEach((wo: any) => {
            // 工單停修起算時間：優先以 claim_form_date 取代工單開單時間
            const rawClaimDate = wo.claim_form_date || vehicle.claim_form_date;
            const woStart = rawClaimDate
              ? new Date(rawClaimDate)
              : new Date(wo.created_at || wo.createdAt || Date.now());

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
              // 「本單累積停修天數」計算：優先以 Claim Form 日期起算
              const rawClaimDate = wo.claim_form_date || vehicle.claim_form_date;
              const startDate = rawClaimDate
                ? new Date(rawClaimDate)
                : new Date(wo.created_at || wo.createdAt || Date.now());
              
              startDate.setHours(0, 0, 0, 0);

              const diffTime = today.getTime() - startDate.getTime();
              const daysOpen = Math.floor(diffTime / (1000 * 3600 * 24)) + 1;

              const maxAllowedDays = 18.25;
              const remainingDays = Math.max(0, maxAllowedDays - totalAnnualRepairDays);
              const isWarrantyExtendedTriggered = totalAnnualRepairDays >= maxAllowedDays;

              let newWarrantyExpiryStr = '未設定';
              if (vehicle.warranty_expiry_date) {
                const origExpiry = new Date(vehicle.warranty_expiry_date);
                if (!isNaN(origExpiry.getTime())) {
                  if (isWarrantyExtendedTriggered) {
                    origExpiry.setMonth(origExpiry.getMonth() + 6);
                  }
                  newWarrantyExpiryStr = origExpiry.toLocaleDateString();
                }
              }

              const items = wo.work_order_items || wo.items || [];
              const actualLocation = wo.location || vehicle.location || '未設定';
              const actualClaimDate = wo.claim_form_date || vehicle.claim_form_date;

              const createdDate = new Date(wo.created_at || wo.createdAt || Date.now());

              list.push({
                ...wo,
                vehiclePlate: vehicle.plate_number || wo.plate_number || '未設定',
                vehicleVin: vehicle.vin || wo.vin || '未設定',
                vehicleProject: vehicle.project || wo.project || '未設定',
                vehicleLocation: actualLocation,
                deliveryDateStr: deliveryDate && !isNaN(deliveryDate.getTime()) ? deliveryDate.toLocaleDateString() : '未設定',
                claimFormDateStr: actualClaimDate ? new Date(actualClaimDate).toLocaleDateString() : '未設定',
                createdDateStr: !isNaN(createdDate.getTime()) ? createdDate.toLocaleDateString() : '未設定',
                daysOpen: daysOpen < 1 ? 1 : daysOpen,
                totalAnnualRepairDays,
                remainingDays,
                isWarrantyExtendedTriggered,
                newWarrantyExpiryStr,
                createdDateObj: createdDate,
                itemsList: items,
                itemsCount: items.length,
              });
            }
          });
        }
      });

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

  const handleCompleteWorkOrder = async (orderId: string) => {
    if (!orderId) return;
    if (!confirm('確定要將此工單標示為【完工 (Completed)】嗎？')) return;

    try {
      setIsUpdating(true);
      const res = await fetch(`/api/work-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Completed',
          completed_date: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        alert('工單已順利標示為完工！');
        setSelectedOrder(null);
        await fetchOpenWorkOrders();
      } else {
        alert('更新完工狀態失敗，請再試一次。');
      }
    } catch (err) {
      console.error('完工操作失敗:', err);
      alert('網路連線失敗');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center bg-slate-800 text-white p-4 rounded-xl shadow-sm gap-2">
        <div>
          <h2 className="text-xl font-bold">工單即時總覽與可用率 (Availability Summary)</h2>
          <p className="text-xs text-slate-300 mt-1">目前全廠進行中 (Open) 工單共有 <span className="font-bold text-amber-400 text-sm">{openOrders.length}</span> 張（點擊卡片可查看詳細資料）</p>
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
          <p className="text-lg font-bold">目前資料庫中沒有任何狀態為 Open 的工單！</p>
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
                onClick={() => {
                  setSelectedOrder(order);
                  if (onSelectWorkOrder) onSelectWorkOrder(order);
                }}
                className="bg-white border rounded-xl p-4 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-blue-900 text-lg group-hover:text-blue-600 transition-colors">
                      📋 {order.order_number || 'WO-未知'}
                    </span>
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
                    <span>Claim Form 日期: <strong>{order.claimFormDateStr}</strong></span>
                    <span>本年合約累積停修: <strong className="text-red-600">{order.totalAnnualRepairDays} 天</strong> / 18.25 天</span>
                    <span>推延保固到期日: <strong>{order.newWarrantyExpiryStr}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 self-end md:self-center">
                  <div className={`px-4 py-2 rounded-lg border text-center ${badgeBg}`}>
                    <div className="text-xs">本單累積停修</div>
                    <div className="text-lg font-black">{order.daysOpen} 天</div>
                  </div>
                  <span className="text-xs font-bold text-slate-600">{riskLabel}</span>
                  <span className="text-xs text-blue-600 underline font-semibold group-hover:text-blue-800">
                    點擊檢視詳情 →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 工單詳細資料 Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-extrabold text-blue-900">
                    📋 {selectedOrder.order_number || 'WO-未知'}
                  </h3>
                  <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-300">
                    進行中 (Open)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">開單時間: {selectedOrder.createdDateStr || '未設定'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 車輛與可用率卡片 */}
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">車輛與合約可用率資訊</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs block">車牌號碼</span><strong>{selectedOrder.vehiclePlate}</strong></div>
                <div><span className="text-gray-500 text-xs block">VIN 碼</span><strong>{selectedOrder.vehicleVin}</strong></div>
                <div><span className="text-gray-500 text-xs block">專案名稱</span><strong>{selectedOrder.vehicleProject}</strong></div>
                <div><span className="text-gray-500 text-xs block">車輛位置</span><strong className="text-blue-900">{selectedOrder.vehicleLocation}</strong></div>
                <div><span className="text-gray-500 text-xs block">Claim Form 日期</span><strong className="text-emerald-800">{selectedOrder.claimFormDateStr}</strong></div>
                <div><span className="text-gray-500 text-xs block">交車日期 (年度起算日)</span><strong>{selectedOrder.deliveryDateStr}</strong></div>
                <div className="col-span-2 md:col-span-1"><span className="text-gray-500 text-xs block">推延保固到期日</span><strong className="text-purple-700">{selectedOrder.newWarrantyExpiryStr}</strong></div>
              </div>

              <div className="pt-2 border-t flex justify-between items-center text-xs">
                <div>
                  本年合約累積停修天數: <span className="font-extrabold text-red-600 text-sm">{selectedOrder.totalAnnualRepairDays ?? 0} 天</span> / 18.25 天
                </div>
                {selectedOrder.isWarrantyExtendedTriggered ? (
                  <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">⚠️ 觸發保固延長 6 個月</span>
                ) : (
                  <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">剩餘可用額度 {selectedOrder.remainingDays ?? 18.25} 天</span>
                )}
              </div>
            </div>

            {/* 工單狀況描述 */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">📝 狀況與故障描述</h4>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border leading-relaxed">
                {selectedOrder.description || '無詳細描述'}
              </p>
            </div>

            {/* 維修與零件項目 */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">🛠️ 維修與零件明細 ({selectedOrder.itemsCount ?? 0} 項)</h4>
              {selectedOrder.itemsList && selectedOrder.itemsList.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold border-b">
                      <tr>
                        <th className="p-2.5">類別</th>
                        <th className="p-2.5">項目名稱</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.itemsList.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2.5 font-bold">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">
                              {item.type || '維修項目'}
                            </span>
                          </td>
                          <td className="p-2.5 text-gray-800">{item.item_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">無詳細明細項目</p>
              )}
            </div>

            {/* Modal Footer 操作選項 */}
            <div className="flex justify-between items-center border-t pt-4">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                關閉視窗
              </button>
              {selectedOrder.id && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleCompleteWorkOrder(selectedOrder.id)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? '更新中...' : '✅ 標示為完工 (Completed)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}