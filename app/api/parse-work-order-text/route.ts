import { NextRequest, NextResponse } from 'next/server';

const systemPrompt = `你是車輛維修工單資料整理助手。使用者會貼上 WhatsApp 報修訊息，請只輸出 JSON。
請辨識並整理：車牌、17 位 VIN、政府合約或散車類別、專案名稱、品牌、型號、Claim Form／報修／入廠日期、取車或完成日期、故障描述，以及所有維修項目。
訊息可能混合中英文、廣東話、標點、emoji、WhatsApp 轉發標題、換行、編號清單、表格或同一行多個欄位。不要因格式不整齊而遺漏資料。
車牌只移除空格並轉大寫；VIN 轉大寫；日期轉 YYYY-MM-DD。維修項目每一項獨立一列，將英文項目翻譯為繁體中文，原文可放在 notes；不要把車牌、VIN、日期或聯絡人資料誤當維修項目。無法確定的欄位使用空字串，不要猜測。`;

const schema = {
  type: 'json_schema',
  json_schema: {
    name: 'whatsapp_work_order',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vehicle: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plate_number: { type: 'string' }, vin: { type: 'string' }, project: { type: 'string' },
            brand: { type: 'string' }, model: { type: 'string' }, warranty_type: { type: 'string' },
            claim_form_date: { type: 'string' }, pickup_return_date: { type: 'string' }, description: { type: 'string' },
          },
          required: ['plate_number', 'vin', 'project', 'brand', 'model', 'warranty_type', 'claim_form_date', 'pickup_return_date', 'description'],
        },
        items: {
          type: 'array', items: { type: 'object', additionalProperties: false,
            properties: { type: { type: 'string' }, item_name: { type: 'string' }, notes: { type: 'string' } },
            required: ['type', 'item_name', 'notes'] },
        },
      },
      required: ['vehicle', 'items'],
    },
  },
};

function config() {
  const baseUrl = process.env.OCR_LLM_API_URL || process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_API_BASE;
  const apiKey = process.env.OCR_LLM_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { url: baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`, apiKey, model: process.env.OCR_MODEL || 'gemini-3-flash-preview' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ error: '請貼上 WhatsApp 報修訊息' }, { status: 400 });
    if (text.length > 30000) return NextResponse.json({ error: '訊息不可大於 30,000 個字元' }, { status: 413 });
    const llm = config();
    if (!llm) return NextResponse.json({ error: '文字解析服務尚未設定，請在部署平台設定 OCR_LLM_API_URL 與 OCR_LLM_API_KEY' }, { status: 503 });

    const response = await fetch(llm.url, {
      method: 'POST', headers: { Authorization: `Bearer ${llm.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: llm.model, messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `請解析以下 WhatsApp 報修訊息：\n\n${text}` },
      ], response_format: schema, max_tokens: 4000 }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: '文字解析服務暫時無法處理訊息' }, { status: 502 });
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('文字解析模型沒有回傳有效內容');
    const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
    if (!parsed.vehicle || !Array.isArray(parsed.items)) throw new Error('文字解析回傳格式不完整');
    return NextResponse.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('WhatsApp 文字解析失敗:', error);
    return NextResponse.json({ error: error.message || 'WhatsApp 訊息解析失敗' }, { status: 422 });
  }
}
