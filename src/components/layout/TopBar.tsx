'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Settings, LogOut, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export default function TopBar() {
  const router = useRouter()
  const [menu, setMenu] = useState(false)

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      background: '#1C1C1E',
      borderBottom: '0.5px solid rgba(139,105,20,0.3)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30,
          background: 'linear-gradient(135deg,#8B6914,#5C4A0A)',
          borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#FAF7F4', fontSize: 10, fontWeight: 700 }}>L&N</span>
        </div>
        <div>
          <p style={{ fontSize: 10, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
            Lucas & Nicoly
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#FAF7F4', lineHeight: 1.3, textTransform: 'capitalize' }}>
            {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href="/parametros" style={{
          width: 32, height: 32, background: 'rgba(139,105,20,0.15)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={15} color="#8B6914" />
        </Link>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(!menu)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(139,105,20,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8B6914' }}>L</span>
            </div>
            <ChevronDown size={13} color="#8B6914" />
          </button>
          {menu && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)',
              background: '#1C1C1E', borderRadius: 14,
              border: '0.5px solid rgba(139,105,20,0.3)',
              boxShadow: '0 8px 24px rgba(0,0,0,.4)',
              padding: '4px', zIndex: 50, minWidth: 160,
            }}>
              <button onClick={logout} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10, border: 'none',
                background: 'none', cursor: 'pointer', color: '#C4622D', fontSize: 14,
              }}>
                <LogOut size={15} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
