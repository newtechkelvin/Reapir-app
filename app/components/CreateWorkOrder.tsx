'use client';

import React, { useState } from 'react';

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
    const normalizedVin = val.trim().toUpperCase();
    setVin(normalizedVin);
    props.setVin?.(normalizedVin);
    const match = vehicles.find((v) => v.vin && String(v.vin).trim().toUpperCase() === normalizedVin);
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
          item_name: String(item.item_name || '').trim(),
          notes: String(item.notes || '').trim(),
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
    const vinMatch = text.match(/(?:VIN|車身號碼)\s*[:：-]?\s*([A-HJ-NPR-Z0-9]{17})/i) || text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
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
      setItems(itemLines.map((item_name) => ({ type: '進廠維修', item_name, notes: '' })));
    }
    setField(props.setDescription, setDescription, text);
    setShowSmartPasteModal(false);
    setSmartText('');
  };

  const handleOcrFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setIsOcrProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/ocr-translate', { method: 'POST', body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'OCR 處理失敗');
      applyExtractedData(data);
      alert('已完成 OCR、中文翻譯及表格回填，請核對後再建立工單。');
    } catch (error: any) {
      console.error('Warranty Claim Form OCR 失敗:', error);
      alert(error.message || 'OCR 處理失敗，請稍後再試');
    } finally {
      setIsOcrProcessing(false);
    }
  };

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

      const payload = {
        warranty_type: warrantyType,
        plate_number: plateNumber.trim(),
        vin: vin.trim(),
        project: project.trim(),
        brand: brand.trim(),
        model: model.trim(),
        garage_location: garageLocation.trim(),
        vehicle_location: vehicleLocation.trim(),
        pickup_return_date: pickupReturnDate,
        claim_form_date: claimFormDate,
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
                placeholder="17 位 VIN 碼"
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

            <div>
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
            </div>

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
              <label className="block font-bold text-gray-700 mb-1">Claim Form 日期</label>
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
              {isOcrProcessing ? 'OCR 處理中...' : '📷 上傳 Claim Form 截圖 OCR'}
              <input type="file" accept="image/*" onChange={handleOcrFileChange} disabled={isOcrProcessing} className="hidden" />
            </label>
          </div>
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