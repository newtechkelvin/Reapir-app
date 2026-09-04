import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    let base64Image = '';
    let mimeType = 'image/jpeg';

    const contentType = request.headers.get('content-type') || '';

    // 支援直接上傳 File (formData) 或傳送已轉好 Base64/文字的 JSON
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
        // 處理 Base64 字串
        const matches = body.image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Image = matches[2];
        } else {
          base64Image = body.image;
        }
      } else if (body.text) {
        // 若只傳送純文字，改用文字對話 prompt 處理
        return handleTextTranslation(body.text);
      }
    }

    if (!base64Image) {
      return NextResponse.json({ error: '未接收到有效圖片資料' }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN || process.env.NEXT_PUBLIC_HF_TOKEN;

    if (!hfToken) {
      return NextResponse.json({
        warning: '未設定 HF_TOKEN，以下為測試範例資料',
        items: [
          { type: '更換零件', item_name: '更換前煞車皮', notes: '' },
          { type: '進廠維修', item_name: '檢查水箱漏水問題', notes: '' },
        ],
      });
    }

    // 呼叫 Hugging Face 視覺模型 (Qwen2-VL-7B-Instruct)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `你是一位精通香港汽車維修（EMSD工程）的專業助手。請讀取維修單圖片：
1. 提取所有維修與更換零件項目。
2. 100% 翻譯成「香港習慣使用的繁體中文」，嚴禁在 item_name 中留有英文單字（除 ABS, CCTV 等標準縮寫外）。
3. 備註 (notes) 欄位請保持空字串 ""，不要填寫英文原文。
4. 汽車術語對照：
   - OFF-SIDE / O/S ➔ 右側/駕駛側
   - NEAR-SIDE / N/S ➔ 左側/副駕側
   - BOTH-SIDE ➔ 雙側/左右兩邊
   - FRONT / REAR ➔ 前方 / 後方
   - RUBBER SEAL ➔ 門膠條/防水膠條
   - HINGE ➔ 鉸鏈/門鉸
   - GRILLE ➔ 車頭格柵/水箱護罩
   - TRACK ROD ➔ 轉向橫拉桿
   - DEFECT / MALFUNCTION ➔ 損壞/故障
5. 自動判定類別：[進廠維修, 更換零件, 現場處理, 外判處理, 收費項目, Recall項目]。
6. 請只回傳 JSON 陣列，格式如下：
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
    );

    const aiData = await response.json();
    const textResult = aiData.choices?.[0]?.message?.content || '';

    // 解析 JSON 陣列
    const jsonMatch = textResult.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsedItems = JSON.parse(jsonMatch[0]).map((item: any) => ({
        type: item.type || '進廠維修',
        item_name: String(item.item_name || '').trim(),
        notes: '', // 確保備註為空白
      }));
      return NextResponse.json({ success: true, items: parsedItems });
    }

    return NextResponse.json({ error: '無法解析相片內容，請確定拍攝清晰再試一次' }, { status: 500 });
  } catch (err: any) {
    console.error('Hugging Face OCR 辨識失敗:', err);
    return NextResponse.json({ error: err.message || '相片辨識失敗' }, { status: 500 });
  }
}

// 處理純文字備用邏輯
async function handleTextTranslation(text: string) {
  const hfToken = process.env.HF_TOKEN || process.env.NEXT_PUBLIC_HF_TOKEN;
  if (!hfToken) {
    return NextResponse.json({ error: '未設定 HF_TOKEN' }, { status: 400 });
  }

  const response = await fetch(
    'https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: '請將維修文字轉為繁體中文 JSON 陣列，格式如：[{"type":"進廠維修","item_name":"維修項目","notes":""}]，項目名稱嚴禁留有英文。',
          },
          { role: 'user', content: text },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    }
  );

  const aiData = await response.json();
  const textResult = aiData.choices?.[0]?.message?.content || '';
  const jsonMatch = textResult.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsedItems = JSON.parse(jsonMatch[0]).map((item: any) => ({
      ...item,
      notes: '',
    }));
    return NextResponse.json({ success: true, items: parsedItems });
  }
  return NextResponse.json({ error: '無法解析文字' }, { status: 500 });
}