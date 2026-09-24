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

  // 詳情/備註 Modal
  const [activeCardModal, setActiveCardModal] = useState<{ vehicle: any; order: any } | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  // 強制填寫拖拽資訊 Modal State
  const [dragPromptModal, setDragPromptModal] = useState<{
    isOpen: boolean;
    targetStage: 'aoshop' | 'outsourced' | null;
    orderId: string;
    pickupDate: string;
    contractorName: string;
  }>({
    isOpen: false,
    targetStage: null,
    orderId: '',
    pickupDate: new Date().toISOString().split('T')[0],
    contractorName: '',
  });

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

  // 定義 4 大分類
  const stages = [
    { key: 'wclaim', label: 'W/CLAIM 待取/無取車日期', color: 'bg-indigo-700', border: 'border-indigo-600' },
    { key: 'aoshop', label: 'AOSHOP 廠內維修中', color: 'bg-blue-700', border: 'border-blue-600' },
    { key: 'outsourced', label: '外判處理中', color: 'bg-purple-700', border: 'border-purple-600' },
    { key: 'pending_review', label: '待主管確認完工 (Pending Review)', color: 'bg-amber-700', border: 'border-amber-600' },
  ];

  // 根據要求精確歸類
  const categorizedVehicles = useMemo(() => {
    const list = {
      wclaim: [] as any[],
      aoshop: [] as any[],
      outsourced: [] as any[],
      pending_review: [] as any[],
    };

    vehicles.forEach((vehicle) => {
      const orders = vehicle.workOrders || vehicle.work_orders || [];
      const totalOrders = orders.length;

      orders.forEach((wo: any) => {
        const status = (wo.status || '').toLowerCase();
        const loc = (wo.garage_location || wo.location || '').toLowerCase();
        const pickupDate = wo.pickup_return_date || vehicle.pickup_return_date || '';

        // 已 Completed 者隱藏
        if (status === 'completed' || status === 'closed' || status === '已完工') return;

        // 篩選條件
        if (selectedGarageFilter !== 'ALL' && !loc.includes(selectedGarageFilter.toLowerCase())) return;
        if (onlyMultipleRepairs && totalOrders < 2) return;

        const itemData = { vehicle, order: wo, totalOrders };

        // 核心歸類邏輯：
        if (status === 'pending_review' || wo.is_staff_completed) {
          list.pending_review.push(itemData);
        } else if (loc.includes('外判') || status === 'outsourced' || status === 'booking') {
          list.outsourced.push(itemData);
        } else if (!pickupDate || pickupDate.trim() === '') {
          // 待取：全部 Open Status 且「無取車日期」的工單
          list.wclaim.push(itemData);
        } else {
          // 有取車日期，屬於廠內維修中
          list.aoshop.push(itemData);
        }
      });
    });

    return list;
  }, [vehicles, selectedGarageFilter, onlyMultipleRepairs]);

  // 更新工單 Database PATCH
  const updateOrderStatus = async (orderId: string, payload: any) => {
    try {
      const res = await fetch(`/api/work-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchKanbanData();
      }
    } catch (err) {
      console.error('更新資料庫失敗:', err);
    }
  };

  // 1. 同事標示已完成
  const handleStaffMarkComplete = (orderId: string) => {
    updateOrderStatus(orderId, { status: 'pending_review', is_staff_completed: true });
  };

  // 2. 主管確認完工 (隱藏卡片)
  const handleSupervisorConfirm = (orderId: string) => {
    if (confirm('確定主管確認無誤？確認後此工單將從看板中移除並標示為 Completed。')) {
      updateOrderStatus(orderId, { status: 'Completed', is_staff_completed: true });
    }
  };

  // 拖拽 Handle
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (!orderId) return;

    if (stageKey === 'aoshop') {
      // 拖到廠內維修：強制彈窗填取車日期
      setDragPromptModal({
        isOpen: true,
        targetStage: 'aoshop',
        orderId,
        pickupDate: new Date().toISOString().split('T')[0],
        contractorName: '',
      });
    } else if (stageKey === 'outsourced') {
      // 拖到外判處理：強制彈窗填取車日期與外判商
      setDragPromptModal({
        isOpen: true,
        targetStage: 'outsourced',
        orderId,
        pickupDate: new Date().toISOString().split('T')[0],
        contractorName: '',
      });
    } else if (stageKey === 'wclaim') {
      // 拖回待取：清空取車日期
      updateOrderStatus(orderId, { status: 'Open', pickup_return_date: '' });
    } else if (stageKey === 'pending_review') {
      updateOrderStatus(orderId, { status: 'pending_review', is_staff_completed: true });
    }
    setDraggedOrderId(null);
  };

  // 送出強制彈窗資料至 Database
  const handleSaveDragPrompt = () => {
    const { targetStage, orderId, pickupDate, contractorName } = dragPromptModal;
    if (!pickupDate) {
      alert('請填寫取車/回廠日期！');
      return;
    }

    if (targetStage === 'aoshop') {
      updateOrderStatus(orderId, {
        status: 'Open',
        pickup_return_date: pickupDate,
        vehicle_location: '工場',
      });
    } else if (targetStage === 'outsourced') {
      if (!contractorName.trim()) {
        alert('請填寫外判處理名稱/廠商！');
        return;
      }
      updateOrderStatus(orderId, {
        status: 'booking',
        pickup_return_date: pickupDate,
        garage_location: `外判 - ${contractorName.trim()}`,
      });
    }

    setDragPromptModal({ isOpen: false, targetStage: null, orderId: '', pickupDate: '', contractorName: '' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 font-sans select-none flex flex-col justify-between overflow-hidden">
      
      {/* 1. 頂部看板控制列與快捷篩選器 */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800 backdrop-blur mb-3 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🖥️</span>
          <h1 className="text-xl font-black tracking-wider text-amber-400">
            車輛維修動態看板 (廠內/外判即時控制台)
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
            <option value="九龍灣">機電 - 九龍灣</option>
            <option value="屯門">機電 - 屯門</option>
            <option value="柴灣">機電 - 柴灣</option>
            <option value="小蠔灣">機電 - 小蠔灣</option>
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

      {/* 2. 版面佈局：左側分類 + 右側方形卡片從左至右橫向排列 */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        {stages.map((stage) => {
          const items = (categorizedVehicles as any)[stage.key] || [];

          return (
            <div
              key={stage.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.key)}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 flex items-stretch gap-3 min-h-[140px] backdrop-blur shadow-md"
            >
              {/* 【左側欄位分類】 */}
              <div className={`w-48 min-w-[190px] ${stage.color} rounded-xl p-3 flex flex-col justify-between shadow-lg text-white`}>
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase opacity-80 tracking-widest block">CATEGORY</span>
                  <h3 className="text-base font-black leading-tight">{stage.label}</h3>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/20">
                  <span className="text-xs font-semibold">當前車輛數</span>
                  <span className="bg-black/30 text-white px-2.5 py-0.5 rounded-full font-black text-xs">
                    {items.length} 架
                  </span>
                </div>
              </div>

              {/* 【右側方形卡片由左至右橫向排列區】 */}
              <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
                {items.length === 0 ? (
                  <div className="text-slate-600 text-xs font-bold px-4 py-8 italic border border-dashed border-slate-800 rounded-xl w-full text-center">
                    此分類目前無待處理車輛
                  </div>
                ) : (
                  items.map(({ vehicle, order, totalOrders }: any, idx: number) => {
                    const isMultipleRepairs = totalOrders >= 2;
                    const isPendingReview = stage.key === 'pending_review';

                    // 抓取工單內所有的維修項目名稱
                    const rawItems = order.work_order_items || order.items || [];
                    const itemsSummary = rawItems.length > 0
                      ? rawItems.map((i: any) => i.item_name).filter(Boolean).join('、')
                      : order.description || '進廠維修';

                    return (
                      <div
                        key={order.id || idx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id)}
                        onClick={() => {
                          setActiveCardModal({ vehicle, order });
                          setNoteInput(order.notes || '');
                        }}
                        className={`w-64 min-w-[256px] h-32 bg-slate-800/90 border-2 ${
                          isPendingReview
                            ? 'border-amber-400 bg-amber-950/30 animate-pulse'
                            : isMultipleRepairs
                            ? 'border-red-500'
                            : 'border-slate-700'
                        } rounded-xl p-2.5 shadow-lg flex flex-col justify-between relative hover:scale-[1.02] hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing`}
                      >
                        {/* 1. 卡片頂部：品牌與取車/回廠日期 */}
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-bold">
                            {vehicle.brand || 'FUSO'} {vehicle.model ? `• ${vehicle.model}` : ''}
                          </span>
                          {order.pickup_return_date ? (
                            <span className="text-emerald-400 font-extrabold">
                              📅 取車: {order.pickup_return_date.slice(5)}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-extrabold">未設定取車日</span>
                          )}
                        </div>

                        {/* 2. 車牌號碼與多次報修警示 */}
                        <div className="text-xl font-black tracking-tight text-white my-0.5 flex items-center justify-between">
                          <span>{vehicle.plate_number}</span>
                          {isMultipleRepairs && (
                            <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                              ⚠️ 多次報修 ({totalOrders}次)
                            </span>
                          )}
                        </div>

                        {/* 3. 維修項目明細 (代替故障描述) */}
                        <p className="text-[11px] text-slate-200 font-bold line-clamp-1 bg-slate-950/70 px-2 py-1 rounded border border-slate-700/60 text-blue-300">
                          🛠️ {itemsSummary}
                        </p>

                        {/* 4. 底部位置與操作按鈕區 */}
                        <div className="flex justify-between items-center pt-1 border-t border-slate-700/60">
                          <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                            📍 {order.vehicle_location || order.garage_location || '機電1/F'}
                          </span>

                          {!isPendingReview ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStaffMarkComplete(order.id);
                              }}
                              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] rounded-md shadow cursor-pointer"
                            >
                              ✓ 同事已完成
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSupervisorConfirm(order.id);
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-md shadow animate-bounce cursor-pointer"
                            >
                              👑 確認完工 (清除)
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

      {/* 3. 強制填寫資料 Modal (拖拽落欄位時彈出) */}
      {dragPromptModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 text-black">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 border-b pb-2">
              📝 請補充工單狀態資料
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  取車 / 回廠日期 *
                </label>
                <input
                  type="date"
                  value={dragPromptModal.pickupDate}
                  onChange={(e) => setDragPromptModal({ ...dragPromptModal, pickupDate: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              {dragPromptModal.targetStage === 'outsourced' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    外判處理廠商 / 單位名稱 *
                  </label>
                  <input
                    type="text"
                    value={dragPromptModal.contractorName}
                    onChange={(e) => setDragPromptModal({ ...dragPromptModal, contractorName: e.target.value })}
                    placeholder="例如：冷氣專科車房 / 大昌行"
                    className="w-full p-2 border rounded-lg text-sm text-black bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDragPromptModal({ isOpen: false, targetStage: null, orderId: '', pickupDate: '', contractorName: '' })}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveDragPrompt}
                className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-blue-700"
              >
                確認並同步至 Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 卡片點擊詳情 Modal */}
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
              <p>車輛位置：<strong>{activeCardModal.order.vehicle_location || '未設定'}</strong></p>
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
                  updateOrderStatus(activeCardModal.order.id, { notes: noteInput });
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

      {/* 自訂滾動條 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
