import fs from 'node:fs';

const samples = [
  ['long-lines-removed', fs.readFileSync('/tmp/claim-lines-long-lines-removed.txt', 'utf8')],
  ['all-lines-removed', fs.readFileSync('/tmp/claim-lines-all-lines-removed.txt', 'utf8')],
];

for (const [name, text] of samples) {
  const response = await fetch('http://127.0.0.1:3100/api/parse-work-order-text', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await response.json();
  console.log(name, response.status, JSON.stringify({
    plate: body.vehicle?.plate_number,
    vin: body.vehicle?.vin,
    claim_form_date: body.vehicle?.claim_form_date,
    items: body.items?.map((item) => item.item_name),
    error: body.error,
  }));
  if (!response.ok || !body.vehicle?.plate_number || !body.vehicle?.vin || !body.items?.length) {
    throw new Error(`API parser failed: ${name}`);
  }
}
console.log('PASS');
