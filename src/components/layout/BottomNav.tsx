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
      background:'#2A1C0E',
      borderTop:'0.5px solid rgba(255,255,255,0.08)',
      display:'flex', alignItems:'center',
      paddingTop:8,
      paddingBottom:'env(safe-area-inset-bottom,14px)',
    }}>
      {items.map((item) => {
        if (item.fab) return (
          <div key="fab" style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', marginTop:-28 }}>
            <Link href="/lancamentos/novo" style={{ display:'block' }}>
              <div style={{
                width:54, height:54,
                background:'radial-gradient(circle at 35% 35%, #E8A070, #C4622D 60%, #A04010)',
                borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 20px rgba(196,98,45,0.5)',
                border:'2px solid #2A1C0E',
              }}>
                <Plus size={24} color="#F4EFE8" strokeWidth={2.5}/>
              </div>
            </Link>
          </div>
        )
        const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href!))
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href!} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 4px 4px', textDecoration:'none' }}>
            <div style={{ width:4, height:4, borderRadius:'50%', background:active?'#C4622D':'transparent', marginBottom:1 }}/>
            <Icon size={21} strokeWidth={active?2.5:1.6} color={active?'#F4EFE8':'#8B7A6A'}/>
            <span style={{ fontSize:10, fontWeight:active?700:400, color:active?'#F4EFE8':'#8B7A6A' }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
