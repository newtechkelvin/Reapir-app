import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    let base64Image = '';
    let mimeType = 'image/jpeg';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('image')) as File;

      if (!file) {
        return NextResponse.json({ error: '請選擇或拍攝紙本維修單相片' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      base64Image = buffer.toString('base64');
      mimeType = file.type || 'image/jpeg';
    } else {
      const body = await request.json();
      if (body.image) {
        const matches = body.image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Image = matches[2];
        } else {
          base64Image = body.image;
        }
      }
    }

    if (!base64Image) {
      return NextResponse.json({ error: '未接收到有效圖片資料' }, { status: 400 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Vercel 未正確設定 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN' },
        { status: 401 }
      );
    }

    const imageBuffer = Buffer.from(base64Image, 'base64');
    const imageArray = Array.from(imageBuffer);

    // 強化 Prompt：要求嚴格 JSON 格式
    const promptText = `agree

請讀取這張車輛維修單/Claim Form圖片，並將裡面的維修與更換零件項目提取並翻譯成繁體中文。

【嚴格輸出格式規律】：
1. 必須 100% 翻譯為繁體中文，禁止保留英文單字（除 ABS, CCTV 等常見縮寫）。
2. 備註 (notes) 統一設為 ""。
3. 直接輸出標準 JSON 陣列，不要加入任何引言或多餘解釋。格式範例：
[
  {"type": "進廠維修", "item_name": "維修右前門防水膠條損壞", "notes": ""},
  {"type": "更換零件", "item_name": "更換轉向橫拉桿", "notes": ""}
]`;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptText,
          image: imageArray,
          max_tokens: 1500,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`Cloudflare AI 失敗 (${response.status}):`, errText);
      return NextResponse.json(
        { error: `AI 視覺模型服務回應異常 (${response.status})` },
        { status: 502 }
      );
    }

    const aiData = await response.json();
    const textResult = aiData.result?.response || '';

    // 寬鬆抓取 JSON 陣列 (涵蓋以 ```json ... ``` 包裹的情況)
    const cleanText = textResult.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        const parsedItems = JSON.parse(jsonMatch[0]).map((item: any) => ({
          type: item.type || '進廠維修',
          item_name: String(item.item_name || '').trim(),
          notes: '',
        }));
        if (parsedItems.length > 0) {
          return NextResponse.json({ success: true, items: parsedItems });
        }
      } catch (e) {
        console.error('JSON 解析失敗:', e);
      }
    }

    return NextResponse.json({ error: '無法解析相片內容，請確定拍攝清晰或裁剪至項目明細區域後再試一次' }, { status: 422 });
  } catch (err: any) {
    console.error('OCR 辨識失敗:', err);
    return NextResponse.json({ error: err.message || '相片辨識失敗' }, { status: 500 });
  }
}