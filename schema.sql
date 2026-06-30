-- =============================================
-- SISTEMA FINANCEIRO LUCAS & NICOLY — Schema
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. CARTÕES
create table if not exists cards (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  bank text not null,
  holder text not null, -- Lucas, Nicoly
  card_type text not null default 'credito', -- credito, debito, conta
  closing_day integer, -- dia fechamento fatura
  due_day integer, -- dia vencimento
  credit_limit numeric(12,2) default 0,
  alert_pct integer default 80,
  color text default '#1D9E75',
  linked_account text, -- conta bancária vinculada
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. TRANSAÇÕES
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  -- Responsável pelo gasto
  holder text not null, -- Lucas, Nicoly, Prata
  -- Tipo principal
  transaction_type text not null, -- parcelada, avista, recorrente, receita
  -- Dados base
  description text not null,
  amount numeric(12,2) not null, -- valor total
  category text not null,
  subcategory text,
  nature text default 'Variavel', -- Fixo, Variavel
  -- Datas
  purchase_date date not null,
  -- Pagamento
  payment_method text, -- cartao_credito, debito, pix, boleto, dinheiro, debito_automatico
  card_id uuid references cards(id),
  card_name text, -- nome do cartão para referência
  billing_month date, -- fatura calculada automaticamente
  -- Status
  status text default 'pendente', -- pendente, pago, previsto, atrasado, cancelado
  paid_date date,
  paid_amount numeric(12,2),
  -- Parcelamento (para type = parcelada)
  installment_total integer, -- total de parcelas (ex: 12)
  installment_value numeric(12,2), -- valor de cada parcela
  installment_interest numeric(12,2) default 0, -- juros total implícito
  -- Entrada (quando tem entrada + parcelas)
  has_entry boolean default false,
  entry_amount numeric(12,2),
  entry_payment_method text,
  entry_card_name text,
  entry_paid boolean default false,
  -- Recorrência
  is_recurring boolean default false,
  recurring_day integer, -- dia do mês que vence/recebe
  -- Receita
  expected_amount numeric(12,2), -- valor previsto (para receitas recorrentes)
  received_account text, -- onde recebeu
  -- Metadados
  notes text,
  goal_id uuid, -- vínculo com meta
  created_at timestamptz default now()
);

-- 3. METAS
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  holder text not null, -- Lucas, Nicoly, Casal
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  monthly_target numeric(12,2),
  deadline date,
  icon text default 'target',
  color text default '#1D9E75',
  category_link text, -- categoria vinculada
  status text default 'ativa',
  created_at timestamptz default now()
);

-- 4. CONFIGURAÇÕES DO APP
create table if not exists app_settings (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz default now(),
  unique(owner_id, key)
);

-- 5. LIMITES POR CATEGORIA
create table if not exists category_limits (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  category text not null,
  holder text default 'Casal', -- Lucas, Nicoly, Casal
  monthly_limit numeric(12,2) not null,
  alert_pct integer default 80,
  created_at timestamptz default now(),
  unique(owner_id, category, holder)
);

-- =============================================
-- RLS — Qualquer usuário autenticado acessa tudo
-- (seguro porque só Lucas e Nicoly têm login)
-- =============================================
alter table cards enable row level security;
alter table transactions enable row level security;
alter table goals enable row level security;
alter table app_settings enable row level security;
alter table category_limits enable row level security;

create policy "acesso_casal_cards" on cards for all to authenticated using (true) with check (true);
create policy "acesso_casal_transactions" on transactions for all to authenticated using (true) with check (true);
create policy "acesso_casal_goals" on goals for all to authenticated using (true) with check (true);
create policy "acesso_casal_settings" on app_settings for all to authenticated using (true) with check (true);
create policy "acesso_casal_limits" on category_limits for all to authenticated using (true) with check (true);

-- =============================================
-- CARTÕES PADRÃO
-- =============================================
insert into cards (owner_id, name, bank, holder, card_type, closing_day, due_day, credit_limit, color)
select 
  (select id from auth.users limit 1),
  name, bank, holder, 'credito', closing_day, due_day, credit_limit, color
from (values
  ('Nubank',        'Nubank',        'Lucas',  2,  9,  5000, '#7F77DD'),
  ('Nubank',        'Nubank',        'Nicoly', 9,  16, 3000, '#7F77DD'),
  ('Santander',     'Santander',     'Lucas',  13, 20, 8000, '#E24B4A'),
  ('Santander',     'Santander',     'Nicoly', 13, 20, 5000, '#E24B4A'),
  ('Banco do Brasil','Banco do Brasil','Lucas', 1,  10, 6000, '#378ADD'),
  ('Banco do Brasil','Banco do Brasil','Nicoly',1,  10, 3000, '#378ADD'),
  ('C6 Bank',       'C6 Bank',       'Lucas',  5,  12, 4000, '#1C1C1E'),
  ('C6 Bank',       'C6 Bank',       'Nicoly', 5,  12, 2000, '#1C1C1E'),
  ('Bradesco',      'Bradesco',      'Lucas',  18, 25, 7000, '#E24B4A'),
  ('Bradesco',      'Bradesco',      'Nicoly', 18, 25, 4000, '#E24B4A'),
  ('Mercado Pago',  'Mercado Pago',  'Lucas',  1,  7,  2000, '#378ADD'),
  ('Mercado Pago',  'Mercado Pago',  'Nicoly', 1,  7,  2000, '#378ADD'),
  ('Caixa',         'Caixa',         'Lucas',  5,  15, 3000, '#1D9E75'),
  ('Caixa',         'Caixa',         'Nicoly', 5,  15, 3000, '#1D9E75')
) as t(name, bank, holder, closing_day, due_day, credit_limit, color)
where not exists (select 1 from cards limit 1);
