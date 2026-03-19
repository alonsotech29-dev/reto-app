'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer
} from 'recharts'
import { Profile, DailyChecklist } from '@/types/database'
import { Trophy, Flame, Footprints, Dumbbell, TrendingUp, Calendar, Scale } from 'lucide-react'

interface Props {
  profile: Profile
  checklists: DailyChecklist[]
  foodEntries: Array<{ date: string; calories: number }>
  weightLogs: Array<{ date: string; weight_kg: number }>
  challengeDay: number
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const }
  })
}

export default function ProgressClient({ profile, checklists, foodEntries, weightLogs, challengeDay }: Props) {
  const startDate = new Date(profile.challenge_start_date)

  const weightChartData = useMemo(() => {
    if (weightLogs.length === 0) return []
    const weightByDate = weightLogs.reduce((acc, w) => {
      acc[w.date] = w.weight_kg
      return acc
    }, {} as Record<string, number>)

    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const dayNum = i + 1
      const weight = weightByDate[dateStr]
      return {
        day: dayNum,
        label: `D${dayNum}`,
        weight: dayNum <= challengeDay ? weight || null : null,
        dateStr,
      }
    }).filter(d => d.weight !== null)
  }, [weightLogs, challengeDay, startDate])

  const weightStats = useMemo(() => {
    if (weightChartData.length === 0) return null
    const weights = weightChartData.map(d => d.weight as number)
    const first = weights[0]
    const last = weights[weights.length - 1]
    const min = Math.min(...weights)
    const max = Math.max(...weights)
    const change = last - first
    return { first, last, min, max, change }
  }, [weightChartData])

  const chartData = useMemo(() => {
    const calsByDate = foodEntries.reduce((acc, e) => {
      acc[e.date] = (acc[e.date] || 0) + e.calories
      return acc
    }, {} as Record<string, number>)

    const checklistByDate = checklists.reduce((acc, c) => {
      acc[c.date] = c
      return acc
    }, {} as Record<string, DailyChecklist>)

    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const dayNum = i + 1
      const isPast = dayNum <= challengeDay
      const c = checklistByDate[dateStr]
      const cals = calsByDate[dateStr] || 0

      return {
        day: dayNum,
        label: `D${dayNum}`,
        dateStr,
        calories: isPast ? cals : null,
        steps: isPast ? (c?.steps_done ? 1 : 0) : null,
        gym: isPast ? (c?.gym_done ? 1 : 0) : null,
        calorieTarget: profile.daily_calories,
        isPerfect: isPast && c?.steps_done && c?.gym_done && cals <= profile.daily_calories && cals > 0,
      }
    })
  }, [checklists, foodEntries, challengeDay, profile.daily_calories, startDate])

  const pastDays = chartData.filter(d => d.calories !== null)

  const stats = useMemo(() => {
    return {
      stepsCompleted: pastDays.filter(d => d.steps === 1).length,
      gymSessions: pastDays.filter(d => d.gym === 1).length,
      calorieGoalMet: pastDays.filter(d => d.calories !== null && d.calories! > 0 && d.calories! <= profile.daily_calories).length,
      perfectDays: pastDays.filter(d => d.isPerfect).length,
      avgCalories: (() => {
        const withCals = pastDays.filter(d => d.calories! > 0)
        return withCals.length > 0
          ? Math.round(withCals.reduce((s, d) => s + d.calories!, 0) / withCals.length)
          : 0
      })(),
      streak: (() => {
        let s = 0
        for (let i = pastDays.length - 1; i >= 0; i--) {
          if (pastDays[i].isPerfect) s++
          else break
        }
        return s
      })(),
    }
  }, [pastDays, profile.daily_calories])

  const progressPercent = Math.round((challengeDay / 30) * 100)
  const circumference = 2 * Math.PI * 40

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (active && payload && (payload as Array<{ value: number }>).length) {
      const d = chartData.find(c => c.label === label)
      if (!d || d.calories === null) return null
      return (
        <div className="bg-card border border-border-strong rounded-xl p-3 text-sm">
          <p className="font-semibold font-heading text-foreground mb-1">Dia {d.day}</p>
          <p className="text-muted">{d.calories} kcal</p>
          {d.calories <= profile.daily_calories ? (
            <p className="text-success text-xs">Objetivo cumplido</p>
          ) : (
            <p className="text-danger text-xs">+{d.calories - profile.daily_calories} kcal exceso</p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-8 pb-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground">Progreso</h1>
        <p className="text-muted text-sm">Dia {challengeDay} de 30 · {30 - challengeDay} restantes</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

        {/* Left: progress ring + stats */}
        <div className="space-y-4">
          {/* Progress ring */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 shrink-0">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <motion.circle
                    cx="48" cy="48" r="40" fill="none"
                    stroke="#84cc16" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - (progressPercent / 100) * circumference }}
                    transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold font-heading text-foreground">{progressPercent}%</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-foreground font-semibold font-heading text-lg">Reto en curso</p>
                <p className="text-muted text-sm mt-1">
                  Inicio: {new Date(profile.challenge_start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                </p>
                {stats.streak > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <Flame className="w-4 h-4 text-accent-orange" />
                    <span className="text-sm font-medium text-accent-orange">{stats.streak} dias perfectos seguidos</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pasos completados', value: stats.stepsCompleted, icon: Footprints, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10', border: 'border-accent-cyan/20' },
              { label: 'Sesiones de gym', value: stats.gymSessions, icon: Dumbbell, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
              { label: 'Objetivo calorias', value: stats.calorieGoalMet, icon: Flame, color: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/20' },
              { label: 'Dias perfectos', value: stats.perfectDays, icon: Trophy, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
            ].map((stat, i) => (
              <motion.div key={stat.label} custom={i + 1} variants={fadeUp} initial="hidden" animate="visible"
                className={`${stat.bg} border ${stat.border} rounded-2xl p-4`}>
                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <p className={`text-2xl font-bold font-heading ${stat.color}`}>
                  {stat.value}<span className="text-base text-muted-dark">/{challengeDay}</span>
                </p>
                <p className="text-xs text-muted mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: charts + calendar */}
        <div className="lg:col-span-2 space-y-4">
          {/* Calorie chart */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-lime" /> Calorias por dia
              </h2>
              {stats.avgCalories > 0 && (
                <span className="text-xs text-muted">Media: {stats.avgCalories} kcal</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={profile.daily_calories} stroke="#84cc16" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="calories" name="Calorias" radius={[4, 4, 0, 0]} fill="#84cc16" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-dark mt-2 text-center">— linea = objetivo ({profile.daily_calories} kcal)</p>
          </motion.div>

          {/* Weight evolution chart */}
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
                <Scale className="w-4 h-4 text-accent-cyan" /> Evolución del peso
              </h2>
              {weightStats && (
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  weightStats.change <= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                }`}>
                  {weightStats.change > 0 ? '+' : ''}{weightStats.change.toFixed(1)} kg
                </span>
              )}
            </div>
            {weightChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weightChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 1),
                        (dataMax: number) => Math.ceil(dataMax + 1)
                      ]}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const d = payload[0].payload
                        return (
                          <div className="bg-card border border-border-strong rounded-xl p-3 text-sm">
                            <p className="font-semibold font-heading text-foreground mb-1">Día {d.day}</p>
                            <p className="text-accent-cyan">{d.weight} kg</p>
                          </div>
                        )
                      }
                      return null
                    }} />
                    <ReferenceLine y={profile.weight_kg} stroke="#06b6d4" strokeDasharray="4 4" strokeWidth={1} strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="weight" stroke="#06b6d4" strokeWidth={2.5}
                      dot={{ fill: '#06b6d4', strokeWidth: 0, r: 3 }}
                      activeDot={{ fill: '#06b6d4', strokeWidth: 2, stroke: '#fff', r: 5 }}
                      connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                {weightStats && (
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    <div className="text-center">
                      <p className="text-xs text-muted">Inicio</p>
                      <p className="text-sm font-bold font-heading text-foreground">{weightStats.first} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted">Actual</p>
                      <p className="text-sm font-bold font-heading text-accent-cyan">{weightStats.last} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted">Mín</p>
                      <p className="text-sm font-bold font-heading text-success">{weightStats.min} kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted">Máx</p>
                      <p className="text-sm font-bold font-heading text-danger">{weightStats.max} kg</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-dark mt-2 text-center">— línea = peso inicial ({profile.weight_kg} kg)</p>
              </>
            ) : (
              <div className="text-center py-8">
                <Scale className="w-8 h-8 text-muted-dark mx-auto mb-2" />
                <p className="text-muted text-sm">Sin registros de peso todavía</p>
                <p className="text-muted-dark text-xs mt-1">Registra tu peso diario desde el Dashboard</p>
              </div>
            )}
          </motion.div>

          {/* Calendar grid */}
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
            <h2 className="font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-lime" /> Calendario del reto
            </h2>
            <div className="grid grid-cols-10 gap-1.5">
              {chartData.map(d => {
                const isPast = d.day <= challengeDay
                const className = `aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all
                  ${!isPast ? 'bg-white/[0.03] text-muted-dark cursor-default' :
                    d.isPerfect ? 'bg-lime/20 text-lime border border-lime/30 hover:ring-1 hover:ring-lime/50 cursor-pointer' :
                    d.calories !== null && d.calories > 0 ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20 hover:ring-1 hover:ring-accent-cyan/50 cursor-pointer' :
                    'bg-white/[0.03] text-muted-dark hover:bg-white/[0.06] cursor-pointer'
                  }`
                return isPast ? (
                  <Link key={d.day} href={`/dashboard?date=${d.dateStr}`} title={`Día ${d.day} · ${d.dateStr}`} className={className}>
                    {d.day}
                  </Link>
                ) : (
                  <div key={d.day} title={`Día ${d.day}`} className={className}>
                    {d.day}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-lime/20 border border-lime/30" /> Perfecto</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent-cyan/15 border border-accent-cyan/20" /> Registrado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/[0.03]" /> Pendiente</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
