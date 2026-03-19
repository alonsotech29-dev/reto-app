import { createClient } from '@/lib/supabase/server'
import { getChallengeDay } from '@/lib/calories'
import { getTodayString } from '@/lib/utils'
import DashboardClient from './DashboardClient'

function calculateStreak(checklists: Array<{date: string, steps_done: boolean, gym_done: boolean}>): number {
  const today = getTodayString()
  let streak = 0
  const map = new Map(checklists.map(c => [c.date, c]))
  const d = new Date()
  // If today has no habit done yet, don't penalize - start from yesterday
  const todayEntry = map.get(today)
  if (!todayEntry || (!todayEntry.steps_done && !todayEntry.gym_done)) {
    d.setDate(d.getDate() - 1)
  }
  for (let i = 0; i < 31; i++) {
    const dateStr = d.toISOString().split('T')[0]
    const c = map.get(dateStr)
    if (!c || (!c.steps_done && !c.gym_done)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

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

  const { data: streakChecklists } = await supabase
    .from('daily_checklist')
    .select('date, steps_done, gym_done')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })
    .limit(31)

  const challengeDay = getChallengeDay(profile!.challenge_start_date)
  const totalCaloriesToday = (foodEntries || []).reduce((sum, e) => sum + e.calories, 0)
  const streak = calculateStreak(streakChecklists || [])

  return (
    <DashboardClient
      profile={profile!}
      checklist={checklist}
      foodEntries={foodEntries || []}
      challengeDay={challengeDay}
      totalCaloriesToday={totalCaloriesToday}
      weightLog={weightLog}
      initialDate={initialDate}
      streak={streak}
    />
  )
}
