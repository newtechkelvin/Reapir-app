'use client';

import React, { useState, useEffect } from 'react';

interface BatchCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[]; // 傳入搜尋或全域的車輛陣列
  onSuccess: () => void;
}

export default function BatchCompleteModal({
  isOpen,
  onClose,
  vehicles,
  onSuccess,
}: BatchCompleteModalProps) {
  if (!isOpen) return null;

  // 1. 解析所有未完成 (Open) 的工單清單
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  useEffect(() => {
    const list: any[] = [];
    vehicles.forEach((v) => {
      const orders = v.workOrders || v.work_orders || [];
      orders.forEach((wo: any) => {
        const status = String(wo.status || '').toLowerCase();
        if (status !== 'completed' && status !== 'closed' && status !== '已完成') {
          list.push({
            ...wo,
            plate_number: v.plate_number,
            brand: v.brand,
            model: v.model,
            project: v.project,
            vehicle_id: v.id,
          });
        }
      });
    });
    setOpenOrders(list);
  }, [vehicles]);

  // 全域預設填入值
  const todayStr = new Date().toISOString().slice(0, 10);
  const [defaultDate, setDefaultDate] = useState(todayStr);
  const [defaultStaff, setDefaultStaff] = useState('');

  // 紀錄已勾選的工單 ID 與個別填寫數據
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsData, setItemsData] = useState<{
    [id: string]: {
      completed_date: string;
      staff_name: string;
      notes: string;
    };
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 取得或初始化單筆資料
  const getItemData = (id: string) => {
    return (
      itemsData[id] || {
        completed_date: defaultDate,
        staff_name: defaultStaff,
        notes: '',
      }
    );
  };

  const handleInputChange = (
    id: string,
    field: 'completed_date' | 'staff_name' | 'notes',
    value: string
  ) => {
    setItemsData((prev) => ({
      ...prev,
      [id]: {
        ...getItemData(id),
        [field]: value,
      },
    }));
  };

  // 全選 / 清除全選
  const handleToggleSelectAll = () => {
    if (selectedIds.length === openOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(openOrders.map((o) => o.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // 將「預設日期與簽核員工」一鍵套用到所有已勾選的工單
  const handleApplyDefaultsToSelected = () => {
    const updated = { ...itemsData };
    selectedIds.forEach((id) => {
      updated[id] = {
        ...getItemData(id),
        completed_date: defaultDate,
        staff_name: defaultStaff,
      };
    });
    setItemsData(updated);
  };

  // 送出批次結案
  const handleSubmitBatch = async () => {
    if (selectedIds.length === 0) {
      alert('請先勾選要結案的工單！');
      return;
    }

    // 驗證是否有勾選的工單未填寫日期
    for (const id of selectedIds) {
      const data = getItemData(id);
      if (!data.completed_date) {
        const targetOrder = openOrders.find((o) => o.id === id);
        alert(`工單編號 ${targetOrder?.order_number || id} 尚未填寫完工/簽核日期！`);
        return;
      }
    }

    if (!confirm(`確定要將已勾選的 ${selectedIds.length} 張工單標示為【Completed】正式結案嗎？`)) return;

    setIsSubmitting(true);
    try {
      const requests = selectedIds.map((id) => {
        const data = getItemData(id);
        const targetOrder = openOrders.find((o) => o.id === id);
        const currentItems = targetOrder?.work_order_items || targetOrder?.items || [];

        // 若填寫了進度備註，將備註帶入項目明細的第一項或建立新備註
        let updatedItems = [...currentItems];
        if (data.notes.trim()) {
          if (updatedItems.length > 0) {
            updatedItems[0] = {
              ...updatedItems[0],
              notes: updatedItems[0].notes
                ? `${updatedItems[0].notes} | ${data.notes}`
                : data.notes,
              is_completed: true,
            };
          } else {
            updatedItems.push({
              type: '進廠維修',
              item_name: '結案紀錄',
              is_completed: true,
              notes: data.notes,
            });
          }
        }

        return fetch(`/api/work-orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Completed',
            completed_date: data.completed_date,
            staff_name: data.staff_name,
            items: updatedItems,
          }),
        });
      });

      await Promise.all(requests);
      alert(`🎉 成功將 ${selectedIds.length} 張工單批次結案！`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('批次結案失敗:', err);
      alert('部分或全部工單結案失敗，請檢查網路或系統權限');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 print:hidden text-black">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              ⚡ 快速批次結案工具
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              一鍵套用完工日期與簽核員工，一次過將多張【Open】工單標示為【Completed】
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 快捷批量欄位套用區 */}
        <div className="bg-slate-100 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-800 bg-slate-200 px-2 py-1 rounded">
              一鍵填寫工具：
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-700 font-semibold">預設完成/簽核日期：</label>
              <input
                type="date"
                value={defaultDate}
                onChange={(e) => setDefaultDate(e.target.value)}
                className="p-1 border border-slate-300 rounded-lg bg-white font-bold focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-gray-700 font-semibold">預設簽核員工：</label>
              <input
                type="text"
                placeholder="員工姓名"
                value={defaultStaff}
                onChange={(e) => setDefaultStaff(e.target.value)}
                className="p-1 border border-slate-300 rounded-lg bg-white font-bold w-28 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleApplyDefaultsToSelected}
            disabled={selectedIds.length === 0}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            套用到已勾選項目 ({selectedIds.length})
          </button>
        </div>

        {/* 表格清單 */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-200 text-slate-900 font-bold sticky top-0 border-b border-slate-300 z-10">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={openOrders.length > 0 && selectedIds.length === openOrders.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 cursor-pointer text-blue-600 rounded"
                  />
                </th>
                <th className="p-3 w-32">工單編號 / 車牌</th>
                <th className="p-3 w-44">故障與狀況描述</th>
                <th className="p-3 w-40">完工/簽核日期 *</th>
                <th className="p-3 w-32">簽核員工</th>
                <th className="p-3">進度備註 (Notes)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {openOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 italic font-medium">
                    🎉 目前沒有任何 Open 狀態的工單需要結案！
                  </td>
                </tr>
              ) : (
                openOrders.map((order) => {
                  const isChecked = selectedIds.includes(order.id);
                  const data = getItemData(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={isChecked ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(order.id)}
                          className="w-4 h-4 cursor-pointer text-blue-600 rounded"
                        />
                      </td>
                      <td className="p-3 font-bold">
                        <div className="text-blue-900">{order.order_number || 'WO-未知'}</div>
                        <div className="text-amber-600 text-[11px] font-extrabold">🚘 {order.plate_number}</div>
                      </td>
                      <td className="p-3 text-gray-600 line-clamp-2">{order.description || '無描述'}</td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={data.completed_date}
                          onChange={(e) => handleInputChange(order.id, 'completed_date', e.target.value)}
                          className="w-full p-1.5 border rounded-lg bg-white font-bold focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="姓名"
                          value={data.staff_name}
                          onChange={(e) => handleInputChange(order.id, 'staff_name', e.target.value)}
                          className="w-full p-1.5 border rounded-lg bg-white font-semibold focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="維修進度或結案備註..."
                          value={data.notes}
                          onChange={(e) => handleInputChange(order.id, 'notes', e.target.value)}
                          className="w-full p-1.5 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center border-t pt-3">
          <span className="text-xs text-gray-600 font-semibold">
            未結案總數：<strong className="text-amber-700">{openOrders.length}</strong> 筆 | 已選擇：
            <strong className="text-blue-600 text-sm">{selectedIds.length}</strong> 筆
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isSubmitting || selectedIds.length === 0}
              onClick={handleSubmitBatch}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? '⏳ 批次提交中...' : `✅ 提交結案 (${selectedIds.length} 筆)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
