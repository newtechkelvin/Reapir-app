import { NextRequest, NextResponse } from 'next/server';
import {
  extractRepairItemsFromOcrText,
  translateRepairItemToTraditionalChinese,
} from '@/lib/repairItemOcr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ error: '未能讀取 Claim Form 維修項目文字' }, { status: 400 });
    if (text.length > 30000) return NextResponse.json({ error: 'OCR 文字不可大於 30,000 個字元' }, { status: 413 });

    const sourceItems = extractRepairItemsFromOcrText(text);
    const items = sourceItems
      .map((sourceText) => ({
        type: '進廠維修',
        item_name: translateRepairItemToTraditionalChinese(sourceText),
        notes: sourceText,
      }))
      .filter((item) => item.item_name.length > 1);

    if (items.length === 0) {
      return NextResponse.json({ error: '未能辨識維修項目，請裁剪至項目明細或使用較清晰圖片' }, { status: 422 });
    }

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('Claim Form 維修項目 OCR 解析失敗:', error);
    return NextResponse.json({ error: error.message || 'Claim Form 維修項目解析失敗' }, { status: 422 });
  }
}
