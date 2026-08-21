'use client';

import React, { useState, useEffect } from 'react';

export default function ManageVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch (err) {
      console.error('抓取車輛資料失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (v?: any) => {
    if (v) {
      setEditingVehicle({ ...v });
    } else {
      setEditingVehicle({
        plate_number: '',
        vin: '',
        project: '',
        brand: '',
        model: '',
        location: '',
        claim_form_date: '',
        delivery_date: '',
        warranty_expiry_date: '',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle?.plate_number) {
      alert('請輸入車牌號碼');
      return;
    }

    try {
      setIsSubmitting(true);
      const isEdit = !!editingVehicle.id;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicle),
      });

      if (res.ok) {
        alert(isEdit ? '車輛資料已順利更新！' : '新車輛已成功建立！');
        setEditingVehicle(null);
        fetchVehicles();
      } else {
        const err = await res.json();
        alert(`儲存失敗: ${err.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('儲存車輛失敗:', err);
      alert('網路連線失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase();
    return (
      (v.plate_number || '').toLowerCase().includes(q) ||
      (v.vin || '').toLowerCase().includes(q) ||
      (v.project || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 text-white p-4 rounded-xl">
        <div>
          <h2 className="text-xl font-bold">車輛主表管理 (Vehicles Management)</h2>
          <p className="text-xs text-slate-300 mt-1">建立新車輛、更新車輛專案、位置或保固到期日</p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenEdit()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
        >
          + 新增車輛
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋車牌、VIN 或專案..."
          className="flex-1 p-2.5 border rounded-xl text-sm text-black bg-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 font-semibold animate-pulse">⏳ 讀取車輛資料中...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">無對應車輛</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b">
              <tr>
                <th className="p-3">車牌號碼</th>
                <th className="p-3">VIN / 品牌車型</th>
                <th className="p-3">專案 / 位置</th>
                <th className="p-3">Claim Form 日期</th>
                <th className="p-3">交車日</th>
                <th className="p-3">保固到期日</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredVehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="p-3 font-extrabold text-blue-900 text-sm">{v.plate_number}</td>
                  <td className="p-3">
                    <div>VIN: {v.vin || '無'}</div>
                    <div className="text-gray-400">{v.brand || ''} {v.model || ''}</div>
                  </td>
                  <td className="p-3">
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">
                      {v.project || '未設定'}
                    </span>
                    <div className="mt-1 text-gray-500">{v.location || '未設定'}</div>
                  </td>
                  <td className="p-3 text-emerald-700 font-bold">{v.claim_form_date || '未設定'}</td>
                  <td className="p-3">{v.delivery_date || '未設定'}</td>
                  <td className="p-3 font-bold text-amber-800">{v.warranty_expiry_date || '未設定'}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(v)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold cursor-pointer"
                    >
                      編輯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 編輯 / 新增 Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800">
                {editingVehicle.id ? '編輯車輛主表資料' : '新增車輛資料'}
              </h3>
              <button type="button" onClick={() => setEditingVehicle(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">車牌號碼 *</label>
                <input
                  type="text"
                  required
                  value={editingVehicle.plate_number || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, plate_number: e.target.value })}
                  placeholder="AM1234"
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">VIN 碼</label>
                <input
                  type="text"
                  value={editingVehicle.vin || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, vin: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">專案名稱</label>
                <input
                  type="text"
                  value={editingVehicle.project || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, project: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">車輛位置</label>
                <input
                  type="text"
                  value={editingVehicle.location || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, location: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Claim Form 日期</label>
                <input
                  type="date"
                  value={editingVehicle.claim_form_date || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, claim_form_date: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">交車日期 (Delivery Date)</label>
                <input
                  type="date"
                  value={editingVehicle.delivery_date || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, delivery_date: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">原保固到期日</label>
                <input
                  type="date"
                  value={editingVehicle.warranty_expiry_date || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, warranty_expiry_date: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm text-black"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? '儲存中...' : '儲存'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}