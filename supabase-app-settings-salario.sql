-- Ciclo salarial: a tabela app_settings era chave/valor (id, owner_id, key, value)
-- e nunca teve as colunas que o app grava. Por isso salvar o salário falhava em
-- silêncio e a tela de Ciclo Salarial abria sempre vazia.
-- Já aplicado no Supabase.

alter table app_settings add column if not exists salary_day integer default 1;
alter table app_settings add column if not exists salary_lucas numeric default 0;
alter table app_settings add column if not exists salary_nicoly numeric default 0;

-- A coluna legada `key` era NOT NULL e sem default, então o insert que o app
-- faz (só com owner_id e os campos de salário) era rejeitado e a linha nunca
-- chegava a existir. Um default resolve sem precisar mexer no schema legado.
alter table app_settings alter column key set default 'config';

-- Encerramento de conta recorrente sem perder histórico.
-- recurring_active = false para de gerar os próximos meses, mas o histórico
-- continua com is_recurring = true e segue classificado como recorrente.
-- Já aplicado no Supabase.
alter table transactions add column if not exists recurring_active boolean default true;
