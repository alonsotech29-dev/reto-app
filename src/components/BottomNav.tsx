'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Utensils, TrendingUp, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Hoy' },
  { href: '/food', icon: Utensils, label: 'Comidas' },
  { href: '/progress', icon: TrendingUp, label: 'Progreso' },
  { href: '/profile', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border z-50 lg:hidden">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className="relative flex flex-col items-center gap-0.5 px-3 py-2">
              {active && (
                <motion.div
                  layoutId="bottomnav-pill"
                  className="absolute inset-0 bg-lime/10 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn(
                'w-5 h-5 relative z-10 transition-colors',
                active ? 'text-lime' : 'text-muted-dark'
              )} />
              <span className={cn(
                'text-[10px] font-medium relative z-10 transition-colors',
                active ? 'text-lime' : 'text-muted-dark'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
