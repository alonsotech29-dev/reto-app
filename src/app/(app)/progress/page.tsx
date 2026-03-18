import { createClient } from '@/lib/supabase/server'
import { getChallengeDay } from '@/lib/calories'
import ProgressClient from './ProgressClient'

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()

  const startDate = profile!.challenge_start_date
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 29)
  const endDateStr = endDate.toISOString().split('T')[0]

  const [{ data: checklists }, { data: foodEntries }] = await Promise.all([
    supabase.from('daily_checklist')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date'),
    supabase.from('food_entries')
      .select('date, calories')
      .eq('user_id', user!.id)
      .gte('date', startDate)
      .lte('date', endDateStr),
  ])

  return (
    <ProgressClient
      profile={profile!}
      checklists={checklists || []}
      foodEntries={foodEntries || []}
      challengeDay={getChallengeDay(startDate)}
    />
  )
}
