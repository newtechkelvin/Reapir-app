import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/am7633-api.json', 'utf8'));
for (const vehicle of data.vehicles || []) {
  const orders = vehicle.workOrders || vehicle.work_orders || [];
  console.log(JSON.stringify({
    plate_number: vehicle.plate_number,
    vin: vehicle.vin,
    delivery_date: vehicle.delivery_date,
    warranty_period_years: vehicle.warranty_period_years,
    warranty_expiry_date: vehicle.warranty_expiry_date,
    extension_months: vehicle.extension_months,
    max_extension_months: vehicle.max_extension_months,
    max_extension_count: vehicle.max_extension_count,
    orders: orders.map((o) => ({
      order_number: o.order_number,
      status: o.status,
      claim_form_date: o.claim_form_date,
      completed_date: o.completed_date,
    })),
  }, null, 2));
}
