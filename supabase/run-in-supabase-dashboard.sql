-- =====================================================
-- EJECUTAR ESTE SQL EN: Supabase Dashboard → SQL Editor
-- =====================================================

-- MIGRACIÓN 1: Soporte para FatSecret en food_entries
-- (necesario para guardar metadata de FatSecret; las calorías ya se guardan sin esto)

ALTER TABLE food_entries DROP CONSTRAINT IF EXISTS food_entries_analysis_source_check;
ALTER TABLE food_entries ADD CONSTRAINT food_entries_analysis_source_check
  CHECK (analysis_source IN ('claude_ai', 'food_db', 'fatsecret', 'manual'));

ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS fatsecret_food_id TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS serving_description TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS serving_quantity DECIMAL(4,1) DEFAULT 1;

-- MIGRACIÓN 2: Tabla para registro de peso

CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own weight logs" ON weight_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own weight logs" ON weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own weight logs" ON weight_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own weight logs" ON weight_logs FOR DELETE USING (auth.uid() = user_id);
