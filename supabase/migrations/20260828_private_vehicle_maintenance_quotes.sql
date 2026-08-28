-- 散車保養期及工單報價確認欄位
-- 這份 migration 需在 Supabase SQL Editor 執行一次。

alter table public.vehicles
  add column if not exists maintenance_start_date date,
  add column if not exists maintenance_expiry_date date,
  add column if not exists maintenance_period_source text;

alter table public.work_orders
  add column if not exists quote_status text not null default 'not_required',
  add column if not exists quote_reference text,
  add column if not exists oral_quote_confirmed boolean not null default false,
  add column if not exists quote_confirmed_at timestamptz,
  add column if not exists quote_confirmed_by text;

alter table public.work_orders
  drop constraint if exists work_orders_quote_status_check;

alter table public.work_orders
  add constraint work_orders_quote_status_check
  check (quote_status in ('not_required', 'pending', 'confirmed'));

create index if not exists vehicles_maintenance_expiry_date_idx
  on public.vehicles (maintenance_expiry_date);

create index if not exists work_orders_quote_status_idx
  on public.work_orders (quote_status);

-- 將現有散車的舊日期欄位映射至新的保養期欄位；只填入空白欄位。
update public.vehicles
set maintenance_start_date = coalesce(maintenance_start_date, delivery_date),
    maintenance_expiry_date = coalesce(maintenance_expiry_date, warranty_expiry_date),
    maintenance_period_source = coalesce(maintenance_period_source, 'legacy_vehicle_dates')
where lower(coalesce(warranty_type, '')) in ('general', '散車', '散車保固');
