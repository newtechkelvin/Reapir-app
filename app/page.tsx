'use client';

import React, { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create');

  // 新增工單狀態
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [project, setProject] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [mileage, setMileage] = useState('');
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([
    { item_name: '', type: 'Labor' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Excel 批量貼上 Modal 狀態
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // 搜尋車牌狀態
  const [searchPlate, setSearchPlate] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const addItem = () => {
    setItems([...items, { item_name: '', type: 'Labor' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // 解析 Excel / 試算表貼上的文字資料
  const handleApplyPaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.trim().split(/\r?\n/);
    const parsedItems = lines.map(line => {
      const cols = line.split('\t').map(c => c.trim());
      
      let type = 'Labor';
      let name = '';

      if (cols.length >= 2) {
        if (cols[0].includes('零件') || cols[0].toLowerCase() === 'part') {
          type = 'Part';
          name = cols[1];
        } else if (cols[0].includes('工時') || cols[0].includes('人工') || cols[0].toLowerCase() === 'labor') {
          type = 'Labor';
          name = cols[1];
        } else {
          name = cols[0];
        }
      } else if (cols.length === 1) {
        name = cols[0];
      }

      return { item_name: name, type };
    }).filter(item => item.item_name !== '');

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      setPasteText('');
      setShowPasteModal(false);
    } else {
      alert('無法解析貼上內容，請確認內容格式');
    }
  };

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
          vin,
          project,
          brand,
          model,
          mileage: Number(mileage) || 0,
          next_maintenance_date: nextMaintenanceDate,
          description,
          items
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`工單開立成功！單號：${data.order_number}`);
        setPlateNumber('');
        setVin('');
        setProject('');
        setBrand('');
        setModel('');
        setMileage('');
        setNextMaintenanceDate('');
        setDescription('');
        setItems([{ item_name: '', type: 'Labor' }]);
      } else {
        alert(`開單失敗：${data.error}`);
      }
    } catch (err) {
      alert('連線失敗，請檢查網路狀態');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          車輛維修與保養管理系統
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
            開立新工單
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
            車牌歷史與保養查詢
          </button>
        </div>

        {/* TAB 1: 新增工單 */}
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">車架號碼 (VIN)</label>
                <input
                  type="text"
                  placeholder="例如: 1HGCR2F83HA000000"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">項目 / Project</label>
                <input
                  type="text"
                  placeholder="例如: 醫院管理局工程 / 隧道維修合約"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">下一次保養到期日</label>
                <input
                  type="date"
                  value={nextMaintenanceDate}
                  onChange={(e) => setNextMaintenanceDate(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
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

            {/* 簡化版：維修與零件項目清單 */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">維修與零件項目明細</h3>
                  <p className="text-xs text-gray-500">可逐列輸入或從 Excel 複製多行直接貼上</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(true)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700 cursor-pointer shadow-xs"
                  >
                    快捷貼上 Excel 資料
                  </button>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 cursor-pointer shadow-xs"
                  >
                    + 新增一列
                  </button>
                </div>
              </div>

              {/* 簡化網格表格 */}
              <div className="overflow-x-auto border rounded-lg bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b text-gray-700">
                      <th className="p-2.5 w-32 font-semibold">類別</th>
                      <th className="p-2.5 font-semibold">維修項目 / 零件名稱</th>
                      <th className="p-2.5 w-16 text-center font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-blue-50/50">
                        <td className="p-1.5">
                          <select
                            value={item.type}
                            onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                            className="w-full p-2 border rounded text-black bg-white focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Labor">工時 / 服務</option>
                            <option value="Part">零件 / 耗材</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            placeholder="輸入項目或零件名稱 (例: 更換機油 / 剎車皮檢修)..."
                            value={item.item_name}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            className="w-full p-2 border rounded text-black focus:ring-1 focus:ring-blue-500"
                            required
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-red-500 hover:text-red-700 font-bold p-1 cursor-pointer"
                              title="刪除此列"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer text-lg shadow-sm"
            >
              {isSubmitting ? '儲存中...' : '儲存並開立工單'}
            </button>
          </form>
        )}

        {/* Excel 批量貼上 Modal 彈出視窗 */}
        {showPasteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800">從 Excel / 試算表批量貼上</h3>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-gray-600 space-y-1 bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">💡 貼上說明：可以從 Excel 複製多列項目貼到下方：</p>
                <p>• 每一行會自動識別為一個維修項目或零件。</p>
              </div>

              <textarea
                rows={8}
                placeholder={"可以直接從 Excel 複製多列貼至此處，例如：\n更換機油\n剎車皮更換\n車身油漆塗裝修補"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 text-black font-mono text-sm"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-5 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 cursor-pointer"
                >
                  解析並套用
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 車牌歷史與保養查詢 */}
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
                {isSearching ? '搜尋中...' : '搜尋車輛'}
              </button>
            </form>

            {/* 搜尋結果 */}
            {hasSearched && (
              <div className="mt-6 border-t pt-4">
                {!searchResult?.vehicle ? (
                  <div className="text-center py-8 text-gray-500">
                    查無該車牌的歷史保養紀錄。
                  </div>
                ) : (
                  <div>
                    {/* 車輛資訊卡片 */}
                    <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 p-5 rounded-xl mb-6 text-black shadow-sm">
                      <div className="flex flex-wrap justify-between items-center mb-3 border-b border-blue-200 pb-2">
                        <h3 className="text-xl font-extrabold text-blue-900">
                          車牌：{searchResult.vehicle.plate_number}
                        </h3>
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
                          <span className="font-semibold text-gray-600">車架號碼 (VIN)：</span>
                          <span className="font-mono font-bold text-gray-800">{searchResult.vehicle.vin || '未設定'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">所屬項目 / Project：</span>
                          <span className="font-bold text-blue-800">{searchResult.vehicle.project || '未設定'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">品牌 / 車型：</span>
                          <span className="font-bold text-gray-800">
                            {searchResult.vehicle.brand || '未設定'} / {searchResult.vehicle.model || '未設定'}
                          </span>
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
                        <div>
                          <span className="font-semibold text-gray-600">最新記錄里程：</span>
                          <span className="font-bold text-gray-800">{searchResult.vehicle.mileage} km</span>
                        </div>
                      </div>

                      {/* 曾維修項目總覽 */}
                      {searchResult.vehicle.maintenance_items_summary?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-blue-100">
                          <span className="font-semibold text-gray-700 block mb-1">過往曾維修/更換項目：</span>
                          <div className="flex flex-wrap gap-1.5">
                            {searchResult.vehicle.maintenance_items_summary.map((item: string, idx: number) => (
                              <span key={idx} className="bg-white border text-gray-700 text-xs px-2.5 py-1 rounded-md shadow-xs">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 歷史工單紀錄 */}
                    <h4 className="font-bold text-gray-800 mb-3">詳細歷史工單紀錄：</h4>
                    <div className="space-y-4">
                      {searchResult.workOrders?.map((wo: any) => (
                        <div key={wo.id} className="border rounded-lg p-4 bg-gray-50 text-black shadow-xs">
                          <div className="flex justify-between items-center mb-2 border-b pb-2">
                            <div>
                              <span className="font-bold text-blue-700">{wo.order_number}</span>
                              {wo.project && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded ml-2 font-medium">
                                  {wo.project}
                                </span>
                              )}
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(wo.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 mb-2">備註描述：{wo.description || '無'}</p>

                          <div className="bg-white p-2.5 rounded border text-sm">
                            <div className="font-semibold text-gray-700 mb-1">本單維修項目明細：</div>
                            <ul className="list-disc list-inside space-y-1">
                              {wo.work_order_items?.map((item: any) => (
                                <li key={item.id} className="text-gray-600">
                                  {item.item_name} ({item.type === 'Part' ? '零件' : '工時'})
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
        )}
      </div>
    </div>
  );
}
