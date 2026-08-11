'use client';

import React, { useState } from 'react';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';
import TabNavigation from './components/TabNavigation';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create');

  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [project, setProject] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [claimFormDate, setClaimFormDate] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([
    { item_name: '', type: 'Labor' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVehicles, setSearchVehicles] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const addItem = function() {
    setItems([...items, { item_name: '', type: 'Labor' }]);
  };

  const removeItem = function(index: number) {
    setItems(items.filter(function(_, i) { return i !== index; }));
  };

  const handleItemChange = function(index: number, field: string, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleClosePasteModal = function() {
    setShowPasteModal(false);
  };

  const handleOpenPasteModal = function() {
    setShowPasteModal(true);
  };

  const handlePasteTextChange = function(e: React.ChangeEvent) {
    setPasteText(e.target.value);
  };

  const handleApplyPaste = function() {
    if (!pasteText.trim()) return;

    const cleanText = pasteText.trim().replace(/\r/g, '');
    const lines = cleanText.split('\n');
    const parsedItems = lines.map(function(line) {
      const cols = line.split('\t').map(function(c) { return c.trim(); });
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

      return { item_name: name, type: type };
    }).filter(function(item) { return item.item_name !== ''; });

    if (parsedItems.length > 0) {
      setItems(parsedItems);
      setPasteText('');
      setShowPasteModal(false);
    } else {
      alert('無法解析貼上內容，請確認內容格式');
    }
  };

  const getMaintenanceStatus = function(dateStr: string) {
    if (!dateStr) {
      return {
        label: '未設定保養日',
        color: 'bg-gray-100 text-gray-600',
        daysRemainingText: '未設定保養日期'
      };
    }
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return {
        label: `已過期 ${Math.abs(diffDays)} 天`,
        color: 'bg-red-100 text-red-700 font-bold',
        daysRemainingText: `已逾期 ${Math.abs(diffDays)} 天 (${dateStr})`
      };
    } else if (diffDays === 0) {
      return {
        label: '今天到期',
        color: 'bg-red-100 text-red-700 font-bold',
        daysRemainingText: '今天到期 (0 天)'
      };
    } else if (diffDays <= 30) {
      return {
        label: `剩餘 ${diffDays} 天到期`,
        color: 'bg-yellow-100 text-yellow-800 font-bold',
        daysRemainingText: `剩餘 ${diffDays} 天 (${dateStr})`
      };
    } else {
      return {
        label: `正常 (${dateStr})`,
        color: 'bg-green-100 text-green-700',
        daysRemainingText: `剩餘 ${diffDays} 天 (${dateStr})`
      };
    }
  };

  const handleCreateOrder = async function(e: React.FormEvent) {
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
          vin: vin,
          project: project,
          brand: brand,
          model: model,
          location: location,
          claim_form_date: claimFormDate,
          description: description,
          items: items
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
        setLocation('');
        setClaimFormDate('');
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

  const handleSearch = async function(e?: React.FormEvent) {
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

  const exportToCSV = function() {
    if (!searchVehicles || searchVehicles.length === 0) {
      alert('沒有可匯出的車輛資料');
      return;
    }

    const headers = ['車牌號碼', '車架號碼(VIN)', '所屬項目(Project)', '品牌', '車型', '車輛位置', 'Claim Form 日期', '保養到期日', '距離保養剩餘時間', '保養狀態', '最後維修時間'];

    const rows = searchVehicles.map(function(v) {
      const status = getMaintenanceStatus(v.next_maintenance_date);
      const lastRepair = v.last_repair_date ? new Date(v.last_repair_date).toLocaleDateString() : '無';
      return [
        `"${v.plate_number || ''}"`,
        `"${v.vin || ''}"`,
        `"${v.project || ''}"`,
        `"${v.brand || ''}"`,
        `"${v.model || ''}"`,
        `"${v.location || ''}"`,
        `"${v.claim_form_date || ''}"`,
        `"${v.next_maintenance_date || ''}"`,
        `"${status.daysRemainingText}"`,
        `"${status.label}"`,
        `"${lastRepair}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `車輛維修紀錄表_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = function() {
    window.print();
  };

  let tabContent = null;
  if (activeTab === 'create') {
    tabContent = (
      
    );
  } else if (activeTab === 'search') {
    tabContent = (
      
    );
  }

  let modalContent = null;
  if (showPasteModal) {
    modalContent = (
      
        
          
            從 Excel 或試算表批量貼上
            
              ✕
            
          

          
            貼上說明：可以從 Excel 複製多列項目貼到下方。
          

                    <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClosePasteModal}
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6 print:shadow-none print:m-0 print:max-w-full print:p-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          車輛維修管理系統
        </h1>

        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {tabContent}

        {modalContent}
      </div>
    </div>
  );
}
