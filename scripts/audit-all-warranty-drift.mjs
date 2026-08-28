const { calculateAvailability } = await import('file:///tmp/all-warranty-audit/availability.js');
const response = await fetch('https://reapir-app.vercel.app/api/vehicles');
if (!response.ok) throw new Error(`vehicles API failed: ${response.status}`);
const payload = await response.json();
const now = new Date();
const rows = [];
for (const vehicle of payload.vehicles || []) {
  const calculation = calculateAvailability(vehicle, now);
  const storedMonths = Number(vehicle.extension_months) || 0;
  const storedExpiry = vehicle.warranty_expiry_date || null;
  const mismatch = storedMonths !== calculation.extensionMonths || storedExpiry !== calculation.finalExpiryDate;
  rows.push({
    id: vehicle.id,
    plate_number: vehicle.plate_number,
    vin: vehicle.vin,
    project: vehicle.project,
    warranty_type: vehicle.warranty_type,
    storedMonths,
    calculatedMonths: calculation.extensionMonths,
    storedExpiry,
    calculatedExpiry: calculation.finalExpiryDate,
    availability: calculation.availability,
    repairDays: calculation.repairDays,
    openCount: calculation.openCount,
    mismatch,
  });
}
const mismatches = rows.filter((row) => row.mismatch);
console.log(JSON.stringify({ now: now.toISOString(), totalVehicles: rows.length, mismatchCount: mismatches.length, mismatches, allRows: rows }, null, 2));
