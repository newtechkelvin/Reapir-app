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
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  const [editGarageLocation, setEditGarageLocation] = useState('');
  const [editVehicleLocation, setEditVehicleLocation] = useState('');
  const [editPickupReturnDate, setEditPickupReturnDate] = useState('');
  const [editClaimDate, setEditClaimDate] = useState('');
  const [editCompletedDate, setEditCompletedDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 計算可用率與停修天數
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

  // 對數報表車輛清單
  const lowAvailabilityVehicles = (vehicles || [])
    .filter((v: any) => (v.warranty_type || 'government').toLowerCase() === 'government')
    .map((v: any) => ({ ...v, stats: getVehicleStats(v) }))
    .filter((v: any) => v.stats.periodTriggered && v.stats.availability !== null && v.stats.availability < 95)
    .sort((a: any, b: any) => (b.stats.totalOpenDays ?? 0) - (a.stats.totalOpenDays ?? 0));

  // 列印對數報表
  const handlePrintWarrantyReport = () => {
    if (lowAvailabilityVehicles.length === 0) {
      alert('目前沒有符合展延條件（可用率 < 95%）的車輛報表可列印。');
      return;
    }
    document.body.classList.add('printing-warranty-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-warranty-report');
    }, 1000);
  };

  // 列印單張工單 Job Sheet
  const handlePrintJobSheet = () => {
    document.body.classList.add('printing-job-sheet');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-job-sheet');
    }, 1000);
  };

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

  // 判斷是否為散車
  const isSanCheOrder = (wo: any, vehicle: any) => {
    const wType = (wo?.warranty_type || vehicle?.warranty_type || '').toString().toLowerCase();
    const project = (vehicle?.project || wo?.project || '').toString().toLowerCase();
    return wType === 'general' || wType === '散車' || project.includes('散車');
  };

  // 開啟工單明細 Modal
  const handleOpenDetailModal = (vehicle: any, order: any) => {
    setSelectedVehicle(vehicle);
    setSelectedOrder(order);
    setEditGarageLocation(order.garage_location || order.location || vehicle.garage_location || vehicle.location || '');
    setEditVehicleLocation(order.vehicle_location || vehicle.vehicle_location || '');
    setEditPickupReturnDate(order.pickup_return_date || vehicle.pickup_return_date || '');
    setEditClaimDate(order.claim_form_date || vehicle.claim_form_date || '');
    setEditCompletedDate(order.completed_date || '');
    setEditDescription(order.description || '');

    let rawItems: any = order.items || order.work_order_items || order.repair_items || [];
    
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch (e) {
        rawItems = rawItems.split(';').map((str: string) => ({
          is_completed: true,
          type: '進廠維修',
          item_name: str.trim(),
          notes: '舊保單批次自動匯入',
        }));
      }
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const parsed = rawItems.map((it: any) => ({
        is_completed: it.is_completed ?? it.completed ?? false,
        type: it.type || '進廠維修',
        item_name: it.item_name || it.name || '',
        notes: it.notes || '',
      }));
      setEditItems(parsed);
    } else {
      setEditItems([{ is_completed: false, type: '進廠維修', item_name: '', notes: '' }]);
    }
  };

  const handleAddItem = () => {
    setEditItems([
      ...editItems,
      { is_completed: false, type: '進廠維修', item_name: '', notes: '' },
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
    const orderId = selectedOrder.id || selectedOrder.work_order_id || selectedOrder.woNum;

    if (!orderId) {
      alert('無法取得此工單的有效識別碼 (ID)');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        garage_location: editGarageLocation || null,
        vehicle_location: editVehicleLocation || null,
        pickup_return_date: editPickupReturnDate.trim() ? editPickupReturnDate : null,
        claim_form_date: editClaimDate.trim() ? editClaimDate : null,
        completed_date: editCompletedDate.trim() ? editCompletedDate : null,
        status: editCompletedDate.trim() ? 'completed' : (selectedOrder.status || 'open'),
        description: editDescription || '',
        items: editItems
          .map((item) => ({
            is_completed: Boolean(item.is_completed),
            type: item.type || '進廠維修',
            item_name: String(item.item_name || '').trim(),
            notes: String(item.notes || '').trim(),
          }))
          .filter((item) => item.item_name.length > 0),
      };

      const res = await fetch(`/api/work-orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('工單更新成功！');
        setSelectedOrder(null);
        setSelectedVehicle(null);
        onRefresh();
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`儲存失敗: ${errorData?.error || errorData?.message || '請檢查資料格式'}`);
      }
    } catch (err) {
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-black summary-main-container">
      {/* 搜尋與頂部工具列 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs print-hidden-element">
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

        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handlePrintWarrantyReport}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          >
            🖨️ 列印政府對數報表
          </button>

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
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse print-hidden-element">
          ⏳ 正在載入車輛工單資料...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-gray-500 print-hidden-element">
          <p className="text-base font-bold">目前沒有有 Open 工單的政府車輛</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print-hidden-element">
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
                  <span className="text-slate-800 font-extrabold truncate flex-1" title={vehicle.project}>
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
                          onClick={() => handleOpenDetailModal(vehicle, wo)}
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

      {/* 完全對齊 SearchVehicles 的「車輛維修工單 (Repair Job Sheet)」Modal 視窗 */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 job-sheet-modal-container">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-4 text-black max-h-[90vh] overflow-y-auto print-job-sheet-content">
            
            {/* 保留 Header 特大標題 */}
            <div className="text-center border-b-2 border-slate-900 pb-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-wide">新力機械有限公司</h1>
              <p className="text-xs text-slate-800 font-bold tracking-widest mt-0.5">NEW TECH MOTOR ENGINEERING LIMITED</p>
              <p className="text-sm font-extrabold text-blue-950 mt-1 bg-slate-100 py-1 rounded">車輛維修工單 (Repair Job Sheet)</p>
            </div>

            {/* Header 控制區 */}
            <div className="flex justify-between items-center border-b pb-2 print:hidden">
              <div className="flex items-center gap-3">
                <span className="font-bold text-blue-900 text-lg">📋 {selectedOrder.order_number || selectedOrder.woNum || 'WO-未知'}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${selectedOrder.status?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  狀態: {selectedOrder.status || 'Open'}
                </span>
                {isSanCheOrder(selectedOrder, selectedVehicle) && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    🚗 散車工單
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintJobSheet}
                  className="px-3.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  🖨️ 列印此工單
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null);
                    setSelectedVehicle(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 1. 車輛與合約資訊欄 */}
            <div className="border border-slate-400 rounded-lg p-3 bg-slate-50/50 space-y-1.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-1">🚘 車輛與合約基本資訊</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-600">工單編號：</span><strong className="text-blue-900 font-bold">{selectedOrder.order_number || selectedOrder.woNum || 'WO-未知'}</strong></div>
                <div><span className="text-gray-600">車牌號碼：</span><strong className="text-blue-900 font-bold">{selectedVehicle?.plate_number || selectedOrder.vehiclePlate || '未設定'}</strong></div>
                <div><span className="text-gray-600">車輛品牌：</span><strong className="text-slate-900">{selectedVehicle?.brand || selectedOrder.vehicleBrand || '未設定'}</strong></div>
                <div><span className="text-gray-600">車輛型號：</span><strong className="text-slate-900">{selectedVehicle?.model || selectedOrder.vehicleModel || '未設定'}</strong></div>
                <div><span className="text-gray-600">VIN 碼：</span><strong className="text-slate-900">{selectedVehicle?.vin || selectedOrder.vehicleVin || '無'}</strong></div>
                <div><span className="text-gray-600">專案名稱：</span><strong className="text-slate-900">{selectedVehicle?.project || selectedOrder.vehicleProject || '未設定'}</strong></div>

                {isSanCheOrder(selectedOrder, selectedVehicle) ? (
                  <div>
                    <label className="text-gray-600 block font-semibold print:hidden">取車位置：</label>
                    <input
                      type="text"
                      value={editGarageLocation}
                      onChange={(e) => setEditGarageLocation(e.target.value)}
                      placeholder="院舍 / 客人自行送廠"
                      className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <div className="hidden print:block"><span className="text-gray-600">取車位置：</span><strong className="text-slate-900">{editGarageLocation || '未設定'}</strong></div>
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-600 block font-semibold print:hidden">車房位置：</label>
                    <select
                      value={editGarageLocation}
                      onChange={(e) => setEditGarageLocation(e.target.value)}
                      className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- 請選擇車房位置 --</option>
                      <option value="機電 - 九龍灣1/F">機電 - 九龍灣1/F</option>
                      <option value="機電 - 九龍灣2/F">機電 - 九龍灣2/F</option>
                      <option value="機電 - 屯門">機電 - 屯門</option>
                      <option value="機電 - 小蠔灣">機電 - 小蠔灣</option>
                      <option value="機電 - 柴灣">機電 - 柴灣</option>
                      <option value="機電 - 芬園">機電 - 芬園</option>
                      <option value="車行">車行</option>
                    </select>
                    <div className="hidden print:block"><span className="text-gray-600">車房位置：</span><strong className="text-slate-900">{editGarageLocation || '未設定'}</strong></div>
                  </div>
                )}

                <div>
                  <label className="text-gray-600 block font-semibold print:hidden">車輛位置：</label>
                  <input
                    type="text"
                    value={editVehicleLocation}
                    onChange={(e) => setEditVehicleLocation(e.target.value)}
                    placeholder="例如：停泊位 B2"
                    className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <div className="hidden print:block"><span className="text-gray-600">車輛位置：</span><strong className="text-slate-900">{editVehicleLocation || '未設定'}</strong></div>
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold print:hidden">取車/回廠日期：</label>
                  <input
                    type="date"
                    value={editPickupReturnDate}
                    onChange={(e) => setEditPickupReturnDate(e.target.value)}
                    className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <div className="hidden print:block"><span className="text-gray-600">取車/回廠日期：</span><strong className="text-slate-900">{editPickupReturnDate || '未設定'}</strong></div>
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold print:hidden">
                    {isSanCheOrder(selectedOrder, selectedVehicle) ? '維修通知日期：' : 'Claim Form 日期：'}
                  </label>
                  <input
                    type="date"
                    value={editClaimDate}
                    onChange={(e) => setEditClaimDate(e.target.value)}
                    className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <div className="hidden print:block">
                    <span className="text-gray-600">{isSanCheOrder(selectedOrder, selectedVehicle) ? '維修通知日期：' : 'Claim Form 日期：'}</span>
                    <strong className="text-slate-900">{editClaimDate || '未設定'}</strong>
                  </div>
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold print:hidden">完成維修/交車日期：</label>
                  <input
                    type="date"
                    value={editCompletedDate}
                    onChange={(e) => setEditCompletedDate(e.target.value)}
                    className="w-full p-1 border border-slate-300 rounded text-xs print:hidden font-bold focus:ring-1 focus:ring-blue-500 bg-emerald-50 text-emerald-900"
                  />
                  <div className="hidden print:block">
                    <span className="text-gray-600">完成維修/交車日期：</span>
                    <strong className="text-emerald-700">{editCompletedDate || '____________________'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 工單狀況敘述 */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">📝 狀況與故障描述</h4>
              <p className="text-xs text-gray-900 bg-gray-50 p-2.5 rounded-lg border border-slate-300 leading-snug">{editDescription || selectedOrder.description || '無詳細描述'}</p>
            </div>

            {/* 3. 維修項目清單 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">🛠️ 維修與零件項目明細</h4>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs print:hidden cursor-pointer flex items-center gap-1"
                >
                  + 新增維修項目
                </button>
              </div>

              {editItems.length > 0 ? (
                <div className="border rounded-lg overflow-hidden border-slate-400">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-200 text-slate-900 font-bold border-b border-slate-400">
                      <tr>
                        <th className="p-2 w-10 text-center print:hidden">完成</th>
                        <th className="p-2 print:p-1.5 w-28">類別</th>
                        <th className="p-2 print:p-1.5 w-1/2">項目名稱</th>
                        <th className="p-2 print:p-1.5">進度備註 (Notes)</th>
                        <th className="p-2 w-10 text-center print:hidden">刪除</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {editItems.map((item: any, i: number) => {
                        const isChecked = !!item.is_completed;

                        return (
                          <tr key={i} className={isChecked ? 'bg-emerald-50/50' : ''}>
                            <td className="p-2 text-center print:hidden">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleItemChange(i, 'is_completed', e.target.checked)}
                                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2 print:p-1.5 font-normal">
                              <select
                                value={item.type || '進廠維修'}
                                onChange={(e) => handleItemChange(i, 'type', e.target.value)}
                                className="p-1 border rounded text-xs bg-white text-slate-900 font-normal print:hidden focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="進廠維修">進廠維修</option>
                                <option value="更換零件">更換零件</option>
                                <option value="現場處理">現場處理</option>
                                <option value="外判處理">外判處理</option>
                                <option value="收費項目">收費項目</option>
                                <option value="Recall項目">Recall項目</option>
                              </select>
                              <span className="hidden print:inline-block px-2 py-0.5 bg-slate-100 text-slate-900 rounded border border-slate-400 text-xs font-normal">
                                {item.type || '進廠維修'}
                              </span>
                            </td>
                            <td className="p-2 print:p-1.5 font-normal">
                              <input
                                type="text"
                                value={item.item_name || ''}
                                onChange={(e) => handleItemChange(i, 'item_name', e.target.value)}
                                placeholder="項目名稱..."
                                className={`w-full p-1 border rounded text-xs bg-white text-slate-900 font-normal print:hidden focus:ring-1 focus:ring-blue-500 ${isChecked ? 'line-through text-gray-400' : ''}`}
                              />
                              <span className={`hidden print:inline-block font-normal ${isChecked ? 'line-through text-gray-400' : 'text-slate-900'}`}>
                                {item.item_name}
                              </span>
                            </td>
                            <td className="p-2 print:p-1.5">
                              <input
                                type="text"
                                value={item.notes || ''}
                                onChange={(e) => handleItemChange(i, 'notes', e.target.value)}
                                placeholder="輸入工程進度..."
                                className="note-input w-full p-1 border-b border-slate-400 print:border-b print:border-slate-800 rounded-none text-xs font-normal bg-transparent focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="p-2 text-center print:hidden">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(i)}
                                className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-2">無詳細明細項目，可點擊右上角按鈕新增</p>
              )}
            </div>

            {/* 列印專屬簽名欄 */}
            <div className="hidden print:grid grid-cols-2 gap-x-6 gap-y-4 pt-4 text-xs font-bold border-t border-slate-500 min-h-[110px]">
              <div>完工日期：____________________</div>
              <div>維修主管簽署：____________________</div>
              <div>交車日期：____________________</div>
              <div>交車司機：____________________</div>
            </div>

            {/* Footer 操作按鈕 */}
            <div className="flex justify-between items-center border-t pt-3 print:hidden">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedVehicle(null);
                }}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                關閉
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveOrderEdit}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
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
                    🏛️ 政府車輛保固展延對數報表 (現行期間已觸發展延)
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
                onClick={handlePrintWarrantyReport}
                disabled={lowAvailabilityVehicles.length === 0}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                🖨️ 列印對數報表
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

      {/* 列印對數報表 DOM 節點 */}
      <div className="warranty-print-report" aria-hidden="true">
        <table>
          <thead>
            <tr>
              <th colSpan={7}>
                <div className="print-company-name">新力機械有限公司</div>
                <div className="print-company-name-en">NEW TECH MOTOR ENGINEERING LIMITED</div>
                <div className="print-report-title">政府車輛保固展延對數報表</div>
                <div className="print-report-subtitle">現行保固／展延期已觸發展延（可用率低於 95%）</div>
                <div className="print-report-meta">
                  <span>報表產生日期：{new Date().toISOString().split('T')[0]}</span>
                  <span>符合車輛：{lowAvailabilityVehicles.length} 輛</span>
                </div>
              </th>
            </tr>
            <tr className="print-column-heading">
              <th>車牌號碼</th>
              <th>專案編號</th>
              <th>當期停修日</th>
              <th>當期可用率</th>
              <th>原保固到期日</th>
              <th>展延月份</th>
              <th>修正後保固到期日</th>
            </tr>
          </thead>
          <tbody>
            {lowAvailabilityVehicles.map((vehicle: any, idx: number) => (
              <tr key={`print-${vehicle.id || idx}`}>
                <td>{vehicle.plate_number || '未設定'}</td>
                <td>{vehicle.project || '未指定'}</td>
                <td>{vehicle.stats.totalOpenDays === null ? '—' : `${vehicle.stats.totalOpenDays} 天`}</td>
                <td>{vehicle.stats.availability}%</td>
                <td>{vehicle.stats.origExpiryStr}</td>
                <td>+{vehicle.stats.extensionMonths} 個月</td>
                <td>{vehicle.stats.finalExpiryStr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 重構後的嚴格隔離列印 CSS */}
      <style jsx global>{`
        .warranty-print-report { display: none; }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }

          /* 情況 1：列印單張工單 Job Sheet */
          body.printing-job-sheet {
            background-color: white !important;
            font-size: 12px !important;
            color: black !important;
          }
          body.printing-job-sheet .print-hidden-element,
          body.printing-job-sheet .warranty-print-report {
            display: none !important;
          }
          body.printing-job-sheet .job-sheet-modal-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
          }
          body.printing-job-sheet .print-job-sheet-content {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
          }

          /* 情況 2：列印政府對數報表 */
          body.printing-warranty-report {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body.printing-warranty-report .print-hidden-element,
          body.printing-warranty-report .job-sheet-modal-container {
            display: none !important;
          }
          body.printing-warranty-report * {
            visibility: hidden !important;
          }
          body.printing-warranty-report .warranty-print-report,
          body.printing-warranty-report .warranty-print-report * {
            visibility: visible !important;
          }
          body.printing-warranty-report .warranty-print-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            color: #111827;
            background: #fff;
            font-family: Arial, "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif;
            font-size: 9pt;
          }
          body.printing-warranty-report .warranty-print-report table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          body.printing-warranty-report .warranty-print-report thead { display: table-header-group; }
          body.printing-warranty-report .warranty-print-report tr { break-inside: avoid; page-break-inside: avoid; }
          body.printing-warranty-report .warranty-print-report th,
          body.printing-warranty-report .warranty-print-report td {
            border: 0.35mm solid #9ca3af;
            padding: 2.4mm 1.8mm;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }
          body.printing-warranty-report .warranty-print-report thead tr:first-child th {
            border: 0;
            padding: 0 0 5mm;
          }
          .print-company-name { font-size: 17pt; font-weight: 800; letter-spacing: 0.04em; }
          .print-company-name-en { margin-top: 1mm; font-size: 8pt; letter-spacing: 0.16em; color: #4b5563; }
          .print-report-title { margin-top: 5mm; font-size: 13pt; font-weight: 800; }
          .print-report-subtitle { margin-top: 1.5mm; font-size: 9pt; color: #374151; }
          .print-report-meta { display: flex; justify-content: space-between; margin-top: 4mm; font-size: 8.5pt; font-weight: 600; color: #374151; }
          .print-column-heading th { background: #e5e7eb !important; font-weight: 800; text-align: center; }
          .warranty-print-report td { text-align: center; }
          .warranty-print-report td:nth-child(2) { text-align: left; }

          /* 隱藏輸入框 placeholder */
          input::placeholder,
          .note-input::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
