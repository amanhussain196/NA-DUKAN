-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Table: product_tabs
create table public.product_tabs (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  sort_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table: products
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price numeric(10, 2) not null default 0,
  stock integer not null default 0,
  is_in_house boolean default false,
  tab_id uuid references public.product_tabs(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table: bills
create table public.bills (
  id uuid default uuid_generate_v4() primary key,
  subtotal numeric(10, 2) not null,
  discount_type text check (discount_type in ('none', 'flat', 'percentage')),
  discount_value numeric(10, 2) default 0,
  final_amount numeric(10, 2) not null,
  payment_mode text check (payment_mode in ('CASH', 'UPI', 'OTHER')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Table: bill_items
create table public.bill_items (
  id uuid default uuid_generate_v4() primary key,
  bill_id uuid references public.bills(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null,
  price numeric(10, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) but allow all access since there is no auth
alter table public.product_tabs enable row level security;
create policy "Allow all access" on public.product_tabs for all using (true) with check (true);

alter table public.products enable row level security;
create policy "Allow all access" on public.products for all using (true) with check (true);

alter table public.bills enable row level security;
create policy "Allow all access" on public.bills for all using (true) with check (true);

alter table public.bill_items enable row level security;
create policy "Allow all access" on public.bill_items for all using (true) with check (true);
