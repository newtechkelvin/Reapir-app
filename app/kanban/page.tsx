'use client';

import React, { useState, useEffect } from 'react';

export default function KanbanDashboardPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 靜默擷取車輛與工單數據
  const fetchKanbanData = async () => {
    try {
      const res = await fetch('/api/vehicles'); // 請確保您的 API 路由支援獲取全部或當前車輛
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || data || []);
      }
    } catch (err) {
      console.error('看板數據刷新失敗:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchKanbanData();
    // 設定每 30 秒自動靜默刷新一次
    const interval = setInterval(fetchKanbanData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 全螢幕切換
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // 分類統計邏輯
  const columns = [
    { key: 'aoshop', label: 'AOSHOP / 廠內維修', color: 'bg-blue-600', border: 'border-blue-500' },
    { key: 'wclaim', label: 'W/CLAIM 待取/待簽', color: 'bg-indigo-600', border: 'border-indigo-500' },
    { key: 'booking', label: 'BOOKING 預約/待進廠', color: 'bg-amber-600', border: 'border-amber-500' },
    { key: 'bos', label: 'BOS / 特殊項目', color: 'bg-purple-600', border: 'border-purple-500' },
    { key: 'completed', label: 'COMPLETED 已完工', color: 'bg-emerald-600', border: 'border-emerald-500' },
  ];

  // 將車輛依據狀態分類
  const categorizedVehicles = {
    aoshop: [] as any[],
    wclaim: [] as any[],
    booking: [] as any[],
    bos: [] as any[],
    completed: [] as any[],
  };

  vehicles.forEach((vehicle) => {
    const orders = vehicle.workOrders || vehicle.work_orders || [];
    if (orders.length === 0) return;

    // 取得最新一張工單的狀態與位置進行歸類
    const latestOrder = orders[0];
    const status = (latestOrder.status || '').toLowerCase();
    const loc = (latestOrder.garage_location || latestOrder.location || '').toLowerCase();

    if (status === 'completed' || status === 'closed') {
      categorizedVehicles.completed.push({ vehicle, order: latestOrder });
    } else if (loc.includes('claim') || latestOrder.claim_form_date) {
      categorizedVehicles.wclaim.push({ vehicle, order: latestOrder });
    } else if (loc.includes('bos')) {
      categorizedVehicles.bos.push({ vehicle, order: latestOrder });
    } else if (status === 'booking' || status === 'pending') {
      categorizedVehicles.booking.push({ vehicle, order: latestOrder });
    } else {
      categorizedVehicles.aoshop.push({ vehicle, order: latestOrder });
    }
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 font-sans select-none flex flex-col justify-between overflow-hidden">
      
      {/* 1. 頂部看板控制列 */}
      <div className="flex justify-between items-center bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800 backdrop-blur mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🖥️</span>
          <h1 className="text-xl font-black tracking-wider text-amber-400">
            車輛維修狀態實時控制台 (LIVE DASHBOARD)
          </h1>
          <span className="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
            LIVE 24H
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
          <span>最後更新時間：<strong className="text-slate-200">{lastRefreshed || '更新中...'}</strong></span>
          <button
            onClick={fetchKanbanData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            🔄 手動刷新
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all cursor-pointer shadow-sm"
          >
            {isFullscreen ? '↙️ 退出全螢幕' : '⤢ 全螢幕播放'}
          </button>
        </div>
      </div>

      {/* 2. 看板核心網格欄位區 (5 欄分區) */}
      <div className="flex-1 grid grid-cols-5 gap-3 overflow-hidden">
        {columns.map((col) => {
          const items = (categorizedVehicles as any)[col.key] || [];

          return (
            <div
              key={col.key}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden backdrop-blur"
            >
              {/* 欄位 Header */}
              <div className={`${col.color} text-white px-3 py-2 font-black text-sm flex justify-between items-center shadow-md`}>
                <span>{col.label}</span>
                <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs font-extrabold">
                  {items.length}
                </span>
              </div>

              {/* 卡片動態滾動區域 */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs font-bold">
                    暫無紀錄
                  </div>
                ) : (
                  items.map(({ vehicle, order }: any, idx: number) => {
                    const totalOrders = (vehicle.workOrders || vehicle.work_orders || []).length;
                    const isMultipleRepairs = totalOrders >= 2;

                    return (
                      <div
                        key={vehicle.id || idx}
                        className={`bg-slate-800/90 border-2 ${isMultipleRepairs ? 'border-red-500' : 'border-slate-700'} rounded-lg p-2.5 shadow-lg relative hover:scale-[1.02] transition-all`}
                      >
                        {/* 頂部標籤與天數 */}
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                          <span className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-bold">
                            {vehicle.brand || 'FUSO'} {vehicle.model ? `• ${vehicle.model}` : ''}
                          </span>
                          {order.claim_form_date && (
                            <span className="text-amber-400 font-extrabold">
                              {order.claim_form_date.slice(5)}
                            </span>
                          )}
                        </div>

                        {/* 車牌大字 */}
                        <div className="text-2xl font-black tracking-tight text-white my-0.5 flex items-center justify-between">
                          <span>{vehicle.plate_number}</span>
                          {isMultipleRepairs && (
                            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold animate-bounce">
                              ⚠️ 多次報修
                            </span>
                          )}
                        </div>

                        {/* 故障描述 */}
                        <p className="text-xs text-slate-300 font-semibold line-clamp-2 bg-slate-900/60 p-1.5 rounded border border-slate-700/50 mt-1">
                          {order.description || '進廠檢查與維修'}
                        </p>

                        {/* 底部屬性標籤 */}
                        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                          {vehicle.project && (
                            <span className="bg-blue-950/80 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">
                              {vehicle.project}
                            </span>
                          )}
                          <span className="bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded">
                            📍 {order.garage_location || '機電1/F'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 自訂滾動條樣式 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
