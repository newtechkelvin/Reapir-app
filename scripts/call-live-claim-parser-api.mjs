import fs from 'node:fs';

const baseUrl = 'https://reapir-app.vercel.app/api/parse-work-order-text';
const text = fs.readFileSync('/tmp/claim-lines-long-lines-removed.txt', 'utf8');
const response = await fetch(baseUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text }),
});
const body = await response.json();
console.log(response.status, JSON.stringify({
  plate: body.vehicle?.plate_number,
  vin: body.vehicle?.vin,
  claim_form_date: body.vehicle?.claim_form_date,
  items: body.items?.map((item) => item.item_name),
  error: body.error,
}));
if (!response.ok || body.vehicle?.plate_number !== 'AM8508' || body.vehicle?.vin !== 'JHMRP1850LC200381' || !body.items?.length) {
  throw new Error('live parser validation failed');
}
console.log('PASS');
