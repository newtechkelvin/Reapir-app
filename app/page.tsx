'use client';

import React, { useState, useEffect } from 'react';
import WorkOrdersSummary from './components/WorkOrdersSummary';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';
import ManageVehicles from './components/ManageVehicles';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'summary' | 'create' | 'search' | 'vehicles'>('summary');

  // 車輛與工單 State
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 搜尋 State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVehicles, setSearchVehicles] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 開單 State
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [project, setProject] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [claimFormDate, setClaimFormDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<any[]>([{ type: '進廠維修', item_name: '' }]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 編輯車輛 Modal State
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  useEffect(() => {
    fetchAllVehicles();
  }, []);

  const fetchAllVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      console.error('讀取車輛資料失敗:', err);
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchVehicles(vehicles);
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/work-orders?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchVehicles(data.vehicles || []);
      } else {
        setSearchVehicles([]);
      }
    } catch (err) {
      console.error('搜尋失敗:', err);
      setSearchVehicles([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim()) {
      alert('請輸入車牌號碼');
      return;
    }

    const validItems = items.filter((i) => i.item_name && i.item_name.trim() !== '');
    if (validItems.length === 0) {
      alert('請至少新增一項維修或零件項目');
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
          location,
          claim_form_date: claimFormDate,
          description,
          items: validItems,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert('工單建立成功！');
        setPlateNumber('');
        setVin('');
        setProject('');
        setBrand('');
        setModel('');
        setLocation('');
        setClaimFormDate('');
        setDescription('');
        setItems([{ type: '進廠維修', item_name: '' }]);

        await fetchAllVehicles();
        setActiveTab('summary');
      } else {
        alert(`建立失敗: ${data?.error || data?.message || '請檢查資料輸入'}`);
      }
    } catch (err: any) {
      console.error('建立工單失敗:', err);
      alert('網路連線或請求失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { type: '進廠維修', item_name: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleApplyPaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n').filter((l) => l.trim() !== '');
    const newParsedItems = lines.map((line) => {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length >= 2) {
        return { type: parts[0] || '進廠維修', item_name: parts[1] };
      }
      return { type: '進廠維修', item_name: parts[0] };
    });

    setItems(newParsedItems);
    setPasteText('');
    setShowPasteModal(false);
  };

  const getMaintenanceStatus = (dateStr: string) => {
    if (!dateStr) return { label: '未設定', color: 'bg-gray-100 text-gray-700' };
    return { label: '正常', color: 'bg-emerald-100 text-emerald-800' };
  };

  const exportToCSV = () => {
    alert('正在匯出 CSV 報表...');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頂部導覽列 */}
        <header className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">車輛維修工單與可用率管理系統</h1>
            <p className="text-xs text-slate-500 mt-1">NEW TECH MOTOR ENGINEERING LIMITED - Vehicle Maintenance & Availability System</p>
          </div>

          <nav className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'summary' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📊 工單即時 Summary
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'create' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ➕ 開新工單
            </button>
            <button
              onClick={() => {
                setActiveTab('search');
                if (!hasSearched) handleSearch();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'search' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🔍 查詢車輛與工單
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚘 車輛主表管理
            </button>
          </nav>
        </header>

        {/* 頁面內容分頁切换 */}
        {activeTab === 'summary' && <WorkOrdersSummary />}

        {activeTab === 'create' && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
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
              location={location}
              setLocation={setLocation}
              claimFormDate={claimFormDate}
              setClaimFormDate={setClaimFormDate}
              description={description}
              setDescription={setDescription}
              items={items}
              handleItemChange={handleItemChange}
              removeItem={removeItem}
              addItem={addItem}
              setShowPasteModal={setShowPasteModal}
              isSubmitting={isSubmitting}
            />
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

        {/* 傳入正確 Props 的 ManageVehicles 模組 */}
        {activeTab === 'vehicles' && (
          <ManageVehicles
            vehicles={vehicles}
            isLoading={isLoading}
            onRefresh={fetchAllVehicles}
            onEditVehicle={(v) => setEditingVehicle(v)}
          />
        )}
      </div>

      {/* 快速貼上 Excel 彈窗 */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">快速貼上 Excel 項目</h3>
            <p className="text-xs text-gray-500">格式：每行一個項目，或包含 [類別 Tab 項目名稱]</p>
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="進廠維修&#9;更換煞車皮&#n更換零件&#9;機油濾芯"
              className="w-full p-2.5 border rounded-xl text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyPaste}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
              >
                套用項目
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}