'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Flame, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contrasena incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const inputClass = "w-full bg-background border border-border-strong rounded-xl pl-10 pr-4 py-3 text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid-pattern px-4">
      <div className="w-full max-w-md lg:max-w-4xl lg:grid lg:grid-cols-2 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border">

        {/* Branding panel (desktop only) */}
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:bg-surface lg:p-12">
          <div className="w-20 h-20 rounded-2xl bg-lime/10 flex items-center justify-center mb-6">
            <Flame className="w-10 h-10 text-lime" />
          </div>
          <h1 className="text-4xl font-bold font-heading text-foreground tracking-tight">RETO 30</h1>
          <p className="text-muted mt-2 text-center">Transforma tu cuerpo en un mes</p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-heading text-lime">10K</p>
              <p className="text-xs text-muted">pasos/dia</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-accent-orange">30</p>
              <p className="text-xs text-muted">dias</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-accent-cyan">100%</p>
              <p className="text-xs text-muted">compromiso</p>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="lg:bg-card lg:p-10">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-lime/10 mb-4">
              <Flame className="w-8 h-8 text-lime" />
            </div>
            <h1 className="text-3xl font-bold font-heading text-foreground">RETO 30</h1>
            <p className="text-muted mt-2">Transforma tu cuerpo en un mes</p>
          </div>

          <div className="card p-8 lg:bg-transparent lg:border-0 lg:p-0">
            <h2 className="text-xl font-semibold font-heading text-foreground mb-6">Iniciar sesion</h2>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className={inputClass} placeholder="tu@email.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">Contrasena</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    className={inputClass + ' !pr-12'} placeholder="********" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark hover:text-muted transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-lime hover:bg-lime-dark disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-xl transition-all mt-2">
                {loading ? 'Iniciando sesion...' : 'Iniciar sesion'}
              </button>
            </form>

            <p className="mt-6 text-center text-muted text-sm">
              No tienes cuenta?{' '}
              <Link href="/register" className="text-lime hover:text-lime-dark font-medium transition-colors">
                Registrate gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
