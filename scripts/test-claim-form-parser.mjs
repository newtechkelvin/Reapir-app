import fs from 'node:fs';
const { parseWhatsAppWorkOrder } = await import('file:///tmp/ocr-parser/whatsappParser.js');

const samples = [
  ['long-lines-removed', fs.readFileSync('/tmp/claim-lines-long-lines-removed.txt', 'utf8')],
  ['all-lines-removed', fs.readFileSync('/tmp/claim-lines-all-lines-removed.txt', 'utf8')],
  ['whatsapp-multiformat', `通知日期：2026-08-26\n車牌：AM1460\n品牌：PEUGEOT\n型號：EXPERT TRAVELLER\nVIN：VF3VEEHZ7NZ006555\n專案/客人：森那美\n維修位置：沙田森那美\n維修項目：\n-左邊中門門窗入水\n-冷氣不冷`],
];

for (const [name, text] of samples) {
  const parsed = parseWhatsAppWorkOrder(text);
  const summary = {
    plate: parsed.vehicle.plate_number,
    vin: parsed.vehicle.vin,
    brand: parsed.vehicle.brand,
    model: parsed.vehicle.model,
    claim_form_date: parsed.vehicle.claim_form_date,
    items: parsed.items.map((item) => item.item_name),
  };
  console.log(name, JSON.stringify(summary));
  if (!summary.plate || !summary.vin || summary.items.length === 0) {
    throw new Error(`parser failed: ${name}`);
  }
}
console.log('PASS');
