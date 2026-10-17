-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Memória de estabelecimentos
-- O app lembra, para cada estabelecimento da fatura, o NOME e a CATEGORIA que
-- você escolheu — na próxima fatura já vem tudo preenchido.
-- Execute no SQL Editor do projeto "financas-lucas-nicoly".
-- Só cria uma tabela nova; não altera nenhum dado existente.
-- ═══════════════════════════════════════════════════════════

create table if not exists estabelecimentos (
  id uuid default gen_random_uuid() primary key,
  chave text not null unique,          -- nome do banco, normalizado (ex.: "supermercados joanin")
  nome text not null,                  -- como você quer ver
  categoria text not null,
  subcategoria text,
  responsavel text,
  usos integer not null default 1,
  updated_at timestamptz default now()
);

alter table estabelecimentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'estabelecimentos'
      and policyname = 'All authenticated estabelecimentos'
  ) then
    create policy "All authenticated estabelecimentos" on estabelecimentos for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;
