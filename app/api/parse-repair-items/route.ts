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

    // 強烈格式約束 Prompt
    const systemPrompt = `你是一個只會輸出純 JSON 的 API 系統。請讀取維修單/Claim Form圖片並提取所有維修項目。
規範：
1. 100% 翻譯成香港繁體中文，嚴禁保留英文單字（除 ABS, CCTV 等常見縮寫）。
2. 備註 (notes) 統一保持空字串 ""。
3. 嚴禁輸出任何 Markdown 語法（如 \`\`\`json）、開場白或結語，只能直接輸出 JSON 陣列。
格式範例：
[{"type":"進廠維修","item_name":"維修右前門防水膠條損壞","notes":""},{"type":"更換零件","item_name":"更換轉向橫拉桿","notes":""}]`;

    const userPrompt = "agree\n請辨識圖片中的維修項目，並嚴格按照範例回傳純 JSON 陣列。";

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          image: imageArray,
          max_tokens: 2048,
          temperature: 0.01,
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
    const rawResult = aiData.result?.response || aiData.result?.description || '';

    // 強力清洗文字，提取 JSON 陣列
    let cleanJsonStr = rawResult
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const jsonStartIndex = cleanJsonStr.indexOf('[');
    const jsonEndIndex = cleanJsonStr.lastIndexOf(']');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      cleanJsonStr = cleanJsonStr.substring(jsonStartIndex, jsonEndIndex + 1);

      try {
        const parsedItems = JSON.parse(cleanJsonStr).map((item: any) => ({
          type: item.type || '進廠維修',
          item_name: String(item.item_name || '').trim(),
          notes: '',
        })).filter((item: any) => item.item_name.length > 0);

        if (parsedItems.length > 0) {
          return NextResponse.json({ success: true, items: parsedItems });
        }
      } catch (e) {
        console.error('JSON 清洗解析失敗:', e, '原始文字:', rawResult);
      }
    }

    return NextResponse.json(
      { error: '圖片解析失敗，建議剪裁圖片只保留維修項目明細區域後再試一次。' },
      { status: 422 }
    );
  } catch (err: any) {
    console.error('OCR 辨識失敗:', err);
    return NextResponse.json({ error: err.message || '相片辨識失敗' }, { status: 500 });
  }
}