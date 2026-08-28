import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/am7633-api.json', 'utf8'));
for (const vehicle of data.vehicles || []) {
  const orders = vehicle.workOrders || vehicle.work_orders || [];
  const selected = orders.filter((o) => String(o.work_order_number || o.order_number || o.work_order_no || '').includes('3911-185'));
  console.log(JSON.stringify({
    id: vehicle.id,
    plate_number: vehicle.plate_number,
    vin: vehicle.vin,
    project: vehicle.project,
    warranty_type: vehicle.warranty_type,
    delivery_date: vehicle.delivery_date,
    warranty_period_years: vehicle.warranty_period_years,
    max_extension_months: vehicle.max_extension_months,
    max_extension_count: vehicle.max_extension_count,
    warranty_expiry_date: vehicle.warranty_expiry_date,
    orderCount: orders.length,
    selected,
    orders: orders.map((o) => ({
      work_order_number: o.work_order_number,
      order_number: o.order_number,
      status: o.status,
      claim_form_date: o.claim_form_date,
      completed_date: o.completed_date,
      created_at: o.created_at,
    })),
  }, null, 2));
}
