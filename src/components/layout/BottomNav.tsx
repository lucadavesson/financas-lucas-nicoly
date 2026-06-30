'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, Plus, CreditCard, BarChart2 } from 'lucide-react'

const items = [
  { href: '/dashboard',   icon: Home,       label: 'Início'      },
  { href: '/lancamentos', icon: List,       label: 'Lançamentos' },
  { href: null,           icon: Plus,       label: '', fab: true  },
  { href: '/cartoes',     icon: CreditCard, label: 'Cartões'     },
  { href: '/relatorios',  icon: BarChart2,  label: 'Relatórios'  },
]

export default function BottomNav() {
  const path = usePathname()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: '#1C1C1E',
      borderTop: '0.5px solid rgba(139,105,20,0.3)',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 50,
    }}>
      {items.map((item, i) => {
        if (item.fab) return (
          <Link key="fab" href="/lancamentos/novo" style={{
            flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
            paddingBottom: 10, marginTop: -18,
          }}>
            <div style={{
              width: 50, height: 50,
              background: 'linear-gradient(135deg,#8B6914,#C4622D)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(139,105,20,0.5)',
            }}>
              <Plus size={24} color="#FAF7F4" strokeWidth={2.5} />
            </div>
          </Link>
        )
        const active = item.href && path.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href!} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '10px 4px 10px',
          }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8}
              color={active ? '#8B6914' : 'rgba(255,255,255,0.3)'} />
            <span style={{
              fontSize: 10, fontWeight: 500,
              color: active ? '#8B6914' : 'rgba(255,255,255,0.3)',
            }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
