import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || '').trim();

    if (!text) {
      return NextResponse.json({ error: '未能接收到有效的 OCR 文字內容' }, { status: 400 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Vercel 未正確設定 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN' },
        { status: 401 }
      );
    }

    const systemPrompt = `你是一個只會輸出純 JSON 陣列的專業汽車維修翻譯 API。
任務：
請讀取輸入的英文維修單/Claim Form 文字，將裡面的每一個維修或更換項目進行分類與翻譯。

規範：
1. 100% 翻譯成香港習慣使用的繁體中文，嚴禁在 item_name 中保留英文單字（除 ABS, CCTV, LED 等標準縮寫外）。
   - OFF-SIDE / O/S ➔ 右側
   - NEAR-SIDE / N/S ➔ 左側
   - RUBBER SEAL ➔ 防水膠條
   - HINGE ➔ 門鉸/鉸鏈
   - GRILLE ➔ 車頭格柵/水箱護罩
   - TRACK ROD ➔ 轉向橫拉桿
2. 類別 (type) 只能從中選擇：[進廠維修, 更換零件, 現場處理, 外判處理, 收費項目, Recall項目]。
3. 備註 (notes) 統一保持空字串 ""。
4. 嚴禁輸出任何 Markdown 語法（如 \`\`\`json）、開場白或結語，只能直接輸出 JSON 陣列。

格式範例：
[{"type":"進廠維修","item_name":"維修右前門防水膠條損壞","notes":""},{"type":"更換零件","item_name":"更換轉向橫拉桿","notes":""}]`;

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
      const errText = await response.text().catch(() => '');
      console.error(`Cloudflare AI 失敗 (${response.status}):`, errText);
      return NextResponse.json(
        { error: `AI 翻譯服務回應異常 (${response.status})` },
        { status: 502 }
      );
    }

    const aiData = await response.json();
    const rawResult = aiData.result?.response || '';

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

    return NextResponse.json({ error: '未能將文字解析成維修項目，請確定圖片清晰並重試' }, { status: 422 });
  } catch (err: any) {
    console.error('維修項目翻譯失敗:', err);
    return NextResponse.json({ error: err.message || '維修項目翻譯失敗' }, { status: 500 });
  }
}