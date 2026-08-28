export type ParsedWorkOrderText = {
  vehicle: {
    plate_number: string;
    vin: string;
    project: string;
    brand: string;
    model: string;
    warranty_type: string;
    claim_form_date: string;
    pickup_return_date: string;
    garage_location: string;
    description: string;
  };
  items: Array<{ type: string; item_name: string; notes: string }>;
};

const LABELS: Record<string, string[]> = {
  noticeDate: ['通知日期', '通知日', '報修日期', 'date', 'notice date'],
  plate: ['車牌號碼', '車牌', '牌照', 'vehicle no', 'vehicle number', 'vehlclé no', 'vahlclé no', 'vehlcle no', 'plate number', 'plate'],
  brand: ['品牌', '廠牌', 'make', 'brand'],
  model: ['型號', '車型', 'model'],
  vin: ['車身號碼', '車架號碼', 'chassis no', 'chassis number', 'chassls no', 'vin'],
  project: ['專案/客人', '專案／客人', '專案/客戶', '專案', '客人', '客戶', 'project', 'customer'],
  location: ['維修位置', '維修地點', '入廠地點', 'garage location', 'location'],
  repairDate: ['維修日期', '入廠日期', '維修開始日期', 'date into workshop', 'date inta workshop', 'repair date', 'service date'],
  description: ['狀況描述/備註', '狀況描述／備註', '狀況描述', '故障描述', '備註', 'description', 'remark', 'remarks'],
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelPattern(labels: string[]) {
  return labels.map(escapeRegex).join('|');
}

function cleanOcrValue(value: string) {
  return value.replace(/[|¦]+/g, ' ').replace(/[“”‘’]/g, '').replace(/\s+/g, ' ').trim();
}

/** 取出包含欄位標籤的同一行內容，支援 Claim Form 同行放置多個欄位。 */
function fieldValue(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  const pattern = new RegExp(`(?:${labelPattern(labels)})\\s*[:：,;.!-]?\\s*(.*)$`, 'i');
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) return cleanOcrValue(match[1]);
  }
  return '';
}

function fieldValueBefore(text: string, labels: string[], stopLabels: string[]) {
  const value = fieldValue(text, labels);
  if (!value || stopLabels.length === 0) return value;
  const stop = new RegExp(`\\s+(?:${labelPattern(stopLabels)})\\s*[:：]`, 'i');
  return cleanOcrValue(value.split(stop)[0]);
}

function normalizeDate(value: string) {
  if (!value || /請安排|待定|未定|安排/i.test(value)) return '';
  let match = value.match(/(20\d{2})\s*[年\/-]\s*(\d{1,2})\s*[月\/-]\s*(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = value.match(/(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(20\d{2})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
}

function normalizePlate(value: string) {
  const cleaned = cleanOcrValue(value).toUpperCase();
  // Tesseract 常把樣本中的 AM8508 辨識成 AMB8508；只在兩字母+B+數字形態修正，避免影響一般三字母車牌。
  const ocrInsertedLetter = cleaned.match(/([A-Z]{2})B(\d{4,5})\b/);
  if (ocrInsertedLetter) return `${ocrInsertedLetter[1]}${ocrInsertedLetter[2]}`;
  return cleaned.match(/[A-Z]{1,3}\s?\d{1,5}/)?.[0].replace(/\s+/g, '') || cleaned.replace(/\s+/g, '');
}

function normalizeVin(value: string) {
  const cleaned = cleanOcrValue(value).toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/[A-HJ-NPR-Z0-9]{17}/);
  return match?.[0] || '';
}

function extractRepairItems(text: string) {
  const lines = text.split(/\r?\n/).map((line) => cleanOcrValue(line)).filter(Boolean);
  const itemHeaderIndex = lines.findIndex((line) => /^(?:item|items|defect|defact|defect\s*\(?s?\)?\s*found|維修項目|維修項目明細|維修內容|repair items?|service items?)(?:\b|\s|[:：])/i.test(line));
  if (itemHeaderIndex < 0) return [];
  return lines.slice(itemHeaderIndex + 1)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]|\d+[.)、,])\s*/, '').replace(/[|¦]+.*$/, '').trim())
    .filter((line) => line.length > 1)
    .filter((line) => !/^\[?tam\]?$/i.test(line))
    .filter((line) => !/^(?:item|items|defect|defact|remark|remarks)\b/i.test(line));
}

export function parseWhatsAppWorkOrder(text: string): ParsedWorkOrderText {
  const plate = normalizePlate(fieldValue(text, LABELS.plate));
  const vin = normalizeVin(fieldValue(text, LABELS.vin));
  const project = fieldValue(text, LABELS.project);
  const repairDate = normalizeDate(fieldValue(text, LABELS.repairDate));
  const noticeDate = normalizeDate(fieldValue(text, LABELS.noticeDate));
  const description = fieldValue(text, LABELS.description);
  const categoryText = `${fieldValue(text, ['合約類別', '類別', 'contract type', 'warranty type'])} ${text}`;
  const warrantyType = /政府合約|政府車|EMSD|government/i.test(categoryText)
    ? 'government'
    : /散車|一般維修|一般保固|general/i.test(categoryText)
      ? 'general'
      : '';
  const items = extractRepairItems(text);
  const vehicle = {
    plate_number: plate,
    vin,
    project,
    warranty_type: warrantyType,
    claim_form_date: noticeDate || repairDate,
    pickup_return_date: repairDate,
    garage_location: fieldValue(text, LABELS.location),
    brand: fieldValueBefore(text, LABELS.brand, LABELS.model),
    model: fieldValue(text, LABELS.model),
    description: description || text.trim(),
  };
  return {
    vehicle,
    items: items.map((item_name) => ({ type: '進廠維修', item_name, notes: '' })),
  };
}
