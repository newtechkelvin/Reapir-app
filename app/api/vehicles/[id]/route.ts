import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '缺少車輛 ID' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updatePayload: Record<string, any> = {};
    if (body.plate_number !== undefined) updatePayload.plate_number = body.plate_number.trim();
    if (body.vin !== undefined) updatePayload.vin = body.vin.trim();
    if (body.brand !== undefined) updatePayload.brand = body.brand.trim();
    if (body.model !== undefined) updatePayload.model = body.model.trim();
    if (body.project !== undefined) updatePayload.project = body.project.trim();
    if (body.garage_location !== undefined) updatePayload.garage_location = body.garage_location.trim();
    if (body.warranty_type !== undefined) updatePayload.warranty_type = body.warranty_type.trim();

    const { data, error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, vehicle: data });
  } catch (err: any) {
    console.error('更新車輛 API 錯誤:', err);
    return NextResponse.json({ error: err.message || '伺服器內部錯誤' }, { status: 500 });
  }
}
