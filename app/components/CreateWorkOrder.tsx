'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

async function preprocessClaimFormImage(file: File) {
  const image = await createImageBitmap(file);
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('瀏覽器不支援圖片處理');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = source;
  const gray = new Uint8Array(width * height);
  for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[pixel] = Math.max(0, Math.min(255, Math.round((luminance - 128) * 1.8 + 128)));
  }

  // 表格框線通常是長而連續的黑線；移除長線，保留短文字筆畫。
  const cleaned = gray.slice();
  const markHorizontalLines = (y: number) => {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const dark = x < width && gray[y * width + x] < 165;
      if (dark && start < 0) start = x;
      if ((!dark || x === width) && start >= 0) {
        if (x - start >= Math.max(80, width * 0.08)) {
          for (let mark = start; mark < x; mark += 1) cleaned[y * width + mark] = 255;
        }
        start = -1;
      }
    }
  };
  const markVerticalLines = (x: number) => {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const dark = y < height && gray[y * width + x] < 165;
      if (dark && start < 0) start = y;
      if ((!dark || y === height) && start >= 0) {
        if (y - start >= Math.max(80, height * 0.12)) {
          for (let mark = start; mark < y; mark += 1) cleaned[mark * width + x] = 255;
        }
        start = -1;
      }
    }
  };
  for (let y = 0; y < height; y += 1) markHorizontalLines(y);
  for (let x = 0; x < width; x += 1) markVerticalLines(x);
  for (let i = 0; i < cleaned.length; i += 1) {
    const value = cleaned[i] < 190 ? 0 : 255;
    const offset = i * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  context.putImageData(source, 0, 0);
  return canvas;
}

// 常用汽車與維修英文術語翻譯字典
const REPAIR_TRANSLATION_MAP: Array<[RegExp, string]> = [
  [/REPAIR\b/gi, '維修'],
  [/OFF-SIDE\b/gi, '右側(駕駛側)'],
  [/NEAR-SIDE\b/gi, '左側(副駕側)'],
  [/BOTH-SIDE\b/gi, '雙側'],
  [/FRONT\b/gi, '前方'],
  [/REAR\b/gi, '後方'],
  [/UPSIDE\b/gi, '頂部'],
  [/COMPARTMENT\b/gi, '車廂'],
  [/DOCR\b/gi, '車門'],
  [/DOOR\b/gi, '車門'],
  [/RUBBER SEAL\b/gi, '膠條'],
  [/DEFECT\b/gi, '缺陷/破損'],
  [/CCTV\b/gi, '閉路電視/監控'],
  [/SOMETIMES NO DISPLAY\b/gi, '偶爾無顯示'],
  [/ALL VEHICLE BODY\b/gi, '全車身'],
  [/VENTILATOR\b/gi, '通風口'],
  [/VENTIL\b/gi, '通風口'],
  [/EMERGENCY\b/gi, '緊急'],
  [/HINGE\b/gi, '鉸鏈'],
  [/TOO TIGHT\b/gi, '過緊'],
  [/GRILLE\b/gi, '水箱護罩/格柵'],
  [/FLASHING LIGHT\b/gi, '閃爍燈'],
  [/MALFUNCTION\b/gi, '故障'],
  [/FOOT STEP\b/gi, '腳踏板'],
  [/STEERING TRACK ROD\b/gi, '轉向拉桿'],
  [/LOOSEN\b/gi, '鬆脫'],
  [/INNER AIR INTAKE\b/gi, '內側進氣管'],
  [/AIR-CONDITIONING\b/gi, '冷氣系統'],
  [/ENGINE BELT\b/gi, '引擎皮帶'],
  [/NOISY\b/gi, '異響'],
  [/DRIVER SEAT\b/gi, '駕駛座'],
  [/MONITOR\b/gi, '顯示器'],
  [/SUPPORT\b/gi, '支架'],
];

function translateRepairText(text: string): string {
  let translated = text;
  for (const [regex, replacement] of REPAIR_TRANSLATION_MAP) {
    translated = translated.replace(regex, replacement);
  }
  return translated.replace(/\s+/g, ' ').trim();
}

export interface CreateWorkOrderProps {
  onSuccess?: () => void;
  vehicles?: any[];
  [key: string]: any; // 支援 app/page.tsx 傳入的其他 state 與 handler
}

export default function CreateWorkOrder(props: CreateWorkOrderProps) {
  const { onSuccess, vehicles = [] } = props;

  const [warrantyType, setWarrantyType] = useState<'government' | 'general' | ''>('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [project, setProject] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  
  const [garageLocation, setGarageLocation] = useState('機電 - 九龍灣1/F');
  const [isCustomGarage, setIsCustomGarage] = useState(false);

  const [vehicleLocation, setVehicleLocation] = useState('');
  const [pickupReturnDate, setPickupReturnDate] = useState('');
  const [claimFormDate, setClaimFormDate] = useState('');
  const [maintenanceStartDate, setMaintenanceStartDate] = useState('');
  const [maintenanceExpiryDate, setMaintenanceExpiryDate] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<'pending' | 'confirmed'>('pending');
  const [quoteReference, setQuoteReference] = useState('');
  const [oralQuoteConfirmed, setOralQuoteConfirmed] = useState(false);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<Array<{ type: string; item_name: string; notes?: string }>>([
    { type: '進廠維修', item_name: '', notes: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smartText, setSmartText] = useState('');
  const currentWarrantyValue = String(props.warrantyType ?? warrantyType).toLowerCase();
  const currentWarrantyType = currentWarrantyValue === 'general' ? 'general' : currentWarrantyValue === 'government' ? 'government' : '';
  const currentItems = Array.isArray(props.items) ? props.items : items;
  const displayedOrderNumber = props.orderNumber || '產生中...';
  const isScatteredVehicle = currentWarrantyType === 'general';
  const effectiveMaintenanceStartDate = props.maintenanceStartDate ?? maintenanceStartDate;
  const effectiveMaintenanceExpiryDate = props.maintenanceExpiryDate ?? maintenanceExpiryDate;
  const effectiveQuoteStatus = props.quoteStatus ?? quoteStatus;
  const effectiveQuoteReference = props.quoteReference ?? quoteReference;
  const effectiveOralQuoteConfirmed = props.oralQuoteConfirmed ?? oralQuoteConfirmed;
  const [showSmartPasteModal, setShowSmartPasteModal] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  const GARAGE_OPTIONS = [
    '機電 - 九龍灣1/F',
    '機電 - 九龍灣2/F',
    '機電 - 屯門',
    '機電 - 小蠔灣',
    '機電 - 柴灣',
    '機電 - 芬園',
    '車行',
  ];

  const updateWarrantyType = (type: 'government' | 'general') => {
    setWarrantyType(type);
    props.setWarrantyType?.(type === 'government' ? 'Government' : 'General');
  };

  const applyVehicleMatch = (match: any) => {
    if (!match) return;
    if (match.plate_number) {
      setPlateNumber(String(match.plate_number).trim().toUpperCase());
      props.setPlateNumber?.(String(match.plate_number).trim().toUpperCase());
    }
    if (match.vin) { setVin(match.vin); props.setVin?.(match.vin); }
    if (match.project) { setProject(match.project); props.setProject?.(match.project); }
    if (match.brand) { setBrand(match.brand); props.setBrand?.(match.brand); }
    if (match.model) { setModel(match.model); props.setModel?.(match.model); }
    if (match.maintenance_start_date) setMaintenanceStartDate(String(match.maintenance_start_date));
    if (match.maintenance_expiry_date) setMaintenanceExpiryDate(String(match.maintenance_expiry_date));
    if (match.garage_location) {
      if (GARAGE_OPTIONS.includes(match.garage_location)) {
        setGarageLocation(match.garage_location);
        props.setGarageLocation?.(match.garage_location);
        setIsCustomGarage(false);
      } else {
        setGarageLocation(match.garage_location);
        props.setGarageLocation?.(match.garage_location);
        setIsCustomGarage(true);
      }
    }
  };

  const handlePlateChange = (val: string) => {
    const upperVal = val.trim().toUpperCase();
    setPlateNumber(upperVal);

    if (vehicles && vehicles.length > 0) {
      const match = vehicles.find(
        (v) => v.plate_number && String(v.plate_number).trim().toUpperCase() === upperVal
      );
      if (match) applyVehicleMatch(match);
    }
  };

  const handleVinChange = (val: string) => {
    const normalizedVin = val.replace(/\s+/g, '').toUpperCase();
    setVin(normalizedVin);
    props.setVin?.(normalizedVin);
    const match = vehicles.find((v) => v.vin && String(v.vin).replace(/\s+/g, '').toUpperCase() === normalizedVin);
    if (match) applyVehicleMatch(match);
  };

  const updateItems = (nextItems: Array<{ type: string; item_name: string; notes?: string }>) => {
    setItems(nextItems);
    props.setItems?.(nextItems);
  };

  const handleAddItem = () => {
    updateItems([...currentItems, { type: '進廠維修', item_name: '', notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    updateItems(currentItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...currentItems];
    (updated[index] as any)[field] = value;
    updateItems(updated);
  };

  const setField = (setter: ((value: string) => void) | undefined, localSetter: (value: string) => void, value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return;
    localSetter(text);
    setter?.(text);
  };

  const applyExtractedData = (data: any) => {
    const vehicle = data?.vehicle || data || {};
    if (vehicle.plate_number) handlePlateChange(String(vehicle.plate_number));
    if (vehicle.vin) handleVinChange(String(vehicle.vin));
    setField(props.setProject, setProject, vehicle.project);
    setField(props.setBrand, setBrand, vehicle.brand);
    setField(props.setModel, setModel, vehicle.model);
    setField(props.setClaimFormDate, setClaimFormDate, vehicle.claim_form_date);
    setField(props.setPickupReturnDate, setPickupReturnDate, vehicle.pickup_return_date);
    setField(props.setGarageLocation, setGarageLocation, vehicle.garage_location);
    setField(props.setDescription, setDescription, vehicle.description);
    if (Array.isArray(data?.items)) {
      const extractedItems = data.items
        .map((item: any) => ({
          type: String(item.type || '進廠維修'),
          item_name: translateRepairText(String(item.item_name || '').trim()),
          notes: '',
        }))
        .filter((item: any) => item.item_name);
      if (extractedItems.length > 0) updateItems(extractedItems);
    }
  };

  const handleParseSmartText = async () => {
    const text = smartText.trim();
    if (!text) {
      alert('請先貼上 WhatsApp 報修訊息');
      return;
    }
    try {
      setIsOcrProcessing(true);
      const response = await fetch('/api/parse-work-order-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'WhatsApp 訊息解析失敗');
      applyExtractedData(data);
      if (data.vehicle?.warranty_type === 'general' || data.vehicle?.warranty_type === 'government') {
        updateWarrantyType(data.vehicle.warranty_type);
      } else {
        setWarrantyType('');
        props.setWarrantyType?.('');
      }
      alert(`已完成 WhatsApp 訊息解析，並回填 ${Array.isArray(data.items) ? data.items.length : 0} 項維修資料，請核對後再建立工單。`);
      setShowSmartPasteModal(false);
      setSmartText('');
      return;
    } catch (error: any) {
      console.error('WhatsApp 訊息解析失敗:', error);
      alert(error.message || 'WhatsApp 訊息解析失敗，請稍後再試');
    } finally {
      setIsOcrProcessing(false);
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const plateMatch = text.match(/(?:車牌(?:號碼)?|牌照|plate(?:\s*number)?)\s*[:：-]?\s*([A-Z]{1,2}\s?\d{1,4})/i) || text.match(/\b([A-Z]{1,2}\s?\d{1,4})\b/i);
    const vinMatch = text.match(/(?:VIN|車身號碼)\s*[:：-]?\s*([A-Z0-9]+)/i) || text.match(/\b([A-Z0-9]{5,20})\b/i);
    const dateMatch = text.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
    const projectMatch = text.match(/(?:專案|project)\s*[:：-]?\s*(.+)/i);
    const brandMatch = text.match(/(?:品牌|brand)\s*[:：-]?\s*(.+)/i);
    const modelMatch = text.match(/(?:型號|model)\s*[:：-]?\s*(.+)/i);
    if (plateMatch) handlePlateChange(plateMatch[1].replace(/\s+/g, ''));
    if (vinMatch) handleVinChange(vinMatch[1]);
    setField(props.setProject, setProject, projectMatch?.[1]);
    setField(props.setBrand, setBrand, brandMatch?.[1]);
    setField(props.setModel, setModel, modelMatch?.[1]);
    if (dateMatch) {
      const formattedDate = dateMatch[1].replace(/[/.]/g, '-');
      setField(props.setPickupReturnDate, setPickupReturnDate, formattedDate);
      setField(props.setClaimFormDate, setClaimFormDate, formattedDate);
    }
    const itemLines = lines
      .filter((line) => /^(?:[-*•]|\d+[.)])/.test(line) || /(?:維修項目|維修內容|更換|檢查|修理|replacement|repair|service)/i.test(line))
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter((line) => line.length > 1 && !/^(車牌|牌照|vin|車身號碼|專案|project|品牌|brand|型號|model|日期|date)\s*[:：]/i.test(line));
    if (itemLines.length > 0) {
      setItems(itemLines.map((item_name) => ({ type: '進廠維修', item_name: translateRepairText(item_name), notes: '' })));
    }
    setField(props.setDescription, setDescription, text);
    setShowSmartPasteModal(false);
    setSmartText('');
  };

  const processOcrImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片格式的 Warranty Claim Form');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('圖片不可大於 10MB');
      return;
    }
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      setIsOcrProcessing(true);
      const processedImage = await preprocessClaimFormImage(file);
      worker = await createWorker('eng+chi_tra', 1, {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            console.info(`Tesseract OCR ${(message.progress * 100).toFixed(0)}%`);
          }
        },
      });
      const result = await worker.recognize(processedImage);
      const text = result.data.text?.trim();
      if (!text) throw new Error('圖片未能辨識出文字，請使用較清晰的 Claim Form 截圖');
      const response = await fetch('/api/parse-repair-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || '維修項目 OCR 解析失敗');
      const extractedItems = Array.isArray(data?.items)
        ? data.items
          .map((item: any) => ({
            type: String(item.type || '進廠維修'),
            item_name: translateRepairText(String(item.item_name || '').trim()),
            notes: '',
          }))
          .filter((item: any) => item.item_name)
        : [];
      if (extractedItems.length === 0) throw new Error('未能辨識維修項目，請裁剪至項目明細或使用較清晰圖片');
      updateItems(extractedItems);
      alert(`已辨認 ${extractedItems.length} 項維修項目，並翻譯成繁體中文。車牌、VIN、日期及其他車輛資料不會由此圖片修改，請核對項目後再建立工單。`);
    } catch (error: any) {
      console.error('Warranty Claim Form Tesseract OCR 失敗:', error);
      alert(error.message || 'OCR 處理失敗，請稍後再試');
    } finally {
      if (worker) await worker.terminate();
      setIsOcrProcessing(false);
    }
  }, []);

  const handleOcrFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processOcrImageFile(file);
  };

  // 監聽 Ctrl+V 全域貼上圖片功能
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // 避免在輸入框內進行純文字複製貼上時觸發 OCR 圖片辨識
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) {
          return;
        }
      }

      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            e.preventDefault();
            processOcrImageFile(files[i]);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [processOcrImageFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWarrantyType) {
      alert('請先選擇政府合約或散車類別');
      return;
    }
    if (props.handleCreateOrder) {
      return props.handleCreateOrder(e);
    }

    if (!plateNumber.trim()) {
      alert('請輸入車牌號碼');
      return;
    }

    try {
      setIsSubmitting(true);

      if (isScatteredVehicle && effectiveQuoteStatus === 'confirmed' && !effectiveQuoteReference.trim() && !effectiveOralQuoteConfirmed) {
        alert('完成報價確認時，請填寫報價單號或選擇「已口頭報價」');
        return;
      }

      const rawVin = props.vin ?? vin;
      const normalizedVin = rawVin ? String(rawVin).replace(/\s+/g, '').toUpperCase() : '';

      const payload = {
        warranty_type: currentWarrantyType,
        plate_number: plateNumber.trim(),
        vin: normalizedVin || null,
        project: project.trim(),
        brand: brand.trim(),
        model: model.trim(),
        garage_location: isScatteredVehicle ? '' : garageLocation.trim(),
        vehicle_location: vehicleLocation.trim(),
        pickup_return_date: pickupReturnDate,
        claim_form_date: claimFormDate,
        maintenance_start_date: isScatteredVehicle ? effectiveMaintenanceStartDate : null,
        maintenance_expiry_date: isScatteredVehicle ? effectiveMaintenanceExpiryDate : null,
        quote_status: isScatteredVehicle ? effectiveQuoteStatus : 'not_required',
        quote_reference: isScatteredVehicle ? (effectiveQuoteReference.trim() || null) : null,
        oral_quote_confirmed: isScatteredVehicle ? effectiveOralQuoteConfirmed : false,
        description: description.trim(),
        items: currentItems.filter((it: any) => it.item_name?.trim() !== ''),
      };

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('工單開立成功！');
        setPlateNumber('');
        setVin('');
        setProject('');
        setBrand('');
        setModel('');
        setGarageLocation('機電 - 九龍灣1/F');
        setIsCustomGarage(false);
        setVehicleLocation('');
        setPickupReturnDate('');
        setClaimFormDate('');
        setMaintenanceStartDate('');
        setMaintenanceExpiryDate('');
        setQuoteStatus('pending');
        setQuoteReference('');
        setOralQuoteConfirmed(false);
        setDescription('');
        setItems([{ type: '進廠維修', item_name: '', notes: '' }]);

        if (onSuccess) onSuccess();
      } else {
        const err = await res.json().catch(() => null);
        alert(`開立失敗: ${err?.error || err?.message || '伺服器錯誤'}`);
      }
    } catch (err) {
      console.error('開立工單失敗:', err);
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900">➕ 開立車輛維修工單</h2>
          <p className="text-xs text-slate-500 mt-1">填寫維修內容與車輛資料以建立新工單</p>
          <p className="text-xs text-blue-700 font-bold mt-2">預計工單編號：{displayedOrderNumber}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowSmartPasteModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
        >
          ✨ 貼上報修訊息智能填表
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">合約 / 保固類別 *</label>
          {!currentWarrantyType && <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">此訊息沒有指定合約類別，請手動選擇政府合約或散車後才可建立工單。</p>}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateWarrantyType('government')}
              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                currentWarrantyType === 'government'
                  ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              🏛️ 政府合約專案 (EMSD)
            </button>
            <button
              type="button"
              onClick={() => updateWarrantyType('general')}
              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                currentWarrantyType === 'general'
                  ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              🚗 散車保固 / 一般維修
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">🚘 車輛基本資料</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">車牌號碼 *</label>
              <input
                type="text"
                value={props.plateNumber ?? plateNumber}
                onChange={(e) => {
                  if (props.setPlateNumber) props.setPlateNumber(e.target.value.toUpperCase());
                  handlePlateChange(e.target.value);
                }}
                placeholder="例如：AM4620"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">VIN 碼</label>
              <input
                type="text"
                value={props.vin ?? vin}
                onChange={(e) => {
                  handleVinChange(e.target.value);
                }}
                placeholder="VIN 碼"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">專案名稱</label>
              <input
                type="text"
                value={props.project ?? project}
                onChange={(e) => {
                  if (props.setProject) props.setProject(e.target.value);
                  setProject(e.target.value);
                }}
                placeholder="例如：FSD/DLP/24"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">品牌</label>
              <input
                type="text"
                value={props.brand ?? brand}
                onChange={(e) => {
                  if (props.setBrand) props.setBrand(e.target.value);
                  setBrand(e.target.value);
                }}
                placeholder="例如：Mercedes-Benz"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">型號</label>
              <input
                type="text"
                value={props.model ?? model}
                onChange={(e) => {
                  if (props.setModel) props.setModel(e.target.value);
                  setModel(e.target.value);
                }}
                placeholder="例如：Atego 1018"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {!isScatteredVehicle && <div>
              <label className="block font-bold text-gray-700 mb-1">車房位置</label>
              <select
                value={isCustomGarage ? 'CUSTOM' : (props.garageLocation ?? garageLocation)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setIsCustomGarage(true);
                    if (props.setGarageLocation) props.setGarageLocation('');
                    setGarageLocation('');
                  } else {
                    setIsCustomGarage(false);
                    if (props.setGarageLocation) props.setGarageLocation(val);
                    setGarageLocation(val);
                  }
                }}
                className="w-full p-2.5 border rounded-lg bg-white text-black font-bold focus:ring-2 focus:ring-blue-500"
              >
                {GARAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="CUSTOM">✍️ 其他 (手動自由輸入)...</option>
              </select>

              {isCustomGarage && (
                <input
                  type="text"
                  value={props.garageLocation ?? garageLocation}
                  onChange={(e) => {
                    if (props.setGarageLocation) props.setGarageLocation(e.target.value);
                    setGarageLocation(e.target.value);
                  }}
                  placeholder="請輸入自訂車房位置..."
                  className="mt-2 w-full p-2.5 border border-blue-400 rounded-lg bg-blue-50/50 text-black font-bold focus:ring-2 focus:ring-blue-500 text-xs"
                />
              )}
            </div>}

            <div>
              <label className="block font-bold text-gray-700 mb-1">車輛位置</label>
              <input
                type="text"
                value={props.vehicleLocation ?? vehicleLocation}
                onChange={(e) => {
                  if (props.setVehicleLocation) props.setVehicleLocation(e.target.value);
                  setVehicleLocation(e.target.value);
                }}
                placeholder="例如：泊位 B2"
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">取車/回廠日期</label>
              <input
                type="date"
                value={props.pickupReturnDate ?? pickupReturnDate}
                onChange={(e) => {
                  if (props.setPickupReturnDate) props.setPickupReturnDate(e.target.value);
                  setPickupReturnDate(e.target.value);
                }}
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">維修通知日期</label>
              <input
                type="date"
                value={props.claimFormDate ?? claimFormDate}
                onChange={(e) => {
                  if (props.setClaimFormDate) props.setClaimFormDate(e.target.value);
                  setClaimFormDate(e.target.value);
                }}
                className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {isScatteredVehicle && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-4 text-xs">
            <h3 className="font-extrabold text-amber-900">🚗 散車保養期及報價資料</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">保養期開始日 *</label>
                <input type="date" required value={effectiveMaintenanceStartDate} onChange={(e) => { setMaintenanceStartDate(e.target.value); props.setMaintenanceStartDate?.(e.target.value); if (e.target.value && !effectiveMaintenanceExpiryDate) { const d = new Date(`${e.target.value}T00:00:00`); d.setFullYear(d.getFullYear() + 1); const expiry = d.toISOString().slice(0, 10); setMaintenanceExpiryDate(expiry); props.setMaintenanceExpiryDate?.(expiry); } }} className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">保養期到期日 *</label>
                <input type="date" required value={effectiveMaintenanceExpiryDate} onChange={(e) => { setMaintenanceExpiryDate(e.target.value); props.setMaintenanceExpiryDate?.(e.target.value); }} className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">是否在保養期內</label>
                <div className="p-2.5 rounded-lg bg-white border font-bold">{effectiveMaintenanceStartDate && effectiveMaintenanceExpiryDate && new Date(`${effectiveMaintenanceStartDate}T00:00:00`) <= new Date() && new Date(`${effectiveMaintenanceExpiryDate}T23:59:59`) >= new Date() ? '✅ 是，在保養期內' : '⚠️ 否，請先報價收費'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-bold text-gray-700 mb-1">報價狀態</label>
                <select value={effectiveQuoteStatus} onChange={(e) => { const value = e.target.value as 'pending' | 'confirmed'; setQuoteStatus(value); props.setQuoteStatus?.(value); }} className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold">
                  <option value="pending">待報價</option><option value="confirmed">已完成報價確認</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">報價單號</label>
                <input type="text" value={effectiveQuoteReference} onChange={(e) => { setQuoteReference(e.target.value); props.setQuoteReference?.(e.target.value); }} placeholder="如：QT-2026-001" className="w-full p-2.5 border rounded-lg bg-white text-black font-semibold" />
              </div>
              <label className="flex items-center gap-2 p-2.5 font-bold text-gray-700"><input type="checkbox" checked={effectiveOralQuoteConfirmed} onChange={(e) => { setOralQuoteConfirmed(e.target.checked); props.setOralQuoteConfirmed?.(e.target.checked); }} /> 已口頭報價</label>
            </div>
            <p className="text-amber-800">不在保養期內仍可建立工單；完成報價確認時，必須填寫報價單號或選擇「已口頭報價」。</p>
          </div>
        )}

        <div className="space-y-1 text-xs">
          <label className="block font-bold text-gray-700">狀況與故障描述</label>
          <textarea
            rows={3}
            value={props.description ?? description}
            onChange={(e) => {
              if (props.setDescription) props.setDescription(e.target.value);
              setDescription(e.target.value);
            }}
            placeholder="請詳細描述車輛故障狀況與維修需求..."
            className="w-full p-3 border rounded-xl bg-white text-black font-semibold focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">🛠️ 維修與零件項目明細</h3>
            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer text-center">
              {isOcrProcessing ? '維修項目 OCR 處理中...' : '📷 上傳/貼上 Claim Form 維修項目 OCR (支持 Ctrl+V)'}
              <input type="file" accept="image/*" onChange={handleOcrFileChange} disabled={isOcrProcessing} className="hidden" />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">只辨認圖片中的維修項目，並自動翻譯成繁體中文（可點擊按鈕選擇圖片，或直接按 Ctrl+V 貼上截圖）；車牌、VIN、日期及其他資料請手動輸入或使用 WhatsApp 填表。</p>
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"
            >
              + 新增項目
            </button>
          </div>

          <div className="border rounded-xl overflow-hidden border-slate-300">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 w-32">類別</th>
                  <th className="p-2.5">項目名稱</th>
                  <th className="p-2.5">備註</th>
                  <th className="p-2.5 w-12 text-center">刪除</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentItems.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <select
                        value={item.type}
                        onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                        className="w-full p-1.5 border rounded bg-white text-black font-bold focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="進廠維修">進廠維修</option>
                        <option value="更換零件">更換零件</option>
                        <option value="現場處理">現場處理</option>
                        <option value="外判處理">外判處理</option>
                        <option value="收費項目">收費項目</option>
                        <option value="Recall項目">Recall項目</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                        placeholder="請輸入維修項目名稱..."
                        className="w-full p-1.5 border rounded bg-white text-black font-semibold focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                        placeholder="補充說明..."
                        className="w-full p-1.5 border rounded bg-white text-black font-semibold focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm px-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || props.isSubmitting}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting || props.isSubmitting ? '建立中...' : '✅ 提交並建立工單'}
          </button>
        </div>
      </form>

      {showSmartPasteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 text-black">
            <h3 className="text-base font-black text-slate-900">✨ 貼上報修訊息自動解析</h3>
            <p className="text-xs text-gray-500">直接貼上 WhatsApp 訊息，系統會按欄位標籤自動辨識車輛、日期、維修位置及所有維修項目：</p>
            <textarea
              rows={6}
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
              placeholder="貼上訊息內容..."
              className="w-full p-3 border rounded-xl text-xs bg-slate-50 text-black font-medium focus:ring-2 focus:ring-purple-500"
            ></textarea>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSmartPasteModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleParseSmartText}
                disabled={isOcrProcessing}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isOcrProcessing ? '解析中...' : '⚡ 開始解析並帶入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
