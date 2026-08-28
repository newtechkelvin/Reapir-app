'use client';

import React, { useState } from 'react';
import { calculateAvailability } from '@/lib/availability';

export interface WorkOrdersSummaryProps {
  vehicles?: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function WorkOrdersSummary({
  vehicles = [],
  isLoading = false,
  onRefresh = () => {},
}: WorkOrdersSummaryProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 對齊「車輛維修工單 (Repair Job Sheet)」Modal 狀態
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [editLocation, setEditLocation] = useState('機電 - 九龍灣1/F');
  const [editSpot, setEditSpot] = useState('');
  const [editPickupReturnDate, setEditPickupReturnDate] = useState('');
  const [editClaimDate, setEditClaimDate] = useState('');
  const [editCompletedDate, setEditCompletedDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 所有報表統計均直接使用統一 availability 計算，不再使用舊版 fallback。
  const getVehicleStats = (vehicle: any) => {
    const orders = vehicle.workOrders || vehicle.work_orders || vehicle.orders || [];
    const calculation = calculateAvailability(vehicle);
    const now = new Date();
    const openOrders = orders
      .filter((wo: any) => {
        const status = String(wo.status || 'open').toLowerCase();
        return status !== 'completed' && status !== 'closed';
      })
      .map((wo: any) => {
        const startValue = wo.claim_form_date || wo.created_at || wo.date;
        const start = startValue ? new Date(startValue) : now;
        return {
          ...wo,
          woNum: wo.order_number || wo.work_order_number || wo.form_number || wo.claim_form_number || 'WO-PENDING',
          openDays: Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))),
          vehiclePlate: vehicle.plate_number,
          vehicleBrand: vehicle.brand || '未設定',
          vehicleModel: vehicle.model || '未設定',
          vehicleVin: vehicle.vin || '未設定',
          vehicleProject: vehicle.project || '未設定',
        };
      });

    const currentPeriod = calculation.currentPeriod;
    return {
      // 停修日及可用率必須同時來自同一個 currentPeriod。
      totalOpenDays: currentPeriod?.repairDays ?? null,
      availability: currentPeriod?.availability ?? null,
      periodStart: currentPeriod?.start ?? null,
      periodEnd: currentPeriod?.end ?? null,
      periodTriggered: currentPeriod?.triggered === true,
      orderCount: orders.length,
      openCount: calculation.openCount,
      openOrders,
      origExpiryStr: calculation.originalExpiryDate || '未設定',
      finalExpiryStr: calculation.finalExpiryDate || '未設定',
      extensionMonths: calculation.extensionMonths,
    };
  };

  // 篩選有 Open 工單的政府車輛
  const governmentVehiclesWithOpenOrders = (vehicles || [])
    .filter((v: any) => (v.warranty_type || 'government').toLowerCase() === 'government')
    .map((v: any) => ({ ...v, stats: getVehicleStats(v) }))
    .filter((v: any) => v.stats.openCount > 0);

  // 全站現時 Open 工單總數
  const totalOpenOrdersCount = governmentVehiclesWithOpenOrders.reduce(
    (sum: number, v: any) => sum + v.stats.openCount,
    0
  );

  // 對數報表：只顯示目前有效期間本身觸發展延的政府車輛。
  // 只曾在過往期間觸發、但目前期間未觸發的車輛，不列入當期報表。
  const lowAvailabilityVehicles = (vehicles || [])
    .filter((v: any) => (v.warranty_type || 'government').toLowerCase() === 'government')
    .map((v: any) => ({ ...v, stats: getVehicleStats(v) }))
    .filter((v: any) => v.stats.periodTriggered && v.stats.availability !== null && v.stats.availability < 95)
    .sort((a: any, b: any) => (b.stats.totalOpenDays ?? 0) - (a.stats.totalOpenDays ?? 0));

  const exportPenaltyReport = () => {
    const headers = ['報表日期', '車牌號碼', 'VIN', '專案', '當期停修日', '當期可用率', '原保固到期日', '展延月份', '修正後保固到期日'];
    const today = new Date().toISOString().split('T')[0];
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = lowAvailabilityVehicles.map((vehicle: any) => [
      today,
      vehicle.plate_number,
      vehicle.vin,
      vehicle.project,
          vehicle.stats.totalOpenDays === null ? '' : vehicle.stats.totalOpenDays,
      vehicle.stats.availability === null ? '' : `${vehicle.stats.availability}%`,
      vehicle.stats.origExpiryStr,
      vehicle.stats.extensionMonths,
      vehicle.stats.finalExpiryStr,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `政府合約罰則對數報表-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 搜尋過濾
  const filteredVehicles = governmentVehiclesWithOpenOrders
    .filter((v: any) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        v.plate_number?.toLowerCase().includes(term) ||
        v.project?.toLowerCase().includes(term) ||
        v.brand?.toLowerCase().includes(term) ||
        v.model?.toLowerCase().includes(term)
      );
    })
    .sort((a: any, b: any) => b.stats.openCount - a.stats.openCount || b.stats.totalOpenDays - a.stats.totalOpenDays);

  // 開啟工單明細 Modal
  const handleOpenDetailModal = (order: any) => {
    setSelectedOrder(order);
    setEditLocation(order.garage_location || order.location || '機電 - 九龍灣1/F');
    setEditSpot(order.vehicle_spot || '');
    setEditPickupReturnDate(order.pickup_return_date || '');
    setEditClaimDate(order.claim_form_date || '');
    setEditCompletedDate(order.completed_date || '');
    setEditDescription(order.description || '');

    let rawItems: any = order.items || order.work_order_items || order.repair_items || [];
    
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch (e) {
        rawItems = rawItems.split(';').map((str: string) => ({
          completed: true,
          type: '進廠維修',
          item_name: str.trim(),
          notes: '舊保單批次自動匯入',
        }));
      }
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const parsed = rawItems.map((it: any) => {
        if (typeof it === 'string') {
          return {
            completed: true,
            type: '進廠維修',
            item_name: it,
            notes: '舊保單批次自動匯入',
          };
        }
        return {
          completed: it.completed ?? true,
          type: it.type || '進廠維修',
          item_name: it.item_name || it.name || '',
          notes: it.notes || '舊保單批次自動匯入',
        };
      });
      setEditItems(parsed);
    } else {
      setEditItems([{ completed: false, type: '進廠維修', item_name: '', notes: '' }]);
    }
  };

  const handleAddItem = () => {
    setEditItems([
      ...editItems,
      { completed: false, type: '進廠維修', item_name: '', notes: '' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...editItems];
    updated[index][field] = value;
    setEditItems(updated);
  };

  const handleSaveOrderEdit = async () => {
    if (!selectedOrder) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/work-orders/${selectedOrder.id || selectedOrder.woNum}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garage_location: editLocation,
          vehicle_spot: editSpot,
          pickup_return_date: editPickupReturnDate,
          claim_form_date: editClaimDate,
          completed_date: editCompletedDate,
          description: editDescription,
          items: editItems,
        }),
      });

      if (res.ok) {
        alert('工單更新成功！');
        setSelectedOrder(null);
        onRefresh();
      } else {
        alert('儲存失敗，請檢查資料格式');
      }
    } catch (err) {
      console.error('儲存工單出錯:', err);
      alert('網路連線失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-black">
      {/* 搜尋與頂部工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex-1 w-full flex items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋車牌、專案、品牌..."
            className="w-full p-2.5 border rounded-xl text-sm font-semibold bg-white text-black focus:ring-2 focus:ring-blue-500 border-slate-300"
          />

          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap shrink-0 shadow-2xs flex items-center gap-1.5">
            <span>🔥 現時 Open 工單總數:</span>
            <strong className="text-base text-red-600 font-black">{totalOpenOrdersCount} 張</strong>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            📋 保固展延對數報表 (可用率 &lt; 95%)
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl shadow-xs cursor-pointer border border-slate-300 whitespace-nowrap"
          >
            🔄 重新整理
          </button>
        </div>
      </div>

      {/* 3 欄式卡片列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">
          ⏳ 正在載入車輛工單資料...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500">
          <p className="text-base font-bold">目前沒有有 Open 工單的政府車輛</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredVehicles.map((vehicle: any, idx: number) => {
            const { stats } = vehicle;

            const isCritical = stats.availability < 95;
            const isWarning = stats.availability >= 95 && stats.availability <= 96;

            let cardBorderClass = 'border-slate-200';
            if (isCritical) cardBorderClass = 'border-red-300 ring-1 ring-red-300';
            if (isWarning) cardBorderClass = 'border-amber-400 ring-2 ring-amber-400';

            return (
              <div
                key={vehicle.id || idx}
                className={`bg-white border-2 rounded-2xl p-5 shadow-2xs space-y-4 hover:shadow-md transition-all ${cardBorderClass}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2 truncate">
                      🚘 {vehicle.plate_number}
                    </h3>
                    <span className="text-[11px] text-gray-400 block mt-0.5 font-medium truncate">
                      VIN: {vehicle.vin || '未設定'}
                    </span>
                  </div>

                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
                    🏛️ 政府合約
                  </span>
                </div>

                <hr className="border-slate-100" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-0">
                    <span className="text-[11px] text-gray-400 font-bold block truncate">
                      當期累積停修天數
                    </span>
                    <strong className="text-xl font-black text-red-600 block mt-1 truncate">
                      {stats.totalOpenDays} 天
                    </strong>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl min-w-0 relative">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[11px] text-gray-400 font-bold block truncate">
                        Availability (可用率)
                      </span>
                      {isWarning && (
                        <span className="bg-amber-500 text-white text-[10px] px-1 py-0.5 rounded font-black whitespace-nowrap shrink-0">
                          ⚠️ 接近 95%
                        </span>
                      )}
                    </div>
                    <strong
                      className={`text-xl font-black block mt-1 truncate ${
                        isCritical ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {stats.availability}%
                    </strong>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 gap-2">
                  <span
                    className="text-slate-800 font-extrabold truncate flex-1"
                    title={vehicle.project}
                  >
                    專案 : {vehicle.project || '預設專案'}
                  </span>
                  <span className="text-slate-700 font-bold whitespace-nowrap shrink-0">
                    Open 工單數 : <strong className="text-red-600">{stats.openCount} 張</strong>
                  </span>
                </div>

                <hr className="border-slate-100" />

                <div className="space-y-2 pt-1">
                  <span className="text-xs text-slate-800 font-bold block">Open 工單清單:</span>

                  {stats.openOrders.length === 0 ? (
                    <div className="text-xs text-gray-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center font-medium">
                      目前無進行中的工單
                    </div>
                  ) : (
                    stats.openOrders.map((wo: any, wIdx: number) => (
                      <div
                        key={wo.id || wIdx}
                        className="bg-blue-50/50 border border-blue-100 p-2.5 rounded-xl flex justify-between items-center text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-bold text-blue-900 truncate">
                            {wo.woNum}
                          </span>
                          <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-md text-[10px] whitespace-nowrap shrink-0">
                            Open ({wo.openDays}天)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(wo)}
                          className="text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5 whitespace-nowrap shrink-0 border-0 bg-transparent"
                        >
                          檢視明細 &rarr;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 「車輛維修工單 (Repair Job Sheet)」Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1 pb-2">
              <h2 className="text-xl font-black text-slate-900 tracking-wide">
                新力機械有限公司
              </h2>
              <p className="text-[11px] text-gray-500 font-bold tracking-widest uppercase">
                NEW TECH MOTOR ENGINEERING LIMITED
              </p>
              <div className="bg-slate-100 py-1 px-4 rounded-lg inline-block border border-slate-200 mt-1">
                <span className="text-sm font-black text-slate-800">
                  車輛維修工單 (Repair Job Sheet)
                </span>
              </div>
            </div>

            <hr className="border-slate-800 border-t-2" />

            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-blue-900 flex items-center gap-1">
                  📋 {selectedOrder.woNum}
                </span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black px-2.5 py-0.5 rounded-full">
                  狀態: {selectedOrder.status || 'Open'}
                </span>
                <span className="text-[11px] text-gray-400 font-medium ml-2">
                  最後更新時間: {selectedOrder.updated_at || new Date().toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  🖨️ 列印此工單
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b pb-2 border-slate-200">
                🚘 車輛與合約基本資訊
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 font-bold">工單編號 :</span>
                  <p className="font-black text-slate-900 text-sm mt-0.5">{selectedOrder.woNum}</p>
                </div>

                <div>
                  <span className="text-gray-500 font-bold">車牌號碼 :</span>
                  <p className="font-black text-blue-900 text-sm mt-0.5">{selectedOrder.vehiclePlate}</p>
                </div>

                <div>
                  <span className="text-gray-500 font-bold">車輛品牌 :</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedOrder.vehicleBrand}</p>
                </div>

                <div>
                  <span className="text-gray-500 font-bold">車類型號 :</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedOrder.vehicleModel}</p>
                </div>

                <div>
                  <span className="text-gray-500 font-bold">VIN 碼 :</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedOrder.vehicleVin}</p>
                </div>

                <div>
                  <span className="text-gray-500 font-bold">專案名稱 :</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedOrder.vehicleProject}</p>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">車房位置 :</label>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full p-2 border rounded-xl font-bold bg-white border-slate-300"
                  >
                    <option value="機電 - 九龍灣1/F">機電 - 九龍灣1/F</option>
                    <option value="機電 - 屯門">機電 - 屯門</option>
                    <option value="機電 - 葵涌">機電 - 葵涌</option>
                    <option value="外部車房">外部車房</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">車輛位置 :</label>
                  <input
                    type="text"
                    value={editSpot}
                    onChange={(e) => setEditSpot(e.target.value)}
                    placeholder="例如：停泊位 B2"
                    className="w-full p-2 border rounded-xl font-semibold bg-white border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">取車/回廠日期 :</label>
                  <input
                    type="date"
                    value={editPickupReturnDate}
                    onChange={(e) => setEditPickupReturnDate(e.target.value)}
                    className="w-full p-2 border rounded-xl font-semibold bg-white border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Claim Form 日期 :</label>
                  <input
                    type="date"
                    value={editClaimDate}
                    onChange={(e) => setEditClaimDate(e.target.value)}
                    className="w-full p-2 border rounded-xl font-semibold bg-white border-slate-300"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-gray-500 font-bold mb-1">完成維修/交車日期 :</label>
                  <input
                    type="date"
                    value={editCompletedDate}
                    onChange={(e) => setEditCompletedDate(e.target.value)}
                    className="w-full p-2 border rounded-xl font-semibold bg-emerald-50 border-emerald-300 text-emerald-900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                📝 狀況與故障描述
              </h3>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="請輸入故障說明描述..."
                className="w-full p-3 border rounded-2xl text-xs font-semibold bg-slate-50 border-slate-200 text-slate-800 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  🛠️ 維修與零件項目明細
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                >
                  + 新增維修項目
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center w-12">完成</th>
                      <th className="p-2.5 w-32">類別</th>
                      <th className="p-2.5">項目名稱</th>
                      <th className="p-2.5">進度備註 (Notes)</th>
                      <th className="p-2.5 text-center w-12">刪除</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {editItems.map((item, iIdx) => (
                      <tr key={iIdx} className="hover:bg-slate-50">
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={(e) => handleItemChange(iIdx, 'completed', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.type}
                            onChange={(e) => handleItemChange(iIdx, 'type', e.target.value)}
                            className="w-full p-1.5 border rounded-lg font-bold bg-white text-xs border-slate-300"
                          >
                            <option value="進廠維修">進廠維修</option>
                            <option value="更換零件">更換零件</option>
                            <option value="定期保養">定期保養</option>
                            <option value="其他">其他</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(iIdx, 'item_name', e.target.value)}
                            placeholder="請輸入項目名稱..."
                            className="w-full p-1.5 border rounded-lg font-bold bg-white text-xs border-slate-300 text-slate-900"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => handleItemChange(iIdx, 'notes', e.target.value)}
                            placeholder="例如：舊保單批次自動匯入"
                            className="w-full p-1.5 border border-dashed rounded-lg font-medium bg-slate-50 text-xs border-slate-300 text-slate-700"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(iIdx)}
                            className="text-red-500 hover:text-red-700 font-bold text-sm cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                關閉
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveOrderEdit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isSaving ? '⏳ 儲存修改中...' : '💾 儲存工單變更'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保固展延對數報表 Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 text-center tracking-wide">
                  新力機械有限公司
                </h2>
                <p className="text-xs text-center text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                  NEW TECH MOTOR ENGINEERING LIMITED
                </p>
                <div className="mt-2 text-center">
                  <span className="bg-red-50 text-red-700 font-black text-sm px-4 py-1 rounded-full border border-red-200">
                    🏛️                     政府車輛保固展延對數報表 (現行期間已觸發展延)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-between text-xs text-gray-500 font-bold px-1">
              <span>報表產生日期: {new Date().toISOString().split('T')[0]}</span>
              <span className="text-red-600">
                超標車輛總計: {lowAvailabilityVehicles.length} 輛
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3 text-center">車牌號碼</th>
                    <th className="p-3">專案編號</th>
                    <th className="p-3 text-center">當期累積停修</th>
                    <th className="p-3 text-center">當期可用率 (Availability)</th>
                    <th className="p-3 text-center">原保固到期日</th>
                    <th className="p-3 text-center">展延月份</th>
                    <th className="p-3 text-center">修正後保固到期日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {lowAvailabilityVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">
                        🎉 目前所有政府車輛當期可用率均大於或等於 95%！
                      </td>
                    </tr>
                  ) : (
                    lowAvailabilityVehicles.map((vehicle: any, idx: number) => (
                      <tr key={vehicle.id || idx} className="hover:bg-slate-50 transition-all">
                        <td className="p-3 text-center font-black text-blue-900">
                          {vehicle.plate_number}
                        </td>
                        <td className="p-3 text-slate-700">{vehicle.project || '未指定'}</td>
                        <td className="p-3 text-center font-bold text-red-600">
                          {vehicle.stats.totalOpenDays === null ? '—' : `${vehicle.stats.totalOpenDays} 天`}
                        </td>
                        <td className="p-3 text-center font-black text-red-600">
                          {vehicle.stats.availability}%
                        </td>
                        <td className="p-3 text-center text-gray-400">
                          {vehicle.stats.origExpiryStr}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-700">
                          +{vehicle.stats.extensionMonths} 個月
                        </td>
                        <td className="p-3 text-center font-black text-emerald-800">
                          {vehicle.stats.finalExpiryStr}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-3 gap-3">
              <button
                type="button"
                onClick={exportPenaltyReport}
                disabled={lowAvailabilityVehicles.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                ⬇️ 匯出即時對數 CSV
              </button>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                關閉對數報表
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
