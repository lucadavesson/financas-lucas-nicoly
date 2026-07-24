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
    router.push('/login'); router.refresh()
  }

  return (
    <header style={{
      background:'linear-gradient(180deg,#1F140D 0%,#2A1B12 100%)',
      padding:'14px 16px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      flexShrink:0, zIndex:40, height:64,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:34, height:34,
          background:'linear-gradient(135deg,#D88B5B,#8B5E3C)',
          borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 2px 8px rgba(216,139,91,0.35)',
        }}>
          <span style={{ color:'#2A1B12', fontSize:10, fontWeight:800 }}>L&N</span>
        </div>
        <div>
          <p style={{ fontSize:10, color:'#A69C8F', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1, marginBottom:2 }}>Lucas & Nicoly</p>
          <p style={{ fontSize:14, fontWeight:700, color:'#F4EFE8', lineHeight:1, textTransform:'capitalize' }}>
            {format(new Date(),'MMMM yyyy',{locale:ptBR})}
          </p>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <Link href="/parametros" style={{ width:34, height:34, background:'rgba(216,139,91,0.12)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:'0.5px solid rgba(216,139,91,0.2)' }}>
          <Settings size={16} color="#D88B5B"/>
        </Link>
        <div style={{ position:'relative' }}>
          <button onClick={()=>setMenu(!menu)} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 9px', borderRadius:10, background:'rgba(216,139,91,0.12)', border:'0.5px solid rgba(216,139,91,0.2)', cursor:'pointer' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#D88B5B,#8B5E3C)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#2A1B12' }}>L</span>
            </div>
            <ChevronDown size={12} color="#D88B5B"/>
          </button>
          {menu && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#3D2C20', borderRadius:14, border:'0.5px solid rgba(216,139,91,0.2)', boxShadow:'0 8px 32px rgba(0,0,0,.5)', padding:'4px', zIndex:50, minWidth:160 }}>
              <button onClick={logout} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:'none', background:'none', cursor:'pointer', color:'#D88B5B', fontSize:14 }}>
                <LogOut size={15}/> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
