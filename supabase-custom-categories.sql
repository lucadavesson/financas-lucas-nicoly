-- Categorias customizadas (compartilhadas entre Lucas e Nicoly)
-- Já aplicado no Supabase.

create table if not exists custom_categories (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) not null,
  name text not null,
  kind text not null default 'despesa',
  icon text,
  created_at timestamptz default now(),
  unique(name)
);

alter table custom_categories enable row level security;
drop policy if exists "All authenticated categories" on custom_categories;
create policy "All authenticated categories" on custom_categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
