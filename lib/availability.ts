export type AvailabilityOrder = {
  claim_form_date?: string | null;
  created_at?: string | null;
  completed_date?: string | null;
  status?: string | null;
};

export type AvailabilityVehicle = {
  delivery_date?: string | null;
  created_at?: string | null;
  warranty_period_years?: number | string | null;
  max_extension_months?: number | string | null;
  extension_months?: number | string | null;
  extension_count?: number | string | null;
  max_extension_count?: number | string | null;
  workOrders?: AvailabilityOrder[];
  work_orders?: AvailabilityOrder[];
};

export type AvailabilityPeriod = {
  kind: 'warranty' | 'extension';
  index: number;
  start: string;
  end: string;
  totalDays: number;
  repairDays: number;
  availability: number;
  triggered: boolean;
};

export type AvailabilityResult = {
  currentPeriod: AvailabilityPeriod | null;
  periods: AvailabilityPeriod[];
  availability: number | null;
  repairDays: number;
  openCount: number;
  extensionMonths: number;
  originalExpiryDate: string | null;
  finalExpiryDate: string | null;
  maxExtensionMonths: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(value: Date, months: number) {
  const result = new Date(value);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(value: Date, years: number) {
  const result = new Date(value);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function diffDays(start: Date, endExclusive: Date) {
  return Math.max(0, Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS));
}

function repairInterval(order: AvailabilityOrder, now: Date) {
  const start = dateOnly(order.claim_form_date);
  if (!start) return null;
  const status = String(order.status || 'Open').trim().toLowerCase();
  const completed = status === 'completed' || status === 'closed' || status === '已完成';
  const completedDate = completed ? dateOnly(order.completed_date) : null;
  const endInclusive = completedDate || now;
  if (endInclusive < start) return null;
  return { start, endExclusive: addDays(endInclusive, 1) };
}

function calculateUnionRepairDays(orders: AvailabilityOrder[], periodStart: Date, periodEndExclusive: Date, now: Date) {
  const intervals = orders
    .map((order) => repairInterval(order, now))
    .filter((interval): interval is { start: Date; endExclusive: Date } => Boolean(interval))
    .map((interval) => ({
      start: new Date(Math.max(interval.start.getTime(), periodStart.getTime())),
      endExclusive: new Date(Math.min(interval.endExclusive.getTime(), periodEndExclusive.getTime())),
    }))
    .filter((interval) => interval.start < interval.endExclusive)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let total = 0;
  let current: { start: Date; endExclusive: Date } | null = null;
  for (const interval of intervals) {
    if (!current) {
      current = interval;
      continue;
    }
    if (interval.start <= current.endExclusive) {
      current.endExclusive = new Date(Math.max(current.endExclusive.getTime(), interval.endExclusive.getTime()));
    } else {
      total += diffDays(current.start, current.endExclusive);
      current = interval;
    }
  }
  if (current) total += diffDays(current.start, current.endExclusive);
  return total;
}

function makePeriod(kind: AvailabilityPeriod['kind'], index: number, start: Date, end: Date, orders: AvailabilityOrder[], now: Date): AvailabilityPeriod {
  const totalDays = diffDays(start, end);
  const repairDays = calculateUnionRepairDays(orders, start, end, now);
  const availability = totalDays > 0 ? Number(Math.max(0, 100 - (repairDays / totalDays) * 100).toFixed(2)) : 100;
  return { kind, index, start: formatDate(start), end: formatDate(addDays(end, -1)), totalDays, repairDays, availability, triggered: availability < 95 };
}

export function calculateAvailability(vehicle: AvailabilityVehicle, now = new Date()): AvailabilityResult {
  const delivery = dateOnly(vehicle.delivery_date || vehicle.created_at);
  if (!delivery) {
    return { currentPeriod: null, periods: [], availability: null, repairDays: 0, openCount: 0, extensionMonths: 0, originalExpiryDate: null, finalExpiryDate: null, maxExtensionMonths: 18 };
  }

  const orders = vehicle.workOrders || vehicle.work_orders || [];
  const warrantyYears = Math.max(1, Number(vehicle.warranty_period_years) || 3);
  const configuredMaxMonths = Number(vehicle.max_extension_months);
  const legacyMaxMonths = Number(vehicle.max_extension_count) * 6;
  const maxExtensionMonths = Math.max(0, configuredMaxMonths || legacyMaxMonths || 18);
  const originalExpiry = addYears(delivery, warrantyYears);
  const periods: AvailabilityPeriod[] = [];
  // 既有資料可能已記錄歷史展延；保留它，再按後續展延期重新檢查是否需要再加 6 個月。
  const persistedExtensionMonths = Math.max(0, Number(vehicle.extension_months) || 0);
  let extensionMonths = Math.min(maxExtensionMonths, persistedExtensionMonths);

  for (let index = 0; index < warrantyYears; index += 1) {
    const start = addYears(delivery, index);
    const end = addYears(delivery, index + 1);
    if (start > now) break;
    const period = makePeriod('warranty', index + 1, start, end, orders, now);
    periods.push(period);
    if (period.triggered) extensionMonths = Math.min(maxExtensionMonths, extensionMonths + 6);
  }

  // 展延期按六個月順序檢查。已存在的展延月份代表前面區段已啟用，下一個區段如低於 95% 就再加 6 個月。
  const extensionPeriods = Math.ceil(maxExtensionMonths / 6);
  for (let extensionIndex = 0; extensionIndex < extensionPeriods; extensionIndex += 1) {
    const extensionStart = addMonths(originalExpiry, extensionIndex * 6);
    if (extensionStart > now) break;
    // 沒有前一個展延期時，不應直接評估更後面的區段。
    if (extensionIndex > 0 && extensionMonths < extensionIndex * 6) break;
    const end = addMonths(extensionStart, 6);
    const period = makePeriod('extension', extensionIndex + 1, extensionStart, end, orders, now);
    periods.push(period);
    if (period.triggered) {
      extensionMonths = Math.min(maxExtensionMonths, Math.max(extensionMonths, (extensionIndex + 2) * 6));
    }
  }

  const currentPeriod = periods.find((period) => {
    const start = dateOnly(period.start)!;
    const endExclusive = addDays(dateOnly(period.end)!, 1);
    return now >= start && now < endExclusive;
  }) || null;
  const finalExpiry = addMonths(originalExpiry, extensionMonths);
  const openCount = orders.filter((order) => {
    const status = String(order.status || 'Open').trim().toLowerCase();
    return status !== 'completed' && status !== 'closed' && status !== '已完成';
  }).length;

  return {
    currentPeriod,
    periods,
    availability: currentPeriod?.availability ?? null,
    repairDays: currentPeriod?.repairDays ?? 0,
    openCount,
    extensionMonths,
    originalExpiryDate: formatDate(originalExpiry),
    finalExpiryDate: formatDate(finalExpiry),
    maxExtensionMonths,
  };
}
