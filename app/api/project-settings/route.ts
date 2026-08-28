import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function validateSetting(body: any) {
  const project = String(body.project || '').trim();
  const warrantyPeriodYears = Number(body.warranty_period_years);
  const maxExtensionMonths = Number(body.max_extension_months);
  if (!project) throw new Error('專案名稱不可為空');
  if (!Number.isInteger(warrantyPeriodYears) || warrantyPeriodYears < 1 || warrantyPeriodYears > 20) {
    throw new Error('保固年限必須是 1 至 20 的整數');
  }
  if (!Number.isInteger(maxExtensionMonths) || maxExtensionMonths < 0 || maxExtensionMonths % 6 !== 0) {
    throw new Error('總展延月數必須是 0 或 6 的倍數');
  }
  return { project, warranty_period_years: warrantyPeriodYears, max_extension_months: maxExtensionMonths };
}

export async function GET() {
  try {
    const [{ data: settings, error: settingsError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
      supabaseAdmin.from('project_warranty_settings').select('*').order('project'),
      supabaseAdmin.from('vehicles').select('project,warranty_period_years,max_extension_months').not('project', 'is', null),
    ]);
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 400 });
    if (vehiclesError) return NextResponse.json({ error: vehiclesError.message }, { status: 400 });

    const map = new Map<string, any>();
    for (const setting of settings || []) map.set(setting.project, setting);
    for (const vehicle of vehicles || []) {
      const project = String(vehicle.project || '').trim();
      if (!project || map.has(project)) continue;
      map.set(project, {
        project,
        warranty_period_years: Number(vehicle.warranty_period_years) || 3,
        max_extension_months: Number(vehicle.max_extension_months) || 18,
        source: 'vehicle_fallback',
      });
    }
    return NextResponse.json({ settings: Array.from(map.values()) });
  } catch (error: any) {
    console.error('讀取專案保固設定失敗:', error);
    return NextResponse.json({ error: error.message || '讀取專案設定失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = validateSetting(await request.json());
    const { data, error } = await supabaseAdmin
      .from('project_warranty_settings')
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'project' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, setting: data });
  } catch (error: any) {
    console.error('儲存專案保固設定失敗:', error);
    return NextResponse.json({ error: error.message || '儲存專案設定失敗' }, { status: 400 });
  }
}
