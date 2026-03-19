import { createClient } from '@/lib/supabase/server'
import { getChallengeDay } from '@/lib/calories'
import { getTodayString } from '@/lib/utils'
import DashboardClient from './DashboardClient'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { date } = await searchParams
  const initialDate = date || getTodayString()

  const [{ data: profile }, { data: checklist }, { data: foodEntries }, { data: weightLog }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('daily_checklist').select('*').eq('user_id', user!.id).eq('date', initialDate).single(),
    supabase.from('food_entries').select('*').eq('user_id', user!.id).eq('date', initialDate),
    supabase.from('weight_logs').select('*').eq('user_id', user!.id).eq('date', initialDate).single(),
  ])

  const challengeDay = getChallengeDay(profile!.challenge_start_date)
  const totalCaloriesToday = (foodEntries || []).reduce((sum, e) => sum + e.calories, 0)

  return (
    <DashboardClient
      profile={profile!}
      checklist={checklist}
      foodEntries={foodEntries || []}
      challengeDay={challengeDay}
      totalCaloriesToday={totalCaloriesToday}
      weightLog={weightLog}
      initialDate={initialDate}
    />
  )
}
