import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const systemPrompt = `你是車輛維修 Warranty Claim Form 資料擷取助手。請只輸出 JSON，將表格中的車牌、VIN、專案、品牌、型號、Claim Form 日期、狀況描述及維修／零件項目擷取出來。保留原文項目的意思，但將每個項目翻譯為繁體中文。無法辨識的欄位使用空字串，日期使用 YYYY-MM-DD。不要猜測不存在的資料。`;

const outputSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'warranty_claim_form',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vehicle: {
          type: 'object',
          additionalProperties: false,
          properties: {
            plate_number: { type: 'string' },
            vin: { type: 'string' },
            project: { type: 'string' },
            brand: { type: 'string' },
            model: { type: 'string' },
            claim_form_date: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['plate_number', 'vin', 'project', 'brand', 'model', 'claim_form_date', 'description'],
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string' },
              item_name: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['type', 'item_name', 'notes'],
          },
        },
      },
      required: ['vehicle', 'items'],
    },
  },
};

function getLlmConfig() {
  const baseUrl = process.env.OCR_LLM_API_URL || process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_API_BASE;
  const apiKey = process.env.OCR_LLM_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    url: baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`,
    apiKey,
    model: process.env.OCR_MODEL || 'gemini-3-flash-preview',
  };
}

function parseModelContent(content: unknown) {
  if (typeof content !== 'string') throw new Error('OCR 模型沒有回傳有效內容');
  const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || !parsed.vehicle || !Array.isArray(parsed.items)) {
    throw new Error('OCR 回傳格式不完整');
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '請選擇或貼上 Warranty Claim Form 相片' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '目前只接受圖片格式的 Warranty Claim Form' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '圖片不可大於 10MB' }, { status: 413 });
    }

    const config = getLlmConfig();
    if (!config) {
      return NextResponse.json({ error: 'OCR 服務尚未設定，請在部署平台設定 OCR_LLM_API_URL 與 OCR_LLM_API_KEY' }, { status: 503 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: '請辨識這張 Warranty Claim Form，完成車輛資料和維修項目擷取及繁體中文翻譯。' },
              { type: 'image_url', image_url: { url: `data:${file.type};base64,${buffer.toString('base64')}`, detail: 'high' } },
            ],
          },
        ],
        response_format: outputSchema,
        max_tokens: 4000,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('OCR 模型請求失敗:', result);
      return NextResponse.json({ error: 'OCR 服務暫時無法處理圖片，請稍後再試' }, { status: 502 });
    }

    const content = result?.choices?.[0]?.message?.content;
    return NextResponse.json({ success: true, ...parseModelContent(content) });
  } catch (error: any) {
    console.error('OCR／翻譯失敗:', error);
    return NextResponse.json({ error: error.message || 'OCR／翻譯失敗，請檢查圖片內容' }, { status: 422 });
  }
}
