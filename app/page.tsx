'use client';

import React, { useState } from 'react';
import CreateWorkOrder from './components/CreateWorkOrder';
import SearchVehicles from './components/SearchVehicles';

  return (
    <div>
      <h1>車輛維修管理系統</h1>
    </div>
  );
}

  const getMaintenanceStatus = (dateStr: string) => {
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
          location,
          claim_form_date: claimFormDate,
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

    const headers = ['車牌號碼', '車架號碼(VIN)', '所屬項目(Project)', '品牌', '車型', '車輛位置', 'Claim Form 日期', '最後維修時間'];

    const rows = searchVehicles.map(v => {
      const lastRepair = v.last_repair_date ? new Date(v.last_repair_date).toLocaleDateString() : '無';
      return [
        `"${v.plate_number || ''}"`,
        `"${v.vin || ''}"`,
        `"${v.project || ''}"`,
        `"${v.brand || ''}"`,
        `"${v.model || ''}"`,
        `"${v.location || ''}"`,
        `"${v.claim_form_date || ''}"`,
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

  const handlePrint = () => {
    window.print();
  };

  const isCreateTab = activeTab === 'create';
  const isSearchTab = activeTab === 'search';

  return (
    
      
        
          車輛維修管理系統
        

        
           setActiveTab('create')}
          >
            開立新工單
          
           setActiveTab('search')}
          >
            車牌、VIN、工單號與專案綜合搜尋
          
        

        {isCreateTab && (
          
        )}

        {showPasteModal && (
          
            
              
                從 Excel 或試算表批量貼上
                 setShowPasteModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xl cursor-pointer"
                >
                  ✕
                
              

              
                💡 貼上說明：可以從 Excel 複製多列項目貼到下方。
              

               setPasteText(e.target.value)}
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

        {isSearchTab && (
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