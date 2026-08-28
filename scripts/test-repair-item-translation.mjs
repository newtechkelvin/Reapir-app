import fs from 'node:fs';
const { extractRepairItemsFromOcrText, translateRepairItemToTraditionalChinese } = await import('file:///tmp/repair-item-ocr/repairItemOcr.js');

const sourceText = fs.readFileSync('/tmp/repair-items-raw-ocr.txt', 'utf8').trim();
const sourceItems = extractRepairItemsFromOcrText(sourceText);
const translatedItems = sourceItems.map(translateRepairItemToTraditionalChinese);
const expected = [
  '維修：引擎機油滲漏',
  '維修：引擎進氣喉損壞',
  '維修：左側頂部射燈不亮',
  '維修：N/S/F 頂部藍色閃燈不亮',
  '維修：N/S/F 乘客閱讀燈閃爍',
];
console.log(JSON.stringify({ sourceItems, translatedItems }, null, 2));
if (JSON.stringify(translatedItems) !== JSON.stringify(expected)) {
  throw new Error('repair item translation regression failed');
}
console.log('PASS');
