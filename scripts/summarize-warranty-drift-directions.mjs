import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/all-warranty-drift-2.json', 'utf8'));
const rows = data.allRows || [];
const lower = rows.filter((r) => r.mismatch && r.calculatedMonths < r.storedMonths);
const sameMonthsExpiryDiff = rows.filter((r) => r.mismatch && r.calculatedMonths === r.storedMonths);
console.log(JSON.stringify({
  total: rows.length,
  calculatedHigher: rows.filter((r) => r.calculatedMonths > r.storedMonths).length,
  calculatedLower: lower.length,
  sameMonthsExpiryDiff: sameMonthsExpiryDiff.length,
  lower: lower.map((r) => ({ plate_number: r.plate_number, storedMonths: r.storedMonths, calculatedMonths: r.calculatedMonths, storedExpiry: r.storedExpiry, calculatedExpiry: r.calculatedExpiry, availability: r.availability, repairDays: r.repairDays })),
  sameMonthsExpiryDiff: sameMonthsExpiryDiff.map((r) => ({ plate_number: r.plate_number, storedMonths: r.storedMonths, calculatedMonths: r.calculatedMonths, storedExpiry: r.storedExpiry, calculatedExpiry: r.calculatedExpiry })),
}, null, 2));
