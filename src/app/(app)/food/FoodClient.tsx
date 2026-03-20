'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getTodayString, formatDate } from '@/lib/utils'
import { getChallengeDay } from '@/lib/calories'
import { FoodEntry, FoodSearchResult, Serving, MEAL_TYPE_LABELS, MEAL_TYPE_ICONS } from '@/types/database'
import CalorieChart from '@/components/CalorieChart'
import DatePickerCalendar from '@/components/DatePickerCalendar'
import {
  Camera, Search, Plus, X, Loader2, Trash2,
  Edit2, Check, ChevronDown, AlertCircle, Zap,
  Star, Copy, BookmarkPlus, BookOpen
} from 'lucide-react'

interface Props {
  userId: string
  dailyCalories: number
  foodEntries: FoodEntry[]
  challengeStartDate: string
  initialDate?: string
  recentFoods: Array<{food_name: string, calories: number}>
}

interface SavedMeal {
  id: string
  name: string
  items: Array<{ food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; meal_type: string }>
  total_calories: number
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export default function FoodClient({ userId, dailyCalories, foodEntries: initial, challengeStartDate, initialDate, recentFoods }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Date selection
  const todayStr = getTodayString()
  const [selectedDate, setSelectedDate] = useState(initialDate || todayStr)
  const [entries, setEntries] = useState<FoodEntry[]>(initial)
  const [loadingDate, setLoadingDate] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [mealType, setMealType] = useState<typeof MEAL_TYPES[number]>('lunch')

  // Photo analysis
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [identifiedFoods, setIdentifiedFoods] = useState<Array<{ name: string; estimated_portion: string }>>([])

  // FatSecret search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Selected food + servings
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [servings, setServings] = useState<Serving[]>([])
  const [selectedServing, setSelectedServing] = useState<Serving | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loadingServings, setLoadingServings] = useState(false)

  // Manual override
  const [editingCalories, setEditingCalories] = useState(false)
  const [manualCalories, setManualCalories] = useState('')
  const [manualFoodName, setManualFoodName] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Favorites (localStorage)
  const [favorites, setFavorites] = useState<Array<{food_id: string, food_name: string, brand_name?: string, calories: number, protein: number, carbs: number, fat: number}>>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('reto-favorites') || '[]') } catch { return [] }
  })
  const toggleFavorite = (food: FoodSearchResult, serving: Serving | null) => {
    const existing = favorites.find(f => f.food_id === food.food_id)
    let next: typeof favorites
    if (existing) {
      next = favorites.filter(f => f.food_id !== food.food_id)
    } else {
      next = [...favorites, {
        food_id: food.food_id,
        food_name: food.food_name,
        brand_name: food.brand_name,
        calories: serving?.calories || 0,
        protein: serving?.protein_g || 0,
        carbs: serving?.carbs_g || 0,
        fat: serving?.fat_g || 0,
      }]
    }
    setFavorites(next)
    localStorage.setItem('reto-favorites', JSON.stringify(next))
  }
  const isFavorite = (food_id: string) => favorites.some(f => f.food_id === food_id)

  // Copy day state
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copySourceDate, setCopySourceDate] = useState('')
  const [copyEntries, setCopyEntries] = useState<FoodEntry[]>([])
  const [loadingCopy, setLoadingCopy] = useState(false)
  const [copying, setCopying] = useState(false)

  // Saved meals (localStorage)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('reto-saved-meals') || '[]') } catch { return [] }
  })
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveMealName, setSaveMealName] = useState('')

  const totalCalories = entries.reduce((s, e) => s + e.calories, 0)
  const totalProtein = entries.reduce((s, e) => s + (e.protein_g || 0), 0)
  const totalCarbs = entries.reduce((s, e) => s + (e.carbs_g || 0), 0)
  const totalFat = entries.reduce((s, e) => s + (e.fat_g || 0), 0)

  const [macroTargets] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('reto-macro-targets') || '{}')
        if (stored.protein_g && stored.carbs_g && stored.fat_g) return stored as { protein_g: number; carbs_g: number; fat_g: number }
      } catch {}
    }
    return {
      protein_g: Math.round(dailyCalories * 0.30 / 4),
      carbs_g: Math.round(dailyCalories * 0.45 / 4),
      fat_g: Math.round(dailyCalories * 0.25 / 9),
    }
  })

  const today = todayStr
  const isToday = selectedDate === today
  const challengeDay = getChallengeDay(challengeStartDate)

  const getDateLabel = (dateStr: string) => {
    if (dateStr === today) return 'Hoy'
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (dateStr === formatDate(yesterday)) return 'Ayer'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const getDayOfChallenge = (dateStr: string) => {
    const start = new Date(challengeStartDate)
    const date = new Date(dateStr + 'T00:00:00')
    start.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diff < 1 || diff > 30) return null
    return diff
  }

  const loadDate = async (newDateStr: string) => {
    if (newDateStr > today) return
    setSelectedDate(newDateStr)
    setLoadingDate(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', newDateStr)
      .order('created_at')
    setEntries(data || [])
    setLoadingDate(false)
  }

  // Copy day functions
  const loadCopyEntries = async (sourceDate: string) => {
    if (!sourceDate || sourceDate >= selectedDate) return
    setCopySourceDate(sourceDate)
    setLoadingCopy(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', sourceDate)
      .order('created_at')
    setCopyEntries(data || [])
    setLoadingCopy(false)
  }

  const executeCopy = async () => {
    if (copyEntries.length === 0) return
    setCopying(true)
    const supabase = createClient()
    const toInsert = copyEntries.map(e => ({
      user_id: userId,
      date: selectedDate,
      meal_type: e.meal_type,
      food_name: e.food_name,
      calories: e.calories,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
      analysis_source: 'manual' as const,
    }))
    const { data } = await supabase.from('food_entries').insert(toInsert).select()
    if (data) {
      setEntries(prev => [...prev, ...data])
      setShowCopyModal(false)
      setCopyEntries([])
      setCopySourceDate('')
      if (selectedDate === today) router.refresh()
    }
    setCopying(false)
  }

  // Saved meals functions
  const saveCurrentAsMeal = () => {
    if (!saveMealName.trim() || entries.length === 0) return
    const newMeal: SavedMeal = {
      id: Date.now().toString(),
      name: saveMealName.trim(),
      items: entries.map(e => ({
        food_name: e.food_name,
        calories: e.calories,
        protein_g: e.protein_g || 0,
        carbs_g: e.carbs_g || 0,
        fat_g: e.fat_g || 0,
        meal_type: e.meal_type,
      })),
      total_calories: entries.reduce((s, e) => s + e.calories, 0),
    }
    const next = [...savedMeals, newMeal]
    setSavedMeals(next)
    localStorage.setItem('reto-saved-meals', JSON.stringify(next))
    setSaveMealName('')
    setShowSaveModal(false)
  }

  const deleteSavedMeal = (id: string) => {
    const next = savedMeals.filter(m => m.id !== id)
    setSavedMeals(next)
    localStorage.setItem('reto-saved-meals', JSON.stringify(next))
  }

  const applySavedMeal = async (meal: SavedMeal) => {
    setSaving(true)
    const supabase = createClient()
    const toInsert = meal.items.map(item => ({
      user_id: userId,
      date: selectedDate,
      meal_type: item.meal_type,
      food_name: item.food_name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      analysis_source: 'manual' as const,
    }))
    const { data } = await supabase.from('food_entries').insert(toInsert).select()
    if (data) {
      setEntries(prev => [...prev, ...data])
      if (selectedDate === today) router.refresh()
    }
    setSaving(false)
  }

  // Debounced search
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value)
    setSelectedFood(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search-food?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.foods || [])
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 300)
  }, [])

  // Fetch servings for selected food
  const selectSearchResult = async (food: FoodSearchResult) => {
    setSelectedFood(food)
    setSearchResults([])
    setSearchQuery(food.food_name)
    setLoadingServings(true)
    try {
      const res = await fetch(`/api/food-details?food_id=${food.food_id}`)
      const data = await res.json()
      const s = data.servings || []
      setServings(s)
      if (s.length > 0) setSelectedServing(s[0])
    } catch { setServings([]) }
    setLoadingServings(false)
  }

  // Photo → identify → auto-search
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzing(true)
    setIdentifiedFoods([])
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('meal_type', MEAL_TYPE_LABELS[mealType])
      const res = await fetch('/api/analyze-food', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        const foods = data.identified_foods || []
        setIdentifiedFoods(foods)
        if (foods.length > 0) {
          handleSearchInput(foods[0].name)
        }
      }
    } catch { /* ignore */ }
    setAnalyzing(false)
  }

  const finalCalories = editingCalories
    ? parseInt(manualCalories) || 0
    : selectedServing ? Math.round(selectedServing.calories * quantity) : 0
  const finalProtein = selectedServing ? Math.round(selectedServing.protein_g * quantity * 10) / 10 : 0
  const finalCarbs = selectedServing ? Math.round(selectedServing.carbs_g * quantity * 10) / 10 : 0
  const finalFat = selectedServing ? Math.round(selectedServing.fat_g * quantity * 10) / 10 : 0

  const canSave = (selectedFood && selectedServing) || (manualFoodName && parseInt(manualCalories) > 0)

  const saveEntry = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    const isManual = !selectedFood
    const insertData = {
      user_id: userId,
      date: selectedDate,
      meal_type: mealType,
      food_name: isManual ? manualFoodName : selectedFood!.food_name,
      calories: isManual ? parseInt(manualCalories) : finalCalories,
      protein_g: isManual ? 0 : finalProtein,
      carbs_g: isManual ? 0 : finalCarbs,
      fat_g: isManual ? 0 : finalFat,
      analysis_source: 'manual' as const,
    }

    const { data, error } = await supabase
      .from('food_entries')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      setSaveError('Error al guardar. Inténtalo de nuevo.')
      console.error('Save error:', error)
    } else if (data) {
      setEntries(prev => [...prev, data])
      resetForm()
      if (selectedDate === today) router.refresh()
    }
    setSaving(false)
  }

  const deleteEntry = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('food_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
    if (selectedDate === today) router.refresh()
  }

  const resetForm = () => {
    setShowForm(false)
    setImagePreview(null)
    setAnalyzing(false)
    setIdentifiedFoods([])
    setSearchQuery('')
    setSearchResults([])
    setSelectedFood(null)
    setServings([])
    setSelectedServing(null)
    setQuantity(1)
    setEditingCalories(false)
    setManualCalories('')
    setManualFoodName('')
    setLoadingServings(false)
    setSaveError(null)
  }

  const groupedEntries = MEAL_TYPES.reduce((acc, mt) => {
    acc[mt] = entries.filter(e => e.meal_type === mt)
    return acc
  }, {} as Record<string, FoodEntry[]>)

  const selectedDayOfChallenge = getDayOfChallenge(selectedDate)

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground">Comidas</h1>
          {selectedDayOfChallenge && (
            <p className="text-muted text-sm">Día {selectedDayOfChallenge} del reto</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-muted text-sm font-medium rounded-xl border border-border transition-all"
          >
            <Copy className="w-4 h-4" /> Copiar día
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-lime hover:bg-lime-dark text-background text-sm font-semibold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Añadir
          </button>
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
              <p className="text-sm font-semibold text-foreground">{getDateLabel(selectedDate)}</p>
              {selectedDayOfChallenge && <p className="text-xs text-muted-dark">Día {selectedDayOfChallenge} del reto</p>}
            </>
          )}
        </div>
        <DatePickerCalendar value={selectedDate} onChange={loadDate} align="down" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: calorie summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 lg:sticky lg:top-8">
            {loadingDate ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-lime animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-muted">Total consumido</p>
                    <p className="text-3xl font-bold font-heading text-foreground">{totalCalories} <span className="text-lg text-muted">kcal</span></p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <CalorieChart consumed={totalCalories} target={dailyCalories} />
                </div>
                <p className="text-center text-sm text-muted mt-2">Objetivo: {dailyCalories} kcal</p>

                {entries.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    {[
                      { label: 'Proteína', consumed: Math.round(totalProtein), target: macroTargets.protein_g, barColor: 'bg-accent-cyan', textColor: 'text-accent-cyan' },
                      { label: 'Carbos', consumed: Math.round(totalCarbs), target: macroTargets.carbs_g, barColor: 'bg-accent-orange', textColor: 'text-accent-orange' },
                      { label: 'Grasas', consumed: Math.round(totalFat), target: macroTargets.fat_g, barColor: 'bg-warning', textColor: 'text-warning' },
                    ].map(macro => {
                      const pct = macro.target > 0 ? Math.min(100, Math.round(macro.consumed / macro.target * 100)) : 0
                      const over = macro.consumed > macro.target
                      return (
                        <div key={macro.label}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-medium ${macro.textColor}`}>{macro.label}</span>
                            <span className="text-xs text-muted">
                              <span className={over ? 'text-danger font-medium' : 'text-foreground font-medium'}>{macro.consumed}g</span>
                              <span className="text-muted-dark"> / {macro.target}g</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-danger' : macro.barColor}`}
                              style={{ width: `${pct}%`, opacity: 0.85 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: meals list */}
        <div className="lg:col-span-2 space-y-4">
          {!loadingDate && MEAL_TYPES.map(mt => {
            const mealEntries = groupedEntries[mt]
            if (mealEntries.length === 0) return null
            const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0)
            return (
              <motion.div key={mt} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold font-heading text-foreground flex items-center gap-2">
                    <span className="text-lg">{MEAL_TYPE_ICONS[mt]}</span> {MEAL_TYPE_LABELS[mt]}
                  </h2>
                  <span className="text-sm font-medium font-heading text-muted">{mealCals} kcal</span>
                </div>
                <div className="space-y-2">
                  {mealEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.food_name}</p>
                        <p className="text-xs text-muted-dark">
                          {entry.protein_g > 0 && `P: ${Math.round(entry.protein_g)}g · `}
                          {entry.carbs_g > 0 && `C: ${Math.round(entry.carbs_g)}g · `}
                          {entry.fat_g > 0 && `G: ${Math.round(entry.fat_g)}g`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold font-heading text-foreground">{entry.calories}</p>
                        <p className="text-xs text-muted-dark">kcal</p>
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deletingId === entry.id}
                        className="text-muted-dark hover:text-danger transition-colors ml-1"
                      >
                        {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}

          {/* Save current as template */}
          {!loadingDate && entries.length > 0 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-border rounded-xl text-xs text-muted transition-colors"
              >
                <BookmarkPlus className="w-3.5 h-3.5" /> Guardar como plantilla
              </button>
            </div>
          )}

          {/* Apply saved meal */}
          {!loadingDate && savedMeals.length > 0 && entries.length === 0 && (
            <div className="card p-5">
              <h3 className="font-semibold font-heading text-foreground text-sm mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-lime" /> Plantillas guardadas
              </h3>
              <div className="space-y-2">
                {savedMeals.map(meal => (
                  <div key={meal.id} className="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.05] rounded-xl border border-border transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{meal.name}</p>
                      <p className="text-xs text-muted-dark">{meal.items.length} alimentos · {meal.total_calories} kcal</p>
                    </div>
                    <button onClick={() => applySavedMeal(meal)} disabled={saving}
                      className="px-3 py-1.5 bg-lime/10 hover:bg-lime/20 text-lime text-xs font-medium rounded-lg border border-lime/20 transition-colors">
                      Usar
                    </button>
                    <button onClick={() => deleteSavedMeal(meal.id)}
                      className="text-muted-dark hover:text-danger transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadingDate && entries.length === 0 && (
            <div className="text-center py-16 text-muted">
              <Zap className="w-10 h-10 mx-auto mb-3 text-muted-dark" />
              <p className="text-lg mb-1 font-heading">Sin registros {isToday ? 'hoy' : 'este día'}</p>
              <p className="text-sm text-muted-dark">Añade tu primera comida pulsando el botón de arriba</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card rounded-t-2xl lg:rounded-2xl w-full max-w-lg flex flex-col border border-border-strong shadow-2xl"
              style={{ maxHeight: '90dvh' }}
            >
              {/* Sticky header */}
              <div className="flex justify-between items-center p-5 border-b border-border shrink-0">
                <div>
                  <h2 className="text-lg font-semibold font-heading text-foreground">Registrar comida</h2>
                  <p className="text-xs text-muted">{getDateLabel(selectedDate)}</p>
                </div>
                <button onClick={resetForm} className="text-muted hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                {/* Meal type selector */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Tipo de comida</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map(mt => (
                      <button key={mt} onClick={() => setMealType(mt)}
                        className={`py-2.5 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all border ${
                          mealType === mt
                            ? 'bg-lime/10 text-lime border-lime/30'
                            : 'bg-white/[0.03] text-muted border-border hover:bg-white/[0.06]'
                        }`}>
                        <span className="text-base">{MEAL_TYPE_ICONS[mt]}</span>
                        {MEAL_TYPE_LABELS[mt]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Foto del plato (opcional)</label>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

                  {!imagePreview ? (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full h-28 border-2 border-dashed border-border-strong hover:border-lime/30 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-muted hover:text-lime transition-all">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-medium">La IA identificará los alimentos</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-2xl" />
                      <button onClick={() => { setImagePreview(null); setIdentifiedFoods([]); }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      {analyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl gap-2">
                          <Loader2 className="w-6 h-6 text-lime animate-spin" />
                          <p className="text-white text-sm">Identificando alimentos...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {identifiedFoods.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {identifiedFoods.map((f, i) => (
                        <button key={i}
                          onClick={() => handleSearchInput(f.name)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-lime/10 text-lime border border-lime/20 hover:bg-lime/20 transition-colors"
                        >
                          {f.name} ({f.estimated_portion})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Food search */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Buscar alimento</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearchInput(e.target.value)}
                      placeholder="Ej: arroz, pollo, manzana..."
                      className="w-full bg-background border border-border-strong rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lime animate-spin" />}
                  </div>

                  {searchQuery === '' && !selectedFood && recentFoods.length > 0 && (
                    <div className="mb-3 mt-2">
                      <p className="text-xs text-muted mb-2 font-medium">Recientes</p>
                      <div className="flex flex-wrap gap-2">
                        {recentFoods.map(f => (
                          <button
                            key={f.food_name}
                            onClick={() => handleSearchInput(f.food_name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-border rounded-xl text-xs text-foreground transition-colors"
                          >
                            <span>{f.food_name}</span>
                            <span className="text-muted-dark">{f.calories} kcal</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchQuery === '' && !selectedFood && favorites.length > 0 && (
                    <div className="mb-3 mt-3">
                      <p className="text-xs text-muted mb-2 font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 text-warning" fill="currentColor" /> Favoritos
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {favorites.map(f => (
                          <button
                            key={f.food_id}
                            onClick={() => handleSearchInput(f.food_name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/5 hover:bg-warning/10 border border-warning/20 rounded-xl text-xs text-foreground transition-colors"
                          >
                            <Star className="w-3 h-3 text-warning shrink-0" fill="currentColor" />
                            <span>{f.food_name}</span>
                            <span className="text-muted-dark">{f.calories} kcal</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && !selectedFood && (
                    <div className="mt-1 bg-elevated border border-border-strong rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      {searchResults.map((result) => (
                        <div key={result.food_id} className="flex items-center border-b border-border last:border-0">
                          <button onClick={() => selectSearchResult(result)}
                            className="flex-1 px-4 py-3 hover:bg-white/[0.04] text-left transition-colors">
                            <p className="text-sm font-medium text-foreground">{result.food_name}</p>
                            {result.brand_name && <p className="text-xs text-muted-dark">{result.brand_name}</p>}
                            <p className="text-xs text-muted mt-0.5 line-clamp-1">{result.food_description}</p>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(result, null) }}
                            className={`p-1.5 rounded-lg transition-colors shrink-0 mr-2 ${isFavorite(result.food_id) ? 'text-warning' : 'text-muted-dark hover:text-warning'}`}
                          >
                            <Star className="w-4 h-4" fill={isFavorite(result.food_id) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Serving picker */}
                {selectedFood && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-lime/5 border border-lime/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground flex-1 mr-2">{selectedFood.food_name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleFavorite(selectedFood, selectedServing)}
                          className={`p-1.5 rounded-lg transition-colors ${isFavorite(selectedFood.food_id) ? 'text-warning' : 'text-muted-dark hover:text-warning'}`}
                        >
                          <Star className="w-4 h-4" fill={isFavorite(selectedFood.food_id) ? 'currentColor' : 'none'} />
                        </button>
                        <button onClick={() => { setSelectedFood(null); setServings([]); setSelectedServing(null); setSearchQuery(''); }}
                          className="text-muted-dark hover:text-foreground"><X className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {loadingServings ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 text-lime animate-spin" />
                        <span className="text-sm text-muted">Cargando porciones...</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5">Porción</label>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {servings.map(s => (
                              <label key={s.serving_id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                selectedServing?.serving_id === s.serving_id ? 'bg-lime/10 border border-lime/30' : 'hover:bg-white/[0.03] border border-transparent'
                              }`}>
                                <input
                                  type="radio"
                                  name="serving"
                                  checked={selectedServing?.serving_id === s.serving_id}
                                  onChange={() => setSelectedServing(s)}
                                  className="accent-lime"
                                />
                                <span className="text-sm text-foreground flex-1">{s.serving_description}</span>
                                <span className="text-xs text-muted">{s.calories} kcal</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted mb-1.5">Cantidad</label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                              className="w-8 h-8 rounded-lg bg-white/[0.05] text-foreground hover:bg-white/[0.1] transition-colors text-sm font-bold">-</button>
                            <input
                              type="number"
                              value={quantity}
                              onChange={e => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0))}
                              className="w-16 bg-background border border-border-strong rounded-lg px-2 py-1.5 text-sm text-center text-foreground focus:outline-none focus:border-lime"
                              step={0.5}
                              min={0.1}
                            />
                            <button onClick={() => setQuantity(quantity + 0.5)}
                              className="w-8 h-8 rounded-lg bg-white/[0.05] text-foreground hover:bg-white/[0.1] transition-colors text-sm font-bold">+</button>
                          </div>
                        </div>

                        {selectedServing && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {editingCalories ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" value={manualCalories}
                                    onChange={e => setManualCalories(e.target.value)}
                                    className="w-20 bg-background border border-lime/30 rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none" />
                                  <span className="text-muted text-sm">kcal</span>
                                  <button onClick={() => setEditingCalories(false)} className="text-success"><Check className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-bold font-heading text-foreground">{finalCalories}</span>
                                  <span className="text-muted text-sm">kcal</span>
                                  <button onClick={() => { setManualCalories(String(finalCalories)); setEditingCalories(true); }}
                                    className="text-muted-dark hover:text-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'Proteína', value: finalProtein, color: 'text-accent-cyan' },
                                { label: 'Carbos', value: finalCarbs, color: 'text-accent-orange' },
                                { label: 'Grasas', value: finalFat, color: 'text-warning' },
                              ].map(m => (
                                <div key={m.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                                  <p className={`text-sm font-bold ${m.color}`}>{Math.round(m.value)}g</p>
                                  <p className="text-xs text-muted-dark">{m.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Manual entry fallback */}
                {!selectedFood && !analyzing && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-dark mb-2">O registra manualmente:</p>
                    <div className="flex gap-2">
                      <input type="text" value={manualFoodName} onChange={e => setManualFoodName(e.target.value)}
                        placeholder="Nombre del alimento"
                        className="flex-1 bg-background border border-border-strong rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors" />
                      <input type="number" value={manualCalories} onChange={e => setManualCalories(e.target.value)}
                        placeholder="kcal"
                        className="w-20 bg-background border border-border-strong rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-dark focus:outline-none focus:border-lime transition-colors" />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {saveError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {saveError}
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={saveEntry}
                  disabled={!canSave || saving}
                  className="w-full py-3.5 bg-lime hover:bg-lime-dark disabled:opacity-40 disabled:cursor-not-allowed text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Guardar comida'}
                </button>

                {/* Bottom padding for mobile safe area */}
                <div className="h-2" />
              </div>
            </motion.div>
          </motion.div>
        )}

        {showCopyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCopyModal(false) }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card rounded-t-2xl lg:rounded-2xl w-full max-w-lg flex flex-col border border-border-strong shadow-2xl"
              style={{ maxHeight: '80dvh' }}
            >
              <div className="flex justify-between items-center p-5 border-b border-border shrink-0">
                <div>
                  <h2 className="text-lg font-semibold font-heading text-foreground">Copiar comidas</h2>
                  <p className="text-xs text-muted">Selecciona un día anterior para copiar sus comidas</p>
                </div>
                <button onClick={() => setShowCopyModal(false)} className="text-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Día origen</label>
                  <DatePickerCalendar
                    value={copySourceDate || ''}
                    onChange={loadCopyEntries}
                    align="down"
                  />
                </div>

                {loadingCopy && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-lime animate-spin" />
                  </div>
                )}

                {!loadingCopy && copySourceDate && copyEntries.length === 0 && (
                  <p className="text-sm text-muted text-center py-4">Sin comidas registradas ese día</p>
                )}

                {!loadingCopy && copyEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted font-medium">{copyEntries.length} comidas a copiar:</p>
                    {copyEntries.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm text-foreground">{e.food_name}</p>
                          <p className="text-xs text-muted-dark">{MEAL_TYPE_LABELS[e.meal_type as keyof typeof MEAL_TYPE_LABELS]}</p>
                        </div>
                        <span className="text-sm font-medium text-muted">{e.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                )}

                {copyEntries.length > 0 && (
                  <button
                    onClick={executeCopy}
                    disabled={copying}
                    className="w-full py-3 bg-lime hover:bg-lime-dark disabled:opacity-40 text-background font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {copying ? 'Copiando...' : `Copiar ${copyEntries.length} comidas a ${getDateLabel(selectedDate)}`}
                  </button>
                )}
                <div className="h-2" />
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl w-full max-w-sm p-5 border border-border-strong shadow-2xl"
            >
              <h3 className="text-lg font-semibold font-heading text-foreground mb-1">Guardar como plantilla</h3>
              <p className="text-xs text-muted mb-4">{entries.length} alimentos · {totalCalories} kcal total</p>
              <input
                type="text"
                value={saveMealName}
                onChange={e => setSaveMealName(e.target.value)}
                placeholder="Nombre (ej: Desayuno habitual)"
                className="w-full bg-background border border-border-strong rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-dark focus:outline-none focus:border-lime mb-4"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveCurrentAsMeal()}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] text-muted rounded-xl text-sm transition-colors">
                  Cancelar
                </button>
                <button onClick={saveCurrentAsMeal} disabled={!saveMealName.trim()}
                  className="flex-1 py-2.5 bg-lime hover:bg-lime-dark disabled:opacity-40 text-background font-semibold rounded-xl text-sm transition-colors">
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
