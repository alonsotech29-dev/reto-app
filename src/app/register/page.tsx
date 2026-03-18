'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calculateDailyCalories, ACTIVITY_LABELS, type ActivityLevel, type Gender } from '@/lib/calories'
import { Flame, User, Mail, Lock, Eye, EyeOff, ChevronRight, ChevronLeft, Activity, Calendar } from 'lucide-react'

type Step = 'account' | 'personal' | 'challenge'
const STEPS: Step[] = ['account', 'personal', 'challenge']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
    gender: 'male' as Gender,
    weight_kg: '',
    height_cm: '',
    activity_level: 'moderate' as ActivityLevel,
    challenge_start_date: new Date().toISOString().split('T')[0],
    gym_days_per_week: '3',
  })

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const estimatedCalories = form.age && form.weight_kg && form.height_cm
    ? calculateDailyCalories(parseFloat(form.weight_kg), parseFloat(form.height_cm), parseInt(form.age), form.gender, form.activity_level)
    : null

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const calories = calculateDailyCalories(parseFloat(form.weight_kg), parseFloat(form.height_cm), parseInt(form.age), form.gender, form.activity_level)

    const { data, error: signUpError } = await supabase.auth.signUp({ email: form.email, password: form.password })

    if (signUpError || !data.user) {
      setError(signUpError?.message || 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      name: form.name,
      age: parseInt(form.age),
      gender: form.gender,
      weight_kg: parseFloat(form.weight_kg),
      height_cm: parseFloat(form.height_cm),
      activity_level: form.activity_level,
      daily_calories: calories,
      challenge_start_date: form.challenge_start_date,
      gym_days_per_week: parseInt(form.gym_days_per_week),
    })

    if (profileError) {
      setError('Error al guardar el perfil')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = "w-full bg-background border border-border-strong rounded-xl px-4 py-3 text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors"
  const inputIconClass = inputClass + ' pl-10'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid-pattern px-4 py-8">
      <div className="w-full max-w-md lg:max-w-4xl lg:grid lg:grid-cols-2 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border">

        {/* Branding panel (desktop) */}
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:bg-surface lg:p-12">
          <div className="w-20 h-20 rounded-2xl bg-lime/10 flex items-center justify-center mb-6">
            <Flame className="w-10 h-10 text-lime" />
          </div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">RETO 30</h1>
          <p className="text-muted mt-2 text-center">30 dias para transformarte</p>
          <div className="mt-8 space-y-3 text-sm text-muted">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-lime/10 text-lime flex items-center justify-center text-xs font-bold">1</span> Crea tu cuenta</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-lime/10 text-lime flex items-center justify-center text-xs font-bold">2</span> Tu perfil fisico</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-lime/10 text-lime flex items-center justify-center text-xs font-bold">3</span> Configura tu reto</div>
          </div>
        </div>

        {/* Form panel */}
        <div className="lg:bg-card lg:p-10">
          {/* Mobile logo */}
          <div className="text-center mb-6 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime/10 mb-3">
              <Flame className="w-7 h-7 text-lime" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Empieza tu reto</h1>
            <p className="text-muted mt-1 text-sm">30 dias para transformarte</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === s ? 'bg-lime text-background' :
                  STEPS.indexOf(step) > i ? 'bg-success text-background' :
                  'bg-white/[0.06] text-muted-dark'
                }`}>
                  {i + 1}
                </div>
                {i < 2 && <div className="w-8 h-px bg-border-strong" />}
              </div>
            ))}
          </div>

          <div className="card p-8 lg:bg-transparent lg:border-0 lg:p-0">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Account */}
            {step === 'account' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold font-heading text-foreground mb-6 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-lime" /> Crea tu cuenta
                </h2>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                      className={inputIconClass} placeholder="Tu nombre" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                      className={inputIconClass} placeholder="tu@email.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Contrasena</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)}
                      className={inputIconClass + ' !pr-12'} placeholder="Minimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-muted">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => {
                  if (!form.name || !form.email || form.password.length < 6) { setError('Completa todos los campos (minimo 6 caracteres en contrasena)'); return }
                  setError(''); setStep('personal')
                }} className="w-full py-3 bg-lime hover:bg-lime-dark text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 2: Personal */}
            {step === 'personal' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold font-heading text-foreground mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-lime" /> Tu perfil fisico
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Edad</label>
                    <input type="number" value={form.age} onChange={e => update('age', e.target.value)} min="15" max="80"
                      className={inputClass} placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Genero</label>
                    <select value={form.gender} onChange={e => update('gender', e.target.value)} className={inputClass}>
                      <option value="male">Hombre</option>
                      <option value="female">Mujer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Peso (kg)</label>
                    <input type="number" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} min="40" max="200" step="0.1"
                      className={inputClass} placeholder="75.0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1.5">Altura (cm)</label>
                    <input type="number" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} min="140" max="220"
                      className={inputClass} placeholder="175" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Nivel de actividad</label>
                  <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)} className={inputClass + ' text-sm'}>
                    {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {estimatedCalories && (
                  <div className="p-4 rounded-xl bg-lime/10 border border-lime/20">
                    <p className="text-sm text-muted">Tu objetivo calorico diario estimado:</p>
                    <p className="text-2xl font-bold font-heading text-lime">{estimatedCalories} kcal</p>
                    <p className="text-xs text-muted-dark mt-1">Deficit de 500 kcal para perdida de grasa</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep('account')}
                    className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.08] text-foreground rounded-xl flex items-center justify-center gap-2 transition-all">
                    <ChevronLeft className="w-4 h-4" /> Atras
                  </button>
                  <button onClick={() => {
                    if (!form.age || !form.weight_kg || !form.height_cm) { setError('Completa todos los campos'); return }
                    setError(''); setStep('challenge')
                  }} className="flex-1 py-3 bg-lime hover:bg-lime-dark text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Challenge */}
            {step === 'challenge' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold font-heading text-foreground mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-lime" /> Configura tu reto
                </h2>

                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Fecha de inicio del reto</label>
                  <input type="date" value={form.challenge_start_date} onChange={e => update('challenge_start_date', e.target.value)}
                    className={inputClass} />
                  <p className="text-xs text-muted-dark mt-1">El reto durara exactamente 30 dias desde esta fecha</p>
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

                <div className="p-4 rounded-xl bg-accent-orange/10 border border-accent-orange/20">
                  <p className="text-sm font-medium text-accent-orange mb-2">Tu reto incluye:</p>
                  <ul className="text-sm text-muted space-y-1">
                    <li className="flex items-center gap-2"><span className="text-success">&#10003;</span> 10.000 pasos diarios</li>
                    <li className="flex items-center gap-2"><span className="text-success">&#10003;</span> {form.gym_days_per_week} dias de gym por semana</li>
                    <li className="flex items-center gap-2"><span className="text-success">&#10003;</span> Maximo {estimatedCalories || '--'} kcal/dia</li>
                    <li className="flex items-center gap-2"><span className="text-success">&#10003;</span> 30 dias de seguimiento</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('personal')}
                    className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.08] text-foreground rounded-xl flex items-center justify-center gap-2 transition-all">
                    <ChevronLeft className="w-4 h-4" /> Atras
                  </button>
                  <button onClick={handleSubmit} disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-accent-orange to-danger hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all">
                    {loading ? 'Creando...' : 'Empezar reto!'}
                  </button>
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-muted text-sm">
              Ya tienes cuenta?{' '}
              <Link href="/login" className="text-lime hover:text-lime-dark font-medium transition-colors">
                Iniciar sesion
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
