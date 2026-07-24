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
      {/* SVG da forma líquida */}
      <svg viewBox="0 0 480 80" style={{ width:'100%', display:'block', marginBottom:-1 }} preserveAspectRatio="none">
        <path d="M0,80 L0,32 Q80,28 160,30 Q200,30 220,10 Q240,-4 260,10 Q280,30 320,30 Q400,28 480,32 L480,80 Z"
          fill="#23160F"/>
      </svg>
      <nav style={{ background:'#23160F', display:'flex', alignItems:'flex-end', paddingBottom:'env(safe-area-inset-bottom,8px)', paddingTop:4 }}>
        {items.map((item) => {
          if (item.fab) return (
            <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', marginTop:-44 }}>
              <Link href="/lancamentos/novo">
                <div style={{
                  width:56, height:56,
                  background:'#D88B5B',
                  borderRadius:40,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 4px 20px rgba(216,139,91,0.5)',
                  border:'2px solid rgba(244,239,232,0.2)',
                }}>
                  <Plus size={26} color="#2A1B12" strokeWidth={2.8}/>
                </div>
              </Link>
            </div>
          )
          const active = item.href && path.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href!} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 4px 8px'
            }}>
              <Icon size={22} strokeWidth={active?2.5:1.6} color={active?'#F4EFE8':'#A69C8F'}/>
              <span style={{ fontSize:10, fontWeight:500, color:active?'#F4EFE8':'#A69C8F' }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
