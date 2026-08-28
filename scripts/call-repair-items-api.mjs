import fs from 'node:fs';

const text = fs.readFileSync('/tmp/repair-items-raw-ocr.txt', 'utf8');
const response = await fetch('http://127.0.0.1:3100/api/parse-repair-items', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text }),
});
const body = await response.json();
console.log(response.status, JSON.stringify(body));
if (!response.ok || !Array.isArray(body.items) || body.items.length !== 5) {
  throw new Error('repair items API regression failed');
}
const expected = [
  '維修：引擎機油滲漏',
  '維修：引擎進氣喉損壞',
  '維修：左側頂部射燈不亮',
  '維修：N/S/F 頂部藍色閃燈不亮',
  '維修：N/S/F 乘客閱讀燈閃爍',
];
if (JSON.stringify(body.items.map((item) => item.item_name)) !== JSON.stringify(expected)) {
  throw new Error('repair items API translation mismatch');
}
if ('vehicle' in body || 'plate_number' in body || 'vin' in body) {
  throw new Error('repair items API returned vehicle fields');
}
console.log('PASS');
