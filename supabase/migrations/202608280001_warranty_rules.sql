-- Government contract warranty rule support.
-- Run this migration in the Supabase SQL editor before using the new settings fields.

alter table public.vehicles
  add column if not exists max_extension_months integer not null default 18;

update public.vehicles
set max_extension_months = greatest(coalesce(max_extension_count, 3), 0) * 6
where max_extension_months is null or max_extension_months = 18;

alter table public.vehicles
  drop constraint if exists vehicles_max_extension_months_check;

alter table public.vehicles
  add constraint vehicles_max_extension_months_check
  check (max_extension_months >= 0 and mod(max_extension_months, 6) = 0);

create unique index if not exists work_orders_order_number_unique_idx
  on public.work_orders (order_number)
  where order_number is not null;

create table if not exists public.project_warranty_settings (
  project text primary key,
  warranty_period_years integer not null default 3 check (warranty_period_years > 0),
  max_extension_months integer not null default 18 check (max_extension_months >= 0 and mod(max_extension_months, 6) = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_warranty_settings enable row level security;

-- The existing server-side admin client owns writes. Add read access for authenticated users if required by the deployment auth policy.
