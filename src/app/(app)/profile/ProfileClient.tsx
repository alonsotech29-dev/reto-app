'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ACTIVITY_LABELS, type ActivityLevel, type Gender } from '@/lib/calories'
import { Profile, WeightLog } from '@/types/database'
import { getChallengeDay } from '@/lib/calories'
import { getTodayString } from '@/lib/utils'
import {
  User, LogOut, Save, Loader2, Flame, Calendar,
  Weight, Ruler, Activity, Target, TrendingDown, Plus, Check,
  Calculator, ChevronDown, ChevronUp
} from 'lucide-react'

interface Props { profile: Profile; email: string }

// Harris-Benedict BMR
function calcHarrisBenedict(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  if (gender === 'male') {
    return 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age)
  } else {
    return 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age)
  }
}

const TDEE_ACTIVITY_FACTORS: Record<string, { factor: number; label: string; desc: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentario', desc: 'Poco o nada de ejercicio' },
  light:     { factor: 1.375, label: 'Ligero',     desc: 'Ejercicio ligero 1-3 días' },
  moderate:  { factor: 1.55,  label: 'Moderado',   desc: 'Ejercicio moderado 3-5 días' },
  active:    { factor: 1.725, label: 'Activo',     desc: 'Ejercicio intenso 6-7 días' },
}

export default function ProfileClient({ profile, email }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: profile.name,
    age: String(profile.age),
    gender: profile.gender as Gender,
    weight_kg: String(profile.weight_kg),
    height_cm: String(profile.height_cm),
    activity_level: profile.activity_level as ActivityLevel,
    gym_days_per_week: String(profile.gym_days_per_week),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Weight log state
  const [weightInput, setWeightInput] = useState('')
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightSaved, setWeightSaved] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)
  const [loadingWeightLogs, setLoadingWeightLogs] = useState(true)

  // TDEE calculator state
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcForm, setCalcForm] = useState({
    weight_kg: String(profile.weight_kg),
    height_cm: String(profile.height_cm),
    age: String(profile.age),
    gender: profile.gender as Gender,
    activity_level: (profile.activity_level in TDEE_ACTIVITY_FACTORS ? profile.activity_level : 'moderate') as keyof typeof TDEE_ACTIVITY_FACTORS,
    deficit: 500,
  })
  const [calcSaving, setCalcSaving] = useState(false)
  const [calcSaved, setCalcSaved] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)

  // Direct daily_calories edit state
  const [directCalories, setDirectCalories] = useState(String(profile.daily_calories))
  const [savingCalories, setSavingCalories] = useState(false)
  const [savedCalories, setSavedCalories] = useState(false)

  const [macroTargets, setMacroTargets] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('reto-macro-targets') || '{}')
        if (stored.protein_g && stored.carbs_g && stored.fat_g) return stored as { protein_g: number; carbs_g: number; fat_g: number }
      } catch {}
    }
    return {
      protein_g: Math.round(profile.daily_calories * 0.30 / 4),
      carbs_g: Math.round(profile.daily_calories * 0.45 / 4),
      fat_g: Math.round(profile.daily_calories * 0.25 / 9),
    }
  })
  const [macroSaved, setMacroSaved] = useState(false)
  const saveMacroTargets = (targets: { protein_g: number; carbs_g: number; fat_g: number }) => {
    localStorage.setItem('reto-macro-targets', JSON.stringify(targets))
    setMacroTargets(targets)
    setMacroSaved(true)
    setTimeout(() => setMacroSaved(false), 2000)
  }

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))
  const updateCalc = (field: string, value: string | number) =>
    setCalcForm(prev => ({ ...prev, [field]: value }))

  // Computed TDEE result
  const tdeeResult = (() => {
    const w = parseFloat(calcForm.weight_kg)
    const h = parseFloat(calcForm.height_cm)
    const a = parseInt(calcForm.age)
    if (!w || !h || !a || w < 30 || h < 100 || a < 10) return null
    const bmr = calcHarrisBenedict(w, h, a, calcForm.gender)
    const factor = TDEE_ACTIVITY_FACTORS[calcForm.activity_level]?.factor ?? 1.55
    const tdee = bmr * factor
    const goal = Math.round(tdee - calcForm.deficit)
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), goal }
  })()

  const challengeDay = getChallengeDay(profile.challenge_start_date)
  const endDate = new Date(profile.challenge_start_date)
  endDate.setDate(endDate.getDate() + 29)

  // Load weight logs
  useEffect(() => {
    const loadWeightLogs = async () => {
      setLoadingWeightLogs(true)
      const supabase = createClient()
      const { data, error: logsError } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', profile.id)
        .order('date', { ascending: false })
        .limit(10)
      if (!logsError) setWeightLogs(data || [])
      setLoadingWeightLogs(false)
    }
    loadWeightLogs()
  }, [profile.id])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const newCalories = form.age && form.weight_kg && form.height_cm
      ? (() => {
          // Use Mifflin formula (existing behavior)
          const w = parseFloat(form.weight_kg)
          const h = parseFloat(form.height_cm)
          const a = parseInt(form.age)
          const activityMultipliers: Record<string, number> = {
            sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
          }
          let bmr: number
          if (form.gender === 'male') {
            bmr = 10 * w + 6.25 * h - 5 * a + 5
          } else {
            bmr = 10 * w + 6.25 * h - 5 * a - 161
          }
          const tdee = bmr * (activityMultipliers[form.activity_level] || 1.55)
          const target = Math.round(tdee - 500)
          const min = form.gender === 'male' ? 1500 : 1200
          return Math.max(target, min)
        })()
      : profile.daily_calories

    await supabase.from('profiles').update({
      name: form.name,
      age: parseInt(form.age),
      gender: form.gender,
      weight_kg: parseFloat(form.weight_kg),
      height_cm: parseFloat(form.height_cm),
      activity_level: form.activity_level,
      daily_calories: newCalories,
      gym_days_per_week: parseInt(form.gym_days_per_week),
    }).eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const handleSaveWeight = async () => {
    const kg = parseFloat(weightInput)
    if (!kg || kg < 30 || kg > 300) {
      setWeightError('Introduce un peso válido (30–300 kg)')
      return
    }
    setSavingWeight(true)
    setWeightError(null)
    const supabase = createClient()
    const today = getTodayString()

    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .upsert({ user_id: profile.id, date: today, weight_kg: kg }, { onConflict: 'user_id,date' })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setWeightLogs(prev => {
          const filtered = prev.filter(l => l.date !== today)
          return [data, ...filtered].sort((a, b) => b.date.localeCompare(a.date))
        })
        setWeightInput('')
        setWeightSaved(true)
        setTimeout(() => setWeightSaved(false), 2000)

        await supabase.from('profiles').update({ weight_kg: kg }).eq('id', profile.id)
        router.refresh()
      }
    } catch {
      setWeightError('Error al guardar. Asegúrate de haber ejecutado la migración de peso.')
    }
    setSavingWeight(false)
  }

  const handleApplyTDEE = async () => {
    if (!tdeeResult) return
    setCalcSaving(true)
    setCalcError(null)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      daily_calories: tdeeResult.goal,
      weight_kg: parseFloat(calcForm.weight_kg),
      height_cm: parseFloat(calcForm.height_cm),
      age: parseInt(calcForm.age),
      activity_level: calcForm.activity_level,
    }).eq('id', profile.id)
    if (error) {
      setCalcError('Error al guardar. Inténtalo de nuevo.')
    } else {
      setCalcSaved(true)
      setDirectCalories(String(tdeeResult.goal))
      const suggestedProtein = Math.round(parseFloat(calcForm.weight_kg) * 2)
      const suggestedFat = Math.round(tdeeResult.goal * 0.25 / 9)
      const suggestedCarbs = Math.round(Math.max(0, (tdeeResult.goal - suggestedProtein * 4 - suggestedFat * 9) / 4))
      saveMacroTargets({ protein_g: suggestedProtein, carbs_g: suggestedCarbs, fat_g: suggestedFat })
      setTimeout(() => { setCalcSaved(false); setCalcOpen(false) }, 2000)
      router.refresh()
    }
    setCalcSaving(false)
  }

  const handleSaveDirectCalories = async () => {
    const val = parseInt(directCalories)
    if (!val || val < 800 || val > 5000) return
    setSavingCalories(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ daily_calories: val }).eq('id', profile.id)
    setSavingCalories(false)
    setSavedCalories(true)
    setTimeout(() => setSavedCalories(false), 2000)
    router.refresh()
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const inputClass = "w-full bg-background border border-border-strong rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-lime transition-colors"
  const calcInputClass = "w-full bg-background border border-border-strong rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-lime transition-colors"

  // Weight trend
  const latestWeight = weightLogs[0]?.weight_kg
  const previousWeight = weightLogs[1]?.weight_kg
  const weightDiff = latestWeight && previousWeight ? latestWeight - previousWeight : null

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-8 pb-24 lg:pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground">Perfil</h1>
          <p className="text-muted text-sm">{email}</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 rounded-xl transition-all text-sm font-medium">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

        {/* Left column */}
        <div className="space-y-4">

          {/* Challenge summary */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-lime/5 border border-lime/20 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-orange/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-accent-orange" />
              </div>
              <div>
                <p className="font-semibold font-heading text-foreground">Reto 30 días</p>
                <p className="text-xs text-muted">Día {challengeDay} de 30</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted">
                <Calendar className="w-4 h-4 text-lime" />
                <span>Inicio: {new Date(profile.challenge_start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Target className="w-4 h-4 text-success" />
                <span>Fin: {endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Flame className="w-4 h-4 text-accent-orange" />
                <span>{profile.daily_calories} kcal/día</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>{profile.gym_days_per_week} días gym/semana</span>
              </div>
            </div>
          </motion.div>

          {/* TDEE Calculator card */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white/[0.03] border border-border-strong rounded-2xl overflow-hidden">

            {/* Header row — always visible */}
            <button
              onClick={() => setCalcOpen(o => !o)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent-orange/15 flex items-center justify-center shrink-0">
                  <Calculator className="w-4 h-4 text-accent-orange" />
                </div>
                <div>
                  <p className="font-semibold font-heading text-foreground text-sm">Recalcular objetivo</p>
                  <p className="text-xs text-muted">Calculadora TDEE · Harris-Benedict</p>
                </div>
              </div>
              {calcOpen
                ? <ChevronUp className="w-4 h-4 text-muted shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              }
            </button>

            {/* Expanded calculator */}
            {calcOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-border">

                {/* Weight + Height */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                      <Weight className="w-3 h-3" /> Peso (kg)
                    </label>
                    <input
                      type="number" step="0.1" min="30" max="300"
                      value={calcForm.weight_kg}
                      onChange={e => updateCalc('weight_kg', e.target.value)}
                      className={calcInputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 flex items-center gap-1">
                      <Ruler className="w-3 h-3" /> Altura (cm)
                    </label>
                    <input
                      type="number" min="100" max="250"
                      value={calcForm.height_cm}
                      onChange={e => updateCalc('height_cm', e.target.value)}
                      className={calcInputClass}
                    />
                  </div>
                </div>

                {/* Age + Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Edad</label>
                    <input
                      type="number" min="10" max="100"
                      value={calcForm.age}
                      onChange={e => updateCalc('age', e.target.value)}
                      className={calcInputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5">Género</label>
                    <div className="flex gap-2">
                      {(['male', 'female'] as Gender[]).map(g => (
                        <button
                          key={g}
                          onClick={() => updateCalc('gender', g)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                            calcForm.gender === g
                              ? 'bg-lime/10 text-lime border-lime/20'
                              : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                          }`}
                        >
                          {g === 'male' ? 'Hombre' : 'Mujer'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activity level */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Nivel de actividad</label>
                  <div className="space-y-1.5">
                    {Object.entries(TDEE_ACTIVITY_FACTORS).map(([key, { label, desc }]) => (
                      <button
                        key={key}
                        onClick={() => updateCalc('activity_level', key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left border transition-all ${
                          calcForm.activity_level === key
                            ? 'bg-lime/10 text-lime border-lime/20'
                            : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="text-xs font-medium">{label}</span>
                        <span className={`text-xs ${calcForm.activity_level === key ? 'text-lime/70' : 'text-muted-dark'}`}>{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deficit */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Déficit calórico</label>
                  <div className="flex gap-2">
                    {[300, 400, 500].map(d => (
                      <button
                        key={d}
                        onClick={() => updateCalc('deficit', d)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                          calcForm.deficit === d
                            ? 'bg-lime/10 text-lime border-lime/20'
                            : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                        }`}
                      >
                        -{d} kcal
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result box */}
                {tdeeResult && (
                  <div className="bg-lime/5 border border-lime/20 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">BMR (metabolismo basal)</span>
                      <span className="font-medium text-foreground">{tdeeResult.bmr} kcal</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">TDEE (gasto total)</span>
                      <span className="font-medium text-foreground">{tdeeResult.tdee} kcal</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-lime/20">
                      <span className="text-sm font-semibold text-foreground">Objetivo recomendado</span>
                      <span className="text-xl font-bold font-heading text-lime">{tdeeResult.goal} kcal</span>
                    </div>
                    {/* Auto-calculated macros */}
                    {(() => {
                      const suggestedProtein = Math.round(parseFloat(calcForm.weight_kg) * 2)
                      const suggestedFat = Math.round(tdeeResult.goal * 0.25 / 9)
                      const suggestedCarbs = Math.round((tdeeResult.goal - suggestedProtein * 4 - suggestedFat * 9) / 4)
                      return (
                        <div className="pt-1 border-t border-lime/20 space-y-1">
                          <p className="text-xs text-muted font-medium">Macros sugeridos:</p>
                          {[
                            { label: 'Proteína', value: suggestedProtein, color: 'text-accent-cyan' },
                            { label: 'Carbos', value: Math.max(0, suggestedCarbs), color: 'text-accent-orange' },
                            { label: 'Grasas', value: suggestedFat, color: 'text-warning' },
                          ].map(m => (
                            <div key={m.label} className="flex justify-between text-xs">
                              <span className="text-muted">{m.label}</span>
                              <span className={`font-medium ${m.color}`}>{m.value}g/día</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {calcError && <p className="text-xs text-danger">{calcError}</p>}

                {/* Apply button */}
                <button
                  onClick={handleApplyTDEE}
                  disabled={calcSaving || !tdeeResult}
                  className="w-full py-3 bg-lime hover:bg-lime-dark disabled:opacity-50 text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                >
                  {calcSaving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : calcSaved
                    ? <><Check className="w-4 h-4" /> Aplicado</>
                    : <><Calculator className="w-4 h-4" /> Aplicar objetivo</>
                  }
                </button>
              </div>
            )}

            {/* Quick edit calories — always visible below header */}
            {!calcOpen && (
              <div className="px-5 pb-5 pt-0">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1">Editar objetivo calórico diario</label>
                    <input
                      type="number"
                      value={directCalories}
                      onChange={e => setDirectCalories(e.target.value)}
                      min="800"
                      max="5000"
                      className="w-full bg-background border border-border-strong rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-lime transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleSaveDirectCalories}
                    disabled={savingCalories}
                    className="mt-5 px-4 py-2.5 bg-lime/10 border border-lime/30 text-lime hover:bg-lime/20 disabled:opacity-40 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {savingCalories ? <Loader2 className="w-4 h-4 animate-spin" /> : savedCalories ? <Check className="w-4 h-4" /> : <Save className="w-3.5 h-3.5" />}
                    {savedCalories ? 'Guardado' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Macro targets card */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold font-heading text-foreground flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-accent-orange" /> Objetivos de macros diarios
              </h2>
              {macroSaved && <span className="text-xs text-success flex items-center gap-1"><Check className="w-3 h-3"/>Guardado</span>}
            </div>
            {[
              { key: 'protein_g' as const, label: 'Proteína', color: 'text-accent-cyan', border: 'border-accent-cyan/20', bg: 'bg-accent-cyan/5' },
              { key: 'carbs_g' as const, label: 'Carbos', color: 'text-accent-orange', border: 'border-accent-orange/20', bg: 'bg-accent-orange/5' },
              { key: 'fat_g' as const, label: 'Grasas', color: 'text-warning', border: 'border-warning/20', bg: 'bg-warning/5' },
            ].map(macro => (
              <div key={macro.key} className={`flex items-center gap-3 p-3 rounded-xl border ${macro.border} ${macro.bg}`}>
                <span className={`text-xs font-medium w-16 shrink-0 ${macro.color}`}>{macro.label}</span>
                <input
                  type="number"
                  value={macroTargets[macro.key]}
                  onChange={e => setMacroTargets(prev => ({ ...prev, [macro.key]: parseInt(e.target.value) || 0 }))}
                  min="0"
                  max="500"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-center focus:outline-none focus:border-lime w-20"
                />
                <span className="text-xs text-muted-dark">g/día</span>
              </div>
            ))}
            <button
              onClick={() => saveMacroTargets(macroTargets)}
              className="w-full py-2.5 bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/20 text-accent-orange font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-3.5 h-3.5" /> Guardar objetivos
            </button>
          </motion.div>

          {/* Weight registration */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
                <Weight className="w-4 h-4 text-accent-cyan" /> Registro de peso
              </h2>
              {latestWeight && (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold font-heading text-foreground">{latestWeight} kg</span>
                  {weightDiff !== null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${
                      weightDiff <= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                    }`}>
                      {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(1)} kg
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Log today's weight */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={weightInput}
                  onChange={e => { setWeightInput(e.target.value); setWeightError(null) }}
                  placeholder={`Peso de hoy (kg)`}
                  step="0.1"
                  min="30"
                  max="300"
                  className="w-full bg-background border border-border-strong rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors"
                />
              </div>
              <button
                onClick={handleSaveWeight}
                disabled={savingWeight || !weightInput}
                className="px-4 py-2.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-40 rounded-xl font-medium text-sm flex items-center gap-1.5 transition-all shrink-0"
              >
                {savingWeight ? <Loader2 className="w-4 h-4 animate-spin" /> : weightSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {weightSaved ? 'Guardado' : 'Registrar'}
              </button>
            </div>

            {weightError && (
              <p className="text-xs text-danger">{weightError}</p>
            )}

            {/* Weight history */}
            {!loadingWeightLogs && weightLogs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-dark mb-2">Historial reciente</p>
                {weightLogs.slice(0, 7).map((log, i) => {
                  const prev = weightLogs[i + 1]
                  const diff = prev ? log.weight_kg - prev.weight_kg : null
                  return (
                    <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <TrendingDown className={`w-3.5 h-3.5 ${diff !== null && diff <= 0 ? 'text-success' : 'text-muted-dark'}`} />
                        <span className="text-xs text-muted">
                          {new Date(log.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {diff !== null && (
                          <span className={`text-xs ${diff <= 0 ? 'text-success' : 'text-danger'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </span>
                        )}
                        <span className="text-sm font-semibold font-heading text-foreground">{log.weight_kg} kg</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!loadingWeightLogs && weightLogs.length === 0 && (
              <p className="text-xs text-muted-dark text-center py-2">
                Aún no hay registros. ¡Empieza registrando tu peso de hoy!
              </p>
            )}

            {loadingWeightLogs && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-muted animate-spin" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Right: Edit profile */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="card p-5 space-y-4 h-fit">
          <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-lime" /> Datos personales
          </h2>

          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Nombre</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Edad</label>
              <input type="number" value={form.age} onChange={e => update('age', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Género</label>
              <select value={form.gender} onChange={e => update('gender', e.target.value)} className={inputClass}>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5 flex items-center gap-1">
                <Weight className="w-3.5 h-3.5" /> Peso (kg)
              </label>
              <input type="number" value={form.weight_kg} step="0.1" onChange={e => update('weight_kg', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5 flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5" /> Altura (cm)
              </label>
              <input type="number" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Nivel de actividad</label>
            <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)} className={inputClass + ' text-sm'}>
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Días de gym por semana</label>
            <div className="flex gap-2">
              {[3, 4, 5].map(n => (
                <button key={n} onClick={() => update('gym_days_per_week', String(n))}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all border ${
                    form.gym_days_per_week === String(n)
                      ? 'bg-lime/10 text-lime border-lime/30'
                      : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                  }`}>
                  {n} días
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-lime hover:bg-lime-dark disabled:opacity-50 text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? 'Guardado ✓' : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
