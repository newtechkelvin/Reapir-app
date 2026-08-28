'use client';

import React, { useEffect, useState } from 'react';

type Setting = {
  project: string;
  warranty_period_years: number;
  max_extension_months: number;
  source?: string;
};

export default function ProjectSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [project, setProject] = useState('');
  const [warrantyYears, setWarrantyYears] = useState('3');
  const [maxExtensionMonths, setMaxExtensionMonths] = useState('18');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/project-settings', { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || '無法讀取專案設定');
      setSettings(data.settings || []);
    } catch (error: any) {
      setMessage(error.message || '讀取專案設定失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const selectSetting = (setting: Setting) => {
    setProject(setting.project);
    setWarrantyYears(String(setting.warranty_period_years || 3));
    setMaxExtensionMonths(String(setting.max_extension_months ?? 18));
    setMessage('');
  };

  const saveSetting = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setMessage('');
      const response = await fetch('/api/project-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          warranty_period_years: Number(warrantyYears),
          max_extension_months: Number(maxExtensionMonths),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || '儲存專案設定失敗');
      setMessage(`已儲存「${project.trim()}」的保固條款設定。`);
      await loadSettings();
    } catch (error: any) {
      setMessage(error.message || '儲存專案設定失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto space-y-6 text-black">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">⚙️ 專案保固條款設定</h2>
            <p className="text-xs text-slate-500 mt-1">統一管理每個政府專案的原始保固年限及總展延月數上限。</p>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">新專案預設：3 年／18 個月</span>
        </div>

        <form onSubmit={saveSetting} className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5 items-end">
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-bold text-slate-700">專案名稱 *</span>
            <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="例如：AD200542019" required className="w-full p-2.5 border rounded-xl bg-white font-semibold" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold text-slate-700">保固年限 *</span>
            <input type="number" min="1" max="20" value={warrantyYears} onChange={(e) => setWarrantyYears(e.target.value)} required className="w-full p-2.5 border rounded-xl bg-white font-semibold" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold text-slate-700">總展延月數上限 *</span>
            <input type="number" min="0" max="120" step="6" value={maxExtensionMonths} onChange={(e) => setMaxExtensionMonths(e.target.value)} required className="w-full p-2.5 border rounded-xl bg-white font-semibold" />
          </label>
          <div className="md:col-span-4 flex justify-end">
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl disabled:opacity-50">{isSaving ? '儲存中...' : '💾 儲存專案設定'}</button>
          </div>
        </form>
        {message && <p className="mt-4 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{message}</p>}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-900">現有專案設定</h3>
          <button type="button" onClick={loadSettings} className="text-xs font-bold text-blue-700 hover:underline">重新整理</button>
        </div>
        {isLoading ? <p className="p-8 text-center text-xs text-slate-500">載入中...</p> : settings.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">目前沒有專案資料，請先新增設定。</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 font-bold text-slate-700"><tr><th className="p-3">專案名稱</th><th className="p-3">保固年限</th><th className="p-3">總展延月數上限</th><th className="p-3">來源</th><th className="p-3 text-right">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{settings.map((setting) => <tr key={setting.project} className="hover:bg-blue-50/40"><td className="p-3 font-black text-blue-900">{setting.project}</td><td className="p-3">{setting.warranty_period_years} 年</td><td className="p-3">{setting.max_extension_months} 個月</td><td className="p-3 text-slate-500">{setting.source === 'vehicle_fallback' ? '由車輛資料帶入' : '中央設定'}</td><td className="p-3 text-right"><button type="button" onClick={() => selectSetting(setting)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold">編輯</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
