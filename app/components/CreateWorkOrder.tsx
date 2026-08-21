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
  handleItemChange: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
  addItem: () => void;
  setShowPasteModal: (v: boolean) => void;
  isSubmitting: boolean;
}

export default function CreateWorkOrder(props: CreateWorkOrderProps) {
  const [isScanning, setIsScanning] = useState(false);

  // 統一處理圖片檔案發送給 AI 辨識與翻譯
  const processImageFile = useCallback(async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ocr-translate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.items && data.items.length > 0) {
        const newItems = data.items.map((i: any) => ({
          type: i.type || '進廠維修',
          item_name: i.item_name || '',
        }));

        if (confirm(`成功辨識並翻譯了 ${newItems.length} 項維修項目，是否自動填入表格中？`)) {
          if (props.items.length === 1 && !props.items[0].item_name) {
            newItems.forEach((item: any, idx: number) => {
              if (idx === 0) {
                props.handleItemChange(0, 'type', item.type);
                props.handleItemChange(0, 'item_name', item.item_name);
              } else {
                props.items.push(item);
              }
            });
          } else {
            newItems.forEach((item: any) => props.items.push(item));
          }
          alert('維修項目已自動翻譯並匯入！');
        }
      } else {
        alert(data.error || '無法辨識相片內容，請確保字跡清晰再試一次');
      }
    } catch (err) {
      console.error('上傳照片失敗:', err);
      alert('圖片處理失敗');
    } finally {
      setIsScanning(false);
    }
  }, [props]);

  // 監聽鍵盤 Ctrl+V / Cmd+V 貼上事件
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            processImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [processImageFile]);

  // 選擇檔案事件
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  return (
    <form onSubmit={props.handleCreateOrder} className="space-y-6 text-black">
      <div className="border-b pb-2">
        <h2 className="text-xl font-bold text-gray-800">開立維修工單</h2>
        <p className="text-xs text-gray-500 mt-1">請填寫工單與 Claim Form 日期，系統將自動以此日子計算車輛停修可用率 (Availability)</p>
      </div>

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
          <label className="block text-xs font-bold text-gray-700 mb-1">Claim Form 日期 (工單停修起算)</label>
          <input
            type="date"
            value={props.claimFormDate}
            onChange={(e) => props.setClaimFormDate(e.target.value)}
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">車房位置</label>
          <input
            type="text"
            value={props.location}
            onChange={(e) => props.setLocation(e.target.value)}
            placeholder="例如：廠房 A"
            className="w-full p-2.5 border rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500"
          />
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

      {/* 維修項目區塊 (支援 Ctrl+V 貼上圖片辨識) */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">維修與零件項目</h3>
          
          <div className="flex gap-2">
            {/* 提示使用者可以 Ctrl+V 貼上 */}
            <label className="text-xs bg-blue-50 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 cursor-pointer flex items-center gap-1 shadow-2xs">
              {isScanning ? '⏳ 正在讀取與翻譯圖片中...' : '📷 拍照 / 按 Ctrl+V 貼上維修單圖片 (自動翻譯)'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                disabled={isScanning}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => props.setShowPasteModal(true)}
              className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 cursor-pointer"
            >
              快速貼上 Excel 項目
            </button>
          </div>
        </div>

        {/* 提示區域 */}
        <div className="text-[11px] text-slate-500 bg-slate-100 p-2 rounded-lg border border-dashed border-slate-300 flex items-center justify-between">
          <span>💡 提示：您可以截圖紙本維修單後，直接在這個頁面按下 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-2xs font-mono font-bold text-slate-700">Ctrl + V</kbd>，AI 將會自動翻譯並匯入！</span>
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
              value={item.item_name}
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
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {props.isSubmitting ? '建立中...' : '建立工單'}
        </button>
      </div>
    </form>
  );
}