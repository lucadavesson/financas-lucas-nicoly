'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, Plus, CreditCard, BarChart2 } from 'lucide-react'

const items = [
  { href:'/dashboard',   icon:Home,       label:'Início'      },
  { href:'/lancamentos', icon:List,       label:'Lançamentos' },
  { href:null,           icon:Plus,       label:'', fab:true  },
  { href:'/cartoes',     icon:CreditCard, label:'Cartões'     },
  { href:'/relatorios',  icon:BarChart2,  label:'Relatórios'  },
]

export default function BottomNav() {
  const path = usePathname()

  return (
    <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, zIndex:50 }}>
      {/* Onda SVG — decorativa, não clicável */}
      <svg viewBox="0 0 480 60" style={{ width:'100%', display:'block', marginBottom:-1, pointerEvents:'none' }} preserveAspectRatio="none">
        <path d="M0,60 L0,30 Q80,25 175,27 Q210,27 220,10 Q240,0 260,10 Q270,27 305,27 Q400,25 480,30 L480,60 Z"
          fill="#2A1C0E"/>
      </svg>
      <nav style={{
        background:'#2A1C0E',
        display:'flex', alignItems:'center',
        paddingBottom:'env(safe-area-inset-bottom,14px)',
        paddingTop:4,
        borderTop:'0.5px solid rgba(255,255,255,0.06)',
      }}>
        {items.map((item, idx) => {
          if (item.fab) return (
            <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', marginTop:-38 }}>
              <Link href="/lancamentos/novo" style={{ display:'block' }}>
                <div style={{
                  width:56, height:56,
                  background: 'radial-gradient(circle at 35% 35%, #E8A070, #C4622D 60%, #A04010)',
                  borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 20px rgba(196,98,45,0.6), inset 0 1px 0 rgba(255,255,255,0.2)',
                  border:'1.5px solid rgba(244,239,232,0.15)',
                }}>
                  <Plus size={24} color="#F4EFE8" strokeWidth={2.5}/>
                </div>
              </Link>
            </div>
          )
          const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href!))
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href!} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px 4px', textDecoration:'none' }}>
              {/* Indicador ativo — ponto acima do ícone */}
              <div style={{ width:4, height:4, borderRadius:'50%', background: active ? '#C4622D' : 'transparent', marginBottom:2, transition:'background 0.2s' }}/>
              <Icon size={22} strokeWidth={active?2.5:1.6} color={active?'#F4EFE8':'#8B7A6A'}/>
              <span style={{ fontSize:10, fontWeight:active?700:400, color:active?'#F4EFE8':'#8B7A6A' }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
