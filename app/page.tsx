'use client';

import React, { useState } from 'react';

export default function MaintenanceApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create');
  
  // 開單 Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [mileage, setMileage] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([
    { type: 'PART', item_name: '全合成機油 5W-30 (1L)', quantity: 4, unit_price: 150 },
    { type: 'LABOR', item_name: '定期保養工時', quantity: 1, unit_price: 300 }
  ]);

  // 查詢 State
  const [searchPlate, setSearchPlate] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);

  // 動態增加明細
  const addItem = () => {
    setItems([...items, { type: 'PART', item_name: '', quantity: 1, unit_price: 0 }]);
  };

  // 計算動態總額
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  // 檢查是否發出里程保養提醒
  const isMaintenanceDue = mileage > 0 && mileage % 10000 >= 9500;

  // 送出工單
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate_number: plateNumber, model, mileage, description, items })
    });
    const data = await res.json();
    if (data.success) {
      alert(`工單開立成功！單號：${data.order_number}`);
      setPlateNumber('');
      setDescription('');
    } else {
      alert(`失敗：${data.error}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">🚘 車輛維修管理系統</h1>
      
      {/* Tab 切換 */}
      <div className="flex gap-4 border-b mb-6">
        <button
          className={`pb-2 px-4 font-semibold ${activeTab === 'create' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('create')}
        >
          開立維修工單
        </button>
        <button
          className={`pb-2 px-4 font-semibold ${activeTab === 'search' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('search')}
        >
          車輛歷史查詢
        </button>
      </div>

      {/* 頁面 1：開立工單 */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmitOrder} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">車牌號碼 *</label>
              <input
                type="text"
                required
                placeholder="例如：AB-1234"
                className="w-full border rounded p-2"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">車型 / 品牌</label>
              <input
                type="text"
                placeholder="例如：Toyota Hino"
                className="w-full border rounded p-2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">進廠里程 (km) *</label>
              <input
                type="number"
                required
                className="w-full border rounded p-2"
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
              />
            </div>
          </div>

          {/* 保養提醒 Banner */}
          {isMaintenanceDue && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-amber-800 text-sm">
              ⚠️ <strong>保養提示：</strong> 該車里程已達 {mileage} km，接近定期大保養標準（每 10,000 km）！
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">故障描述 / 備註</label>
            <textarea
              className="w-full border rounded p-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 零件與工時明細 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">維修項目與零件明細</h3>
              <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">
                + 新增項目
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select
                  value={item.type}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].type = e.target.value;
                    setItems(newItems);
                  }}
                  className="border rounded p-2 text-sm"
                >
                  <option value="PART">零件</option>
                  <option value="LABOR">工時/服務</option>
                </select>
                <input
                  type="text"
                  placeholder="項目名稱"
                  className="flex-1 border rounded p-2 text-sm"
                  value={item.item_name}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].item_name = e.target.value;
                    setItems(newItems);
                  }}
                />
                <input
                  type="number"
                  placeholder="數量"
                  className="w-20 border rounded p-2 text-sm"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].quantity = Number(e.target.value);
                    setItems(newItems);
                  }}
                />
                <input
                  type="number"
                  placeholder="單價"
                  className="w-24 border rounded p-2 text-sm"
                  value={item.unit_price}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].unit_price = Number(e.target.value);
                    setItems(newItems);
                  }}
                />
                <span className="w-20 text-right text-sm font-medium">
                  ${item.quantity * item.unit_price}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t pt-4">
            <span className="text-lg font-bold">總計金額：${totalAmount}</span>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              儲存並送出工單
            </button>
          </div>
        </form>
      )}

      {/* 頁面 2：歷史紀錄查詢 */}
      {activeTab === 'search' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="輸入車牌號碼查詢"
              className="flex-1 border rounded p-2"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
            />
            <button className="bg-gray-800 text-white px-4 py-2 rounded">搜尋</button>
          </div>

          <div className="border-t pt-4 text-gray-500 text-center py-8">
            輸入車牌以檢視該車輛之歷史維修工單紀錄與更換零件履歷。
          </div>
        </div>
      )}
    </div>
  );
}