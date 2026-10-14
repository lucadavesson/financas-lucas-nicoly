-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Importação em massa: identifica o lote de cada lançamento
-- importado, para dar para DESFAZER uma importação inteira.
-- Execute no SQL Editor do projeto "financas-lucas-nicoly".
-- Não altera nenhum dado existente: só acrescenta uma coluna vazia.
-- ═══════════════════════════════════════════════════════════

alter table transactions add column if not exists import_batch text;

create index if not exists idx_transactions_import_batch
  on transactions (import_batch) where import_batch is not null;
