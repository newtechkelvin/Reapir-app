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

    const hfToken = process.env.HF_TOKEN || process.env.NEXT_PUBLIC_HF_TOKEN;

    if (!hfToken) {
      return NextResponse.json(
        { error: 'Vercel 環境變數未設定 HF_TOKEN，請填寫有效的 Hugging Face Access Token' },
        { status: 401 }
      );
    }

    // 呼叫 Hugging Face Qwen2-VL 視覺模型
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `你是一位精通香港汽車維修（EMSD工程）的專業助手。請讀取維修單圖片：
1. 提取所有維修與更換零件項目。
2. 100% 翻譯成「香港習慣使用的繁體中文」，嚴禁在 item_name 中留有英文單字（除 ABS, CCTV 等標準縮寫外）。
3. 備註 (notes) 欄位請保持空字串 ""。
4. 請只回傳 JSON 陣列，格式如下：
[
  {"type": "更換零件", "item_name": "更換引擎機油濾芯", "notes": ""},
  {"type": "進廠維修", "item_name": "維修右前門防水膠條損壞", "notes": ""}
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
          max_tokens: 1000,
          temperature: 0.1,
        }),
      }
    ).catch((err) => {
      console.error('Fetch 至 Hugging Face 網路連線失敗:', err);
      return null;
    });

    if (!hfResponse) {
      return NextResponse.json(
        { error: '無法連線至 Hugging Face 模型伺服器，請檢查網路狀態或重試' },
        { status: 502 }
      );
    }

    if (!hfResponse.ok) {
      const errText = await hfResponse.text().catch(() => '');
      console.error(`Hugging Face API 回傳錯誤 (${hfResponse.status}):`, errText);

      if (hfResponse.status === 401) {
        return NextResponse.json(
          { error: 'Hugging Face Token 驗證失敗 (401)，請檢查 Vercel 的 HF_TOKEN 是否正確' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `Hugging Face 模型伺服器回應異常 (${hfResponse.status})` },
        { status: 502 }
      );
    }

    const aiData = await hfResponse.json();
    const textResult = aiData.choices?.[0]?.message?.content || '';

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
    console.error('Hugging Face OCR 辨識失敗:', err);
    return NextResponse.json({ error: err.message || '相片辨識失敗' }, { status: 500 });
  }
}