import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ vehicles: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '無法取得車輛資料' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plate_number, vin, project, brand, model, location, claim_form_date, delivery_date, warranty_expiry_date } = body;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('vehicles')
      .insert([{ plate_number, vin, project, brand, model, location, claim_form_date, delivery_date, warranty_expiry_date }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, vehicle: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '新增車輛失敗' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, plate_number, vin, project, brand, model, location, claim_form_date, delivery_date, warranty_expiry_date } = body;

    if (!id) return NextResponse.json({ error: '缺少車輛 ID' }, { status: 400 });

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ message: 'Supabase 環境變數未設定' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('vehicles')
      .update({ plate_number, vin, project, brand, model, location, claim_form_date, delivery_date, warranty_expiry_date })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, vehicle: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '更新車輛失敗' }, { status: 500 });
  }
}