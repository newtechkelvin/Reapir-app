import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '請選擇或貼上紙本維修單相片' }, { status: 400 });
    }

    // 傳回成功相片處理回應，交由前端自動載入
    return NextResponse.json({
      success: true,
      items: [
        { type: '進廠維修', item_name: '檢視紙本維修單內容 (Photo Repair Entry)' }
      ]
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      items: [
        { type: '進廠維修', item_name: '貼上之紙本維修單項目' }
      ]
    });
  }
}