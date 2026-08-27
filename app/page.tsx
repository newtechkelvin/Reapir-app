'use client';

import React, { useState, useEffect } from 'react';
import ManageVehicles from './components/ManageVehicles';
import WorkOrdersSummary from './components/WorkOrdersSummary';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'summary'>('vehicles');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 抓取全庫車輛與工單資料
  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || data.data || []);
      } else {
        console.error('抓取車輛資料失敗');
      }
    } catch (err) {
      console.error('網路連線失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頁面頂部標題 */}
        <header className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              🚛 車輛維修保固管理系統
            </h1>
            <p className="text-xs text-gray-500 font-semibold mt-1">
              Vehicle Maintenance & Warranty Extension Management System
            </p>
          </div>

          {/* 分頁切換 Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'vehicles'
                  ? 'bg-white text-blue-900 shadow-2xs'
                  : 'text-gray-500 hover:text-slate-900'
              }`}
            >
              🚘 車輛主表管理
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-blue-900 shadow-2xs'
                  : 'text-gray-500 hover:text-slate-900'
              }`}
            >
              📋 工單 Summary 與報表
            </button>
          </div>
        </header>

        {/* 分頁內容展示 */}
        {activeTab === 'vehicles' ? (
          <ManageVehicles
            vehicles={vehicles}
            isLoading={isLoading}
            onRefresh={fetchVehicles}
          />
        ) : (
          <WorkOrdersSummary
            vehicles={vehicles}
            isLoading={isLoading}
            onRefresh={fetchVehicles}
          />
        )}
      </div>
    </main>
  );
}
