import { createClient } from '@/lib/supabase/server'
import { getTodayString } from '@/lib/utils'
import FoodClient from './FoodClient'

export default async function FoodPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const selectedDate = date && date <= getTodayString() ? date : getTodayString()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: foodEntries }] = await Promise.all([
    supabase.from('profiles').select('daily_calories, challenge_start_date').eq('id', user!.id).single(),
    supabase.from('food_entries').select('*').eq('user_id', user!.id).eq('date', selectedDate).order('created_at'),
  ])

  return (
    <FoodClient
      userId={user!.id}
      dailyCalories={profile!.daily_calories}
      foodEntries={foodEntries || []}
      challengeStartDate={profile!.challenge_start_date}
      initialDate={selectedDate}
    />
  )
}
