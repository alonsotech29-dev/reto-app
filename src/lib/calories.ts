export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Gender = 'male' | 'female'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // Little or no exercise
  light: 1.375,        // Light exercise 1-3 days/week
  moderate: 1.55,      // Moderate exercise 3-5 days/week
  active: 1.725,       // Hard exercise 6-7 days/week
  very_active: 1.9,    // Very hard exercise + physical job
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario (poco o ningún ejercicio)',
  light: 'Ligero (ejercicio 1-3 días/semana)',
  moderate: 'Moderado (ejercicio 3-5 días/semana)',
  active: 'Activo (ejercicio 6-7 días/semana)',
  very_active: 'Muy activo (ejercicio intenso + trabajo físico)',
}

export function calculateDailyCalories(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
  activityLevel: ActivityLevel
): number {
  // Mifflin-St Jeor equation (most accurate)
  let bmr: number
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel]

  // For fat loss: deficit of 500 kcal/day (safe, ~0.5kg/week)
  const targetCalories = Math.round(tdee - 500)

  // Minimum safe calories
  const minCalories = gender === 'male' ? 1500 : 1200
  return Math.max(targetCalories, minCalories)
}

export function getChallengeDay(startDate: string): number {
  const start = new Date(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(Math.max(diff + 1, 1), 30)
}

export function isChallengeActive(startDate: string): boolean {
  const day = getChallengeDay(startDate)
  return day >= 1 && day <= 30
}
