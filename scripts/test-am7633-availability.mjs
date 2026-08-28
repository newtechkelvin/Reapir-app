const { calculateAvailability } = await import('file:///tmp/am7633-availability/availability.js');

const result = calculateAvailability({
  delivery_date: '2022-07-28',
  warranty_period_years: 3,
  max_extension_months: 18,
  extension_months: 12,
  workOrders: [
    { status: 'Completed', claim_form_date: '2026-04-23', completed_date: '2026-07-07' },
    { status: 'Open', claim_form_date: '2026-07-28', completed_date: null },
  ],
}, new Date(2026, 7, 28));

console.log(JSON.stringify(result, null, 2));
if (result.extensionMonths !== 18) throw new Error(`expected 18 months, got ${result.extensionMonths}`);
if (result.finalExpiryDate !== '2027-01-28') throw new Error(`expected 2027-01-28, got ${result.finalExpiryDate}`);
const extension = result.periods.filter((period) => period.kind === 'extension');
if (extension.length < 2 || extension[1].triggered !== true) throw new Error('second extension period should trigger');
console.log('PASS');
