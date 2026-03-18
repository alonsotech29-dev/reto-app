export interface Profile {
  id: string
  name: string
  age: number
  gender: 'male' | 'female'
  weight_kg: number
  height_cm: number
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  daily_calories: number
  challenge_start_date: string
  gym_days_per_week: number
  created_at: string
  updated_at: string
}

export interface DailyChecklist {
  id: string
  user_id: string
  date: string
  steps_done: boolean
  gym_done: boolean
  steps_count: number
  created_at: string
  updated_at: string
}

export interface FoodEntry {
  id: string
  user_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  image_url: string | null
  analysis_source: 'claude_ai' | 'fatsecret' | 'food_db' | 'manual'
  fatsecret_food_id?: string
  serving_description?: string
  serving_quantity?: number
  created_at: string
}

export interface FoodSearchResult {
  food_id: string
  food_name: string
  brand_name?: string
  food_description: string
}

export interface Serving {
  serving_id: string
  serving_description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  metric_serving_amount?: number
  metric_serving_unit?: string
}

export const MEAL_TYPE_LABELS = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
} as const

export const MEAL_TYPE_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
} as const
