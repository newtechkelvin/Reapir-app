'use client';

import React, { useState, useEffect, useCallback } from 'react';

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
  setItems?: (items: any[]) => void;
  handleItemChange: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
  addItem: () => void;
  setShowPasteModal: (v: boolean) => void;
  isSubmitting: boolean;
  warrantyType?: string;
  setWarrantyType?: (v: string) => void;
}

export default function CreateWorkOrder(props: CreateWorkOrderProps) {
  const [showAutoParseModal, setShowAutoParseModal] = useState(false);
  const [rawParseText, setRawParseText] = useState('');

  const isSanChe = props.warrantyType === 'General' || props.warrantyType === '散車';

  // 核心功能：自動解析訊息內文並填入表單
  const handleAutoParse = () => {
    if (!rawParseText.trim()) return;

    const text = rawParseText;

    // 1. 正則表達式匹配各欄位
    const plateMatch = text.match(/(?:車牌號碼|車牌|Plate)\s*[:：]\s*([A-Za-z0-9-]+)/i);
    const brandMatch = text.match(/(?:車輛品牌|品牌|Brand)\s*[:：]\s*(.+)/i);
    const modelMatch = text.match(/(?:車輛型號|型號|Model)\s*[:：]\s*(.+)/i);
    const vinMatch = text.match(/(?:VIN碼|VIN|車身號碼)\s*[:：]\s*([A-Za-z0-9-]+)/i);
    const projectMatch = text.match(/(?:專案名稱|專案|客戶)\s*[:：]\s*(.+)/i);
    const locationMatch = text.match(/(?:取車位置|車輛位置|車房位置|地點|位置)\s*[:：]\s*(.+)/i);
    const noticeDateMatch = text.match(/(?:維修通知日期|通知日期|Claim Form 日期|日期)\s*[:：]\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
    const descMatch = text.match(/(?:狀況描述|故障描述|描述|原因)\s*[:：]\s*(.+)/i);

    if (plateMatch?.[1]) props.setPlateNumber(plateMatch[1].trim());
    if (brandMatch?.[1]) props.setBrand(brandMatch[1].trim());
    if (modelMatch?.[1]) props.setModel(modelMatch[1].trim());
    if (vinMatch?.[1]) props.setVin(vinMatch[1].trim());
    if (projectMatch?.[1]) props.setProject(projectMatch[1].trim());
    if (locationMatch?.[1]) props.setLocation(locationMatch[1].trim());
    if (descMatch?.[1]) props.setDescription(descMatch[1].trim());

    if (noticeDateMatch?.[1]) {
      const formattedDate = noticeDateMatch[1].replace(/\//g, '-');
      props.setClaimFormDate(formattedDate);
    }

    // 2. 擷取維修項目列表 (匹配「維修項目：」底下的列表)
    const itemsSection = text.split(/(?:維修項目|維修內容)\s*[:：]/i)[1];
    if (itemsSection) {
      const itemLines = itemsSection
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
        .filter((l) => l.length > 0);

      if (itemLines.length > 0 && props.setItems) {
        props.setItems(itemLines.map((itemName) => ({ type: '進廠維修', item_name: itemName })));
      }
    }

    alert('訊息內容已成功拆解並填入表單欄位！');
    setShowAutoParseModal(false);
    setRawParseText('');
  };

  return (
    <form onSubmit={props.handleCreateOrder} className="space-y-6 text-black">
      <div className="border-b pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">開立維修工單</h2>
          <p className="text-xs text-gray-500 mt-0.5">選擇「散車保固」的工單將會歸類至獨立的散車 Summary 頁面</p>
        </div>

        <div className="flex items-center gap-2">
          {/* 一鍵貼上訊息自動填表按鈕 */}
          <button
            type="button"
            onClick={() => setShowAutoParseModal(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
          >
            📋 一鍵貼上訊息填表
          </button>

          {/* 保固類別切換器 */}
          {props.setWarrantyType && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-300">
              <span className="text-xs font-bold text-slate-700 pl-2">保固類別:</span>
              <button
                type="button"
                onClick={() => props.setWarrantyType && props.setWarrantyType('Government')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  props.warrantyType === 'Government'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                🏛️ 政府合約專案
              </button>
              <button
                type="button"
                onClick={() => props.setWarrantyType && props.setWarrantyType('General')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isSanChe
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                🚗 散車保固
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 輸入欄位維持原樣 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車牌號碼 *</label>
          <input
            type="text"
            required
            value={props.plateNumber}
            onChange={(e) => props.setPlateNumber(e.target.value)}
            placeholder="AM1234"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500 font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車輛品牌 (Brand)</label>
          <input
            type="text"
            value={props.brand}
            onChange={(e) => props.setBrand(e.target.value)}
            placeholder="例如：Toyota / Isuzu"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車輛型號 (Model)</label>
          <input
            type="text"
            value={props.model}
            onChange={(e) => props.setModel(e.target.value)}
            placeholder="例如：Coaster / N-Series"
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
          <label className="block text-xs font-bold text-gray-700 mb-1">專案名稱 / 備註</label>
          <input
            type="text"
            value={props.project}
            onChange={(e) => props.setProject(e.target.value)}
            placeholder={isSanChe ? '散車客戶 / 項目' : '例如：專案 A'}
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            {isSanChe ? '維修通知日期' : 'Claim Form 日期 (工單停修起算)'}
          </label>
          <input
            type="date"
            value={props.claimFormDate}
            onChange={(e) => props.setClaimFormDate(e.target.value)}
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            {isSanChe ? '取車位置' : '車房位置'}
          </label>
          {isSanChe ? (
            <input
              type="text"
              value={props.location}
              onChange={(e) => props.setLocation(e.target.value)}
              placeholder="院舍 / 客人自行送廠"
              className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          ) : (
            <select
              value={props.location}
              onChange={(e) => props.setLocation(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="">-- 請選擇車房位置 --</option>
              <option value="機電 - 九龍灣1/F">機電 - 九龍灣1/F</option>
              <option value="機電 - 九龍灣2/F">機電 - 九龍灣2/F</option>
              <option value="機電 - 屯門">機電 - 屯門</option>
              <option value="機電 - 小蠔灣">機電 - 小蠔灣</option>
              <option value="機電 - 柴灣">機電 - 柴灣</option>
              <option value="車行">車行</option>
            </select>
          )}
        </div>
      </div>

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

      {/* 維修項目列表區塊維持原樣 */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">維修與零件項目</h3>
          <button
            type="button"
            onClick={() => props.setShowPasteModal(true)}
            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer"
          >
            快速貼上 Excel 項目
          </button>
        </div>

        {props.items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <select
              value={item.type || '進廠維修'}
              onChange={(e) => props.handleItemChange(idx, 'type', e.target.value)}
              className="p-2 border rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="進廠維修">進廠維修</option>
              <option value="更換零件">更換零件</option>
              <option value="現場處理">現場處理</option>
              <option value="外判處理">外判處理</option>
              <option value="收費項目">收費項目</option>
              <option value="Recall項目">Recall項目</option>
            </select>
            <input
              type="text"
              value={item.item_name || ''}
              onChange={(e) => props.handleItemChange(idx, 'item_name', e.target.value)}
              placeholder="項目名稱"
              className="flex-1 p-2 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
            />
            {props.items.length > 1 && (
              <button
                type="button"
                onClick={() => props.removeItem(idx)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 cursor-pointer"
              >
                刪除
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={props.addItem}
          className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 cursor-pointer"
        >
          + 新增維修項目
        </button>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={props.isSubmitting}
          className={`px-6 py-3 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 cursor-pointer transition-all ${
            isSanChe ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {props.isSubmitting ? '建立中...' : isSanChe ? '建立散車工單' : '建立政府合約工單'}
        </button>
      </div>

      {/* 自動拆解貼上視窗 Modal */}
      {showAutoParseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-black">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">📋 一鍵貼上通訊軟體訊息自動填表</h3>
              <button
                type="button"
                onClick={() => setShowAutoParseModal(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              請直接將同事發來的 WhatsApp / Email 通知整段貼在下方，系統會自動拆解車牌、品牌、型號、取車位置及維修項目：
            </p>

            <textarea
              rows={8}
              value={rawParseText}
              onChange={(e) => setRawParseText(e.target.value)}
              placeholder={`【散車維修通知】\n車牌號碼：AM1234\n車輛品牌：Toyota\n車輛型號：Coaster\n取車位置：九龍灣院舍 A座大門\n維修通知日期：2026-08-24\n狀況描述：冷氣不冷\n維修項目：\n- 檢查冷媒\n- 更換冷氣濾芯`}
              className="w-full p-2.5 border rounded-xl text-xs font-mono bg-slate-50 text-black focus:bg-white"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAutoParseModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAutoParse}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                ⚡ 開始拆解並自動帶入表單
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
