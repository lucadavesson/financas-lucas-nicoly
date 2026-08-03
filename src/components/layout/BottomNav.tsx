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
      width:'100%', maxWidth:480, zIndex:50,
      background:'#FFFFFF',
      borderTop:'1px solid rgba(0,0,0,0.06)',
      display:'flex', alignItems:'flex-end',
      paddingTop:8,
      paddingBottom:'max(env(safe-area-inset-bottom, 0px), 10px)',
      minHeight:70,
    }}>
      {items.map((item) => {
        if (item.fab) return (
          <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', marginBottom:10 }}>
            <Link href="/lancamentos/novo" style={{ display:'block' }}>
              <div style={{
                width:50, height:50,
                background:'linear-gradient(135deg,#C4622D,#A04818)',
                borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 16px rgba(196,98,45,0.35)',
              }}>
                <Plus size={22} color="#fff" strokeWidth={2.5}/>
              </div>
            </Link>
          </div>
        )
        const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href!))
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href!} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            gap:3, paddingBottom:6, paddingTop:2, textDecoration:'none',
          }}>
            <Icon size={22} strokeWidth={active?2.2:1.5} color={active?'#C4622D':'#8E8E93'}/>
            <span style={{ fontSize:10, fontWeight:active?600:400, color:active?'#C4622D':'#8E8E93' }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
