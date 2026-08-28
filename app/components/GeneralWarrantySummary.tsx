'use client';

import React, { useEffect, useMemo, useState } from 'react';

function formatDate(value: string | null | undefined) {
  if (!value) return '未設定';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-HK');
}

function getMaintenanceInfo(vehicle: any) {
  const start = vehicle.maintenance_start_date || vehicle.delivery_date || null;
  const expiry = vehicle.maintenance_expiry_date || vehicle.warranty_expiry_date || null;
  const now = new Date();
  const startDate = start ? new Date(`${String(start).slice(0, 10)}T00:00:00`) : null;
  const expiryDate = expiry ? new Date(`${String(expiry).slice(0, 10)}T23:59:59`) : null;
  const inPeriod = Boolean(
    startDate && expiryDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(expiryDate.getTime()) &&
    startDate <= now && expiryDate >= now,
  );
  return { start, expiry, inPeriod, hasDates: Boolean(start && expiry) };
}

function isCompleted(status: unknown) {
  const value = String(status || '').trim().toLowerCase();
  return value === 'completed' || value === 'closed' || value === '已完成';
}

export default function GeneralWarrantySummary() {
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchGeneralOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders', { cache: 'no-store' });
      if (!res.ok) {
        setOpenOrders([]);
        return;
      }
      const data = await res.json();
      const list: any[] = [];
      for (const vehicle of data.vehicles || []) {
        const vehicleType = String(vehicle.warranty_type || '').trim().toLowerCase();
        const project = String(vehicle.project || '').trim().toLowerCase();
        const isScattered = vehicleType === 'general' || vehicleType === '散車' || vehicleType === '散車保固' || project.includes('散車');
        if (!isScattered) continue;
        const maintenance = getMaintenanceInfo(vehicle);
        for (const order of vehicle.workOrders || vehicle.work_orders || []) {
          if (isCompleted(order.status) || String(order.warranty_type || '').toLowerCase() === 'government') continue;
          const items = order.work_order_items || order.items || [];
          const quoteStatus = String(order.quote_status || 'pending').toLowerCase();
          list.push({
            ...order,
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.plate_number || order.plate_number || '未設定',
            vehicleVin: vehicle.vin || order.vin || '未設定',
            vehicleBrand: vehicle.brand || '未設定',
            vehicleModel: vehicle.model || '未設定',
            vehicleProject: vehicle.project || '散車',
            maintenanceStartDate: maintenance.start,
            maintenanceExpiryDate: maintenance.expiry,
            inMaintenancePeriod: maintenance.inPeriod,
            hasMaintenanceDates: maintenance.hasDates,
            quoteStatus,
            quoteReference: order.quote_reference || '',
            oralQuoteConfirmed: Boolean(order.oral_quote_confirmed),
            itemsList: items,
            createdDate: order.created_at,
          });
        }
      }
      setOpenOrders(list);
    } catch (error) {
      console.error('抓取散車工單失敗:', error);
      setOpenOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGeneralOrders();
  }, []);

  const selectedItems = useMemo(() => selectedOrder?.itemsList || [], [selectedOrder]);

  return (
    <div className="space-y-6 text-black">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .private-detail-print, .private-detail-print * { visibility: visible !important; }
          .private-detail-print { position: absolute !important; inset: 0 !important; width: 100% !important; margin: 0 !important; padding: 24px !important; background: white !important; }
          .private-detail-print .print-hide { display: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap justify-between items-center bg-slate-900 text-white p-5 rounded-2xl shadow-sm gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">🚗 散車保固 Summary</h2>
          <p className="text-xs text-slate-300 mt-1">目前進行中的散車工單共有 <span className="font-extrabold text-amber-400 text-base">{openOrders.length}</span> 張</p>
        </div>
        <button type="button" onClick={fetchGeneralOrders} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer">🔄 重新整理</button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 正在載入散車保固工單...</div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 space-y-2 print:hidden">
          <p className="text-lg font-bold text-slate-800">目前沒有任何進行中的散車工單 (0張)</p>
          <p className="text-xs text-gray-400">開立散車工單後，資料會獨立顯示於此頁面</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 print:hidden">
          {openOrders.map((order, index) => {
            const itemNames = order.itemsList.map((item: any) => item.item_name).filter(Boolean);
            const isQuotePending = !order.inMaintenancePeriod && order.quoteStatus !== 'confirmed';
            return (
              <button type="button" key={order.id || index} onClick={() => setSelectedOrder(order)} className="text-left bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all border-slate-200 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-blue-900 text-lg group-hover:text-blue-600">📋 {order.order_number || 'WO-未知'}</span>
                    <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-slate-300">車牌: {order.vehiclePlate}</span>
                    <span className="bg-amber-50 text-amber-800 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-amber-200">🚗 散車</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2"><span className="font-bold text-slate-900">維修項目：</span>{itemNames.length ? itemNames.slice(0, 2).join('；') : '尚未填寫維修項目'}{itemNames.length > 2 ? `；另有 ${itemNames.length - 2} 項` : ''}</p>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-1">
                    <span>保養到期日：<strong className={order.inMaintenancePeriod ? 'text-emerald-700' : 'text-red-600'}>{formatDate(order.maintenanceExpiryDate)}</strong></span>
                    <span>維修通知日期：<strong>{formatDate(order.claim_form_date)}</strong></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {order.inMaintenancePeriod ? (
                    <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">✅ 在保養期內</span>
                  ) : (
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-xs border border-red-200">⚠️ 不在保養期內</span>
                  )}
                  {isQuotePending && <span className="text-red-700 text-xs font-extrabold">請先報價收費</span>}
                  {!isQuotePending && !order.inMaintenancePeriod && <span className="text-emerald-700 text-xs font-bold">報價已確認</span>}
                  <span className="text-xs text-blue-600 font-bold group-hover:underline">顯示詳情 →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 private-detail-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 text-black">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">🚗 散車工單詳情</span>
                <h3 className="text-xl font-black text-slate-900">📋 {selectedOrder.order_number || 'WO-未知'}</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedOrder.vehicleBrand} {selectedOrder.vehicleModel}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold cursor-pointer print-hide">✕</button>
            </div>

            {!selectedOrder.inMaintenancePeriod && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-800">⚠️ 此車輛目前不在保養期內，請先向客戶報價及確認收費，再安排維修。</div>
            )}
            {selectedOrder.inMaintenancePeriod && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800">✅ 此車輛目前在保養期內，可按保養條款處理。</div>}

            <section className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-4 space-y-2"><h4 className="font-extrabold text-slate-900">車輛資料</h4><p>車牌：<strong>{selectedOrder.vehiclePlate}</strong></p><p>VIN：<strong>{selectedOrder.vehicleVin}</strong></p><p>品牌／型號：<strong>{selectedOrder.vehicleBrand} {selectedOrder.vehicleModel}</strong></p><p>類別：<strong>散車</strong></p></div>
              <div className="rounded-xl bg-slate-50 p-4 space-y-2"><h4 className="font-extrabold text-slate-900">保養期狀態</h4><p>狀態：<strong className={selectedOrder.inMaintenancePeriod ? 'text-emerald-700' : 'text-red-700'}>{selectedOrder.inMaintenancePeriod ? '在保養期內' : '不在保養期內'}</strong></p><p>開始日：<strong>{formatDate(selectedOrder.maintenanceStartDate)}</strong></p><p>到期日：<strong>{formatDate(selectedOrder.maintenanceExpiryDate)}</strong></p><p>判斷日期：<strong>{new Date().toLocaleDateString('zh-HK')}</strong></p></div>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm"><h4 className="font-extrabold text-amber-900">報價確認</h4><p>狀態：<strong>{selectedOrder.inMaintenancePeriod ? '不需要報價確認' : selectedOrder.quoteStatus === 'confirmed' ? '已完成報價確認' : '待報價'}</strong></p>{!selectedOrder.inMaintenancePeriod && <><p>報價單號：<strong>{selectedOrder.quoteReference || '未輸入'}</strong></p><p>口頭報價：<strong>{selectedOrder.oralQuoteConfirmed ? '已確認' : '否'}</strong></p></>}</section>

            <section className="rounded-xl border border-slate-200 p-4 space-y-2 text-sm"><h4 className="font-extrabold text-slate-900">工單資料</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-2"><p>維修通知日期：<strong>{formatDate(selectedOrder.claim_form_date)}</strong></p><p>建立日期：<strong>{formatDate(selectedOrder.createdDate)}</strong></p><p>狀態：<strong>{isCompleted(selectedOrder.status) ? 'Completed' : 'Open'}</strong></p><p>完成日期：<strong>{formatDate(selectedOrder.completed_date)}</strong></p></div></section>

            <section className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm"><h4 className="font-extrabold text-slate-900">維修項目</h4>{selectedItems.length ? <ol className="list-decimal pl-5 space-y-2">{selectedItems.map((item: any, index: number) => <li key={item.id || index}><strong>{item.item_name}</strong>{item.notes && <span className="block text-xs text-slate-500">備註：{item.notes}</span>}</li>)}</ol> : <p className="text-slate-500">尚未填寫維修項目</p>}</section>

            {selectedOrder.description && <section className="rounded-xl bg-slate-50 p-4 text-sm"><h4 className="font-extrabold text-slate-900 mb-1">工單備註</h4><p className="whitespace-pre-wrap">{selectedOrder.description}</p></section>}

            <div className="flex justify-end gap-2 pt-3 border-t print-hide"><button type="button" onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-blue-700">🖨️ 列印詳情</button><button type="button" onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-200">關閉</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
