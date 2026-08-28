import fs from 'node:fs';

const text = fs.readFileSync('/tmp/repair-items-raw-ocr.txt', 'utf8');
const response = await fetch('https://reapir-app.vercel.app/api/parse-repair-items', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text }),
});
const body = await response.json();
console.log(response.status, JSON.stringify(body));
const expected = [
  '維修：引擎機油滲漏',
  '維修：引擎進氣喉損壞',
  '維修：左側頂部射燈不亮',
  '維修：N/S/F 頂部藍色閃燈不亮',
  '維修：N/S/F 乘客閱讀燈閃爍',
];
if (!response.ok || JSON.stringify(body.items?.map((item) => item.item_name)) !== JSON.stringify(expected)) {
  throw new Error('live repair items API validation failed');
}
console.log('PASS');
