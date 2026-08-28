import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local'), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase admin environment variables are missing');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: vehicles, error: findError } = await supabase
  .from('vehicles')
  .select('id, plate_number, vin, extension_count, extension_months, warranty_expiry_date')
  .eq('plate_number', 'AM7633');
if (findError) throw findError;
if (!vehicles || vehicles.length !== 1) throw new Error(`Expected exactly one AM7633, found ${vehicles?.length || 0}`);
const vehicle = vehicles[0];
const update = { extension_count: 3, extension_months: 18, warranty_expiry_date: '2027-01-28' };
const { data, error } = await supabase.from('vehicles').update(update).eq('id', vehicle.id).select('id, plate_number, vin, extension_count, extension_months, warranty_expiry_date');
if (error) throw error;
console.log(JSON.stringify({ before: vehicle, update, after: data?.[0] }, null, 2));
if (data?.[0]?.extension_months !== 18 || data?.[0]?.warranty_expiry_date !== '2027-01-28') throw new Error('AM7633 update verification failed');
console.log('PASS');
