-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Preferências de categorias e subcategorias
-- (esconder / excluir / ordem) — compartilhadas entre Lucas e Nicoly
-- Execute no SQL Editor do projeto "financas-lucas-nicoly"
-- ═══════════════════════════════════════════════════════════
--
-- kind = 'despesa' | 'receita'  → linha de uma CATEGORIA
-- kind = 'sub'                  → linha de uma SUBCATEGORIA (category = nome da categoria)
-- status: ativa (aparece nas listas) | escondida (some das listas, mas dá pra reativar)
--         | excluida (item de fábrica removido; fica em "Removidas" para restaurar)
-- ordem: posição escolhida (null = ordem original)

create table if not exists categoria_prefs (
  id uuid default gen_random_uuid() primary key,
  kind text not null check (kind in ('despesa','receita','sub')),
  category text not null,
  subcategory text not null default '',
  status text not null default 'ativa' check (status in ('ativa','escondida','excluida')),
  ordem integer,
  updated_at timestamptz default now(),
  unique (kind, category, subcategory)
);

alter table categoria_prefs enable row level security;
drop policy if exists "All authenticated categoria_prefs" on categoria_prefs;
create policy "All authenticated categoria_prefs" on categoria_prefs for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
