import { createClient } from '@/lib/supabase/server'
import { getChallengeDay } from '@/lib/calories'
import { getTodayString } from '@/lib/utils'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: checklist }, { data: foodEntries }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('daily_checklist').select('*').eq('user_id', user!.id).eq('date', getTodayString()).single(),
    supabase.from('food_entries').select('*').eq('user_id', user!.id).eq('date', getTodayString()),
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
    />
  )
}
