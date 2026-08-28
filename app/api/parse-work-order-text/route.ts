import { NextRequest, NextResponse } from 'next/server';
import { parseWhatsAppWorkOrder } from '@/lib/whatsappParser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ error: '請貼上 WhatsApp 報修訊息' }, { status: 400 });
    if (text.length > 30000) return NextResponse.json({ error: '訊息不可大於 30,000 個字元' }, { status: 413 });

    const parsed = parseWhatsAppWorkOrder(text);
    if (!parsed.vehicle.plate_number && !parsed.vehicle.vin && parsed.items.length === 0) {
      return NextResponse.json({ error: '未能辨識車牌、VIN 或維修項目，請檢查訊息格式' }, { status: 422 });
    }
    return NextResponse.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('WhatsApp 文字解析失敗:', error);
    return NextResponse.json({ error: error.message || 'WhatsApp 訊息解析失敗' }, { status: 422 });
  }
}
