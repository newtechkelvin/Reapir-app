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

    // 將 Base64 轉換為位元組陣列 (Cloudflare Workers AI 要求格式)
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const imageArray = Array.from(imageBuffer);

    // 呼叫 Cloudflare Workers AI (Llama 3.2 Vision)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `你是一位精通香港汽車維修（EMSD工程）的專業助手。請讀取維修單圖片：
1. 提取所有維修與更換零件項目。
2. 100% 翻譯成「香港習慣使用的繁體中文」，嚴禁在 item_name 中留有英文單字（除 ABS, CCTV 等標準縮寫外）。
3. 備註 (notes) 欄位請保持空字串 ""。
4. 請只回傳 JSON 陣列，格式如下：
[
  {"type": "更換零件", "item_name": "更換引擎機油濾芯", "notes": ""},
  {"type": "進廠維修", "item_name": "維修右前門防水膠條損壞", "notes": ""}
]`,
          image: imageArray,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`Cloudflare AI 失敗 (${response.status}):`, errText);

      if (response.status === 403) {
        return NextResponse.json(
          { error: `Cloudflare API 權限不足 (403)，請確認 API Token 擁有 Workers AI Read/Edit 權限。詳情: ${errText}` },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `AI 視覺模型服務回應異常 (${response.status})` },
        { status: 502 }
      );
    }

    const aiData = await response.json();
    const textResult = aiData.result?.response || '';

    const jsonMatch = textResult.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsedItems = JSON.parse(jsonMatch[0]).map((item: any) => ({
        type: item.type || '進廠維修',
        item_name: String(item.item_name || '').trim(),
        notes: '',
      }));
      return NextResponse.json({ success: true, items: parsedItems });
    }

    return NextResponse.json({ error: '無法解析相片內容，請確定拍攝清晰再試一次' }, { status: 422 });
  } catch (err: any) {
    console.error('OCR 辨識失敗:', err);
    return NextResponse.json({ error: err.message || '相片辨識失敗' }, { status: 500 });
  }
}