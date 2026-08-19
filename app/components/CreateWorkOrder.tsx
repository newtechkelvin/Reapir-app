'use client';

import React from 'react';

interface CreateWorkOrderProps {
  handleCreateOrder: (e: React.FormEvent) => void;
  plateNumber: string;
  setPlateNumber: (v: string) => void;
  vin: string;
  setVin: (v: string) => void;
  project: string;
  setProject: (v: string) => void;
  brand: string;
  setBrand: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  claimFormDate: string;
  setClaimFormDate: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  items: any[];
  handleItemChange: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
  addItem: () => void;
  setShowPasteModal: (v: boolean) => void;
  isSubmitting: boolean;
}

export default function CreateWorkOrder({
  handleCreateOrder,
  plateNumber,
  setPlateNumber,
  vin,
  setVin,
  project,
  setProject,
  brand,
  setBrand,
  model,
  setModel,
  location,
  setLocation,
  claimFormDate,
  setClaimFormDate,
  description,
  setDescription,
  items,
  handleItemChange,
  removeItem,
  addItem,
  setShowPasteModal,
  isSubmitting,
}: CreateWorkOrderProps) {
  return (
    <form onSubmit={handleCreateOrder} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">車牌號碼 *</label>
          <input
            type="text"
            required
            placeholder="例如: AB-1234"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">車架號碼 (VIN)</label>
          <input
            type="text"
            placeholder="例如: 1HGCR2F83HA000000"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">項目 (Project)</label>
          <input
            type="text"
            placeholder="例如: 醫院管理局工程 或 隧道維修合約"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">汽車品牌</label>
          <input
            type="text"
            placeholder="例如: Toyota 或 Benz 或 Scania"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">車型名稱</label>
          <input
            type="text"
            placeholder="例如: HiAce 或 Coaster"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">車輛位置</label>
          <input
            type="text"
            placeholder="例如: 唐人新村車廠 / 葵涌營運中心"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Claim Form 日期</label>
          <input
            type="date"
            value={claimFormDate}
            onChange={(e) => setClaimFormDate(e.target.value)}
            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">維修狀況描述</label>
        <textarea
          rows={2}
          placeholder="請輸入客訴問題或維修備註..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
        />
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
          <div>
            <h3 className="font-bold text-gray-800 text-base">維修與零件項目明細</h3>
            <p className="text-xs text-gray-500">可逐列輸入或從 Excel 複製多行直接貼上</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-semibold hover:bg-purple-700 cursor-pointer shadow-xs"
            >
              快捷貼上 Excel 資料
            </button>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 cursor-pointer shadow-xs"
            >
              + 新增一列
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg bg-white shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 border-b text-gray-700">
                <th className="p-2.5 w-32 font-semibold">類別</th>
                <th className="p-2.5 font-semibold">維修項目與零件名稱</th>
                <th className="p-2.5 w-16 text-center font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-blue-50/50">
                  <td className="p-1.5">
                    <select
                      value={item.type}
                      onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                      className="w-full p-2 border rounded text-black bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Labor">工時與服務</option>
                      <option value="Part">零件與耗材</option>
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      placeholder="輸入項目或零件名稱..."
                      value={item.item_name}
                      onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                      className="w-full p-2 border rounded text-black focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 font-bold p-1 cursor-pointer"
                        title="刪除此列"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer text-lg shadow-sm"
      >
        {isSubmitting ? '儲存中...' : '儲存並開立工單'}
      </button>
    </form>
  );
}