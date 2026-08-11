'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Settings, LogOut, ChevronDown, Target } from 'lucide-react'
import Link from 'next/link'

export default function TopBar() {
  const router  = useRouter()
  const path    = usePathname()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menu])
  useEffect(() => { setMenu(false) }, [path])

  async function logout() {
    setMenu(false)
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }

  const mes = format(new Date(),'MMMM yyyy',{locale:ptBR})
  const iconBtn = (href:string, Icon:any) => {
    const active = path.startsWith(href)
    return (
      <Link href={href} style={{
        width:34, height:34, borderRadius:10,
        background: active ? 'rgba(196,98,45,0.1)' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <Icon size={18} color={active ? '#C4622D' : '#8E8E93'}/>
      </Link>
    )
  }

  return (
    <header style={{
      background:'#FFFFFF',
      padding:'10px 16px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      flexShrink:0, zIndex:40, height:56,
      borderBottom:'1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:32, height:32,
          background:'linear-gradient(135deg,#C4622D,#A04818)',
          borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <span style={{ color:'#fff', fontSize:9, fontWeight:800, letterSpacing:'-0.3px' }}>L&N</span>
        </div>
        <div>
          <p style={{ fontSize:10, color:'#8E8E93', textTransform:'uppercase', letterSpacing:'0.06em', lineHeight:1, marginBottom:2 }}>Lucas & Nicoly</p>
          <p style={{ fontSize:14, fontWeight:700, color:'#1C1C1E', lineHeight:1, textTransform:'capitalize' }}>{mes}</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        {iconBtn('/metas', Target)}
        {iconBtn('/parametros', Settings)}
        <div ref={menuRef} style={{ position:'relative' }}>
          <button onClick={()=>setMenu(m=>!m)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 8px', borderRadius:10, background:menu?'rgba(0,0,0,0.04)':'transparent', border:'none', cursor:'pointer' }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#C4622D,#A04818)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>L</span>
            </div>
            <ChevronDown size={12} color="#8E8E93" style={{ transform:menu?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}/>
          </button>
          {menu && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'#fff', borderRadius:14, boxShadow:'0 4px 24px rgba(0,0,0,.12)', padding:'6px', zIndex:50, minWidth:180, border:'1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ padding:'8px 12px 6px', borderBottom:'1px solid rgba(0,0,0,0.05)', marginBottom:4 }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#1C1C1E', margin:0 }}>Lucas Davisson</p>
                <p style={{ fontSize:11, color:'#8E8E93', margin:'2px 0 0' }}>lucas@ln.app</p>
              </div>
              <button onClick={logout} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:'none', background:'none', cursor:'pointer', color:'#FF3B30', fontSize:13, fontWeight:600 }}>
                <LogOut size={15}/> Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
