'use client';

import React, { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create');

  // --- 新增工單 State ---
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [mileage, setMileage] = useState('');
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([
    { item_name: '', type: 'Labor', quantity: 1, unit_price: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 搜尋車牌 State ---
  const [searchPlate, setSearchPlate] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const addItem = () => {
    setItems([...items, { item_name: '', type: 'Labor', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  };

  // 計算保養到期狀態（過期 / 即將到期 / 正常）
  const getMaintenanceStatus = (dateStr: string) => {
    if (!dateStr) return { label: '未設定', color: 'bg-gray-100 text-gray-600' };
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return { label: `已過期 ${Math.abs(diffDays)} 天`, color: 'bg-red-100 text-red-700 font-bold' };
    } else if (diffDays <= 30) {
      return { label: `剩餘 ${diffDays} 天到期`, color: 'bg-yellow-100 text-yellow-800 font-bold' };
    } else {
      return { label: `正常 (${dateStr})`, color: 'bg-green-100 text-green-700' };
    }
  };

  // 1. 提交新工單
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      alert('請輸入車牌號碼');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate_number: plateNumber,
          brand,
          model,
          mileage: Number(mileage) || 0,
          next_maintenance_date: nextMaintenanceDate,
          description,
          items: items.map(item => ({
            ...item,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price)
          }))
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`工單開立成功！單號：${data.order_number}`);
        setPlateNumber('');
        setBrand('');
        setModel('');
        setMileage('');
        setNextMaintenanceDate('');
        setDescription('');
        setItems([{ item_name: '', type: 'Labor', quantity: 1, unit_price: 0 }]);
      } else {
        alert(`開單失敗：${data.error}`);
      }
    } catch (err) {
      alert('連線失敗，請檢查網路狀態');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. 搜尋車牌歷史與保養資訊
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedPlate = searchPlate.trim();
    if (!trimmedPlate) {
      alert('請輸入車牌號碼再點擊搜尋');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/work-orders?plate=${encodeURIComponent(trimmedPlate)}`);
      const data = await res.json();

      if (data.success) {
        setSearchResult(data);
      } else {
        alert(data.error || '查詢發生錯誤');
      }
    } catch (err) {
      alert('無法連線至伺服器');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {"🚗 車輛維修與保養管理系統"}
        </h1>

        {/* 分頁切換 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'create'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('create')}
          >
            {"➕ 開立新工單"}
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('search')}
          >
            {"🔍 車牌歷史與保養查詢"}
          </button>
        </div>

        {/* TAB 1: 新增工單頁面 */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateOrder} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">車牌號碼 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如: AB-1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">汽車品牌</label>
                <input
                  type="text"
                  placeholder="例如: Toyota / Benz / Scania"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">車型名稱</label>
                <input
                  type="text"
                  placeholder="例如: HiAce / Coaster"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">最新里程數 (km)</label>
                <input
                  type="number"
                  placeholder="例如: 85000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">下一次保養到期日</label>
              <input
                type="date"
                value={nextMaintenanceDate}
                onChange={(e) => setNextMaintenanceDate(e.target.value)}
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">維修狀況描述</label>
              <textarea
                rows={2}
                placeholder="請輸入客訴問題或維修備註..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              />
            </div>

            {/* 明細清單 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-700">維修與零件項目</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 cursor-pointer"
                >
                  + 新增項目
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 mb-2 items-center border-b pb-2">
                  <select
                    value={item.type}
                    onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                    className="p-2 border rounded text-black bg-white"
                  >
                    <option value="Labor">工時 / 服務</option>
                    <option value="Part">零件 / 耗材</option>
                  </select>
                  <input
                    type="text"
                    placeholder="項目名稱 (如: 更換機油/剎車片)"
                    value={item.item_name}
                    onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                    className="flex-1 p-2 border rounded text-black"
                    required
                  />
                  <input
                    type="number"
                    placeholder="數量"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    className="w-20 p-2 border rounded text-black"
                    required
                  />
                  <input
                    type="number"
                    placeholder="單價"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                    className="w-28 p-2 border rounded text-black"
                    required
                  />
                  <div className="w-24 text-right font-semibold text-gray-700">
                    ${(Number(item.quantity) || 0) * (Number(item.unit_price) || 0)}
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div className="text-right text-lg font-bold text-gray-800 mt-4">
                總金額: <span className="text-blue-600">${calculateTotal()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer"
            >
              {isSubmitting ? '儲存中...' : '儲存並開立工單'}
            </button>
          </form>
        )}

        {/* TAB 2: 車牌歷史與保養查詢頁面 */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="輸入完整車牌號碼 (例: AB-1234)"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black text-lg"
              />
              <button
                type="submit"
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer"
              >
                {isSearching ? '搜尋中...' : '🔍 搜尋車輛'}
              </button>
            </form>

            {/* 搜尋結果列表 */}
            {hasSearched && (
              <div className="mt-6 border-t pt-4">
                {!searchResult?.vehicle ? (
                  <div className="text-center py-8 text-gray-500">
                    查無該車牌的歷史保養紀錄。
                  </div>
                ) : (
                  <div>
                    {/* 車輛與保養核心資訊卡片 */}
                    <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 p-5 rounded-xl mb-6 text-black shadow-sm">
                      <div className="flex flex-wrap justify-between items-center mb-3 border-b border-blue-200 pb-2">
                        <h3 className="text-xl font-extrabold text-blue-900">
                          車牌：{searchResult.vehicle.plate_number}
                        </h3>
                        {/* 保養狀態標籤 */}
                        {(() => {
                          const status = getMaintenanceStatus(searchResult.vehicle.next_maintenance_date);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                              保養狀態：{status.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold text-gray-600">品牌：</span>
                          <span className="font-bold text-gray-800">{searchResult.vehicle.brand || '未填寫'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">車型：</span>
                          <span className="font-bold text-gray-800">{searchResult.vehicle.model || '未填寫'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">保養到期日：</span>
                          <span className="font-bold text-gray-800">
                            {searchResult.vehicle.next_maintenance_date || '未設定'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">最後一次維修時間：</span>
                          <span className="font-bold text-gray-800">
                            {searchResult.vehicle.last_repair_date
                              ? new Date(searchResult.vehicle.last_repair_date).toLocaleString()
                              : '無歷史紀錄'}
                          </span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-semibold text-gray-600">最新記錄里程：</span>
                          <span className="font-bold text-gray-800">{searchResult.vehicle.mileage} km</span>
                        </div>
                      </div>

                      {/* 做過的項目總覽 */}
                      {searchResult.vehicle.maintenance_items_summary?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-blue-100">
                          <span className="font-semibold text-gray-700 block mb-1">過往曾維修/更換項目：</span>
                          <div className="flex flex-wrap gap-1.5">
                            {searchResult.vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                              <span key={idx} className="bg-white border text-gray-700 text-xs px-2.5 py-1 rounded-md shadow-xs">
                                {`🔧 ${item}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 工單歷史清單 */}
                    <h4 className="font-bold text-gray-800 mb-3">詳細歷史工單紀錄：</h4>
                    <div className="space-y-4">
                      {searchResult.workOrders?.map((wo: any) => (
                        <div key={wo.id} className="border rounded-lg p-4 bg-gray-50 text-black shadow-xs">
                          <div className="flex justify-between items-center mb-2 border-b pb-2">
                            <div>
                              <span className="font-bold text-blue-700">{wo.order_number}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(wo.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="font-bold text-green-700">${wo.total_cost}</span>
                          </div>

                          <p className="text-sm text-gray-600 mb-2">備註描述：{wo.description || '無'}</p>

                          <div className="bg-white p-2.5 rounded border text-sm">
                            <div className="font-semibold text-gray-700 mb-1">本單維修項目明細：</div>
                            <ul className="list-disc list-inside space-y-1">
                              {wo.work_order_items?.map((item: any) => (
                                <li key={item.id} className="text-gray-600">
                                  {item.item_name} ({item.type === 'Part' ? '零件' : '工時'}) - {item.quantity} x ${item.unit_price} = ${item.subtotal}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
