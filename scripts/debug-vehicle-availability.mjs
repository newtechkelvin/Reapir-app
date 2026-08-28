const { calculateAvailability } = await import('file:///tmp/all-warranty-audit/availability.js');
const plate = process.argv[2] || 'AM8583';
const response = await fetch(`https://reapir-app.vercel.app/api/vehicles?q=${encodeURIComponent(plate)}`);
const payload = await response.json();
const now = new Date();
for (const vehicle of payload.vehicles || []) {
  if (String(vehicle.plate_number).toUpperCase() !== plate.toUpperCase()) continue;
  const result = calculateAvailability(vehicle, now);
  console.log(JSON.stringify({
    vehicle: {
      id: vehicle.id,
      plate_number: vehicle.plate_number,
      delivery_date: vehicle.delivery_date,
      warranty_period_years: vehicle.warranty_period_years,
      max_extension_months: vehicle.max_extension_months,
      max_extension_count: vehicle.max_extension_count,
      extension_months: vehicle.extension_months,
      warranty_expiry_date: vehicle.warranty_expiry_date,
    },
    orders: (vehicle.workOrders || []).map((o) => ({
      order_number: o.order_number,
      status: o.status,
      claim_form_date: o.claim_form_date,
      completed_date: o.completed_date,
    })),
    result,
  }, null, 2));
}
