import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/all-warranty-drift-2.json', 'utf8'));
const rows = data.allRows || [];
const inc = rows.filter((r) => r.mismatch && r.calculatedMonths > r.storedMonths);
const group = (list) => list.reduce((acc, row) => {
  const key = row.warranty_type || 'Unknown';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const delta = inc.reduce((acc, row) => {
  const key = `${row.storedMonths}->${row.calculatedMonths}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({
  now: data.now,
  total: rows.length,
  increases: inc.length,
  increasesByWarrantyType: group(inc),
  increasesByDelta: delta,
  governmentIncreases: inc.filter((r) => String(r.warranty_type || '').toLowerCase() === 'government').length,
  generalIncreases: inc.filter((r) => String(r.warranty_type || '').toLowerCase() === 'general').length,
  nonGovernment: inc.filter((r) => String(r.warranty_type || '').toLowerCase() !== 'government').map((r) => ({ plate_number: r.plate_number, warranty_type: r.warranty_type, storedMonths: r.storedMonths, calculatedMonths: r.calculatedMonths })),
}, null, 2));
