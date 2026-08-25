'use client';

import React, { useState, useEffect } from 'react';

export default function WorkOrdersSummary() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGovernmentVehicles();
  }, []);

  const fetchGovernmentVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const data = await res.json();
        // 僅篩選政府合約車輛
        const govVehicles = (data.vehicles || []).filter((v: any) => {
          const wType = (v.warranty_type || '').toLowerCase();
          const project = (v.project || '').toLowerCase();
          return wType !== 'general' && wType !== '散車' && !project.includes('散車');
        });
        setVehicles(govVehicles);
      }
    } catch (err) {
      console.error('讀取政府合約 Summary 失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 計算累積 Open 停修日數
  const calculateTotalOpenDays = (orders: any[]) => {
    let totalDays = 0;
    const now = new Date();

    orders.forEach((wo) => {
      // 僅計算 Open / 進廠維修中的工單
      if ((wo.status || 'Open').toLowerCase() === 'open') {
        const startDateStr = wo.claim_form_date || wo.created_at;
        if (startDateStr) {
          const start = new Date(startDateStr);
          const diffTime = Math.max(0, now.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          totalDays += diffDays;
        }
      }
    });

    return totalDays;
  };

  // 計算 Availability (%) [基準：18.25天為可扣除扣分上限]
  const calculateAvailability = (totalOpenDays: number) => {
    const targetDays = 18.25;
    if (totalOpenDays <= 0) return 100;
    const avail = Math.max(0, 100 - (totalOpenDays / targetDays) * 5); // 扣分指標計算
    return parseFloat(avail.toFixed(2));
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      v.plate_number?.toLowerCase().includes(term) ||
      v.vin?.toLowerCase().includes(term) ||
      v.project?.toLowerCase().includes(term) ||
      v.brand?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-black">
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-900">🏛️ 政府合約維修工單 Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">監控政府車輛 18.25 天停修日數扣減與 95% 標的可用率 (Committed Availability)</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋車牌、VIN、專案..."
            className="p-2 border rounded-xl text-xs bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={fetchGovernmentVehicles}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            🔄 重新整理
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入政府合約 Summary...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">
          <p className="text-base font-bold">無政府合約車輛與工單紀錄</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle, idx) => {
            const orders = vehicle.workOrders || vehicle.work_orders || [];
            const openOrders = orders.filter((o: any) => (o.status || 'Open').toLowerCase() === 'open');
            const totalOpenDays = calculateTotalOpenDays(orders);
            const availability = calculateAvailability(totalOpenDays);

            const isWarning = availability < 95;

            return (
              <div
                key={vehicle.id || idx}
                className="bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all border-slate-200 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div>
                      <span className="text-xl font-black text-blue-900 block">🚘 {vehicle.plate_number}</span>
                      <span className="text-xs text-gray-500">VIN: {vehicle.vin || '未填寫'}</span>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      🏛️ 政府合約
                    </span>
                  </div>

                  {/* 核心指標：工單累計 Open 日數 & 可用率 Availability */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border">
                      <span className="text-gray-500 block text-[11px]">工單累計 Open 日數</span>
                      <strong className={`text-base font-black ${totalOpenDays > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {totalOpenDays} 天
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border">
                      <span className="text-gray-500 block text-[11px]">Availability (可用率)</span>
                      <strong className={`text-base font-black ${isWarning ? 'text-red-600' : 'text-emerald-600'}`}>
                        {availability}%
                      </strong>
                    </div>

                    <div className="col-span-2 flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                      <span>專案：<strong className="text-slate-900">{vehicle.project || '未設定'}</strong></span>
                      <span>進行中工單：<strong className="text-amber-700 font-bold">{openOrders.length} 張</strong></span>
                    </div>
                  </div>
                </div>

                {/* 歷史工單列表概覽 */}
                <div className="text-xs space-y-1 border-t pt-2">
                  <span className="font-bold text-gray-700 block text-[11px]">最新工單紀錄:</span>
                  {orders.length === 0 ? (
                    <span className="text-gray-400 italic">無工單紀錄</span>
                  ) : (
                    orders.slice(0, 2).map((wo: any, oIdx: number) => (
                      <div key={oIdx} className="flex justify-between items-center text-[11px] bg-slate-50 p-1.5 rounded border">
                        <span className="font-bold text-blue-900">{wo.order_number || 'WO-未知'}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${wo.status?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {wo.status || 'Open'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}