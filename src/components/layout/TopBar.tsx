'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Settings, LogOut, ChevronDown, Wallet, Target } from 'lucide-react'
import Link from 'next/link'

export default function TopBar() {
  const router  = useRouter()
  const path    = usePathname()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!menu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menu])

  // Fecha o menu ao mudar de rota
  useEffect(() => { setMenu(false) }, [path])

  async function logout() {
    setMenu(false)
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const mes = format(new Date(),'MMMM yyyy',{locale:ptBR})
  const iconBtn = (href: string, Icon: any, isActive: boolean) => (
    <Link href={href} style={{
      width:32, height:32,
      background: isActive ? 'rgba(196,98,45,0.2)' : 'rgba(255,255,255,0.07)',
      borderRadius:10,
      display:'flex', alignItems:'center', justifyContent:'center',
      border: isActive ? '1px solid rgba(196,98,45,0.4)' : 'none',
    }}>
      <Icon size={16} color={isActive ? '#C4622D' : 'rgba(200,184,154,0.6)'}/>
    </Link>
  )

  return (
    <header style={{
      background: 'linear-gradient(180deg,#2A1C0E 0%,#1E1408 100%)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, zIndex: 40, height: 60,
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      {/* Logo + mês */}
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
          <p style={{ fontSize:10, color:'rgba(200,184,154,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', lineHeight:1, marginBottom:2 }}>Lucas & Nicoly</p>
          <p style={{ fontSize:14, fontWeight:700, color:'#F4EFE8', lineHeight:1, textTransform:'capitalize' }}>{mes}</p>
        </div>
      </div>

      {/* Ações à direita */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {iconBtn('/pagamentos', Wallet, path.startsWith('/pagamentos'))}
        {iconBtn('/metas',     Target,  path.startsWith('/metas'))}
        {iconBtn('/parametros',Settings,path.startsWith('/parametros'))}

        {/* Avatar + menu */}
        <div ref={menuRef} style={{ position:'relative' }}>
          <button
            onClick={()=>setMenu(m=>!m)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px', borderRadius:10, background: menu ? 'rgba(196,98,45,0.2)' : 'rgba(255,255,255,0.07)', border:'none', cursor:'pointer' }}
          >
            <div style={{ width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#C4A882,#8B6340)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#2A1B12' }}>L</span>
            </div>
            <ChevronDown size={12} color="rgba(200,184,154,0.7)" style={{ transform: menu?'rotate(180deg)':'rotate(0)', transition:'transform 0.2s' }}/>
          </button>

          {menu && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', background:'#2A1C0E', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,.7)', padding:'6px', zIndex:50, minWidth:180, border:'0.5px solid rgba(255,255,255,0.1)' }}>
              <div style={{ padding:'8px 12px 6px', borderBottom:'0.5px solid rgba(255,255,255,0.07)', marginBottom:4 }}>
                <p style={{ fontSize:12, fontWeight:600, color:'#C8B89A', margin:0 }}>Lucas Davisson</p>
                <p style={{ fontSize:10, color:'#8B7A6A', margin:'2px 0 0' }}>lucas@ln.app</p>
              </div>
              <button onClick={logout} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, border:'none', background:'none', cursor:'pointer', color:'#C4622D', fontSize:13, fontWeight:600 }}>
                <LogOut size={15}/> Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
