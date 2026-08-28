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
  plate: ['車牌號碼', '車牌', '牌照', 'plate number', 'plate'],
  brand: ['品牌', '廠牌', 'brand'],
  model: ['型號', '車型', 'model'],
  vin: ['車身號碼', '車架號碼', 'vin'],
  project: ['專案/客人', '專案／客人', '專案/客戶', '專案', '客人', '客戶', 'project', 'customer'],
  location: ['維修位置', '維修地點', '入廠地點', 'garage location', 'location'],
  repairDate: ['維修日期', '入廠日期', '維修開始日期', 'repair date', 'service date'],
  description: ['狀況描述/備註', '狀況描述／備註', '狀況描述', '故障描述', '備註', 'description', 'remark', 'remarks'],
};

function labelPattern(labels: string[]) {
  return labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}

function fieldValue(text: string, labels: string[]) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${labelPattern(labels)})\\s*[:：-]?\\s*([^\\n]*)`, 'im');
  return text.match(pattern)?.[1]?.trim() || '';
}

function normalizeDate(value: string) {
  if (!value || /請安排|待定|未定|安排/i.test(value)) return '';
  const match = value.match(/(20\d{2})\s*[年\/-]\s*(\d{1,2})\s*[月\/-]\s*(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function normalizePlate(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function normalizeVin(value: string) {
  const match = value.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/);
  return match?.[0] || value.replace(/\s+/g, '').toUpperCase();
}

export function parseWhatsAppWorkOrder(text: string): ParsedWorkOrderText {
  const plate = normalizePlate(fieldValue(text, LABELS.plate));
  const vin = normalizeVin(fieldValue(text, LABELS.vin));
  const project = fieldValue(text, LABELS.project);
  const repairDate = normalizeDate(fieldValue(text, LABELS.repairDate));
  const noticeDate = normalizeDate(fieldValue(text, LABELS.noticeDate));
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const itemHeaderIndex = lines.findIndex((line) => /^(?:維修項目|維修項目明細|維修內容|repair items?|service items?)\s*[:：]?\s*$/i.test(line));
  const itemLines = itemHeaderIndex >= 0
    ? lines.slice(itemHeaderIndex + 1)
      .map((line) => line.replace(/^\s*(?:[-*•▪◦]|\d+[.)、])\s*/, '').trim())
      .filter((line) => line.length > 0)
    : [];
  const description = fieldValue(text, LABELS.description);
  const vehicle = {
    plate_number: plate,
    vin,
    project,
    brand: fieldValue(text, LABELS.brand),
    model: fieldValue(text, LABELS.model),
    warranty_type: /散車|一般|general/i.test(`${project} ${text}`) ? 'general' : 'government',
    claim_form_date: noticeDate,
    pickup_return_date: repairDate,
    garage_location: fieldValue(text, LABELS.location),
    description,
  };
  return {
    vehicle,
    items: itemLines.map((item_name) => ({ type: '進廠維修', item_name, notes: '' })),
  };
}
