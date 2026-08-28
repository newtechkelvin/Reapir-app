const ITEM_HEADER_PATTERN = /^(?:item|items|defect|defact|defect\s*\(?s?\)?\s*found|repair items?|service items?|維修項目|維修項目明細|維修內容)(?:\b|\s|[:：])/i;
const ITEM_LINE_PATTERN = /^(?:repair|replace|replacement|check|inspect|inspection|service|fix|renew|remove|install|adjust|clean|change)\b/i;

function cleanLine(value: string) {
  return value
    .replace(/[|¦]+/g, ' ')
    .replace(/[“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripItemPrefix(value: string) {
  return value
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)、,])\s*/, '')
    .replace(/^\s*[|¦]+\s*/, '')
    .replace(/\s*[|¦]+.*$/, '')
    .replace(/^[^A-Za-z\u4e00-\u9fff]+/, '')
    .trim();
}

/** 從 Tesseract 文字中只取維修項目，忽略 Claim Form 其他欄位。 */
export function extractRepairItemsFromOcrText(text: string) {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const headerIndex = lines.findIndex((line) => ITEM_HEADER_PATTERN.test(line));
  const afterHeader = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const candidateLines = afterHeader
    .map(stripItemPrefix)
    .filter((line) => ITEM_LINE_PATTERN.test(line) || /[\u4e00-\u9fff]/.test(line));

  return candidateLines
    .map((line) => line.replace(/^N\/\$\/F\b/i, 'N/S/F'))
    .filter((line) => line.length > 1)
    .filter((line) => !/^\[?tam\]?$/i.test(line))
    .filter((line) => !/^(?:item|items|defect|defact|remark|remarks)\b/i.test(line))
    .filter((line) => headerIndex < 0 || ITEM_LINE_PATTERN.test(line) || /[\u4e00-\u9fff]/.test(line));
}

const EXACT_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^REPAIR ENGINE O(?:IL|RL) LEAKAGE\b/i, '維修：引擎機油滲漏'],
  [/^REPAIR INTAKE HOSE DAMAGE\b/i, '維修：引擎進氣喉損壞'],
  [/^REPAIR LEFT TOP SPOTLIGHTS? NOT WORK(?:ING)?\b/i, '維修：左側頂部射燈不亮'],
  [/^REPAIR N\/S\/F TOP BLUE FLASHING LIGHT NOT WORK(?:ING)?\b/i, '維修：N/S/F 頂部藍色閃燈不亮'],
  [/^REPAIR N\/S\/F PASSENGER READING LIGHT BLINKING\b/i, '維修：N/S/F 乘客閱讀燈閃爍'],
];

const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bREPAIR\b/gi, '維修'],
  [/\bREPLACE\b|\bREPLACEMENT\b/gi, '更換'],
  [/\bCHECK\b|\bINSPECT(?:ION)?\b/gi, '檢查'],
  [/\bENGINE\b/gi, '引擎'],
  [/\bOIL\b/gi, '機油'],
  [/\bLEAK(?:AGE|ING)?\b/gi, '滲漏'],
  [/\bINTAKE\b/gi, '進氣'],
  [/\bHOSE\b/gi, '喉管'],
  [/\bDAMAGE(?:D)?\b/gi, '損壞'],
  [/\bLEFT\b/gi, '左側'],
  [/\bRIGHT\b/gi, '右側'],
  [/\bFRONT\b/gi, '前方'],
  [/\bREAR\b/gi, '後方'],
  [/\bTOP\b/gi, '頂部'],
  [/\bBOTTOM\b/gi, '底部'],
  [/\bSPOTLIGHTS?\b/gi, '射燈'],
  [/\bBLUE\b/gi, '藍色'],
  [/\bFLASHING\b/gi, '閃爍'],
  [/\bLIGHT\b/gi, '燈'],
  [/\bPASSENGER\b/gi, '乘客'],
  [/\bREADING\b/gi, '閱讀'],
  [/\bBLINKING\b/gi, '閃爍'],
  [/\bNOT\s+WORK(?:ING)?\b/gi, '不運作'],
  [/\bWORK(?:ING)?\b/gi, '運作'],
  [/\bBRAKE\b/gi, '制動'],
  [/\bPAD(?:S)?\b/gi, '皮'],
  [/\bAIR\s+CONDITION(?:ER|ING)?\b/gi, '冷氣'],
  [/\bBATTERY\b/gi, '電池'],
  [/\bDOOR\b/gi, '車門'],
  [/\bWINDOW\b/gi, '車窗'],
  [/\bWATER\b/gi, '水'],
];

/** 將維修項目翻譯成繁體中文；不使用 LLM 或外部服務。 */
export function translateRepairItemToTraditionalChinese(value: string) {
  const normalized = cleanLine(value)
    .replace(/N\/\$\/F/gi, 'N/S/F')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, translation] of EXACT_TRANSLATIONS) {
    if (pattern.test(normalized)) return translation;
  }

  let translated = normalized;
  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }
  translated = translated.replace(/\bN\/S\/F\b/gi, 'N/S/F').replace(/\s{2,}/g, ' ').trim();
  return translated;
}
