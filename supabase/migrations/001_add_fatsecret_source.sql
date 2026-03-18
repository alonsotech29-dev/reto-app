-- Add fatsecret as a valid analysis source
ALTER TABLE food_entries DROP CONSTRAINT IF EXISTS food_entries_analysis_source_check;
ALTER TABLE food_entries ADD CONSTRAINT food_entries_analysis_source_check
  CHECK (analysis_source IN ('claude_ai', 'food_db', 'fatsecret', 'manual'));

-- Add FatSecret tracking columns
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS fatsecret_food_id TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS serving_description TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS serving_quantity DECIMAL(4,1) DEFAULT 1;
