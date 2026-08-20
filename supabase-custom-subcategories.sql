-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Subcategorias customizadas (compartilhadas)
-- Execute no SQL Editor do Supabase (projeto financas-lucas-nicoly)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS custom_subcategories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  category text NOT NULL,
  subcategory text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category, subcategory)
);

ALTER TABLE custom_subcategories ENABLE ROW LEVEL SECURITY;

-- Compartilhado: qualquer usuário autenticado vê e cria subcategorias
-- (mesmo racional das outras tabelas compartilhadas do casal)
DROP POLICY IF EXISTS "All authenticated subcategories" ON custom_subcategories;
CREATE POLICY "All authenticated subcategories" ON custom_subcategories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
