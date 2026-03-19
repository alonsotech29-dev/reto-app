import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'
import SideNav from '@/components/SideNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/register')

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <SideNav />
      </Suspense>
      <main className="lg:pl-64 pb-24 lg:pb-0">
        {children}
      </main>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  )
}
