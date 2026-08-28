'use client';

import React, { useEffect, useState } from 'react';

const isCompleted = (status: unknown) => ['completed', 'closed', '已完成'].includes(String(status || '').trim().toLowerCase());
const formatDate = (value: string | null | undefined) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('zh-HK') : '未設定';

function maintenanceInfo(vehicle: any) {
  const start = vehicle.maintenance_start_date || vehicle.delivery_date || '';
  const expiry = vehicle.maintenance_expiry_date || vehicle.warranty_expiry_date || '';
  const now = new Date();
  const startDate = start ? new Date(`${String(start).slice(0, 10)}T00:00:00`) : null;
  const expiryDate = expiry ? new Date(`${String(expiry).slice(0, 10)}T23:59:59`) : null;
  return { start, expiry, inPeriod: Boolean(startDate && expiryDate && startDate <= now && expiryDate >= now) };
}

export default function GeneralWarrantySummary() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [maintenanceStart, setMaintenanceStart] = useState('');
  const [maintenanceExpiry, setMaintenanceExpiry] = useState('');
  const [claimDate, setClaimDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [quoteStatus, setQuoteStatus] = useState('pending');
  const [quoteReference, setQuoteReference] = useState('');
  const [oralQuote, setOralQuote] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/work-orders', { cache: 'no-store' });
      const data = await response.json();
      const list: any[] = [];
      for (const vehicle of data.vehicles || []) {
        const type = String(vehicle.warranty_type || '').trim().toLowerCase();
        const project = String(vehicle.project || '').trim().toLowerCase();
        if (!(type === 'general' || type === '散車' || type === '散車保固' || project.includes('散車'))) continue;
        const maintenance = maintenanceInfo(vehicle);
        for (const order of vehicle.workOrders || vehicle.work_orders || []) {
          if (isCompleted(order.status) || String(order.warranty_type || '').toLowerCase() === 'government') continue;
          const storedStatus = String(order.quote_status || '').toLowerCase();
          const quoteConfirmed = storedStatus === 'confirmed' && Boolean(order.quote_reference || order.oral_quote_confirmed);
          list.push({ ...order, vehicle, vehiclePlate: vehicle.plate_number || order.plate_number || '未設定', vehicleVin: vehicle.vin || order.vin || '未設定', vehicleBrand: vehicle.brand || '未設定', vehicleModel: vehicle.model || '未設定', maintenanceStart: maintenance.start, maintenanceExpiry: maintenance.expiry, inMaintenancePeriod: maintenance.inPeriod, quoteStatus: quoteConfirmed ? 'confirmed' : 'pending', quoteReference: order.quote_reference || '', oralQuote: Boolean(order.oral_quote_confirmed), itemsList: order.work_order_items || order.items || [] });
        }
      }
      setOrders(list);
    } catch (error) { console.error('抓取散車工單失敗:', error); setOrders([]); } finally { setLoading(false); }
  };

  useEffect(() => { loadOrders(); }, []);

  const openDetail = (order: any) => {
    setSelected(order); setEditItems((order.itemsList || []).map((item: any) => ({ ...item })));
    setMaintenanceStart(order.maintenanceStart || ''); setMaintenanceExpiry(order.maintenanceExpiry || '');
    setClaimDate(order.claim_form_date || ''); setCompletedDate(order.completed_date || '');
    setQuoteStatus(order.quoteStatus || 'pending'); setQuoteReference(order.quoteReference || ''); setOralQuote(order.oralQuote || false); setDescription(order.description || '');
  };

  const save = async (status?: 'Open' | 'Completed') => {
    if (!selected?.id) return;
    if (!selected.inMaintenancePeriod && quoteStatus === 'confirmed' && !quoteReference.trim() && !oralQuote) { alert('完成報價確認時，請填寫報價單號或選擇「已口頭報價」'); return; }
    if (status === 'Completed' && !completedDate) { alert('請先填寫完成維修／交車日期'); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/work-orders/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status || selected.status || 'Open', claim_form_date: claimDate || null, completed_date: status === 'Completed' ? completedDate : (completedDate || null), maintenance_start_date: maintenanceStart || null, maintenance_expiry_date: maintenanceExpiry || null, quote_status: selected.inMaintenancePeriod ? 'not_required' : quoteStatus, quote_reference: selected.inMaintenancePeriod ? null : (quoteReference.trim() || null), oral_quote_confirmed: selected.inMaintenancePeriod ? false : oralQuote, description, items: editItems }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || '儲存失敗');
      alert(status === 'Completed' ? '散車工單已結案。' : '散車工單資料已儲存。'); setSelected(null); await loadOrders();
    } catch (error: any) { alert(error.message || '儲存失敗'); } finally { setSaving(false); }
  };

  const itemSummary = (items: any[]) => { const names = items.map((item) => item.item_name).filter(Boolean); return names.length ? `${names.slice(0, 2).join('；')}${names.length > 2 ? `；另有 ${names.length - 2} 項` : ''}` : '尚未填寫維修項目'; };

  return <div className="space-y-6 text-black">
    <style jsx global>{`@media print { @page { size: A4 portrait; margin: 12mm; } body * { visibility: hidden !important; } .private-detail-modal-content, .private-detail-modal-content * { visibility: visible !important; } .private-detail-modal-content { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; } .private-print-hide { display: none !important; } }`}</style>
    <div className="flex flex-wrap justify-between items-center bg-slate-900 text-white p-5 rounded-2xl shadow-sm gap-3 print:hidden"><div><h2 className="text-xl font-extrabold">🚗 散車保固 Summary</h2><p className="text-xs text-slate-300 mt-1">目前進行中的散車工單共有 <strong className="text-amber-400 text-base">{orders.length}</strong> 張</p></div><button type="button" onClick={loadOrders} className="px-4 py-2 bg-blue-600 text-xs font-bold rounded-xl">🔄 重新整理</button></div>
    {loading ? <div className="text-center py-12 text-slate-500">⏳ 正在載入散車保固工單...</div> : orders.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-slate-500">目前沒有任何進行中的散車工單</div> : <div className="grid gap-4 print:hidden">{orders.map((order, index) => <button type="button" key={order.id || index} onClick={() => openDetail(order)} className="text-left bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col md:flex-row justify-between gap-4"><div className="space-y-2 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-blue-900 text-lg">📋 {order.order_number || 'WO-未知'}</strong><span className="bg-slate-100 px-2.5 py-0.5 rounded-lg text-xs font-bold">車牌：{order.vehiclePlate}</span><span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-xs font-bold">🚗 散車</span></div><p className="text-sm line-clamp-2"><strong>維修項目：</strong>{itemSummary(order.itemsList)}</p><p className="text-xs text-slate-500">保養到期日：<strong className={order.inMaintenancePeriod ? 'text-emerald-700' : 'text-red-600'}>{formatDate(order.maintenanceExpiry)}</strong>　維修通知日期：<strong>{formatDate(order.claim_form_date)}</strong></p>{!order.inMaintenancePeriod && <p className="text-xs font-extrabold text-red-700">⚠️ 請先報價收費　{order.quoteStatus === 'confirmed' ? `（${order.quoteReference || '已口頭報價'}）` : '（尚未確認）'}</p>}</div><div className="flex flex-col items-end gap-2">{order.inMaintenancePeriod ? <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">✅ 在保養期內</span> : <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold">⚠️ 不在保養期內</span>}<span className="text-xs text-blue-600 font-bold">顯示詳情 →</span></div></button>)}</div>}
    {selected && <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 print:bg-white"><div className="private-detail-modal-content bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5"><div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4"><div className="text-xl font-black">NEW TECH MOTOR ENGINEERING LIMITED</div><div className="text-xs">新力機械工程有限公司</div><div className="text-lg font-extrabold mt-3">散車保固工單正式詳情報告</div><div className="text-xs mt-1">列印日期：{new Date().toLocaleDateString('zh-HK')}</div></div><div className="flex justify-between items-start border-b pb-3"><div><span className="text-xs font-bold text-amber-600">🚗 散車工單詳情</span><h3 className="text-xl font-black text-slate-900">📋 {selected.order_number || 'WO-未知'}</h3><p className="text-xs text-slate-500 mt-1">{selected.vehicleBrand} {selected.vehicleModel}</p></div><button type="button" onClick={() => setSelected(null)} className="text-gray-400 text-2xl font-bold private-print-hide">✕</button></div>
      {!selected.inMaintenancePeriod && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-extrabold text-red-800">⚠️ 此車輛目前不在保養期內，請先向客戶報價及確認收費，再安排維修。</div>}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-4 space-y-2"><h4 className="font-extrabold">車輛資料</h4><p>車牌：<strong>{selected.vehiclePlate}</strong></p><p>VIN：<strong>{selected.vehicleVin}</strong></p><p>品牌／型號：<strong>{selected.vehicleBrand} {selected.vehicleModel}</strong></p><p>類別：<strong>散車</strong></p></div><div className="rounded-xl bg-slate-50 p-4 space-y-2"><h4 className="font-extrabold">保養期狀態</h4><p>是否在保養期內：<strong className={selected.inMaintenancePeriod ? 'text-emerald-700' : 'text-red-700'}>{selected.inMaintenancePeriod ? '是' : '否'}</strong></p><label>開始日：<input type="date" value={maintenanceStart} onChange={(e) => setMaintenanceStart(e.target.value)} className="private-print-hide ml-1 border rounded p-1" /></label><p className="hidden print:block">開始日：<strong>{formatDate(maintenanceStart)}</strong></p><label>到期日：<input type="date" value={maintenanceExpiry} onChange={(e) => setMaintenanceExpiry(e.target.value)} className="private-print-hide ml-1 border rounded p-1" /></label><p className="hidden print:block">到期日：<strong>{formatDate(maintenanceExpiry)}</strong></p></div></section>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-sm"><h4 className="font-extrabold text-amber-900">報價確認</h4>{selected.inMaintenancePeriod ? <p>此工單在保養期內，報價確認：<strong>不需要</strong></p> : <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><select value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value)} className="border rounded p-2"><option value="pending">待報價</option><option value="confirmed">已完成報價確認</option></select><input value={quoteReference} onChange={(e) => setQuoteReference(e.target.value)} placeholder="報價單號" className="border rounded p-2" /><label className="flex items-center gap-2"><input type="checkbox" checked={oralQuote} onChange={(e) => setOralQuote(e.target.checked)} />已口頭報價</label></div>}{!selected.inMaintenancePeriod && <p>目前：<strong>{quoteStatus === 'confirmed' ? (quoteReference || oralQuote ? `已確認（${quoteReference || '已口頭報價'}）` : '資料不完整') : '待報價'}</strong></p>}</section>
      <section className="rounded-xl border p-4 space-y-3 text-sm"><h4 className="font-extrabold">工單資料</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label>維修通知日期：<input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} className="private-print-hide ml-1 border rounded p-1" /></label><p className="hidden print:block">維修通知日期：<strong>{formatDate(claimDate)}</strong></p><p>工單建立日期：<strong>{formatDate(selected.created_at)}</strong></p><label>完成日期：<input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} className="private-print-hide ml-1 border rounded p-1" /></label><p className="hidden print:block">完成日期：<strong>{formatDate(completedDate)}</strong></p><p>狀態：<strong>{selected.status || 'Open'}</strong></p></div><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="工單備註" className="w-full border rounded p-2 private-print-hide" rows={2} /><p className="hidden print:block whitespace-pre-wrap">備註：{description || '無'}</p></section>
      <section className="rounded-xl border p-4 space-y-3 text-sm"><div className="flex justify-between items-center"><h4 className="font-extrabold">維修項目</h4><button type="button" onClick={() => setEditItems([...editItems, { type: '進廠維修', item_name: '', notes: '', is_completed: false }])} className="private-print-hide px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">+ 新增</button></div>{editItems.map((item, index) => <div key={item.id || index} className="flex gap-2 items-center"><span className="w-6">{index + 1}.</span><input value={item.item_name || ''} onChange={(e) => setEditItems(editItems.map((current, i) => i === index ? { ...current, item_name: e.target.value } : current))} className="flex-1 border rounded p-2" placeholder="維修項目" /><input value={item.notes || ''} onChange={(e) => setEditItems(editItems.map((current, i) => i === index ? { ...current, notes: e.target.value } : current))} className="flex-1 border rounded p-2 private-print-hide" placeholder="備註" /><button type="button" onClick={() => setEditItems(editItems.filter((_, i) => i !== index))} className="private-print-hide text-red-600 font-bold">✕</button></div>)}</section>
      <div className="flex justify-between items-center border-t pt-3 private-print-hide"><button type="button" onClick={() => setSelected(null)} className="px-4 py-2 border rounded-xl font-bold">關閉</button><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => save()} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">{saving ? '儲存中...' : '💾 儲存修改'}</button><button type="button" disabled={saving} onClick={() => save('Completed')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">✅ 提交結案</button><button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-xl font-bold">🖨️ 列印詳情</button></div></div></div></div>}
  </div>;
}
