import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/all-warranty-drift-2.json', 'utf8'));
const relevant = data.mismatches.filter((row) => row.calculatedMonths > row.storedMonths);
console.log(JSON.stringify({
  now: data.now,
  totalVehicles: data.totalVehicles,
  mismatchCount: data.mismatchCount,
  increaseCount: relevant.length,
  increaseRows: relevant.map((row) => ({
    id: row.id,
    plate_number: row.plate_number,
    vin: row.vin,
    project: row.project,
    storedMonths: row.storedMonths,
    calculatedMonths: row.calculatedMonths,
    storedExpiry: row.storedExpiry,
    calculatedExpiry: row.calculatedExpiry,
    availability: row.availability,
    repairDays: row.repairDays,
    openCount: row.openCount,
  })),
}, null, 2));
