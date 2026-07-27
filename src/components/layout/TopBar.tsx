'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Settings, LogOut, ChevronDown, CreditCard, Target } from 'lucide-react'
import Link from 'next/link'

const PAGE_TITLES: Record<string,string> = {
  '/dashboard':   'Julho 2026',
  '/lancamentos': 'Julho 2026',
  '/pagamentos':  'Julho 2026',
  '/relatorios':  'Julho 2026',
  '/cartoes':     'Julho 2026',
  '/metas':       'Julho 2026',
  '/parametros':  'Julho 2026',
}

export default function TopBar() {
  const router   = useRouter()
  const path     = usePathname()
  const [menu, setMenu] = useState(false)

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const mes = format(new Date(),'MMMM yyyy',{locale:ptBR})

  return (
    <header style={{
      background: 'linear-gradient(180deg,#2A1C0E 0%,#1E1408 100%)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, zIndex: 40, height: 60,
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:34, height:34,
          background: 'linear-gradient(135deg,#C4A882,#8B6340)',
          borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 2px 8px rgba(0,0,0,0.4)',
        }}>
          <span style={{ color:'#2A1B12', fontSize:10, fontWeight:800 }}>L&N</span>
        </div>
        <div>
          <p style={{ fontSize:10, color:'rgba(200,184,154,0.6)', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1, marginBottom:2 }}>Lucas & Nicoly</p>
          <p style={{ fontSize:14, fontWeight:700, color:'#F4EFE8', lineHeight:1, textTransform:'capitalize' }}>
            {mes}
          </p>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {/* Atalho Cartões */}
        <Link href="/cartoes" style={{
          width:32, height:32, background:'rgba(255,255,255,0.07)', borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          border: path.startsWith('/cartoes') ? '1px solid rgba(196,98,45,0.5)' : 'none',
        }}>
          <CreditCard size={16} color={path.startsWith('/cartoes')?"#C4622D":"rgba(200,184,154,0.6)"}/>
        </Link>
        {/* Atalho Metas */}
        <Link href="/metas" style={{
          width:32, height:32, background:'rgba(255,255,255,0.07)', borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          border: path.startsWith('/metas') ? '1px solid rgba(196,98,45,0.5)' : 'none',
        }}>
          <Target size={16} color={path.startsWith('/metas')?"#C4622D":"rgba(200,184,154,0.6)"}/>
        </Link>
        {/* Settings */}
        <Link href="/parametros" style={{
          width:32, height:32, background:'rgba(255,255,255,0.07)', borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          border: path.startsWith('/parametros') ? '1px solid rgba(196,98,45,0.5)' : 'none',
        }}>
          <Settings size={16} color={path.startsWith('/parametros')?"#C4622D":"rgba(200,184,154,0.6)"}/>
        </Link>
        {/* Avatar + logout */}
        <div style={{ position:'relative' }}>
          <button onClick={()=>setMenu(!menu)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderRadius:10, background:'rgba(255,255,255,0.07)', border:'none', cursor:'pointer' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#C4A882,#8B6340)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#2A1B12' }}>L</span>
            </div>
            <ChevronDown size={12} color="rgba(200,184,154,0.7)"/>
          </button>
          {menu && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#2A1C0E', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,.6)', padding:'4px', zIndex:50, minWidth:160, border:'0.5px solid rgba(255,255,255,0.1)' }}>
              <button onClick={logout} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, border:'none', background:'none', cursor:'pointer', color:'#C4622D', fontSize:14 }}>
                <LogOut size={15}/> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
