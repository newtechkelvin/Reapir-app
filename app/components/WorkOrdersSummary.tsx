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

  // 對數報表 Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);

  const [garageLocationInput, setGarageLocationInput] = useState('');
  const [vehicleLocationInput, setVehicleLocationInput] = useState('');
  const [pickupReturnDateInput, setPickupReturnDateInput] = useState('');
  const [claimFormDateInput, setClaimFormDateInput] = useState('');
  const [completedDateInput, setCompletedDateInput] = useState('');

  const [staffNameInput, setStaffNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchGovernmentVehicles();
  }, []);

  const calculateDaysForOrder = (wo: any) => {
    const isCompleted = (wo.status || '').toLowerCase() === 'completed';
    const sStr = wo.claim_form_date || wo.created_at;
    if (!sStr) return 0;

    const start = new Date(sStr);
    const end = isCompleted && wo.completed_date ? new Date(wo.completed_date) : new Date();
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateTotalRepairDaysForVehicle = (orders: any[]) => {
    let total = 0;
    orders.forEach((wo) => {
      total += calculateDaysForOrder(wo);
    });
    return total;
  };

  const calculateAvailability = (totalRepairDays: number) => {
    if (totalRepairDays <= 0) return 100;
    const avail = Math.max(0, 100 - (totalRepairDays / 365) * 100);
    return parseFloat(avail.toFixed(2));
  };

  // 🎯 完全同步「兩階段精算演算法」：固定 3 個標準年度 + 滾動式展延期審查
  const getWarrantyInfo = (vehicle: any, allOrders: any[]) => {
    const deliveryDateStr = vehicle.delivery_date || vehicle.created_at || vehicle.claim_form_date;
    if (!deliveryDateStr) {
      return {
        originalEndDateStr: vehicle.warranty_expiry_date || vehicle.warranty_end_date || '未設定',
        updatedEndDateStr: vehicle.warranty_expiry_date || vehicle.warranty_end_date || '未設定',
        extensionMonths: 0,
        extensionCount: 0,
      };
    }

    const startDate = new Date(deliveryDateStr);
    
    // 原始標準保固 3 年
    let originalEndDate = new Date(startDate);
    originalEndDate.setFullYear(originalEndDate.getFullYear() + 3);

    let extensionCount = 0;

    // 階段 1：審查原保固期（固定 3 個標準年度，每年 365 天，5% 門檻 18.25 天）
    for (let yr = 0; yr < 3; yr++) {
      if (extensionCount >= 3) break;

      const pStart = new Date(startDate);
      pStart.setFullYear(pStart.getFullYear() + yr);

      const pEnd = new Date(pStart);
      pEnd.setFullYear(pEnd.getFullYear() + 1);

      let repairDays = 0;
      allOrders.forEach((wo: any) => {
        const sStr = wo.claim_form_date || wo.created_at;
        if (!sStr) return;

        const oStart = new Date(sStr);
        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
        const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : new Date();

        if (oStart < pEnd && oEnd >= pStart) {
          const overlapStart = new Date(Math.max(oStart.getTime(), pStart.getTime()));
          const overlapEnd = new Date(Math.min(oEnd.getTime(), pEnd.getTime()));
          const diffDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          repairDays += diffDays;
        }
      });

      if (repairDays > 18.25) {
        extensionCount++;
      }
    }

    // 階段 2：若前階段觸展延，接著滾動審查展延期（最多 3 期，每期 6 個月，5% 門檻 9.125 天）
    let currentExtStart = new Date(originalEndDate);

    for (let ext = 0; ext < 3; ext++) {
      if (extensionCount <= ext || extensionCount >= 3) break;

      const pStart = new Date(currentExtStart);
      const pEnd = new Date(pStart);
      pEnd.setMonth(pEnd.getMonth() + 6);

      let repairDays = 0;
      allOrders.forEach((wo: any) => {
        const sStr = wo.claim_form_date || wo.created_at;
        if (!sStr) return;

        const oStart = new Date(sStr);
        const isCompleted = (wo.status || '').toLowerCase() === 'completed';
        const oEnd = isCompleted && wo.completed_date ? new Date(wo.completed_date) : new Date();

        if (oStart < pEnd && oEnd >= pStart) {
          const overlapStart = new Date(Math.max(oStart.getTime(), pStart.getTime()));
          const overlapEnd = new Date(Math.min(oEnd.getTime(), pEnd.getTime()));
          const diffDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)));
          repairDays += diffDays;
        }
      });

      if (repairDays > 9.125) {
        extensionCount++;
      }

      currentExtStart = pEnd;
    }

    const totalExtensionMonths = extensionCount * 6;
    const updatedEndDate = new Date(originalEndDate);
    if (totalExtensionMonths > 0) {
      updatedEndDate.setMonth(updatedEndDate.getMonth() + totalExtensionMonths);
    }

    return {
      originalEndDateStr: originalEndDate.toISOString().split('T')[0],
      updatedEndDateStr: updatedEndDate.toISOString().split('T')[0],
      extensionMonths: totalExtensionMonths,
      extensionCount,
    };
  };

  const fetchGovernmentVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const data = await res.json();
        const govVehicles = (data.vehicles || [])
          .filter((v: any) => {
            const wType = (v.warranty_type || '').toLowerCase();
            const project = (v.project || '').toLowerCase();
            return wType !== 'general' && wType !== '散車' && !project.includes('散車');
          })
          .map((v: any) => {
            const allOrders = v.workOrders || v.work_orders || [];
            const openOnlyOrders = allOrders.filter(
              (o: any) => (o.status || 'Open').toLowerCase() === 'open'
            );
            
            const totalRepairDays = calculateTotalRepairDaysForVehicle(allOrders);

            return {
              ...v,
              allOrders,
              workOrders: openOnlyOrders,
              totalRepairDays,
            };
          })
          .filter((v: any) => (v.workOrders || []).length > 0);

        govVehicles.sort((a: any, b: any) => b.totalRepairDays - a.totalRepairDays);

        setVehicles(govVehicles);
      }
    } catch (err) {
      console.error('讀取政府合約 Summary 失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalOpenOrdersCount = vehicles.reduce((sum, v) => sum + (v.workOrders?.length || 0), 0);

  const lowAvailabilityVehicles = vehicles.filter((v) => {
    const avail = calculateAvailability(v.totalRepairDays || 0);
    return avail < 95;
  });

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

  const handleDeleteWorkOrder = async () => {
    if (!selectedOrder?.id) return;

    const orderNo = selectedOrder.order_number || '此工單';
    if (!confirm(`⚠️ 警告：確定要永久刪除【${orderNo}】嗎？刪除後紀錄無法復原！`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/work-orders/${selectedOrder.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('工單已成功刪除！');
        handleCloseDetailModal();
        fetchGovernmentVehicles();
      } else {
        const errData = await res.json().catch(() => null);
        alert(`刪除失敗: ${errData?.error || errData?.message || '請稍後再試'}`);
      }
    } catch (err) {
      console.error('刪除工單錯誤:', err);
      alert('網路連線失敗，無法刪除工單');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (lowAvailabilityVehicles.length === 0) {
      alert('當前沒有可用率低於 95% 的車輛資料可供匯出');
      return;
    }

    const headers = [
      '車牌號碼',
      '專案名稱',
      '品牌型號',
      'VIN碼',
      '累積停修天數',
      '當前可用率(%)',
      '原保固到期日',
      '展延月份',
      '修正後保固到期日',
      'Open工單數',
    ];

    const rows = lowAvailabilityVehicles.map((v) => {
      const avail = calculateAvailability(v.totalRepairDays || 0);
      const wInfo = getWarrantyInfo(v, v.allOrders || []);
      const brandModelStr = [v.brand, v.model].filter(Boolean).join(' ');

      return [
        `"${v.plate_number || ''}"`,
        `"${v.project || ''}"`,
        `"${brandModelStr}"`,
        `"${v.vin || ''}"`,
        v.totalRepairDays || 0,
        `${avail}%`,
        `"${wInfo.originalEndDateStr}"`,
        `"+${wInfo.extensionMonths}個月"`,
        `"${wInfo.updatedEndDateStr}"`,
        (v.workOrders || []).length,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `政府車輛保固展延對數表_可用率低於95%_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-black">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-modal-content,
          .print-modal-content * {
            visibility: visible !important;
          }
          .print-modal-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-hidden-element {
            display: none !important;
          }
        }
      `}</style>

      {/* 主頁面 UI 區塊 */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">🏛️ 政府合約維修工單 Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">顯示包含 Open 工單之車輛累積停修總天數與可用率 (按累積天數由高至低排序)</p>
          </div>
          <div className="bg-amber-500 text-white px-4 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
            <span className="text-xs font-bold">Open 工單總數：</span>
            <span className="text-xl font-black">{totalOpenOrdersCount} 張</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
          >
            ⚠️ 95% 超標對數報表 ({lowAvailabilityVehicles.length})
          </button>

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
          <p className="text-base font-bold">目前無 Open 狀態的政府合約工單</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle, idx) => {
            const openOrders = vehicle.workOrders || [];
            const totalRepairDays = vehicle.totalRepairDays || 0;
            const availability = calculateAvailability(totalRepairDays);
            
            const isNearWarning = availability >= 95 && availability <= 96.5;
            const isPassed = availability < 95;

            return (
              <div
                key={vehicle.id || idx}
                className={`bg-white border-2 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 ${
                  isNearWarning
                    ? 'border-amber-400 bg-amber-50/20 animate-pulse ring-2 ring-amber-300'
                    : isPassed
                    ? 'border-red-300'
                    : 'border-slate-200'
                }`}
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
                      <span className="text-gray-500 block text-[11px]">累積停修總天數</span>
                      <strong className={`text-base font-black ${totalRepairDays > 18.25 ? 'text-red-600' : 'text-slate-800'}`}>
                        {totalRepairDays} 天
                      </strong>
                    </div>

                    <div className={`p-2.5 rounded-lg border ${isNearWarning ? 'bg-amber-100 border-amber-400' : 'bg-white'}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 block text-[11px]">Availability (可用率)</span>
                        {isNearWarning && (
                          <span className="text-[10px] font-black bg-amber-600 text-white px-1.5 py-0.5 rounded animate-bounce">
                            ⚠️ 接近 95%
                          </span>
                        )}
                      </div>
                      <strong
                        className={`text-base font-black block mt-0.5 ${
                          isNearWarning
                            ? 'text-amber-700 font-extrabold'
                            : isPassed
                            ? 'text-red-600 font-bold'
                            : 'text-emerald-600'
                        }`}
                      >
                        {availability}%
                      </strong>
                    </div>

                    <div className="col-span-2 flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                      <span>專案：<strong className="text-slate-900">{vehicle.project || '未設定'}</strong></span>
                      <span>Open 工單數：<strong className="text-amber-700 font-bold">{openOrders.length} 張</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-xs space-y-1 border-t pt-2">
                  <span className="font-bold text-gray-700 block text-[11px]">Open 工單清單:</span>
                  {openOrders.map((wo: any, oIdx: number) => {
                    const orderDays = calculateDaysForOrder(wo);

                    return (
                      <div
                        key={oIdx}
                        onClick={() => handleOpenDetailModal(vehicle, wo)}
                        className="flex justify-between items-center text-[11px] bg-slate-50 p-2 rounded border border-slate-200 hover:bg-blue-50 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-900 group-hover:text-blue-700">{wo.order_number || 'WO-未知'}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Open ({orderDays}天)
                          </span>
                        </div>
                        <span className="text-[11px] text-blue-600 font-bold group-hover:underline">檢視明細 →</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🎯 對數報表 Modal (已對齊最新兩階段精算法) */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="print-modal-content bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto text-black">
            
            <div className="text-center border-b-2 border-slate-900 pb-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-wide">新力機械有限公司</h1>
              <p className="text-xs text-slate-700 font-bold tracking-widest mt-0.5">NEW TECH MOTOR ENGINEERING LIMITED</p>
              <p className="text-base font-extrabold text-red-700 mt-2 bg-red-50 py-1.5 rounded-lg border border-red-200">
                🏛️ 政府車輛保固展延對數報表 (可用率低於 95%)
              </p>
              <div className="flex justify-between items-center text-xs text-gray-500 mt-3 px-2">
                <span>報表產生日期: <strong>{new Date().toISOString().split('T')[0]}</strong></span>
                <span>超標車輛總計: <strong className="text-red-600 font-black">{lowAvailabilityVehicles.length} 輛</strong></span>
              </div>
            </div>

            {lowAvailabilityVehicles.length === 0 ? (
              <p className="text-center py-8 text-gray-500 font-bold">目前無任何可用率低於 95% 的車輛</p>
            ) : (
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-900 font-extrabold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 border-r border-slate-300">車牌號碼</th>
                      <th className="p-2.5 border-r border-slate-300">專案編號</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">累積停修</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">可用率 (Availability)</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">原保固到期日</th>
                      <th className="p-2.5 border-r border-slate-300 text-center">展延月份</th>
                      <th className="p-2.5 text-center bg-amber-50">修正後保固到期日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lowAvailabilityVehicles.map((v, idx) => {
                      const avail = calculateAvailability(v.totalRepairDays || 0);
                      const wInfo = getWarrantyInfo(v, v.allOrders || []);

                      return (
                        <tr key={v.id || idx} className="hover:bg-slate-50/80">
                          <td className="p-2.5 border-r border-slate-200 font-black text-blue-950">{v.plate_number}</td>
                          <td className="p-2.5 border-r border-slate-200 font-semibold">{v.project || '未設定'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-extrabold text-red-600">{v.totalRepairDays || 0} 天</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-black text-red-600">{avail}%</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-medium text-gray-600">{wInfo.originalEndDateStr}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold text-amber-700">+{wInfo.extensionMonths} 個月</td>
                          <td className="p-2.5 text-center font-black text-emerald-700 bg-amber-50/50">{wInfo.updatedEndDateStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-gray-600 space-y-1">
              <p className="font-bold text-slate-800">📌 保固展延對數原則說明：</p>
              <p>1. 原保固期內，按前 3 個標準年度分開審查，停修天數超標 18.25 天 (5%) 即觸發 1 次展延 (+6 個月)。</p>
              <p>2. 進入展延期（182.5天/6個月）後，停修上限調為 9.125 天。若期間停修再次超標，則進一步觸發下一期展延。</p>
              <p>3. 展延上限最多 3 次 (上限 18 個月)。</p>
            </div>

            <div className="flex justify-between items-center border-t pt-4 print-hidden-element">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 border rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                關閉
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  📥 匯出 CSV 檔
                </button>
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  🖨️ 列印 / 儲存為 PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 工單詳細 Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto text-black">
            
            <div className="text-center border-b-2 border-slate-900 pb-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-wide">新力機械有限公司</h1>
              <p className="text-xs text-slate-700 font-bold tracking-widest mt-0.5">NEW TECH MOTOR ENGINEERING LIMITED</p>
              <p className="text-sm font-extrabold text-blue-950 mt-1.5 bg-slate-100 py-1 rounded">車輛維修工單 (Repair Job Sheet)</p>
            </div>

            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-blue-900 text-lg">📋 {selectedOrder.order_number || 'WO-未知'}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800">
                  狀態: Open
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
                    <option value="機電 - 芬園">機電 - 芬園</option>
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

            <div className="flex justify-between items-center border-t pt-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  關閉
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteWorkOrder}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? '刪除中...' : '🗑️ 刪除工單'}
                </button>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleMarkAsCompleted}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? '提交中...' : '✅ 提交結案 (Mark as Completed)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}