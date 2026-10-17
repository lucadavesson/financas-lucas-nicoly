-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Cartão físico de cada compra (principal e adicionais)
-- Guarda os 4 últimos dígitos do cartão físico (ex.: 4690), para a tela de
-- Cartões mostrar quanto foi em cada cartão do mesmo titular.
-- Execute no SQL Editor do projeto "financas-lucas-nicoly".
-- Só acrescenta uma coluna vazia; não altera nenhum dado existente.
-- ═══════════════════════════════════════════════════════════
alter table transactions add column if not exists card_final text;
