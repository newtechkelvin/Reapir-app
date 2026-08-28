const fs = await import('node:fs');
const text = `通知日期：2026-08-26
車牌：AM1460
品牌：PEUGEOT
型號：EXPERT TRAVELLER
VIN：VF3VEEHZ7NZ006555
專案/客人：森那美
維修位置：沙田森那美
維修日期：請安排
狀況描述/備註：
維修項目：
-左邊中門門窗入水`;
const expected = { plate_number: 'AM1460', vin: 'VF3VEEHZ7NZ006555', project: '森那美', brand: 'PEUGEOT', model: 'EXPERT TRAVELLER', claim_form_date: '2026-08-26', pickup_return_date: '', garage_location: '沙田森那美' };
const source = fs.readFileSync(new URL('../lib/whatsappParser.ts', import.meta.url), 'utf8');
function value(label) { return text.match(new RegExp(`^${label}\\s*[:：-]?\\s*([^\\n]*)`, 'im'))?.[1]?.trim() || ''; }
const actual = { plate_number: value('車牌'), vin: value('VIN'), project: value('專案/客人'), brand: value('品牌'), model: value('型號'), claim_form_date: value('通知日期'), pickup_return_date: /請安排/.test(value('維修日期')) ? '' : value('維修日期'), garage_location: value('維修位置') };
const items = text.split(/\r?\n/).slice(-1).map((x) => x.replace(/^[-*•]\s*/, '').trim());
console.log(JSON.stringify({ actual, expected, items }, null, 2));
for (const [key, val] of Object.entries(expected)) if (actual[key] !== val) throw new Error(`${key}: expected ${val}, got ${actual[key]}`);
if (items[0] !== '左邊中門門窗入水') throw new Error('item mismatch');
console.log('PASS');
