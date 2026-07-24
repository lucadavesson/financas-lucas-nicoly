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
      background: 'linear-gradient(180deg,#2C1A0E 0%,#1A0F0A 100%)',
      borderBottom: '0.5px solid rgba(201,168,76,0.15)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, zIndex: 40,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:32, height:32,
          background: 'linear-gradient(135deg,#C9A84C,#8B5E3C)',
          borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: '0 2px 8px rgba(201,168,76,0.3)',
        }}>
          <span style={{ color:'#1A0F0A', fontSize:10, fontWeight:800, letterSpacing:'-0.5px' }}>L&N</span>
        </div>
        <div>
          <p style={{ fontSize:9, color:'#C9A84C', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1, marginBottom:2 }}>
            Lucas & Nicoly
          </p>
          <p style={{ fontSize:13, fontWeight:600, color:'#F5E6D3', lineHeight:1, textTransform:'capitalize' }}>
            {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
          </p>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <Link href="/parametros" style={{
          width:32, height:32, background:'rgba(201,168,76,0.1)',
          border: '0.5px solid rgba(201,168,76,0.2)',
          borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <Settings size={15} color="#C9A84C" />
        </Link>
        <div style={{ position:'relative' }}>
          <button onClick={() => setMenu(!menu)} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 8px', borderRadius:10,
            background:'rgba(201,168,76,0.1)',
            border:'0.5px solid rgba(201,168,76,0.2)',
            cursor:'pointer',
          }}>
            <div style={{
              width:22, height:22, borderRadius:'50%',
              background:'linear-gradient(135deg,#C9A84C,#8B5E3C)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#1A0F0A' }}>L</span>
            </div>
            <ChevronDown size={12} color="#C9A84C" />
          </button>
          {menu && (
            <div style={{
              position:'absolute', right:0, top:'calc(100% + 6px)',
              background:'#2C1A0E', borderRadius:14,
              border:'0.5px solid rgba(201,168,76,0.2)',
              boxShadow:'0 8px 32px rgba(0,0,0,.5)',
              padding:'4px', zIndex:50, minWidth:160,
            }}>
              <button onClick={logout} style={{
                width:'100%', display:'flex', alignItems:'center', gap:8,
                padding:'10px 12px', borderRadius:10, border:'none',
                background:'none', cursor:'pointer', color:'#C4622D', fontSize:14,
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
