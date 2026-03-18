'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { calculateDailyCalories, ACTIVITY_LABELS, type ActivityLevel, type Gender } from '@/lib/calories'
import { Profile } from '@/types/database'
import { getChallengeDay } from '@/lib/calories'
import {
  User, LogOut, Save, Loader2, Flame, Calendar,
  Weight, Ruler, Activity, Target
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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const inputClass = "w-full bg-background border border-border-strong rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-lime transition-colors"

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-8">
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
        {/* Challenge summary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-lime/5 border border-lime/20 rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent-orange/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-accent-orange" />
            </div>
            <div>
              <p className="font-semibold font-heading text-foreground">Reto 30 dias</p>
              <p className="text-xs text-muted">Dia {challengeDay} de 30</p>
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
              <span>{profile.daily_calories} kcal/dia</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>{profile.gym_days_per_week} dias gym/semana</span>
            </div>
          </div>
        </motion.div>

        {/* Edit profile */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-5 space-y-4">
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
              <label className="block text-sm font-medium text-muted mb-1.5">Genero</label>
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
            <label className="block text-sm font-medium text-muted mb-1.5">Dias de gym por semana</label>
            <div className="flex gap-2">
              {[3, 4, 5].map(n => (
                <button key={n} onClick={() => update('gym_days_per_week', String(n))}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all border ${
                    form.gym_days_per_week === String(n)
                      ? 'bg-lime/10 text-lime border-lime/30'
                      : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                  }`}>
                  {n} dias
                </button>
              ))}
            </div>
          </div>

          {newCalories !== profile.daily_calories && (
            <div className="p-3 rounded-xl bg-lime/10 border border-lime/20">
              <p className="text-xs text-muted">Nuevo objetivo calorico calculado:</p>
              <p className="text-xl font-bold font-heading text-lime">{newCalories} kcal/dia</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-lime hover:bg-lime-dark disabled:opacity-50 text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? 'Guardado' : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
