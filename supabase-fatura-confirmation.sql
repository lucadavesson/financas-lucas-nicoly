-- Confirmação de fechamento de fatura de cartão
-- Rodar manualmente no SQL Editor do Supabase (projeto financas-lucas-nicoly)

alter table cards add column if not exists last_confirmed_billing_month date;
alter table cards add column if not exists last_confirmed_total numeric;

comment on column cards.last_confirmed_billing_month is 'Mês (yyyy-mm-01) do último ciclo de fatura que o usuário confirmou o fechamento';
comment on column cards.last_confirmed_total is 'Valor real informado pelo usuário ao confirmar o fechamento da fatura (pode diferir do calculado pelo app, se algum lançamento não foi registrado)';
