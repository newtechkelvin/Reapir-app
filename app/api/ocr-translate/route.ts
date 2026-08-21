import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '請選擇或貼上紙本維修單相片' }, { status: 400 });
    }

    // 將圖片轉換為 Base64 格式
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const hfToken = process.env.HF_TOKEN || process.env.NEXT_PUBLIC_HF_TOKEN;

    // 若未設定 HF_TOKEN，回傳範例測試資料
    if (!hfToken) {
      return NextResponse.json({
        warning: '未設定 HF_TOKEN，以下為測試範例資料',
        items: [
          { type: '更換零件', item_name: '更換前煞車皮 (Change Front Brake Pads)' },
          { type: '進廠維修', item_name: '檢查水箱漏水問題 (Check Water Tank Leak)' },
        ],
      });
    }

    // 設定 15 秒連線 Timeout，防止 fetch failed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `你是一位汽車維修專業助手。請讀取維修單圖片：
1. 提取所有維修與更換零件項目。
2. 若內容為英文，請翻譯成「繁體中文」（可在括號內保留英文）。
3. 自動判定類別：[進廠維修, 更換零件, 現場處理, 外判處理, 收費項目, Recall項目]。
4. 請只回傳 JSON 陣列，不要有其他文字，格式如：
[
  {"type": "更換零件", "item_name": "更換機油濾芯 (Engine Oil Filter Replacement)"},
  {"type": "進廠維修", "item_name": "檢查煞車系統異音"}
]`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '請辨識圖片中的維修項目並翻譯為繁體中文 JSON。' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('HF API 回傳失敗:', response.status, errText);
      return NextResponse.json({ error: `AI 辨識服務回傳錯誤 (${response.status})，請稍後再試` }, { status: response.status });
    }

    const aiData = await response.json();
    const textResult = aiData.choices?.[0]?.message?.content || '';

    // 解析 JSON 陣列
    const jsonMatch = textResult.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsedItems = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ success: true, items: parsedItems });
    }

    return NextResponse.json({ error: '無法解析相片內容，請確定拍攝清晰再試一次' }, { status: 500 });
  } catch (err: any) {
    console.error('Hugging Face OCR 辨識失敗:', err);
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: '連線超時，請檢查網路連線或降低相片解析度後再試' }, { status: 504 });
    }
    return NextResponse.json({ error: `連線 failure: ${err.message || '請檢查後端網路與 Token 設定'}` }, { status: 500 });
  }
}