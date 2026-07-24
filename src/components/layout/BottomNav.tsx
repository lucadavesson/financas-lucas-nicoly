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
    <nav style={{
      position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
      width:'100%', maxWidth:480,
      background:'linear-gradient(180deg,#1A0F0A 0%,#2C1A0E 100%)',
      borderTop:'0.5px solid rgba(201,168,76,0.15)',
      display:'flex', alignItems:'flex-end',
      paddingBottom:'env(safe-area-inset-bottom,8px)',
      zIndex:50,
    }}>
      {items.map((item,i) => {
        if (item.fab) return (
          <Link key="fab" href="/lancamentos/novo" style={{
            flex:1, display:'flex', justifyContent:'center', alignItems:'center',
            paddingBottom:10, marginTop:-20,
          }}>
            <div style={{
              width:52, height:52,
              background:'linear-gradient(135deg,#C9A84C,#8B5E3C)',
              borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 20px rgba(201,168,76,0.4)',
              border:'2px solid rgba(201,168,76,0.3)',
            }}>
              <Plus size={24} color="#1A0F0A" strokeWidth={2.8} />
            </div>
          </Link>
        )
        const active = item.href && path.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href!} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            gap:3, padding:'10px 4px 8px',
          }}>
            <Icon size={21} strokeWidth={active?2.5:1.6}
              color={active ? '#C9A84C' : 'rgba(245,230,211,0.25)'} />
            <span style={{ fontSize:10, fontWeight:500,
              color: active ? '#C9A84C' : 'rgba(245,230,211,0.25)',
            }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
