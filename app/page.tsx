'use client';

import React, { useState, useEffect } from 'react';
import WorkOrdersSummary from './components/WorkOrdersSummary';
import GeneralWarrantySummary from './components/GeneralWarrantySummary';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';
import ManageVehicles from './components/ManageVehicles';
import ProjectSettings from './components/ProjectSettings';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'summary' | 'general_summary' | 'create' | 'search' | 'vehicles' | 'project_settings'>('summary');

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [pickupReturnDate, setPickupReturnDate] = useState('');
  const [description, setDescription] = useState('');
  const [warrantyType, setWarrantyType] = useState<string>('');
  const [maintenanceStartDate, setMaintenanceStartDate] = useState('');
  const [maintenanceExpiryDate, setMaintenanceExpiryDate] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<'pending' | 'confirmed'>('pending');
  const [quoteReference, setQuoteReference] = useState('');
  const [oralQuoteConfirmed, setOralQuoteConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [items, setItems] = useState<any[]>([{ type: '進廠維修', item_name: '' }]);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  // 舊紀錄 CSV 批次匯入 Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCsvText, setBatchCsvText] = useState('');
  const [isBatchImporting, setIsBatchImporting] = useState(false);

  useEffect(() => {
    fetchAllVehicles();
  }, []);

  useEffect(() => {
    if (activeTab !== 'create') return;
    let cancelled = false;
    const fetchNextOrderNumber = async () => {
      try {
        const res = await fetch('/api/work-orders/next-number');
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.order_number) setOrderNumber(data.order_number);
      } catch (error) {
        console.error('取得下一個工單編號失敗:', error);
      }
    };
    fetchNextOrderNumber();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

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
    if (!warrantyType) {
      alert('請先選擇政府合約或散車類別');
      return;
    }
    if (!plateNumber.trim()) {
      alert('請輸入車牌號碼');
      return;
    }

    const validItems = items.filter((i) => i.item_name && i.item_name.trim() !== '');
    if (warrantyType === 'General' && (!maintenanceStartDate || !maintenanceExpiryDate)) {
      alert('散車必須輸入保養期開始日及到期日');
      return;
    }
    if (warrantyType === 'General' && quoteStatus === 'confirmed' && !quoteReference.trim() && !oralQuoteConfirmed) {
      alert('完成報價確認時，請填寫報價單號或選擇「已口頭報價」');
      return;
    }
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
          project: project || (warrantyType === 'General' ? '散車保固' : ''),
          brand,
          model,
          location,
          claim_form_date: claimFormDate,
          pickup_return_date: pickupReturnDate,
          description,
          items: validItems,
          warranty_type: warrantyType,
          maintenance_start_date: warrantyType === 'General' ? maintenanceStartDate : null,
          maintenance_expiry_date: warrantyType === 'General' ? maintenanceExpiryDate : null,
          quote_status: warrantyType === 'General' ? quoteStatus : 'not_required',
          quote_reference: warrantyType === 'General' ? (quoteReference.trim() || null) : null,
          oral_quote_confirmed: warrantyType === 'General' ? oralQuoteConfirmed : false,
          order_number: orderNumber || undefined
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
        setPickupReturnDate('');
        setMaintenanceStartDate('');
        setMaintenanceExpiryDate('');
        setQuoteStatus('pending');
        setQuoteReference('');
        setOralQuoteConfirmed(false);
        setDescription('');
        setItems([{ type: '進廠維修', item_name: '' }]);
        setOrderNumber('');

        await fetchAllVehicles();
        if (warrantyType === 'General') {
          setActiveTab('general_summary');
        } else {
          setActiveTab('summary');
        }
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

  const downloadCsvTemplate = () => {
    const csvHeader = 'plate_number,vin,project,brand,model,claim_form_date,completed_date,garage_location,description,items,warranty_type\n';
    const csvSample1 = 'AM1234,VIN123456,政府合約,Toyota,Coaster,2025-01-10,2025-01-12,機電 - 九龍灣1/F,引擎異音與煞車檢修,更換機油;更換前煞車皮,Government\n';
    const csvSample2 = 'AM5678,VIN789012,散車項目,Isuzu,N-Series,2025-02-01,2025-02-03,機電 - 屯門,冷氣不冷,檢查冷媒 leak;更換冷氣濾芯,General\n';
    
    const blob = new Blob(['\uFEFF' + csvHeader + csvSample1 + csvSample2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Warranty_Form_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setBatchCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteBatchImport = async () => {
    if (!batchCsvText.trim()) {
      alert('請先貼上 CSV 內容或選取 CSV 檔案');
      return;
    }

    try {
      setIsBatchImporting(true);
      const lines = batchCsvText.split(/\r\n|\n/).filter((l) => l.trim() !== '');
      if (lines.length <= 1) {
        alert('CSV 內容不可為空或只有標題列');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const records: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
        if (row.length === 0 || !row[0]) continue;

        const record: any = {};
        headers.forEach((h, idx) => {
          record[h] = row[idx] || '';
        });

        records.push(record);
      }

      if (records.length === 0) {
        alert('沒有解析出有效的資料列');
        return;
      }

      const res = await fetch('/api/work-orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`成功匯入 ${data.count} 筆舊有 Warranty Form 紀錄！`);
        setBatchCsvText('');
        setShowBatchModal(false);
        await fetchAllVehicles();
        setActiveTab('vehicles');
      } else {
        alert(`匯入失敗: ${data.error || '請檢查 CSV 格式'}`);
      }
    } catch (err: any) {
      console.error('匯入出錯:', err);
      alert('處理匯入檔案失敗');
    } finally {
      setIsBatchImporting(false);
    }
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'summary' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🏛️ 政府合約 Summary
            </button>
            <button
              onClick={() => setActiveTab('general_summary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'general_summary' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚗 散車保固 Summary
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'create' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ➕ 開新工單
            </button>
            <button
              onClick={() => setActiveTab('project_settings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'project_settings' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚙️ 專案設定
            </button>
            <button
              onClick={() => {
                setActiveTab('search');
                if (!hasSearched) handleSearch();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'search' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🔍 查詢車輛與工單
            </button>
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚘 車輛主表管理
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
            >
              📂 批次匯入舊紀錄
            </button>
          </nav>
        </header>

        {/* 🎯 關鍵修正：傳入實時車輛資料 */}
        {activeTab === 'summary' && (
          <WorkOrdersSummary
            vehicles={vehicles}
            isLoading={isLoading}
            onRefresh={fetchAllVehicles}
          />
        )}

        {activeTab === 'general_summary' && <GeneralWarrantySummary />}

        {activeTab === 'project_settings' && <ProjectSettings />}

        {activeTab === 'create' && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
              <CreateWorkOrder
                vehicles={vehicles}
                orderNumber={orderNumber}
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
              pickupReturnDate={pickupReturnDate}
              setPickupReturnDate={setPickupReturnDate}
              description={description}
              setDescription={setDescription}
              items={items}
              setItems={setItems}
              handleItemChange={handleItemChange}
              removeItem={removeItem}
              addItem={addItem}
              setShowPasteModal={setShowPasteModal}
              isSubmitting={isSubmitting}
              warrantyType={warrantyType}
              setWarrantyType={setWarrantyType}
              maintenanceStartDate={maintenanceStartDate}
              setMaintenanceStartDate={setMaintenanceStartDate}
              maintenanceExpiryDate={maintenanceExpiryDate}
              setMaintenanceExpiryDate={setMaintenanceExpiryDate}
              quoteStatus={quoteStatus}
              setQuoteStatus={setQuoteStatus}
              quoteReference={quoteReference}
              setQuoteReference={setQuoteReference}
              oralQuoteConfirmed={oralQuoteConfirmed}
              setOralQuoteConfirmed={setOralQuoteConfirmed}
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

        {activeTab === 'vehicles' && (
          <ManageVehicles
            vehicles={vehicles}
            isLoading={isLoading}
            onRefresh={fetchAllVehicles}
            onEditVehicle={(v) => setEditingVehicle(v)}
          />
        )}
      </div>

      {/* 舊紀錄 CSV 批次匯入 Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-black">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xl font-bold text-slate-800">📂 批次匯入舊有 Warranty Form 紀錄</h3>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border">
              <p className="font-bold text-slate-800">說明與操作步驟：</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>下載匯入 CSV 範本，用 Excel 開啟並填入舊有的保固紀錄。</li>
                <li>欄位說明：<code className="bg-white px-1 border rounded">plate_number</code> (車牌號碼，必填)、<code className="bg-white px-1 border rounded">warranty_type</code> (<code className="text-blue-700 font-bold">Government</code> 或 <code className="text-amber-700 font-bold">General</code>)。</li>
                <li>選擇 CSV 檔案，或直接複製內容貼至下方文字框點擊「開始匯入」。</li>
              </ol>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 cursor-pointer shadow-2xs"
              >
                ⬇️ 下載 CSV 匯入範本
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">方式 A：選擇 CSV 檔案上傳</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">方式 B：直接貼上 CSV 或 Excel 文字</label>
              <textarea
                rows={8}
                value={batchCsvText}
                onChange={(e) => setBatchCsvText(e.target.value)}
                placeholder="plate_number,vin,project,brand,model,claim_form_date,completed_date,garage_location,description,items,warranty_type&#nAM1234,VIN1234,政府合約,Toyota,Coaster,2025-01-10,2025-01-12,機電 - 九龍灣1/F,煞車檢修,更換煞車皮;更換煞車油,Government"
                className="w-full p-2.5 border rounded-xl text-xs font-mono bg-white text-black"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isBatchImporting}
                onClick={handleExecuteBatchImport}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchImporting ? '⏳ 正在批次匯入中...' : '🚀 開始批次匯入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 快速貼上 Excel 項目彈窗 */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl text-black">
            <h3 className="text-lg font-bold text-slate-800">快速貼上 Excel 項目</h3>
            <p className="text-xs text-gray-500">格式：每行一個項目，或包含 [類別 Tab 項目名稱]</p>
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="進廠維修&#9;更換煞車皮&#n更換零件&#9;機油濾芯"
              className="w-full p-2.5 border rounded-xl text-xs font-mono bg-white text-black"
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
