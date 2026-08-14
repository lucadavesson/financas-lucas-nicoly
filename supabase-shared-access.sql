-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Acesso compartilhado para o casal
-- Execute APENAS se Nicoly não conseguir ver os dados do Lucas
-- ═══════════════════════════════════════════════════════════

-- Transactions: ambos veem tudo
DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;
DROP POLICY IF EXISTS "All authenticated" ON transactions;
CREATE POLICY "All authenticated" ON transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Cards: ambos veem tudo
DROP POLICY IF EXISTS "Users can manage own cards" ON cards;
DROP POLICY IF EXISTS "All authenticated cards" ON cards;
CREATE POLICY "All authenticated cards" ON cards FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Goals: ambos veem tudo
DROP POLICY IF EXISTS "Users can manage own goals" ON goals;
DROP POLICY IF EXISTS "All authenticated goals" ON goals;
CREATE POLICY "All authenticated goals" ON goals FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Category limits: cada um vê o seu (faz sentido individual)
-- App Settings: cada um vê o seu
