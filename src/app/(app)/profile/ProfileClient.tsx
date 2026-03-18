'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { calculateDailyCalories, ACTIVITY_LABELS, type ActivityLevel, type Gender } from '@/lib/calories'
import { Profile, WeightLog } from '@/types/database'
import { getChallengeDay } from '@/lib/calories'
import { getTodayString } from '@/lib/utils'
import {
  User, LogOut, Save, Loader2, Flame, Calendar,
  Weight, Ruler, Activity, Target, TrendingDown, Plus, Check
} from 'lucide-react'

interface Props { profile: Profile; email: string }

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

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const newCalories = form.age && form.weight_kg && form.height_cm
    ? calculateDailyCalories(
        parseFloat(form.weight_kg), parseFloat(form.height_cm),
        parseInt(form.age), form.gender, form.activity_level
      )
    : profile.daily_calories

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
      // If table doesn't exist yet, error is set - silently skip
      if (!logsError) setWeightLogs(data || [])
      setLoadingWeightLogs(false)
    }
    loadWeightLogs()
  }, [profile.id])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
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

        // Also update profile weight
        await supabase.from('profiles').update({ weight_kg: kg }).eq('id', profile.id)
        router.refresh()
      }
    } catch {
      setWeightError('Error al guardar. Asegúrate de haber ejecutado la migración de peso.')
    }
    setSavingWeight(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const inputClass = "w-full bg-background border border-border-strong rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-lime transition-colors"

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

          {newCalories !== profile.daily_calories && (
            <div className="p-3 rounded-xl bg-lime/10 border border-lime/20">
              <p className="text-xs text-muted">Nuevo objetivo calórico calculado:</p>
              <p className="text-xl font-bold font-heading text-lime">{newCalories} kcal/día</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-lime hover:bg-lime-dark disabled:opacity-50 text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? 'Guardado ✓' : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
