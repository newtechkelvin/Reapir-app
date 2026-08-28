const samples = [
  {
    name: '多項目中文格式',
    text: `通知日期：2026-08-26\n車牌：AM1460\n品牌：PEUGEOT\n型號：EXPERT TRAVELLER\nVIN：VF3VEEHZ7NZ006555\n專案/客人：森那美\n維修位置：沙田森那美\n維修日期：請安排\n狀況描述/備註：\n維修項目：\n-左邊中門門窗入水\n-冷氣不冷\n3. 檢查引擎故障燈`,
    expected: { plate: 'AM1460', vin: 'VF3VEEHZ7NZ006555', items: 3, category: '' },
  },
  {
    name: '英文欄位混合格式',
    text: `Notice Date: 2026/8/27\nPlate Number: AB 1234\nBrand: Toyota\nModel: Coaster\nVIN: JTFSX22P006123456\nCustomer: Demo Fleet\nLocation: Kowloon Bay\nRepair Date: TBC\nContract Type: Government\nRepair Items:\n1) Replace brake pads\n2) Check engine light`,
    expected: { plate: 'AB1234', vin: 'JTFSX22P006123456', items: 2, category: 'government' },
  },
];

function field(text, labels) { const p = labels.join('|'); return text.match(new RegExp(`(?:^|\\n)[ \\t]*(?:${p})[ \\t]*[:：-]?[ \\t]*([^\\n]*)`, 'im'))?.[1]?.trim() || ''; }
function date(v) { const m = v.match(/(20\d{2})\s*[年\/-]\s*(\d{1,2})\s*[月\/-]\s*(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : ''; }
for (const sample of samples) {
  const lines = sample.text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const header = lines.findIndex(x => /^(?:維修項目|repair items?)\s*[:：]?$/i.test(x));
  const items = header >= 0 ? lines.slice(header + 1).map(x => x.replace(/^[-*•▪◦]|^\d+[.)、]/, '').trim()).filter(Boolean) : [];
  const actual = { plate: field(sample.text, ['車牌','Plate Number']).replace(/\s+/g,''), vin: field(sample.text, ['VIN']), items: items.length, category: /政府合約|Government/i.test(sample.text) ? 'government' : /散車|General/i.test(sample.text) ? 'general' : '', date: date(field(sample.text, ['通知日期','Notice Date'])) };
  console.log(sample.name, actual);
  if (actual.plate !== sample.expected.plate || actual.vin !== sample.expected.vin || actual.items !== sample.expected.items || actual.category !== sample.expected.category) throw new Error(`failed: ${sample.name}`);
}
console.log('PASS');
