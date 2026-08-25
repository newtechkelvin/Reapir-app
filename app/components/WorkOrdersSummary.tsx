'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function WorkOrdersSummary() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 彈窗 Modal 相關 State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [lastModifiedStr, setLastModifiedStr] = useState<string>('');

  const [garageLocationInput, setGarageLocationInput] = useState('');
  const [vehicleLocationInput, setVehicleLocationInput] = useState('');
  const [pickupReturnDateInput, setPickupReturnDateInput] = useState('');
  const [claimFormDateInput, setClaimFormDateInput] = useState('');
  const [completedDateInput, setCompletedDateInput] = useState('');

  const [staffNameInput, setStaffNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchGovernmentVehicles();
  }, []);

  const fetchGovernmentVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const data = await res.json();
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

  const calculateOpenDaysForOrder = (wo: any) => {
    const startDateStr = wo.claim_form_date || wo.created_at;
    if (!startDateStr) return 0;
    const start = new Date(startDateStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateTotalOpenDaysForVehicle = (orders: any[]) => {
    let total = 0;
    orders.forEach((wo) => {
      if ((wo.status || 'Open').toLowerCase() === 'open') {
        total += calculateOpenDaysForOrder(wo);
      }
    });
    return total;
  };

  const calculateAvailability = (totalOpenDays: number) => {
    const targetDays = 18.25;
    if (totalOpenDays <= 0) return 100;
    const avail = Math.max(0, 100 - (totalOpenDays / targetDays) * 5);
    return parseFloat(avail.toFixed(2));
  };

  // 1. 僅整理出 Status 是 Open 的工單 (且 Open 天數 >= 5 天 或 Availability < 95%)
  const urgentWorkOrders: any[] = [];
  vehicles.forEach((v) => {
    const orders = v.workOrders || v.work_orders || [];
    // 嚴格僅抓取 Open 工單
    const openOrders = orders.filter((o: any) => (o.status || 'Open').toLowerCase() === 'open');
    const totalOpenDays = calculateTotalOpenDaysForVehicle(orders);
    const avail = calculateAvailability(totalOpenDays);

    openOrders.forEach((wo: any) => {
      const days = calculateOpenDaysForOrder(wo);
      if (days >= 5 || avail < 95) {
        urgentWorkOrders.push({
          ...wo,
          vehicle: v,
          openDays: days,
          vehicleAvailability: avail,
        });
      }
    });
  });

  urgentWorkOrders.sort((a, b) => b.openDays - a.openDays);

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

  // 開啟詳細工單 Modal
  const handleOpenDetailModal = (vehicle: any, order: any) => {
    setSelectedVehicle(vehicle);
    setSelectedOrder(order);
    setStaffNameInput(order.staff_name || '');

    setGarageLocationInput(order.garage_location || order.location || vehicle.garage_location || vehicle.location || '');
    setVehicleLocationInput(order.vehicle_location || vehicle.vehicle_location || '');
    setPickupReturnDateInput(order.pickup_return_date || vehicle.pickup_return_date || '');
    setClaimFormDateInput(order.claim_form_date || vehicle.claim_form_date || '');
    setCompletedDateInput(order.completed_date || '');

    const rawItems = order.work_order_items || order.items || [];
    const formattedItems = rawItems.map((item: any) => ({
      id: item.id,
      type: item.type || '進廠維修',
      item_name: item.item_name || '',
      is_completed: item.is_completed || false,
      notes: item.notes || '',
    }));

    setModalItems(formattedItems);

    const modTime = order.updated_at || order.created_at;
    setLastModifiedStr(modTime ? new Date(modTime).toLocaleString() : '未有更新紀錄');
  };

  const handleCloseDetailModal = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSelectedOrder(null);
    setSelectedVehicle(null);
    setModalItems([]);
  };

  const triggerAutoSave = (overrideData?: any) => {
    if (!selectedOrder?.id) return;
    setIsAutoSaving(true);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          garage_location: garageLocationInput,
          vehicle_location: vehicleLocationInput,
          pickup_return_date: pickupReturnDateInput,
          claim_form_date: claimFormDateInput,
          completed_date: completedDateInput,
          items: modalItems,
          ...overrideData
        };

        const res = await fetch(`/api/work-orders/${selectedOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const newTime = new Date().toLocaleString();
          setLastModifiedStr(newTime);
          fetchGovernmentVehicles();
        }
      } catch (err) {
        console.error('自動保存失敗:', err);
      } finally {
        setIsAutoSaving(false);
      }
    }, 800);
  };

  const handleAddNewItem = () => {
    const newItem = { type: '進廠維修', item_name: '', is_completed: false, notes: '' };
    const updated = [...modalItems, newItem];
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleRemoveItem = (index: number) => {
    const updated = modalItems.filter((_, i) => i !== index);
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleToggleCheck = (index: number) => {
    const updated = [...modalItems];
    updated[index].is_completed = !updated[index].is_completed;
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleTypeChange = (index: number, typeVal: string) => {
    const updated = [...modalItems];
    updated[index].type = typeVal;
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleItemNameChange = (index: number, nameVal: string) => {
    const updated = [...modalItems];
    updated[index].item_name = nameVal;
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleNoteChange = (index: number, val: string) => {
    const updated = [...modalItems];
    updated[index].notes = val;
    setModalItems(updated);
    triggerAutoSave({ items: updated });
  };

  const handleMarkAsCompleted = async () => {
    if (!selectedOrder?.id) return;
    if (!completedDateInput) {
      alert('請先填寫完成維修/交車日期');
      return;
    }

    if (!confirm('確定要提交結案並將此工單狀態標示為【Completed】嗎？')) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/work-orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Completed',
          completed_date: completedDateInput,
          staff_name: staffNameInput,
          garage_location: garageLocationInput,
          vehicle_location: vehicleLocationInput,
          pickup_return_date: pickupReturnDateInput,
          claim_form_date: claimFormDateInput,
          items: modalItems,
        }),
      });

      if (res.ok) {
        alert('工單已順利標示為結案 (Completed)！');
        handleCloseDetailModal();
        fetchGovernmentVehicles();
      } else {
        const errData = await res.json().catch(() => null);
        alert(`結案失敗: ${errData?.error || errData?.message || '請檢查資料庫設定'}`);
      }
    } catch (err) {
      console.error('結案操作錯誤:', err);
      alert('網路連線失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-black">
      {/* 頂部標題與控制項 */}
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

      {/* 🚨 優先處理工單提醒 🚨 */}
      {urgentWorkOrders.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-red-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">🚨</span>
              <h3 className="text-base font-black text-red-900">
                優先處理工單提醒
              </h3>
              <span className="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                {urgentWorkOrders.length} 張緊急
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentWorkOrders.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenDetailModal(item.vehicle, item)}
                className="bg-white border-l-4 border-l-red-600 border border-red-200 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-blue-900 group-hover:text-blue-700 text-sm block">📋 {item.order_number || 'WO-未知'}</span>
                    <span className="text-xs font-black text-slate-800">🚘 車牌: {item.vehicle?.plate_number}</span>
                  </div>
                  <span className="bg-red-100 text-red-800 font-black text-xs px-2 py-0.5 rounded-lg border border-red-300">
                    停修 {item.openDays} 天
                  </span>
                </div>

                <p className="text-xs text-gray-700 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-200">
                  {item.description || '無描述'}
                </p>

                <div className="flex justify-between items-center text-[11px] pt-1 text-slate-600">
                  <span>位置: <strong>{item.garage_location || item.vehicle?.garage_location || '九龍灣'}</strong></span>
                  <span className="text-blue-600 font-bold group-hover:underline">檢視內容 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 車輛主卡片展示列表 */}
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
            const totalOpenDays = calculateTotalOpenDaysForVehicle(orders);
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

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border">
                      <span className="text-gray-500 block text-[11px]">工單累計 Open 日數</span>
                      <strong className={`text-base font-black ${totalOpenDays > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {totalOpenDays} 天
                      </strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border">
                      <span className="text-gray-500 block text-[11px]">Availability (可用率)</span>
                      <strong className={`text-base font-black ${isWarning ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>
                        {availability}%
                      </strong>
                    </div>

                    <div className="col-span-2 flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                      <span>專案：<strong className="text-slate-900">{vehicle.project || '未設定'}</strong></span>
                      <span>進行中工單：<strong className="text-amber-700 font-bold">{openOrders.length} 張</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-1 border-t pt-2">
                  <span className="font-bold text-gray-700 block text-[11px]">最新工單紀錄:</span>
                  {orders.length === 0 ? (
                    <span className="text-gray-400 italic">無工單紀錄</span>
                  ) : (
                    orders.slice(0, 2).map((wo: any, oIdx: number) => (
                      <div
                        key={oIdx}
                        onClick={() => handleOpenDetailModal(vehicle, wo)}
                        className="flex justify-between items-center text-[11px] bg-slate-50 p-1.5 rounded border hover:bg-blue-50 cursor-pointer"
                      >
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

      {/* 工單詳細卡片 Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 print:bg-white print:static flex items-center justify-center p-4 print:p-0 z-50">
          <div className="bg-white rounded-2xl print:rounded-none shadow-2xl print:shadow-none max-w-3xl w-full p-6 print:p-0 space-y-5 print:space-y-3 max-h-[90vh] print:max-h-none overflow-y-auto print:overflow-visible text-black">
            
            <div className="text-center border-b-2 border-slate-900 pb-2 print:pb-2">
              <h1 className="text-2xl print:text-2xl font-black text-slate-900 tracking-wide">新力機械有限公司</h1>
              <p className="text-xs print:text-sm text-slate-700 font-bold tracking-widest mt-0.5">NEW TECH MOTOR ENGINEERING LIMITED</p>
              <p className="text-sm print:text-base font-extrabold text-blue-950 mt-1.5 bg-slate-100 print:bg-slate-200 py-1 rounded">車輛維修工單 (Repair Job Sheet)</p>
            </div>

            <div className="flex justify-between items-center border-b pb-2 print:hidden">
              <div className="flex items-center gap-3">
                <span className="font-bold text-blue-900 text-lg">📋 {selectedOrder.order_number || 'WO-未知'}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedOrder.status?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  狀態: {selectedOrder.status || 'Open'}
                </span>
                {isAutoSaving ? (
                  <span className="text-xs text-blue-600 font-bold animate-pulse">💾 正在保存更新...</span>
                ) : (
                  <span className="text-xs text-gray-500">最後更新時間: <strong>{lastModifiedStr}</strong></span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="border-2 border-slate-400 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-1">🚘 車輛與合約基本資訊</h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div><span className="text-gray-600 block">工單編號：</span><strong className="text-blue-900 font-black">{selectedOrder.order_number || 'WO-未知'}</strong></div>
                <div><span className="text-gray-600 block">車牌號碼：</span><strong className="text-blue-900 font-black">{selectedVehicle?.plate_number || selectedOrder.plate_number || '未設定'}</strong></div>
                <div><span className="text-gray-600 block">車輛品牌：</span><strong className="text-slate-900">{selectedVehicle?.brand || selectedOrder.brand || '未設定'}</strong></div>
                <div><span className="text-gray-600 block">車輛型號：</span><strong className="text-slate-900">{selectedVehicle?.model || selectedOrder.model || '未設定'}</strong></div>
                <div><span className="text-gray-600 block">VIN 碼：</span><strong className="text-slate-900">{selectedVehicle?.vin || selectedOrder.vin || '無'}</strong></div>
                <div><span className="text-gray-600 block">專案名稱：</span><strong className="text-slate-900">{selectedVehicle?.project || selectedOrder.project || '未設定'}</strong></div>

                <div>
                  <label className="text-gray-600 block font-semibold">車房位置：</label>
                  <select
                    value={garageLocationInput}
                    onChange={(e) => {
                      setGarageLocationInput(e.target.value);
                      triggerAutoSave({ garage_location: e.target.value });
                    }}
                    className="w-full p-1 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- 請選擇車房位置 --</option>
                    <option value="機電 - 九龍灣1/F">機電 - 九龍灣1/F</option>
                    <option value="機電 - 九龍灣2/F">機電 - 九龍灣2/F</option>
                    <option value="機電 - 屯門">機電 - 屯門</option>
                    <option value="機電 - 小蠔灣">機電 - 小蠔灣</option>
                    <option value="機電 - 柴灣">機電 - 柴灣</option>
                    <option value="車行">車行</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold">車輛位置：</label>
                  <input
                    type="text"
                    value={vehicleLocationInput}
                    onChange={(e) => {
                      setVehicleLocationInput(e.target.value);
                      triggerAutoSave({ vehicle_location: e.target.value });
                    }}
                    placeholder="例如：停泊位 B2"
                    className="w-full p-1 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold">取車/回廠日期：</label>
                  <input
                    type="date"
                    value={pickupReturnDateInput}
                    onChange={(e) => {
                      setPickupReturnDateInput(e.target.value);
                      triggerAutoSave({ pickup_return_date: e.target.value });
                    }}
                    className="w-full p-1 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold">Claim Form 日期：</label>
                  <input
                    type="date"
                    value={claimFormDateInput}
                    onChange={(e) => {
                      setClaimFormDateInput(e.target.value);
                      triggerAutoSave({ claim_form_date: e.target.value });
                    }}
                    className="w-full p-1 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-gray-600 block font-semibold">完成維修/交車日期：</label>
                  <input
                    type="date"
                    value={completedDateInput}
                    onChange={(e) => {
                      setCompletedDateInput(e.target.value);
                      triggerAutoSave({ completed_date: e.target.value });
                    }}
                    className="w-full p-1 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-500 bg-emerald-50 text-emerald-900"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">📝 狀況與故障描述</h4>
              <p className="text-xs text-gray-900 bg-gray-50 p-2.5 rounded-lg border border-slate-300 leading-snug">{selectedOrder.description || '無詳細描述'}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">🛠️ 維修與零件項目明細</h4>
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                >
                  + 新增維修項目
                </button>
              </div>

              {modalItems.length > 0 ? (
                <div className="border-2 rounded-lg overflow-hidden border-slate-400">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-200 text-slate-900 font-bold border-b-2 border-slate-400">
                      <tr>
                        <th className="p-2 w-10 text-center">完成</th>
                        <th className="p-2 w-32">類別</th>
                        <th className="p-2 w-1/2">項目名稱</th>
                        <th className="p-2">進度備註 (Notes)</th>
                        <th className="p-2 w-10 text-center">刪除</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {modalItems.map((item: any, i: number) => {
                        const isChecked = !!item.is_completed;
                        return (
                          <tr key={i} className={isChecked ? 'bg-emerald-50/50' : ''}>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCheck(i)}
                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2 font-bold">
                              <select
                                value={item.type || '進廠維修'}
                                onChange={(e) => handleTypeChange(i, e.target.value)}
                                className="p-1 border rounded text-xs bg-white text-slate-900 font-bold focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="進廠維修">進廠維修</option>
                                <option value="更換零件">更換零件</option>
                                <option value="現場處理">現場處理</option>
                                <option value="外判處理">外判處理</option>
                                <option value="收費項目">收費項目</option>
                                <option value="Recall項目">Recall項目</option>
                              </select>
                            </td>
                            <td className="p-2 font-semibold">
                              <input
                                type="text"
                                value={item.item_name || ''}
                                onChange={(e) => handleItemNameChange(i, e.target.value)}
                                placeholder="項目名稱..."
                                className={`w-full p-1 border rounded text-xs bg-white text-slate-900 font-semibold focus:ring-1 focus:ring-blue-500 ${isChecked ? 'line-through text-gray-400' : ''}`}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.notes || ''}
                                onChange={(e) => handleNoteChange(i, e.target.value)}
                                placeholder="輸入工程進度..."
                                className="w-full p-1 border-b border-slate-400 rounded-none text-xs bg-transparent focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="p-2 text-center">
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

            {selectedOrder.status?.toLowerCase() !== 'completed' && (
              <div className="border-t pt-2 space-y-2 bg-slate-50 p-3 rounded-xl border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">✍️ 工單完工簽核與結案設定</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">簽核完成日期 *</label>
                    <input
                      type="date"
                      value={completedDateInput}
                      onChange={(e) => {
                        setCompletedDateInput(e.target.value);
                        triggerAutoSave({ completed_date: e.target.value });
                      }}
                      className="w-full p-2 border rounded-lg text-xs text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">簽核員工姓名</label>
                    <input
                      type="text"
                      value={staffNameInput}
                      onChange={(e) => setStaffNameInput(e.target.value)}
                      className="w-full p-2 border rounded-lg text-xs text-black bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t pt-3">
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                關閉
              </button>
              {selectedOrder.status?.toLowerCase() !== 'completed' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleMarkAsCompleted}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? '提交中...' : '✅ 提交結案 (Mark as Completed)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}