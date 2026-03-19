'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn, getTodayString, formatDate } from '@/lib/utils'

interface Props {
  value: string
  onChange: (date: string) => void
  align?: 'up' | 'down'
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export default function DatePickerCalendar({ value, onChange, align = 'up' }: Props) {
  const today = getTodayString()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => new Date(value + 'T00:00:00').getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(value + 'T00:00:00').getMonth())
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const POPOVER_W = 288 // w-72
    const MARGIN = 8

    // Horizontal: anchor right edge of popover to right edge of button, clamp to viewport
    let left = rect.right - POPOVER_W
    if (left < MARGIN) left = MARGIN
    if (left + POPOVER_W > window.innerWidth - MARGIN) left = window.innerWidth - POPOVER_W - MARGIN

    const style: React.CSSProperties = { position: 'fixed', left, width: POPOVER_W, zIndex: 9999 }

    if (align === 'up') {
      style.bottom = window.innerHeight - rect.top + MARGIN
    } else {
      style.top = rect.bottom + MARGIN
    }

    setPopoverStyle(style)
  }, [align])

  // Recalculate on open and on scroll/resize
  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const valueDate = new Date(value + 'T00:00:00')
  const label = value === today
    ? 'Hoy'
    : valueDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    const now = new Date()
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (day: number) => {
    const str = formatDate(new Date(viewYear, viewMonth, day))
    if (str > today) return
    onChange(str)
    setOpen(false)
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const isNextDisabled = viewYear === new Date().getFullYear() && viewMonth >= new Date().getMonth()

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all',
          open
            ? 'bg-lime/10 border-lime text-lime'
            : 'bg-background border-border-strong text-foreground hover:border-lime/50 hover:text-lime'
        )}
      >
        <CalendarDays className="w-4 h-4 shrink-0" />
        <span className="capitalize">{label}</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="bg-elevated border border-border rounded-2xl p-4 shadow-2xl"
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">{monthLabel}</span>
            <button onClick={nextMonth} disabled={isNextDisabled}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-dark py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const dateStr = formatDate(new Date(viewYear, viewMonth, day))
              const isFuture = dateStr > today
              const isSelected = dateStr === value
              const isToday = dateStr === today
              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  disabled={isFuture}
                  className={cn(
                    'aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all',
                    isFuture && 'text-muted-dark/40 cursor-not-allowed',
                    !isFuture && !isSelected && !isToday && 'text-foreground hover:bg-white/[0.08]',
                    isToday && !isSelected && 'text-lime font-bold ring-1 ring-lime/40',
                    isSelected && 'bg-lime text-background font-bold',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {value !== today && (
            <button
              onClick={() => { onChange(today); setOpen(false) }}
              className="mt-3 w-full text-xs text-center text-lime hover:text-lime-dark transition-colors"
            >
              Ir a hoy
            </button>
          )}
        </div>
      )}
    </>
  )
}
