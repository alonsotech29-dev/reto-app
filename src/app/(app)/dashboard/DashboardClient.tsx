'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getTodayString, formatDate } from '@/lib/utils'
import { getChallengeDay } from '@/lib/calories'
import { Profile, DailyChecklist, FoodEntry, WeightLog, MEAL_TYPE_LABELS, MEAL_TYPE_ICONS } from '@/types/database'
import CalorieChart from '@/components/CalorieChart'
import DatePickerCalendar from '@/components/DatePickerCalendar'
import {
  Flame, Footprints, Dumbbell, Plus, CheckCircle2, Circle,
  ChevronRight, Trophy, Zap, Loader2, Scale
} from 'lucide-react'

interface Props {
  profile: Profile
  checklist: DailyChecklist | null
  foodEntries: FoodEntry[]
  challengeDay: number
  totalCaloriesToday: number
  weightLog: WeightLog | null
  initialDate?: string
  streak: number
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const }
  })
}

export default function DashboardClient({ profile, checklist, foodEntries, challengeDay, weightLog, initialDate, streak }: Props) {
  const router = useRouter()

  const today = getTodayString()
  const [selectedDate, setSelectedDate] = useState(initialDate || today)
  const [localChecklist, setLocalChecklist] = useState(checklist)
  const [localFoodEntries, setLocalFoodEntries] = useState<FoodEntry[]>(foodEntries)
  const [loadingDate, setLoadingDate] = useState(false)
  const [savingSteps, setSavingSteps] = useState(false)
  const [savingGym, setSavingGym] = useState(false)
  const [stepsInput, setStepsInput] = useState(String(checklist?.steps_count || ''))
  const [localWeightLog, setLocalWeightLog] = useState(weightLog)
  const [weightInput, setWeightInput] = useState(String(weightLog?.weight_kg || ''))
  const [savingWeight, setSavingWeight] = useState(false)

  const isToday = selectedDate === today

  const selectedChallengeDay = useMemo(() => {
    const start = new Date(profile.challenge_start_date)
    const date = new Date(selectedDate + 'T00:00:00')
    start.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return Math.min(Math.max(diff, 1), 30)
  }, [selectedDate, profile.challenge_start_date])

  const getDateLabel = (dateStr: string) => {
    if (dateStr === today) return 'Hoy'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === formatDate(yesterday)) return 'Ayer'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
  }

  const loadDate = async (newDateStr: string) => {
    if (newDateStr > today) return
    setSelectedDate(newDateStr)
    setLoadingDate(true)
    const supabase = createClient()
    const [{ data: cl }, { data: fe }, { data: wl }] = await Promise.all([
      supabase.from('daily_checklist').select('*').eq('user_id', profile.id).eq('date', newDateStr).single(),
      supabase.from('food_entries').select('*').eq('user_id', profile.id).eq('date', newDateStr).order('created_at'),
      supabase.from('weight_logs').select('*').eq('user_id', profile.id).eq('date', newDateStr).single(),
    ])
    setLocalChecklist(cl || null)
    setLocalFoodEntries(fe || [])
    setStepsInput(String(cl?.steps_count || ''))
    setLocalWeightLog(wl || null)
    setWeightInput(String(wl?.weight_kg || ''))
    setLoadingDate(false)
  }

  const totalCalories = localFoodEntries.reduce((s, e) => s + e.calories, 0)
  const totalProtein = localFoodEntries.reduce((s, e) => s + (e.protein_g || 0), 0)
  const totalCarbs = localFoodEntries.reduce((s, e) => s + (e.carbs_g || 0), 0)
  const totalFat = localFoodEntries.reduce((s, e) => s + (e.fat_g || 0), 0)
  const caloriesRemaining = profile.daily_calories - totalCalories
  const progressPercent = Math.round((challengeDay / 30) * 100)

  const upsertChecklist = async (updates: Partial<DailyChecklist>) => {
    const supabase = createClient()
    const current = localChecklist || { steps_done: false, gym_done: false, steps_count: 0 }
    const newData = { ...current, ...updates, user_id: profile.id, date: selectedDate }

    const { data } = await supabase
      .from('daily_checklist')
      .upsert(newData, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (data) setLocalChecklist(data)
    if (isToday) router.refresh()
  }

  const toggleSteps = async () => {
    setSavingSteps(true)
    await upsertChecklist({ steps_done: !localChecklist?.steps_done })
    setSavingSteps(false)
  }

  const toggleGym = async () => {
    setSavingGym(true)
    await upsertChecklist({ gym_done: !localChecklist?.gym_done })
    setSavingGym(false)
  }

  const saveSteps = async () => {
    const count = parseInt(stepsInput) || 0
    await upsertChecklist({ steps_count: count, steps_done: count >= 10000 })
  }

  const saveWeight = async () => {
    const weight = parseFloat(weightInput)
    if (!weight || weight <= 0) return
    setSavingWeight(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: profile.id, date: selectedDate, weight_kg: weight },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()
    if (data) setLocalWeightLog(data)
    if (isToday) router.refresh()
    setSavingWeight(false)
  }

  const groupedMeals = localFoodEntries.reduce((acc, entry) => {
    if (!acc[entry.meal_type]) acc[entry.meal_type] = []
    acc[entry.meal_type].push(entry)
    return acc
  }, {} as Record<string, FoodEntry[]>)

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-5">
        <div>
          <p className="text-muted text-sm capitalize">{getDateLabel(selectedDate)}</p>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground tracking-tight">
            {isToday ? `Hola, ${profile.name.split(' ')[0]}` : `Día ${selectedChallengeDay}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-2 bg-accent-orange/10 border border-accent-orange/20 rounded-2xl px-3 py-2">
              <Flame className="w-4 h-4 text-accent-orange" />
              <div className="text-center">
                <span className="text-lg font-bold font-heading text-accent-orange">{streak}</span>
                <span className="text-xs text-muted ml-0.5">racha</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 bg-accent-orange/10 border border-accent-orange/20 rounded-2xl px-4 py-2.5">
            <Flame className="w-5 h-5 text-accent-orange" />
            <div className="text-center">
              <span className="text-xl font-bold font-heading text-accent-orange">{challengeDay}</span>
              <span className="text-xs text-muted ml-0.5">/ 30</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Date navigator */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 mb-5">
        <div className="flex-1 min-w-0">
          {loadingDate ? (
            <Loader2 className="w-4 h-4 text-lime animate-spin" />
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground capitalize">{getDateLabel(selectedDate)}</p>
              <p className="text-xs text-muted-dark">Día {selectedChallengeDay} del reto</p>
            </>
          )}
        </div>
        <DatePickerCalendar value={selectedDate} onChange={loadDate} align="down" />
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

        {/* Left column */}
        <div className="space-y-4">

          {/* Challenge progress bar */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted">Progreso del reto</span>
              <span className="text-sm font-bold font-heading text-lime">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-lime to-lime-dark rounded-full"
                initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: [0, 0, 0.2, 1] }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-muted-dark">Día {challengeDay}</span>
              <span className="text-xs text-muted-dark">{30 - challengeDay} días restantes</span>
            </div>
          </motion.div>

          {/* Calorie ring + macros */}
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-semibold font-heading text-foreground">Calorías {isToday ? 'de hoy' : 'del día'}</h2>
                <p className="text-sm text-muted">{totalCalories} de {profile.daily_calories} kcal</p>
              </div>
              <div className={`text-right ${caloriesRemaining >= 0 ? 'text-success' : 'text-danger'}`}>
                <p className="text-2xl font-bold font-heading">{Math.abs(caloriesRemaining)}</p>
                <p className="text-xs">{caloriesRemaining >= 0 ? 'restantes' : 'excedidas'}</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <CalorieChart consumed={totalCalories} target={profile.daily_calories} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Proteína', value: Math.round(totalProtein), color: 'text-accent-cyan', bg: 'bg-accent-cyan', max: 150 },
                { label: 'Carbos', value: Math.round(totalCarbs), color: 'text-accent-orange', bg: 'bg-accent-orange', max: 250 },
                { label: 'Grasa', value: Math.round(totalFat), color: 'text-warning', bg: 'bg-warning', max: 80 },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={m.color}>{m.label}</span>
                    <span className="text-muted">{m.value}g</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${m.bg} rounded-full`}
                      style={{ width: `${Math.min((m.value / m.max) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Daily checklist */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-lime" />
              <h2 className="font-semibold font-heading text-foreground">
                Checklist {isToday ? 'de hoy' : `· Día ${selectedChallengeDay}`}
              </h2>
            </div>
            <div className="space-y-3">
              {/* Steps */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border-l-2 ${
                localChecklist?.steps_done ? 'border-l-success bg-success/5' : 'border-l-muted-dark bg-white/[0.02]'
              } border border-border`}>
                <button onClick={toggleSteps} disabled={savingSteps} className="shrink-0 transition-transform hover:scale-110">
                  {savingSteps ? <Loader2 className="w-6 h-6 text-muted animate-spin" /> :
                    localChecklist?.steps_done
                      ? <CheckCircle2 className="w-6 h-6 text-success" />
                      : <Circle className="w-6 h-6 text-muted-dark" />}
                </button>
                <Footprints className="w-5 h-5 text-accent-cyan shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">10.000 pasos</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" value={stepsInput}
                      onChange={e => setStepsInput(e.target.value)} onBlur={saveSteps}
                      placeholder="0"
                      className="w-24 bg-background border border-border-strong rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-lime transition-colors" />
                    <span className="text-xs text-muted-dark">pasos</span>
                  </div>
                </div>
                {localChecklist?.steps_done && (
                  <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-lg shrink-0">Meta</span>
                )}
              </div>

              {/* Gym */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border-l-2 ${
                localChecklist?.gym_done ? 'border-l-success bg-success/5' : 'border-l-muted-dark bg-white/[0.02]'
              } border border-border`}>
                <button onClick={toggleGym} disabled={savingGym} className="shrink-0 transition-transform hover:scale-110">
                  {savingGym ? <Loader2 className="w-6 h-6 text-muted animate-spin" /> :
                    localChecklist?.gym_done
                      ? <CheckCircle2 className="w-6 h-6 text-success" />
                      : <Circle className="w-6 h-6 text-muted-dark" />}
                </button>
                <Dumbbell className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Sesión de gimnasio</p>
                  <p className="text-xs text-muted-dark">{profile.gym_days_per_week} días/semana</p>
                </div>
                {localChecklist?.gym_done && (
                  <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-lg shrink-0">Hecho</span>
                )}
              </div>

              {/* Weight */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border-l-2 ${
                localWeightLog ? 'border-l-accent-cyan bg-accent-cyan/5' : 'border-l-muted-dark bg-white/[0.02]'
              } border border-border`}>
                <div className="shrink-0">
                  {savingWeight ? <Loader2 className="w-6 h-6 text-muted animate-spin" /> :
                    localWeightLog
                      ? <CheckCircle2 className="w-6 h-6 text-accent-cyan" />
                      : <Circle className="w-6 h-6 text-muted-dark" />}
                </div>
                <Scale className="w-5 h-5 text-accent-cyan shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Peso del día</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" step="0.1" value={weightInput}
                      onChange={e => setWeightInput(e.target.value)} onBlur={saveWeight}
                      onKeyDown={e => e.key === 'Enter' && saveWeight()}
                      placeholder={String(profile.weight_kg)}
                      className="w-24 bg-background border border-border-strong rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-lime transition-colors" />
                    <span className="text-xs text-muted-dark">kg</span>
                  </div>
                </div>
                {localWeightLog && (
                  <span className="text-xs font-medium text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded-lg shrink-0">{localWeightLog.weight_kg} kg</span>
                )}
              </div>

              {/* Calories status */}
              <div className={`flex items-center gap-3 p-3 rounded-xl border-l-2 border ${
                caloriesRemaining >= 0
                  ? 'border-l-success bg-success/5 border-success/20'
                  : 'border-l-danger bg-danger/5 border-danger/20'
              }`}>
                <div className="shrink-0">
                  {caloriesRemaining >= 0
                    ? <CheckCircle2 className="w-6 h-6 text-success" />
                    : <Circle className="w-6 h-6 text-danger" />}
                </div>
                <Flame className="w-5 h-5 text-accent-orange shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Objetivo calórico</p>
                  <p className="text-xs text-muted-dark">Máximo {profile.daily_calories} kcal</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg shrink-0 ${
                  caloriesRemaining >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                }`}>
                  {caloriesRemaining >= 0 ? `${caloriesRemaining} kcal` : `+${Math.abs(caloriesRemaining)}`}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Meals summary */}
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold font-heading text-foreground">
                Comidas {isToday ? 'de hoy' : 'del día'}
              </h2>
              <Link href="/food" className="flex items-center gap-1 text-sm text-lime hover:text-lime-dark transition-colors">
                <Plus className="w-4 h-4" /> Añadir
              </Link>
            </div>

            {localFoodEntries.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted text-sm">Sin comidas registradas {isToday ? 'hoy' : 'este día'}</p>
                <Link href="/food" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-lime/10 border border-lime/20 rounded-xl text-lime text-sm hover:bg-lime/20 transition-colors">
                  <Plus className="w-4 h-4" /> Registrar comida
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedMeals).map(([mealType, entries]) => (
                  <div key={mealType} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{MEAL_TYPE_ICONS[mealType as keyof typeof MEAL_TYPE_ICONS]}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{MEAL_TYPE_LABELS[mealType as keyof typeof MEAL_TYPE_LABELS]}</p>
                        <p className="text-xs text-muted truncate max-w-[180px] lg:max-w-[250px]">{entries.map(e => e.food_name).join(', ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-heading text-foreground">{entries.reduce((s, e) => s + e.calories, 0)}</p>
                      <p className="text-xs text-muted-dark">kcal</p>
                    </div>
                  </div>
                ))}
                <Link href="/food" className="flex items-center justify-between pt-2 text-sm text-lime hover:text-lime-dark transition-colors">
                  Ver todas las comidas <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Perfect day banner */}
      {isToday && challengeDay === 30 && localChecklist?.steps_done && localChecklist?.gym_done && caloriesRemaining >= 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="mt-6 bg-gradient-to-br from-warning/20 to-accent-orange/20 border border-warning/30 rounded-2xl p-5 text-center">
          <Trophy className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="font-bold font-heading text-warning text-lg">¡Día perfecto!</p>
          <p className="text-muted text-sm mt-1">Has completado todos los objetivos de hoy</p>
        </motion.div>
      )}
    </div>
  )
}
