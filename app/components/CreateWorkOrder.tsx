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

const REPAIR_DICT: { [key: string]: { zh: string; type: string } } = {
  brake: { zh: '煞車系統/更換煞車皮', type: '更換零件' },
  pad: { zh: '煞車皮/煞車片', type: '更換零件' },
  oil: { zh: '更換機油', type: '進廠維修' },
  filter: { zh: '更換機油/空氣濾芯', type: '更換零件' },
  engine: { zh: '檢查/維修引擎', type: '進廠維修' },
  tyre: { zh: '檢查/更換輪胎', type: '更換零件' },
  tire: { zh: '檢查/更換輪胎', type: '更換零件' },
  battery: { zh: '測試/更換汽車電池', type: '更換零件' },
  coolant: { zh: '檢查水箱/冷卻液', type: '進廠維修' },
  light: { zh: '更換車燈/燈泡', type: '更換零件' },
  recall: { zh: 'Recall 召回維修項目', type: 'Recall項目' },
  charge: { zh: '收費維修項目', type: '收費項目' },
  leak: { zh: '檢查漏油/漏水問題', type: '進廠維修' },
};

export default function CreateWorkOrder(props: CreateWorkOrderProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');

  const loadTesseract = async () => {
    if ((window as any).Tesseract) return (window as any).Tesseract;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => resolve((window as any).Tesseract);
      script.onerror = () => reject(new Error('無法載入 OCR 組件'));
      document.head.appendChild(script);
    });
  };

  const translateToZh = async (text: string) => {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`);
      if (res.ok) {
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        if (translated && !translated.includes('MYMEMORY')) {
          return translated;
        }
      }
    } catch (e) {
      console.warn('線上翻譯失敗:', e);
    }
    return null;
  };

  const processImageFile = useCallback(async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    setIsScanning(true);
    setOcrProgress('正在初始化照片 OCR 辨識引擎...');

    try {
      const Tesseract = await loadTesseract();
      setOcrProgress('正在讀取相片文字 (OCR Scanning)...');

      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(`照片辨識進度: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      const rawText = result?.data?.text || '';
      setOcrProgress('辨識完成，正在翻譯與拆解項目...');

      const lines = rawText
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 3 && !/^\d+$/.test(l));

      if (lines.length === 0) {
        alert('無法從照片中辨識出清晰文字，請確保相片字跡清晰再試一次！');
        return;
      }

      const parsedItems: any[] = [];

      for (const line of lines.slice(0, 10)) {
        let matchedType = '進廠維修';
        let chineseName = '';

        const lowerLine = line.toLowerCase();
        Object.keys(REPAIR_DICT).forEach((kw) => {
          if (lowerLine.includes(kw)) {
            matchedType = REPAIR_DICT[kw].type;
            if (!chineseName) chineseName = REPAIR_DICT[kw].zh;
          }
        });

        const onlineZh = await translateToZh(line);

        let finalName = '';
        if (chineseName && onlineZh) {
          finalName = `${onlineZh} (${chineseName})`;
        } else if (onlineZh) {
          finalName = `${onlineZh} (${line})`;
        } else if (chineseName) {
          finalName = `${chineseName} (${line})`;
        } else {
          finalName = line;
        }

        parsedItems.push({
          type: matchedType,
          item_name: finalName,
        });
      }

      if (parsedItems.length > 0) {
        if (confirm(`成功辨識並翻譯了 ${parsedItems.length} 個項目，是否自動填入表格中？`)) {
          let newAllItems: any[] = [];
          if (props.items.length === 1 && !props.items[0].item_name) {
            newAllItems = [...parsedItems];
          } else {
            newAllItems = [...props.items, ...parsedItems];
          }

          if (props.setItems) {
            props.setItems(newAllItems);
          } else {
            newAllItems.forEach((item, idx) => {
              props.handleItemChange(idx, 'type', item.type);
              props.handleItemChange(idx, 'item_name', item.item_name);
            });
          }

          alert('相片維修項目已全數同步匯入表單！');
        }
      }
    } catch (err: any) {
      console.error('OCR 辨識失敗:', err);
      alert(`照片讀取失敗: ${err.message || '請確認圖片清晰度'}`);
    } finally {
      setIsScanning(false);
      setOcrProgress('');
    }
  }, [props]);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  const isSanChe = props.warrantyType === 'General' || props.warrantyType === '散車';

  return (
    <form onSubmit={props.handleCreateOrder} className="space-y-6 text-black">
      <div className="border-b pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">開立維修工單</h2>
          <p className="text-xs text-gray-500 mt-0.5">選擇「散車保固」的工單將會歸類至獨立的散車 Summary 頁面</p>
        </div>

        {/* 1. 保固與車輛類別選擇器 */}
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

        {/* 動態日期標籤 */}
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

        {/* 動態車房/車輛位置輸入欄 */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            {isSanChe ? '車輛位置' : '車房位置'}
          </label>
          {isSanChe ? (
            <input
              type="text"
              value={props.location}
              onChange={(e) => props.setLocation(e.target.value)}
              placeholder="請輸入車輛位置 (例如：廠區 A區 / 停車場 B2)"
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

      {/* 維修項目區塊 */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">維修與零件項目</h3>
          
          <div className="flex gap-2">
            <label className="text-xs bg-blue-50 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 cursor-pointer flex items-center gap-1 shadow-2xs">
              {isScanning ? `⏳ ${ocrProgress}` : '📷 拍照 / Ctrl+V 貼上維修單照片 (自動翻譯中文字)'}
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

        <div className="text-[11px] text-slate-500 bg-slate-100 p-2 rounded-lg border border-dashed border-slate-300 flex items-center justify-between">
          <span>💡 提示：您可以截圖紙本維修單後，直接在頁面上按下 <kbd className="px-1.5 py-0.5 bg-white border rounded shadow-2xs font-mono font-bold text-slate-700">Ctrl + V</kbd>，系統將會同步新增欄位並填入中文內容！</span>
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
    </form>
  );
}
