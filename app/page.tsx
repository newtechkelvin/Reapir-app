'use client';

import React, { useState } from 'react';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create');

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

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVehicles, setSearchVehicles] = useState<any[]>([]);
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

  const handleApplyPaste = () => {
    if (!pasteText.trim()) return;

    const cleanText = pasteText.trim().replace(/\r/g, '');
    const lines = cleanText.split('\n');
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

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      alert('請輸入搜尋關鍵字');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/work-orders?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (data.success) {
        setSearchVehicles(data.vehicles || []);
      } else {
        alert(data.error || '查詢發生錯誤');
      }
    } catch (err) {
      alert('無法連線至伺服器');
    } finally {
      setIsSearching(false);
    }
  };

  const exportToCSV = () => {
    if (!searchVehicles || searchVehicles.length === 0) {
      alert('沒有可匯出的車輛資料');
      return;
    }

    const headers = ['車牌號碼', '車架號碼(VIN)', '所屬項目(Project)', '品牌', '車型', '最新里程(km)', '保養到期日', '保養狀態', '最後維修時間'];

    const rows = searchVehicles.map(v => {
      const status = getMaintenanceStatus(v.next_maintenance_date).label;
      const lastRepair = v.last_repair_date ? new Date(v.last_repair_date).toLocaleDateString() : '無';
      return [
        `"${v.plate_number || ''}"`,
        `"${v.vin || ''}"`,
        `"${v.project || ''}"`,
        `"${v.brand || ''}"`,
        `"${v.model || ''}"`,
        v.mileage || 0,
        `"${v.next_maintenance_date || ''}"`,
        `"${status}"`,
        `"${lastRepair}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `車輛維修與保養紀錄表_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6 print:shadow-none print:m-0 print:max-w-full print:p-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          車輛維修與保養管理系統
        </h1>

        <div className="flex border-b border-gray-200 mb-6 print:hidden">
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
            車牌、VIN 與專案綜合搜尋
          </button>
        </div>

        {activeTab === 'create' && (
          <CreateWorkOrder
            handleCreateOrder={handleCreateOrder}
            plateNumber={plateNumber}
            setPlateNumber={setPlateNumber}
            vin={vin}
            setVin={setVin}
            project={project}
            setProject={setProject}
            brand={brand}
            setBrand={setBrand}
            model={model}
            setModel={setModel}
            mileage={mileage}
            setMileage={setMileage}
            nextMaintenanceDate={nextMaintenanceDate}
            setNextMaintenanceDate={setNextMaintenanceDate}
            description={description}
            setDescription={setDescription}
            items={items}
            handleItemChange={handleItemChange}
            removeItem={removeItem}
            addItem={addItem}
            setShowPasteModal={setShowPasteModal}
            isSubmitting={isSubmitting}
          />
        )}

        {showPasteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-800">從 Excel 或試算表批量貼上</h3>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-semibold text-blue-900">💡 貼上說明：可以從 Excel 複製多列項目貼到下方。</p>
              </div>

              <textarea
                rows={8}
                placeholder="例如：更換機油、剎車皮更換"
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

        {activeTab === 'search' && (
          <SearchVehicles
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
            isSearching={isSearching}
            hasSearched={hasSearched}
            searchVehicles={searchVehicles}
            getMaintenanceStatus={getMaintenanceStatus}
            exportToCSV={exportToCSV}
            handlePrint={handlePrint}
          />
        )}
      </div>
    </div>
  );
}
