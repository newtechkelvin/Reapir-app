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
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  warrantyExpiryDate: string;
  setWarrantyExpiryDate: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  items: any[];
  handleItemChange: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
  addItem: () => void;
  setShowPasteModal: (v: boolean) => void;
  isSubmitting: boolean;
}

export default function CreateWorkOrder(props: CreateWorkOrderProps) {
  return (
    <form onSubmit={props.handleCreateOrder} className="space-y-6">
      <div className="border-b pb-2">
        <h2 className="text-xl font-bold text-gray-800">開立維修工單與車輛設定</h2>
        <p className="text-xs text-gray-500 mt-1">請填寫車輛基本資訊與交車日期，系統將自動計算合約停修可用率 (Availability)</p>
      </div>

      {/* 車輛與合約資訊 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車牌號碼 *</label>
          <input
            type="text"
            required
            value={props.plateNumber}
            onChange={(e) => props.setPlateNumber(e.target.value)}
            placeholder="例如：ABC-1234"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">VIN 碼</label>
          <input
            type="text"
            value={props.vin}
            onChange={(e) => props.setVin(e.target.value)}
            placeholder="車身號碼"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">專案名稱</label>
          <input
            type="text"
            value={props.project}
            onChange={(e) => props.setProject(e.target.value)}
            placeholder="例如：專案 A"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">交車日期 (Delivery Date)</label>
          <input
            type="date"
            value={props.deliveryDate}
            onChange={(e) => props.setDeliveryDate(e.target.value)}
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">原保固到期日</label>
          <input
            type="date"
            value={props.warrantyExpiryDate}
            onChange={(e) => props.setWarrantyExpiryDate(e.target.value)}
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車輛位置</label>
          <input
            type="text"
            value={props.location}
            onChange={(e) => props.setLocation(e.target.value)}
            placeholder="例如：台北一廠"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 工單描述 */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">狀況與維修描述</label>
        <textarea
          rows={3}
          value={props.description}
          onChange={(e) => props.setDescription(e.target.value)}
          placeholder="請詳細描述車輛故障狀況或維修需求..."
          className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 維修項目清單 */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-800">維修與零件項目</h3>
          <button
            type="button"
            onClick={() => props.setShowPasteModal(true)}
            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100"
          >
            快速貼上 Excel 項目
          </button>
        </div>

        {props.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <select
              value={item.type}
              onChange={(e) => props.handleItemChange(idx, 'type', e.target.value)}
              className="p-2 border rounded-lg text-sm text-black bg-white"
            >
              <option value="Labor">工時 (Labor)</option>
              <option value="Part">零件 (Part)</option>
            </select>
            <input
              type="text"
              value={item.item_name}
              onChange={(e) => props.handleItemChange(idx, 'item_name', e.target.value)}
              placeholder="項目名稱 (例如：更換機油或煞車片)"
              className="flex-1 p-2 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
            />
            {props.items.length > 1 && (
              <button
                type="button"
                onClick={() => props.removeItem(idx)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100"
              >
                刪除
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={props.addItem}
          className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50"
        >
          + 新增維修項目
        </button>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={props.isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {props.isSubmitting ? '建立中...' : '建立工單'}
        </button>
      </div>
    </form>
  );
}