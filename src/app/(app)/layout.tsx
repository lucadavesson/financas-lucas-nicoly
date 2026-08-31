import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import TopBar from '@/components/layout/TopBar'
import LockGate from '@/components/security/LockGate'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <LockGate>
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', background:'#F5F5F7' }}>
        <TopBar />
        <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', overscrollBehavior:'none', WebkitOverflowScrolling:'touch' as any, position:'relative' }}>
          {children}
        </main>
        <BottomNav />
      </div>
    </LockGate>
  )
}
