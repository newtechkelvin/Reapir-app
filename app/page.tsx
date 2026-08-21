'use client';

import React, { useState, useEffect } from 'react';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';
import WorkOrdersSummary from './components/WorkOrdersSummary';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'summary' | 'create'>('search');

  // 表單與搜尋狀態
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [project, setProject] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [claimFormDate, setClaimFormDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<any[]>([{ type: '進廠維修', item_name: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal 貼上
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // 搜尋狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(true);
  const [searchVehicles, setSearchVehicles] = useState<any[]>([]);

  useEffect(() => {
    fetchAllVehicles();
  }, []);

  const fetchAllVehicles = async () => {
    try {
      setIsSearching(true);
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const data = await res.json();
        setSearchVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error('拉取資料失敗:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    try {
      const q = searchQuery.trim() || '%';
      const res = await fetch(`/api/work-orders?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchVehicles(data.vehicles || []);
      } else {
        setSearchVehicles([]);
      }
    } catch (err) {
      console.error('搜尋錯誤:', err);
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
          delivery_date: deliveryDate,
          warranty_expiry_date: warrantyExpiryDate,
          description,
          items: validItems,
        }),
      });

      if (res.ok) {
        alert('工單建立成功！');
        setPlateNumber('');
        setVin('');
        setProject('');
        setBrand('');
        setModel('');
        setLocation('');
        setClaimFormDate('');
        setDeliveryDate('');
        setWarrantyExpiryDate('');
        setDescription('');
        setItems([{ type: '進廠維修', item_name: '' }]);

        await fetchAllVehicles();
        setActiveTab('summary');
      } else {
        const err = await res.json();
        alert(`建立失敗: ${err.error || err.message || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('建立工單失敗:', err);
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { type: '進廠維修', item_name: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pastedText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newItems: any[] = [];

    lines.forEach((line) => {
      let type = '進廠維修';
      let name = line;

      if (line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const first = parts[0].trim();
          if (['進廠維修', '更換零件', '現場處理', '外判處理'].includes(first)) {
            type = first;
          }
          name = parts.slice(1).join(' ').trim();
        }
      } else {
        ['進廠維修', '更換零件', '現場處理', '外判處理'].forEach((t) => {
          if (line.startsWith(`${t}:`)) {
            type = t;
            name = line.replace(`${t}:`, '').trim();
          }
        });
      }

      if (name) {
        newItems.push({ type, item_name: name });
      }
    });

    if (newItems.length > 0) {
      setItems(newItems);
    }

    setPastedText('');
    setShowPasteModal(false);
  };

  const getMaintenanceStatus = (dateStr: string) => {
    if (!dateStr) return { label: '未排定', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return { label: `已逾期 ${Math.abs(diffDays)} 天`, color: 'bg-red-100 text-red-800 border-red-300 font-bold' };
    } else if (diffDays <= 7) {
      return { label: `即將到期 (${diffDays} 天內)`, color: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' };
    } else {
      return { label: `正常 (${diffDays} 天後)`, color: 'bg-green-100 text-green-800 border-green-300' };
    }
  };

  const exportToCSV = () => {
    if (searchVehicles.length === 0) return;
    let csvContent = '\uFEFF';
    csvContent += '車牌號碼,VIN,所屬專案,汽車品牌,車型,車輛位置,交車日期,原保固到期日,工單編號,工單描述,維修項目\n';

    searchVehicles.forEach((v) => {
      if (v.workOrders && v.workOrders.length > 0) {
        v.workOrders.forEach((wo: any) => {
          const itemsStr = wo.work_order_items?.map((i: any) => i.item_name).join('; ') || '';
          csvContent += `"${v.plate_number || ''}","${v.vin || ''}","${v.project || ''}","${v.brand || ''}","${v.model || ''}","${v.location || ''}","${v.delivery_date || ''}","${v.warranty_expiry_date || ''}","${wo.order_number || ''}","${wo.description || ''}","${itemsStr}"\n`;
        });
      } else {
        csvContent += `"${v.plate_number || ''}","${v.vin || ''}","${v.project || ''}","${v.brand || ''}","${v.model || ''}","${v.location || ''}","${v.delivery_date || ''}","${v.warranty_expiry_date || ''}","無","無","無"\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `車輛與工單紀錄_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4 print:hidden">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900">車輛維修與工單管理系統</h1>
            <p className="text-sm text-gray-500 mt-1">即時工單監控、車輛合約可用率 (Availability) 與保固期風險管理</p>
          </div>
        </div>

        <div className="flex gap-2 border-b pb-2 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🔍 查詢車輛與工單
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊 工單即時 Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2.5 rounded-lg font-bold text-sm cursor-pointer transition-all ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ✏️ 開立新工單
          </button>
        </div>

        {activeTab === 'summary' && (
          <WorkOrdersSummary />
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
            location={location}
            setLocation={setLocation}
            claimFormDate={claimFormDate}
            setClaimFormDate={setClaimFormDate}
            deliveryDate={deliveryDate}
            setDeliveryDate={setDeliveryDate}
            warrantyExpiryDate={warrantyExpiryDate}
            setWarrantyExpiryDate={setWarrantyExpiryDate}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">快捷貼上 Excel 資料</h3>
              <p className="text-xs text-gray-500">
                請複製 Excel 欄位並貼於下方（系統自動辨識：進廠維修、更換零件、現場處理、外判處理）：
              </p>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={'例如：\n更換零件:\t油濾清器\n外判處理:\t底盤鈑金'}
                className="w-full p-3 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleProcessPastedText}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 cursor-pointer"
                >
                  匯入至表單
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}