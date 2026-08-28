import fs from 'node:fs';
const { extractRepairItemsFromOcrText, translateRepairItemToTraditionalChinese } = await import('file:///tmp/repair-item-ocr/repairItemOcr.js');

const cases = [
  {
    name: 'raw-sample',
    text: fs.readFileSync('/tmp/repair-items-raw-ocr.txt', 'utf8').trim(),
    expected: [
      '維修：引擎機油滲漏',
      '維修：引擎進氣喉損壞',
      '維修：左側頂部射燈不亮',
      '維修：N/S/F 頂部藍色閃燈不亮',
      '維修：N/S/F 乘客閱讀燈閃爍',
    ],
  },
  {
    name: 'browser-noise-sample',
    text: `REPAIR ENGINE ORL LEAKAGE BN oT\nREPAIR INTAKE HOSE DAMAGE\nREPAIR LEFT TOP SPOTLIGHTS NOT WORK\n' REPAIR N/$/F TOP BLUE FLASHING LIGHT NOT WORK\nREPAIR N/S/F PASSENGER READING LIGHT BLINKING 一`,
    expectedCount: 5,
  },
];

for (const testCase of cases) {
  const sourceItems = extractRepairItemsFromOcrText(testCase.text);
  const translatedItems = sourceItems.map(translateRepairItemToTraditionalChinese);
  console.log(testCase.name, JSON.stringify({ sourceItems, translatedItems }, null, 2));
  if (translatedItems.length !== (testCase.expectedCount || testCase.expected.length)) {
    throw new Error(`repair item extraction count regression failed: ${testCase.name}`);
  }
  if (testCase.expected && JSON.stringify(translatedItems) !== JSON.stringify(testCase.expected)) {
    throw new Error(`repair item translation regression failed: ${testCase.name}`);
  }
}
console.log('PASS');
