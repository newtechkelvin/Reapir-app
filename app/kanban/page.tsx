'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function KanbanDashboardPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 篩選器 State
  const [selectedGarageFilter, setSelectedGarageFilter] = useState<string>('ALL');
  const [onlyMultipleRepairs, setOnlyMultipleRepairs] = useState<boolean>(false);

  // 彈窗與卡片互動 State
  const [activeCardModal, setActiveCardModal] = useState<{ vehicle: any; order: any } | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [draggedOrder, setDraggedOrder] = useState<any | null>(null);

  // 擷取看板數據
  const fetchKanbanData = async () => {
    try {
      const res = await fetch('/api/vehicles');
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
    const interval = setInterval(fetchKanbanData, 30000); // 30 秒自動靜默刷新
    return () => clearInterval(interval);
  }, []);

  // 全螢幕切換
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 定義橫向流向 4 大階段
  const stages = [
    { key: 'wclaim', label: '1. W/CLAIM 待取/待簽', color: 'bg-indigo-600', border: 'border-indigo-500' },
    { key: 'aoshop', label: '2. AOSHOP 廠內維修中', color: 'bg-blue-600', border: 'border-blue-500' },
    { key: 'booking_bos', label: '3. BOOKING / BOS 特殊處理', color: 'bg-purple-600', border: 'border-purple-500' },
    { key: 'pending_review', label: '4. 待主管確認完工 (Pending Review)', color: 'bg-amber-600', border: 'border-amber-500' },
  ];

  // 資料處理與歸類 (自動過濾已完全簽核結案的工單)
  const categorizedVehicles = useMemo(() => {
    const list = {
      wclaim: [] as any[],
      aoshop: [] as any[],
      booking_bos: [] as any[],
      pending_review: [] as any[],
    };

    vehicles.forEach((vehicle) => {
      const orders = vehicle.workOrders || vehicle.work_orders || [];
      const totalOrders = orders.length;

      orders.forEach((wo: any) => {
        const status = (wo.status || '').toLowerCase();
        const loc = (wo.garage_location || wo.location || '').toLowerCase();

        // 條件過濾：完全 Completed / Closed 且已簽核者，直接隱藏不顯示
        if (status === 'completed' || status === 'closed' || status === '已完工') return;

        // 篩選器條件檢查
        if (selectedGarageFilter !== 'ALL' && !loc.includes(selectedGarageFilter.toLowerCase())) return;
        if (onlyMultipleRepairs && totalOrders < 2) return;

        const itemData = { vehicle, order: wo, totalOrders };

        // 狀態階段歸類
        if (status === 'pending_review' || wo.is_staff_completed) {
          list.pending_review.push(itemData);
        } else if (loc.includes('claim') || wo.claim_form_date) {
          list.wclaim.push(itemData);
        } else if (status === 'booking' || loc.includes('bos')) {
          list.booking_bos.push(itemData);
        } else {
          list.aoshop.push(itemData);
        }
      });
    });

    return list;
  }, [vehicles, selectedGarageFilter, onlyMultipleRepairs]);

  // 更新工單狀態 API
  const updateOrderStatus = async (orderId: string, newStatus: string, extraData: any = {}) => {
    try {
      const res = await fetch(`/api/work-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extraData }),
      });
      if (res.ok) {
        fetchKanbanData();
      }
    } catch (err) {
      console.error('更新狀態失敗:', err);
    }
  };

  // 1. 同事標示「同事已完成」
  const handleStaffMarkComplete = (orderId: string) => {
    updateOrderStatus(orderId, 'pending_review', { is_staff_completed: true });
  };

  // 2. 主管點擊「確認完工」 (工單消失於畫面)
  const handleSupervisorConfirm = (orderId: string) => {
    if (confirm('確定主管確認無誤？確認後此工單將從看板中移除並標示為 Completed。')) {
      updateOrderStatus(orderId, 'Completed', { is_staff_completed: true });
    }
  };

  // 拖拽手勢處理
  const handleDragStart = (e: React.DragEvent, order: any) => {
    setDraggedOrder(order);
  };

  const handleDrop = (stageKey: string) => {
    if (!draggedOrder) return;
    let targetStatus = 'Open';
    if (stageKey === 'pending_review') targetStatus = 'pending_review';
    else if (stageKey === 'booking_bos') targetStatus = 'booking';
    
    updateOrderStatus(draggedOrder.id, targetStatus);
    setDraggedOrder(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 font-sans select-none flex flex-col justify-between overflow-hidden">
      
      {/* 1. 頂部看板控制列與快捷篩選器 */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800 backdrop-blur mb-3 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🖥️</span>
          <h1 className="text-xl font-black tracking-wider text-amber-400">
            車輛維修動態看板 (橫向流程控制台)
          </h1>
          <span className="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
            LIVE 24H
          </span>
        </div>

        {/* 快捷篩選工具列 */}
        <div className="flex items-center gap-2">
          <select
            value={selectedGarageFilter}
            onChange={(e) => setSelectedGarageFilter(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg focus:outline-none"
          >
            <option value="ALL">📍 所有車房位置</option>
            <option value="九龍灣">九龍灣</option>
            <option value="屯門">屯門</option>
            <option value="柴灣">柴灣</option>
            <option value="小蠔灣">小蠔灣</option>
          </select>

          <button
            onClick={() => setOnlyMultipleRepairs(!onlyMultipleRepairs)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              onlyMultipleRepairs
                ? 'bg-red-600 text-white border-red-500 shadow-md animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {onlyMultipleRepairs ? '⚠️ 僅高亮多次報修' : '🔍 顯示全部車輛'}
          </button>
        </div>

        {/* 時間與全螢幕按鈕 */}
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span>最後更新：<strong className="text-slate-200">{lastRefreshed || '更新中...'}</strong></span>
          <button
            onClick={fetchKanbanData}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
          >
            🔄 刷新
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all cursor-pointer shadow-sm"
          >
            {isFullscreen ? '↙️ 退出全螢幕' : '⤢ 全螢幕播放'}
          </button>
        </div>
      </div>

      {/* 2. 核心橫向流向 4 大階段 (Horizontal Layout) */}
      <div className="flex-1 grid grid-cols-4 gap-3 overflow-hidden">
        {stages.map((stage) => {
          const items = (categorizedVehicles as any)[stage.key] || [];

          return (
            <div
              key={stage.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
              className="bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden backdrop-blur"
            >
              {/* 階段標題 Header */}
              <div className={`${stage.color} text-white px-3 py-2 font-black text-sm flex justify-between items-center shadow-md`}>
                <span>{stage.label}</span>
                <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs font-extrabold">
                  {items.length} 架
                </span>
              </div>

              {/* 卡片動態滾動區域 */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 text-xs font-bold">
                    目前無車輛
                  </div>
                ) : (
                  items.map(({ vehicle, order, totalOrders }: any, idx: number) => {
                    const isMultipleRepairs = totalOrders >= 2;
                    const isPendingReview = stage.key === 'pending_review';

                    return (
                      <div
                        key={order.id || idx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order)}
                        onClick={() => {
                          setActiveCardModal({ vehicle, order });
                          setNoteInput(order.notes || '');
                        }}
                        className={`bg-slate-800/90 border-2 ${
                          isPendingReview
                            ? 'border-amber-400 bg-amber-950/20 animate-pulse'
                            : isMultipleRepairs
                            ? 'border-red-500'
                            : 'border-slate-700'
                        } rounded-xl p-3 shadow-lg relative hover:scale-[1.02] transition-all cursor-pointer`}
                      >
                        {/* 卡片標題：車型與日期 */}
                        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                          <span className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-bold">
                            {vehicle.brand || 'FUSO'} {vehicle.model ? `• ${vehicle.model}` : ''}
                          </span>
                          {order.claim_form_date && (
                            <span className="text-amber-400 font-extrabold">
                              {order.claim_form_date.slice(5)}
                            </span>
                          )}
                        </div>

                        {/* 車牌大字與多次報修警示 */}
                        <div className="text-2xl font-black tracking-tight text-white my-0.5 flex items-center justify-between">
                          <span>{vehicle.plate_number}</span>
                          {isMultipleRepairs && (
                            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                              ⚠️ 多次報修 ({totalOrders}次)
                            </span>
                          )}
                        </div>

                        {/* 故障描述簡述 */}
                        <p className="text-xs text-slate-300 font-semibold line-clamp-2 bg-slate-900/70 p-2 rounded-md border border-slate-700/50 my-1.5">
                          {order.description || '進廠檢查與維修'}
                        </p>

                        {/* 操作按鈕區 */}
                        <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">
                            📍 {order.garage_location || '機電1/F'}
                          </span>

                          {!isPendingReview ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStaffMarkComplete(order.id);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] rounded-lg shadow cursor-pointer"
                            >
                              ✓ 同事標示已完成
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSupervisorConfirm(order.id);
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-md animate-bounce cursor-pointer"
                            >
                              👑 主管確認完工 (清除卡片)
                            </button>
                          )}
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

      {/* 3. 卡片點擊快速預覽與新增備註 Modal */}
      {activeCardModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 text-black">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xl font-black text-slate-900">
                🚘 {activeCardModal.vehicle.plate_number} 維修明細
              </h3>
              <button
                onClick={() => setActiveCardModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p>工單編號：<strong className="text-blue-900">{activeCardModal.order.order_number || 'WO-未知'}</strong></p>
              <p>車輛專案：<strong>{activeCardModal.vehicle.project || '未設定'}</strong></p>
              <p>故障敘述：<strong>{activeCardModal.order.description || '無描述'}</strong></p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">✍️ 追加/修改工程進度備註 (Notes)</label>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="輸入進度備註..."
                className="w-full p-2 border rounded-lg text-xs bg-slate-50 focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveCardModal(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
              >
                關閉
              </button>
              <button
                onClick={() => {
                  updateOrderStatus(activeCardModal.order.id, activeCardModal.order.status || 'Open', {
                    notes: noteInput,
                  });
                  setActiveCardModal(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700"
              >
                💾 儲存備註
              </button>
            </div>
          </div>
        </div>
      )}

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
