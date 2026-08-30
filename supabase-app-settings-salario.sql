-- Ciclo salarial: a tabela app_settings era chave/valor (id, owner_id, key, value)
-- e nunca teve as colunas que o app grava. Por isso salvar o salário falhava em
-- silêncio e a tela de Ciclo Salarial abria sempre vazia.
-- Já aplicado no Supabase.

alter table app_settings add column if not exists salary_day integer default 1;
alter table app_settings add column if not exists salary_lucas numeric default 0;
alter table app_settings add column if not exists salary_nicoly numeric default 0;
