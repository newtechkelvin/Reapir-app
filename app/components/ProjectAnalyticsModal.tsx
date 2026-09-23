'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// 註冊 Chart.js 模組
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ProjectAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchVehicles: any[]; // 搜尋結果中的車輛與工單陣列
  searchQuery: string;
}

export default function ProjectAnalyticsModal({
  isOpen,
  onClose,
  searchVehicles,
  searchQuery,
}: ProjectAnalyticsModalProps) {
  if (!isOpen) return null;

  // 🧮 運算統計數據 (useMemo 避免重複計算)
  const analyticsData = useMemo(() => {
    let totalWorkOrders = 0;
    let completedOrders = 0;
    let openOrders = 0;

    const vehicleOrderCounts: { [plate: string]: number } = {};
    const itemTypeCounts: { [type: string]: number } = {};
    const issueKeywordCounts: { [keyword: string]: number } = {};

    let totalRepairDays = 0;
    let validDaysCount = 0;

    // 常用故障關鍵字分類清單
    const keywordsList = [
      '漏電', '引擎', '冷氣', '皮帶', '電池', 'EDSS', '中門', 
      '尾門', '漏油', '漏水', '異音', '尾踏板', '司機位', '軚油'
    ];

    searchVehicles.forEach((vehicle) => {
      const orders = vehicle.workOrders || vehicle.work_orders || [];
      const plate = vehicle.plate_number;

      vehicleOrderCounts[plate] = orders.length;

      orders.forEach((wo: any) => {
        totalWorkOrders++;

        // 1. 狀態統計
        const status = String(wo.status || '').toLowerCase();
        if (status === 'completed' || status === 'closed' || status === '已完成') {
          completedOrders++;
        } else {
          openOrders++;
        }

        // 2. 入廠天數計算 (Claim Form 日期 -> 完成日期)
        const claimDate = wo.claim_form_date ? new Date(wo.claim_form_date) : null;
        const compDate = wo.completed_date ? new Date(wo.completed_date) : null;
        if (claimDate && compDate && !isNaN(claimDate.getTime()) && !isNaN(compDate.getTime())) {
          const diffTime = compDate.getTime() - claimDate.getTime();
          const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          totalRepairDays += diffDays;
          validDaysCount++;
        }

        // 3. 維修項目類別統計
        const items = wo.work_order_items || wo.items || [];
        items.forEach((item: any) => {
          const type = item.type || '未分類';
          itemTypeCounts[type] = (itemTypeCounts[type] || 0) + 1;
        });

        // 4. 故障問題關鍵字統計 (針對描述與項目名稱)
        const textToAnalyze = `${wo.description || ''} ${items.map((i: any) => i.item_name).join(' ')}`;
        keywordsList.forEach((kw) => {
          if (textToAnalyze.includes(kw)) {
            issueKeywordCounts[kw] = (issueKeywordCounts[kw] || 0) + 1;
          }
        });
      });
    });

    // 篩選多次入廠車輛 (入廠次數 >= 2)
    const repeatVehicles = Object.entries(vehicleOrderCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    // 計算平均入廠天數
    const avgDays = validDaysCount > 0 ? (totalRepairDays / validDaysCount).toFixed(1) : '0';

    // 排序常壞問題 Top 5
    const topIssues = Object.entries(issueKeywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalVehicles: searchVehicles.length,
      totalWorkOrders,
      completedOrders,
      openOrders,
      repeatVehicles,
      avgDays,
      itemTypeCounts,
      topIssues,
    };
  }, [searchVehicles]);

  // 📊 Chart 1: 最常故障問題 (長條圖設定)
  const barChartData = {
    labels: analyticsData.topIssues.map(([kw]) => kw),
    datasets: [
      {
        label: '發生次數',
        data: analyticsData.topIssues.map(([_, count]) => count),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 8,
      },
    ],
  };

  // 📊 Chart 2: 維修項目類別分佈 (圓餅圖設定)
  const pieChartData = {
    labels: Object.keys(analyticsData.itemTypeCounts),
    datasets: [
      {
        data: Object.values(analyticsData.itemTypeCounts),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'
        ],
      },
    ],
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 print:hidden text-black">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              📈 專案維修統計與分析報表
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              搜尋關鍵字：<span className="font-bold text-blue-600">{searchQuery || '全專案數據'}</span> | 共有 {analyticsData.totalVehicles} 輛車，{analyticsData.totalWorkOrders} 張工單
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-3xl font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. 核心 KPI 數字卡片區 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
            <span className="text-xs text-blue-700 font-bold block uppercase">總維修工單數</span>
            <span className="text-3xl font-black text-blue-900 mt-1 block">{analyticsData.totalWorkOrders} 張</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
            <span className="text-xs text-amber-700 font-bold block uppercase">多次入廠車輛數</span>
            <span className="text-3xl font-black text-amber-900 mt-1 block">{analyticsData.repeatVehicles.length} 架</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-xs text-emerald-700 font-bold block uppercase">平均入廠維修時間</span>
            <span className="text-3xl font-black text-emerald-900 mt-1 block">{analyticsData.avgDays} 天</span>
          </div>

          <div className="bg-slate-100 border border-slate-300 p-4 rounded-xl text-center">
            <span className="text-xs text-slate-600 font-bold block uppercase">工單完成率</span>
            <span className="text-3xl font-black text-slate-900 mt-1 block">
              {analyticsData.totalWorkOrders > 0
                ? ((analyticsData.completedOrders / analyticsData.totalWorkOrders) * 100).toFixed(0)
                : 0}%
            </span>
          </div>
        </div>

        {/* 2. 圖表分析區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 最常壞的問題 Top 5 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              🔥 最常見故障問題次數 (Top 5)
            </h4>
            {analyticsData.topIssues.length > 0 ? (
              <div className="h-64">
                <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic py-12 text-center">無足夠數據分析故障問題</p>
            )}
          </div>

          {/* 維修項目類別分佈 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              🧩 維修項目類別佔比
            </h4>
            {Object.keys(analyticsData.itemTypeCounts).length > 0 ? (
              <div className="h-64 flex justify-center">
                <Pie data={pieChartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic py-12 text-center">無維修項目分類數據</p>
            )}
          </div>
        </div>

        {/* 3. 多次維修車輛清單與自動分析簡報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* 多次維修車輛排名 */}
          <div className="border rounded-xl p-4 bg-white border-slate-200">
            <h4 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              ⚠️ 高頻維修車輛名單 (入廠 $\ge 2$ 次)
            </h4>
            <div className="max-h-48 overflow-y-auto">
              {analyticsData.repeatVehicles.length === 0 ? (
                <p className="text-sm text-emerald-600 font-semibold py-4">良好！此專案內暫無重複多次維修的車輛。</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2">車牌號碼</th>
                      <th className="p-2 text-right">入廠維修次數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analyticsData.repeatVehicles.map(([plate, count]) => (
                      <tr key={plate} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-blue-900">🚘 {plate}</td>
                        <td className="p-2 text-right font-extrabold text-amber-600">{count} 次</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 自動文字分析報告 */}
          <div className="border rounded-xl p-4 bg-blue-50/50 border-blue-200 space-y-2">
            <h4 className="text-base font-bold text-blue-950 flex items-center gap-1.5">
              💡 專案維修數據智慧分析診斷
            </h4>
            <div className="text-sm text-slate-700 leading-relaxed space-y-2">
              <p>
                * 本專案包含 <strong>{analyticsData.totalVehicles}</strong> 架車輛，累計產生 <strong>{analyticsData.totalWorkOrders}</strong> 張工單。平均每車維修入廠天數約為 <strong>{analyticsData.avgDays} 天</strong>。
              </p>
              {analyticsData.topIssues.length > 0 && (
                <p>
                  * 數據顯示，該專案最主要的故障原因為「<strong className="text-blue-800">{analyticsData.topIssues[0][0]}</strong>」（共出現 {analyticsData.topIssues[0][1]} 次），建議針對此相關零組件進行預防性檢查。
                </p>
              )}
              {analyticsData.repeatVehicles.length > 0 && (
                <p>
                  * 共有 <strong className="text-amber-700">{analyticsData.repeatVehicles.length}</strong> 架車輛有多次入廠紀錄（如車牌 <strong className="text-amber-800">{analyticsData.repeatVehicles[0][0]}</strong>），建議調閱該車詳細履歷進行全面檢修。
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="flex justify-end pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-sm hover:bg-slate-900 cursor-pointer shadow-sm"
          >
            關閉報表
          </button>
        </div>

      </div>
    </div>
  );
}
