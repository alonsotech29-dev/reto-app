'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { LayoutDashboard, Utensils, TrendingUp, User, Flame } from 'lucide-react'
import { cn, getTodayString } from '@/lib/utils'
import DatePickerCalendar from './DatePickerCalendar'

const links = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Hoy' },
  { href: '/food', icon: Utensils, label: 'Comidas' },
  { href: '/progress', icon: TrendingUp, label: 'Progreso' },
  { href: '/profile', icon: User, label: 'Perfil' },
]

export default function SideNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const today = getTodayString()
  const currentDate = searchParams.get('date') || today

  const getTabHref = (href: string) =>
    currentDate !== today ? `${href}?date=${currentDate}` : href

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-surface border-r border-border z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
          <Flame className="w-6 h-6 text-lime" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold text-foreground tracking-tight">RETO 30</h1>
          <p className="text-xs text-muted">Transforma tu cuerpo</p>
        </div>
      </div>

      {/* Global date selector */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted mb-2">Día seleccionado</p>
        <DatePickerCalendar
          value={currentDate}
          onChange={date => router.push(`${pathname}?date=${date}`)}
          align="down"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={getTabHref(href)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-lime/10 text-lime border-l-2 border-lime'
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-muted-dark text-center">Reto 30 Días v1.0</p>
      </div>
    </aside>
  )
}
