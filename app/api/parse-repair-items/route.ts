import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Vercel 未正確設定 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // 處理圖片 Form-Data 請求
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('image')) as File;

      if (!file) {
        return NextResponse.json({ error: '請選擇或拍攝紙本維修單相片' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const imageArray = Array.from(new Uint8Array(bytes));

      const systemPrompt = `你是一個只會輸出純 JSON 陣列的 API 系統。請讀取這張維修單/Claim Form圖片並提取所有維修項目。
規範：
1. 100% 翻譯成香港繁體中文，嚴禁保留英文單字（除 ABS, CCTV 等常見縮寫）。
2. 備註 (notes) 統一保持空字串 ""。
3. 嚴禁輸出任何 Markdown 語法（如 \`\`\`json）、開場白或結語，只能直接輸出 JSON 陣列。
格式範例：
[{"type":"進廠維修","item_name":"維修右前門防水膠條損壞","notes":""},{"type":"更換零件","item_name":"更換轉向橫拉桿","notes":""}]`;

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
              { role: 'user', content: "agree\n請辨識圖片中的維修項目，並回傳純 JSON 陣列。" }
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

      return NextResponse.json({ error: '圖片解析失敗，建議剪裁圖片只保留維修項目明細區域後再試一次。' }, { status: 422 });
    }

    // 處理純文字 JSON 請求
    const body = await request.json();
    const text = String(body?.text || '').trim();

    if (!text) {
      return NextResponse.json({ error: '未接收到有效內容' }, { status: 400 });
    }

    const systemPrompt = `你是一個只會輸出純 JSON 陣列的專業汽車維修翻譯 API。
規範：
1. 100% 翻譯成香港繁體中文，嚴禁保留英文單字（除 ABS, CCTV 等縮寫）。
2. 備註 (notes) 統一保持空字串 ""。
3. 嚴禁輸出任何 Markdown 語法，只能直接輸出 JSON 陣列。
格式範例：
[{"type":"進廠維修","item_name":"維修右前門防水膠條損壞","notes":""}]`;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          max_tokens: 2048,
          temperature: 0.01,
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'AI 服務回應異常' }, { status: 502 });
    }

    const aiData = await response.json();
    const rawResult = aiData.result?.response || '';

    let cleanJsonStr = rawResult.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonStartIndex = cleanJsonStr.indexOf('[');
    const jsonEndIndex = cleanJsonStr.lastIndexOf(']');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      cleanJsonStr = cleanJsonStr.substring(jsonStartIndex, jsonEndIndex + 1);
      const parsedItems = JSON.parse(cleanJsonStr).map((item: any) => ({
        type: item.type || '進廠維修',
        item_name: String(item.item_name || '').trim(),
        notes: '',
      })).filter((item: any) => item.item_name.length > 0);

      if (parsedItems.length > 0) {
        return NextResponse.json({ success: true, items: parsedItems });
      }
    }

    return NextResponse.json({ error: '解析失敗' }, { status: 422 });
  } catch (err: any) {
    console.error('維修項目處理失敗:', err);
    return NextResponse.json({ error: err.message || '處理失敗' }, { status: 500 });
  }
}