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
      <svg viewBox="0 0 480 90" style={{ width:'100%', display:'block', marginBottom:-2 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="navGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3D2C20"/>
            <stop offset="100%" stopColor="#2A1B12"/>
          </linearGradient>
        </defs>
        <path d="M0,90 L0,45 Q80,40 180,42 Q215,42 225,20 Q240,0 255,20 Q265,42 300,42 Q400,40 480,45 L480,90 Z"
          fill="url(#navGrad)"/>
      </svg>
      <nav style={{ background:'linear-gradient(180deg,#3D2C20,#2A1B12)', display:'flex', alignItems:'flex-end', paddingBottom:'env(safe-area-inset-bottom,10px)', paddingTop:2 }}>
        {items.map((item) => {
          if (item.fab) return (
            <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', marginTop:-50 }}>
              <Link href="/lancamentos/novo">
                <div style={{
                  width:58, height:58,
                  background: 'radial-gradient(circle at 35% 35%, #E8A070, #C4622D 60%, #A04010)',
                  borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 20px rgba(196,98,45,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                  border:'1.5px solid rgba(244,239,232,0.15)',
                }}>
                  <Plus size={26} color="#F4EFE8" strokeWidth={2.5}/>
                </div>
              </Link>
            </div>
          )
          const active = item.href && path.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href!} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 4px 8px' }}>
              <Icon size={22} strokeWidth={active?2.5:1.6} color={active?'#F4EFE8':'#A69C8F'}/>
              <span style={{ fontSize:10, fontWeight:500, color:active?'#F4EFE8':'#A69C8F' }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
