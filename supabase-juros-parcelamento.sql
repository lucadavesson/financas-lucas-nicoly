-- Juros do parcelamento: guardado em cada parcela para aparecer depois em
-- Lançamentos, Parcelamentos e na edição. Seguro de rodar mais de uma vez.
-- ANTES DE RODAR: confira que o nome no topo do dashboard é "financas-lucas-nicoly".
alter table transactions add column if not exists installment_interest numeric(12,2) default 0;
