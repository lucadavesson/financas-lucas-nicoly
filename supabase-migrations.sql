-- ═══════════════════════════════════════════════════════════
-- Finanças L&N — Tabelas extras para Configurações
-- Execute no SQL Editor do Supabase (supabase.com > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- Tabela: Limites por categoria
CREATE TABLE IF NOT EXISTS category_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  category text NOT NULL,
  limit_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, category)
);

-- RLS
ALTER TABLE category_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own limits" ON category_limits FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Tabela: Configurações do app (salário, preferências)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  salary_day integer DEFAULT 5,
  salary_lucas numeric(12,2) DEFAULT 0,
  salary_nicoly numeric(12,2) DEFAULT 0,
  savings_pct integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own settings" ON app_settings FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Garante que a coluna nature existe na transactions (caso não exista)
DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS nature text DEFAULT 'despesa';
EXCEPTION WHEN others THEN NULL;
END $$;
