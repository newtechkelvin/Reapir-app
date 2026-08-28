import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('/tmp/all-warranty-drift-2.json', 'utf8'));
const relevant = data.mismatches.filter((row) => row.calculatedMonths > row.storedMonths);
const lines = [
  `計算時間: ${data.now}`,
  `全庫車輛: ${data.totalVehicles}`,
  `資料庫欄位有落差: ${data.mismatchCount}`,
  `應增加展延月份: ${relevant.length}`,
  '',
  '車牌 | VIN | 目前月數 | 應有月數 | 目前到期日 | 應有到期日 | 可用率 | 停修日 | Open',
  ...relevant.map((r) => [r.plate_number, r.vin, r.storedMonths, r.calculatedMonths, r.storedExpiry, r.calculatedExpiry, r.availability ?? '', r.repairDays, r.openCount].join(' | ')),
];
fs.writeFileSync('/tmp/warranty-drift-report.txt', `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
