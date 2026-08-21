import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: '請提供有效的匯入紀錄陣列' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase 環境變數未設定' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let successCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < records.length; index++) {
      const rec = records[index];
      const plateNumber = (rec.plate_number || rec.plateNumber || rec['車牌號碼'] || rec['車牌'] || '').toString().trim();

      if (!plateNumber) {
        errors.push(`第 ${index + 1} 筆紀錄缺少車牌號碼，已略過`);
        continue;
      }

      // 1. 檢查並建立/更新車輛主表
      let { data: vehicle } = await supabase
        .from('vehicles')
        .select('*')
        .eq('plate_number', plateNumber)
        .maybeSingle();

      const vin = (rec.vin || rec['VIN'] || rec['車身號碼'] || '').toString().trim();
      const project = (rec.project || rec['專案'] || rec['專案名稱'] || '').toString().trim();
      const brand = (rec.brand || rec['品牌'] || '').toString().trim();
      const model = (rec.model || rec['型號'] || '').toString().trim();
      const garageLocation = (rec.garage_location || rec.location || rec['車房位置'] || '機電 - 九龍灣1/F').toString().trim();
      const vehicleLocation = (rec.vehicle_location || rec['車輛位置'] || '').toString().trim();
      const claimFormDate = rec.claim_form_date || rec.claimFormDate || rec['Claim Form 日期'] || rec['ClaimFormDate'] || null;
      const deliveryDate = rec.delivery_date || rec.deliveryDate || rec['交車日期'] || null;

      if (!vehicle) {
        const { data: newV, error: vErr } = await supabase
          .from('vehicles')
          .insert([{
            plate_number: plateNumber,
            vin,
            project,
            brand,
            model,
            garage_location: garageLocation,
            vehicle_location: vehicleLocation,
            claim_form_date: claimFormDate,
            delivery_date: deliveryDate,
          }])
          .select()
          .single();

        if (vErr) {
          errors.push(`車輛 [${plateNumber}] 建立失敗: ${vErr.message}`);
          continue;
        }
        vehicle = newV;
      }

      if (!vehicle) continue;

      // 2. 建立舊保固工單 (設為 Completed)
      const orderNumber = rec.order_number || rec.orderNumber || rec['工單編號'] || `WO-OLD-${Date.now().toString().slice(-4)}-${index + 1}`;
      const description = rec.description || rec['描述'] || rec['狀況描述'] || '舊 Warranty Form 批次匯入';
      const completedDate = rec.completed_date || rec.completedDate || rec['完工日期'] || claimFormDate || new Date().toISOString().split('T')[0];

      const { data: order, error: oErr } = await supabase
        .from('work_orders')
        .insert([{
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate_number,
          order_number: orderNumber,
          description,
          garage_location: garageLocation,
          vehicle_location: vehicleLocation,
          claim_form_date: claimFormDate,
          completed_date: completedDate,
          status: 'Completed',
          created_at: claimFormDate ? new Date(claimFormDate).toISOString() : new Date().toISOString()
        }])
        .select()
        .single();

      if (oErr) {
        errors.push(`工單 [${orderNumber}] 建立失敗: ${oErr.message}`);
        continue;
      }

      // 3. 自動相容拆解多行文字、換行符號 (\n, \r)、分號 (;) 與逗號 (,)
      const rawItems = rec.items || rec.items_str || rec['維修項目'] || rec['維修與零件項目'] || '';
      if (order && rawItems) {
        // 使用正規表達式自動拆解換行、分號與逗號
        const itemNames = rawItems
          .toString()
          .split(/\r\n|\n|\r|;|；|,|，/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        if (itemNames.length > 0) {
          const itemsToInsert = itemNames.map((name: string) => ({
            work_order_id: order.id,
            type: '進廠維修',
            item_name: name,
            is_completed: true,
            notes: '舊保固單批次自動匯入'
          }));
          await supabase.from('work_order_items').insert(itemsToInsert);
        }
      }

      successCount++;
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    console.error('批次匯入 API 失敗:', err);
    return NextResponse.json({ error: err.message || '批次匯入失敗' }, { status: 500 });
  }
}
