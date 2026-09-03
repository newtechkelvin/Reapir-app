// src/lib/repairItemOcr.ts

/**
 * 從 OCR 文字中提取維修項目
 */
export function extractRepairItemsFromOcrText(text: string): string[] {
  if (!text) return [];
  
  // 按行分割並過濾空行
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // 簡單過濾掉標頭或非維修項目的雜訊（可依實際表格格式微調）
  return lines.filter((line) => {
    const isHeader = /^(claim|form|page|date|vehicle|vin|plate|no|item|description|remarks)/i.test(line);
    return !isHeader && line.length > 2;
  });
}

/**
 * 建構傳遞給 AI 的 System Prompt (包含 Few-Shot 範例與 100% 繁體中文強制規範)
 */
function buildPrompt(sourceText: string): string {
  return `你是一位精通香港汽車維修與政府工程（EMSD）專用語彙的專業翻譯員。
請將輸入的 Claim Form 英文維修項目描述翻譯為**香港習慣使用的繁體中文**。

【最高指令與輸出規範】：
1. **100% 繁體中文**：輸出的結果**嚴禁包含任何英文字母**（除 ABS、EBS、CCTV、LED 等常見標準專有名詞縮寫外，其餘英文單字必須全部翻譯）。
2. **精準香港汽車術語**：
   - OFF-SIDE / O/S ➔ 右側 / 駕駛側
   - NEAR-SIDE / N/S ➔ 左側 / 副駕側
   - BOTH-SIDE ➔ 雙側 / 左右兩邊
   - FRONT / REAR ➔ 前方 / 後方
   - COMPARTMENT ➔ 車廂 / 車斗
   - RUBBER SEAL ➔ 門膠條 / 防水膠條
   - HINGE ➔ 鉸鏈 / 門鉸
   - GRILLE ➔ 水箱護罩 / 車頭格柵
   - TRACK ROD ➔ 轉向橫拉桿
   - DEFECT / MALFUNCTION ➔ 損壞 / 故障
   - TOO TIGHT / LOOSEN ➔ 過緊 / 鬆脫
   - NOISY ➔ 異響 / 噪音
3. **只輸出翻譯後的文字**：不要輸出任何解釋、開場白、標點引號或原英文。

【Few-Shot 學習範例】：
英文原圖文字: "REPAIR OFF-SIDE FRONT DOOR RUBBER SEAL DEFECT"
繁體中文翻譯: "維修右前門防水膠條損壞"

英文原圖文字: "REPAIR REAR COMPARTMENT CCTV SOMETIMES NO DISPLAY"
繁體中文翻譯: "維修後車廂閉路電視偶爾無顯示"

英文原圖文字: "REPAIR BOTH-SIDE ALL VEHICLE BODY UPSIDE VENTILATOR"
繁體中文翻譯: "維修雙側全車身頂部通風口"

英文原圖文字: "REPAIR EMERGENCY DOOR HINGE TOO TIGHT"
繁體中文翻譯: "維修緊急門鉸鏈過緊"

英文原圖文字: "REPAIR FRONT GRILLE FLASHING LIGHT MALFUNCTION"
繁體中文翻譯: "維修車頭格柵閃爍燈故障"

英文原圖文字: "REPAIR STEERING TRACK ROD LOOSEN"
繁體中文翻譯: "維修轉向橫拉桿鬆脫"

英文原圖文字: "REPAIR ENGINE BELT NOISY"
繁體中文翻譯: "維修引擎皮帶異響"

【待翻譯英文內容】：
"${sourceText}"
`;
}

/**
 * 呼叫 AI 模型將英文維修項目翻譯為繁體中文
 * (此處以 OpenAI API 為例，若使用 Gemini / Claude 可適當更換 API 呼叫)
 */
export async function translateRepairItemToTraditionalChinese(sourceText: string): Promise<string> {
  if (!sourceText || !sourceText.trim()) return '';

  try {
    // 假設您在環境變數中有設定 OPENAI_API_KEY
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // 建議使用 gpt-4o 或 gpt-4o-mini 確保高精準度
        temperature: 0.1,    // 低溫度確保輸出穩定不天馬行空
        messages: [
          { role: 'user', content: buildPrompt(sourceText) }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API 翻譯請求失敗: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content?.trim() || sourceText;

    // 後處理：若翻譯結果仍殘留常見未翻譯英文單字，做最後一層清理
    return resultText
      .replace(/\bREPAIR\b/gi, '維修')
      .replace(/\bOFF-SIDE\b/gi, '右側')
      .replace(/\bNEAR-SIDE\b/gi, '左側')
      .replace(/\s+/g, ' ');

  } catch (error) {
    console.error('AI 翻譯執行失敗，啟用退回機制:', error);
    // 發生例外時的降級處理（Fallback）
    return sourceText;
  }
}
