'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Bell } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string;holder:string;description:string;category:string;amount:number;status:string;purchase_date:string;transaction_type:string;installment_value?:number }

const BADGE: Record<string,string>       = { pago:'badge-pago',pendente:'badge-pendente',previsto:'badge-previsto',atrasado:'badge-atrasado',cancelado:'badge-previsto' }
const BADGE_LABEL: Record<string,string> = { pago:'Pago',pendente:'Pendente',previsto:'Previsto',atrasado:'Atrasado',cancelado:'Cancelado' }

function BadgeInline({status}: {status:string}) {
  const cfg: Record<string,{bg:string;color:string;border:string;label:string;pulse:boolean}> = {
    pago:      {bg:'rgba(34,120,60,0.35)',   color:'#5DE08A', border:'rgba(93,224,138,0.4)',  label:'Pago',      pulse:false},
    pendente:  {bg:'rgba(180,60,20,0.35)',   color:'#FF8A5C', border:'rgba(255,138,92,0.45)', label:'Pendente',  pulse:true},
    previsto:  {bg:'rgba(160,110,10,0.3)',   color:'#FFCC55', border:'rgba(255,204,85,0.35)', label:'Previsto',  pulse:false},
    atrasado:  {bg:'rgba(180,30,30,0.35)',   color:'#FF6B6B', border:'rgba(255,107,107,0.4)', label:'Atrasado',  pulse:true},
    cancelado: {bg:'rgba(100,100,100,0.2)',  color:'#9B9B9B', border:'rgba(155,155,155,0.2)', label:'Cancelado', pulse:false},
  }
  const c = cfg[status] || cfg.pendente
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:c.bg, color:c.color,
      fontSize:11, fontWeight:700,
      padding:'3px 10px', borderRadius:20,
      border:`1px solid ${c.border}`,
      letterSpacing:'0.03em', flexShrink:0,
    }}>
      <span style={{
        width:6, height:6, borderRadius:'50%',
        background:c.color, flexShrink:0,
        animation: c.pulse ? 'pulse 1.6s ease-in-out infinite' : 'none',
      }}/>
      {c.label}
    </span>
  )
}


// ── Paleta Gemini Espresso ────────────────────────────────────────────────────
const BG       = '#1A110A'
const PEBBLE   = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const PEBBLE_DK= 'linear-gradient(145deg,#2A1C0E,#1A1208)'
const TEXT     = '#F4EFE8'
const TEXTLT   = '#C8B89A'
const TEXTMU   = '#8B7A6A'
const GREEN    = '#4A8C5C'
const GREENBG  = 'rgba(74,140,92,0.18)'
const TERRA    = '#C4622D'
const TERRABG  = 'rgba(196,98,45,0.18)'
const CREAM    = '#F4EFE8'

function groupByDate(txs: Tx[]) {
  const g: Record<string,Tx[]> = {}
  txs.forEach(t => {
    const d = t.purchase_date.split('T')[0]
    if (!g[d]) g[d] = []
    g[d].push(t)
  })
  return Object.entries(g).sort(([a],[b]) => b.localeCompare(a))
}
function dateLabel(d: string) {
  const p = parseISO(d)
  if (isToday(p))     return 'Hoje'
  if (isYesterday(p)) return 'Ontem'
  return format(p,"dd 'de' MMMM",{locale:ptBR})
}

export default function Dashboard() {
  const [txs,   setTxs]  = useState<Tx[]>([])
  const [loading,setLoad]= useState(true)
  const [hide,  setHide] = useState(false)
  const [sel,   setSel]  = useState<Tx|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoad(true)
    const now = new Date()
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    setTxs(data||[])
    setLoad(false)
  }

  async function markPaid(tx: Tx) {
    await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
    toast.success('Pago!'); setSel(null); load()
  }
  async function del(tx: Tx) {
    if (!confirm('Apagar?')) return
    await createClient().from('transactions').delete().eq('id',tx.id)
    toast.success('Apagado!'); setSel(null); load()
  }

  const v = (n: number) => hide ? '•••' : formatCurrency(n)
  const recR      = txs.filter(t => t.transaction_type==='receita')
  const recD      = txs.filter(t => t.transaction_type!=='receita')
  const totalR    = recR.reduce((s,t) => s+t.amount, 0)
  const recebidas = recR.filter(t => t.status==='pago').reduce((s,t) => s+t.amount, 0)
  const previstas = recR.filter(t => t.status==='previsto').reduce((s,t) => s+t.amount, 0)
  const totalD    = recD.reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const pagas     = recD.filter(t => t.status==='pago').reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const pendentes = recD.filter(t => ['pendente','atrasado'].includes(t.status)).reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const economia  = recebidas - pagas
  const diasRest  = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate() - new Date().getDate()
  const gastoDia  = diasRest>0 ? Math.max(0,economia/diasRest) : 0

  const hoje=new Date(); const em7=new Date(); em7.setDate(em7.getDate()+7)
  const venc = txs.filter(t =>
    t.status==='pendente' && t.transaction_type!=='receita' &&
    new Date(t.purchase_date)>=hoje && new Date(t.purchase_date)<=em7
  ).slice(0,3)

  const grouped = useMemo(() => groupByDate(txs.slice(0,25)).slice(0,6), [txs])

  const pebble = (extra?:any) => ({
    background:PEBBLE, borderRadius:28, padding:'18px 20px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    marginBottom:12, ...extra
  })

  return (
    <div style={{ background:BG, minHeight:'100%', padding:'14px 14px 130px' }}>

      {/* Mês + ocultar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:700, color:TEXTMU, textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>
          {format(new Date(),'MMMM yyyy',{locale:ptBR})}
        </p>
        <button onClick={()=>setHide(!hide)} style={{ fontSize:11, color:TEXTMU, background:'none', border:'none', cursor:'pointer' }}>
          {hide?'👁 Mostrar':'🙈 Ocultar'}
        </button>
      </div>

      {/* Pode gastar */}
      <div style={{ ...pebble(), display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 4px' }}>Pode gastar hoje</p>
          <p style={{ fontSize:28, fontWeight:800, color:TERRA, lineHeight:1, fontVariantNumeric:'tabular-nums' as const, margin:'0 0 4px' }}>
            {v(gastoDia)}<span style={{ fontSize:13, fontWeight:400, color:TEXTMU }}>/dia</span>
          </p>
          <p style={{ fontSize:11, color:TEXTMU, margin:0 }}>{diasRest} dias restantes</p>
        </div>
        <div style={{ width:44, height:44, background:TERRABG, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>💰</div>
      </div>

      {/* Hero economia */}
      <div style={{ ...pebble(), background:'linear-gradient(145deg,#2C1C0E,#1A1008)' }}>
        <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 4px' }}>Economia do mês:</p>
        <p style={{ fontSize:32, fontWeight:800, color:CREAM, lineHeight:1, fontVariantNumeric:'tabular-nums' as const, margin:'0 0 4px' }}>{v(economia)}</p>
        <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 14px' }}>
          {recebidas>0 ? `${((economia/recebidas)*100).toFixed(1)}% de poupança` : 'Confirme as receitas para calcular'}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div style={{ background:GREENBG, borderRadius:20, padding:'12px 14px', border:'0.5px solid rgba(74,140,92,0.25)' }}>
            <p style={{ fontSize:10, color:'rgba(110,201,138,0.7)', margin:'0 0 4px' }}>↑ Receitas</p>
            <p style={{ fontSize:15, fontWeight:700, color:'#6EC98A', fontVariantNumeric:'tabular-nums' as const, margin:'0 0 8px' }}>{v(totalR)}</p>
            <div style={{ paddingTop:8, borderTop:'0.5px solid rgba(110,201,138,0.15)' }}>
              <p style={{ fontSize:10, color:'rgba(110,201,138,0.4)', margin:'0 0 2px' }}>A confirmar</p>
              <p style={{ fontSize:12, fontWeight:600, color:previstas>0?'#6EC98A':'rgba(110,201,138,0.25)', fontVariantNumeric:'tabular-nums' as const, margin:0 }}>{previstas>0?v(previstas):'—'}</p>
            </div>
          </div>
          <div style={{ background:TERRABG, borderRadius:20, padding:'12px 14px', border:'0.5px solid rgba(196,98,45,0.25)' }}>
            <p style={{ fontSize:10, color:'rgba(232,133,90,0.7)', margin:'0 0 4px' }}>↓ Despesas</p>
            <p style={{ fontSize:15, fontWeight:700, color:'#E8855A', fontVariantNumeric:'tabular-nums' as const, margin:'0 0 8px' }}>{v(totalD)}</p>
            <div style={{ paddingTop:8, borderTop:'0.5px solid rgba(196,98,45,0.15)' }}>
              <p style={{ fontSize:10, color:'rgba(232,133,90,0.4)', margin:'0 0 2px' }}>A pagar</p>
              <p style={{ fontSize:12, fontWeight:600, color:pendentes>0?'#E8855A':'rgba(232,133,90,0.25)', fontVariantNumeric:'tabular-nums' as const, margin:0 }}>{pendentes>0?v(pendentes):'—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Por pessoa */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        {['Lucas','Nicoly'].map(p => {
          const r = txs.filter(t=>t.holder===p&&t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
          const d = txs.filter(t=>t.holder===p&&t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)
          return (
            <div key={p} style={{ background:PEBBLE, borderRadius:24, padding:'14px 16px', boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <div style={{ width:28,height:28,borderRadius:'50%',background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:TERRA,marginBottom:8 }}>{p[0]}</div>
              <p style={{ fontSize:13,fontWeight:600,color:TEXT,margin:'0 0 3px' }}>{p}</p>
              <p style={{ fontSize:16,fontWeight:700,fontVariantNumeric:'tabular-nums' as const,margin:'0 0 4px',color:r-d>=0?GREEN:TERRA }}>{v(r-d)}</p>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:TEXTMU }}>
                <span>↑{v(r)}</span><span>↓{v(d)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vencimentos */}
      {venc.length>0 && (
        <div style={{ ...pebble() }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
            <Bell size={14} color={TERRA}/>
            <p style={{ fontSize:13,fontWeight:700,color:TEXT,margin:0 }}>Vencendo em breve</p>
          </div>
          {venc.map((tx,i) => (
            <div key={tx.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:i>0?`0.5px solid rgba(255,255,255,0.06)`:undefined }}>
              <div>
                <p style={{ fontSize:13,fontWeight:500,color:TEXT,margin:'0 0 2px' }}>{tx.description}</p>
                <p style={{ fontSize:11,color:TEXTMU,margin:0 }}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
              </div>
              <p style={{ fontSize:13,fontWeight:700,color:TERRA,fontVariantNumeric:'tabular-nums' as const,margin:0 }}>{v(tx.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Últimas transações agrupadas por data */}
      <div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
          <p style={{ fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.07em',margin:0 }}>Últimas transações</p>
          <Link href="/lancamentos" style={{ fontSize:11,color:TERRA,fontWeight:600,display:'flex',alignItems:'center',gap:2,textDecoration:'none' }}>
            Ver todas <ChevronRight size={11}/>
          </Link>
        </div>

        {loading ? (
          <div style={{ display:'flex',justifyContent:'center',padding:32 }}>
            <div style={{ width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ) : txs.length===0 ? (
          <div style={{ ...pebble(), textAlign:'center' }}>
            <p style={{ fontSize:13,color:TEXTMU,margin:'0 0 8px' }}>Nenhum lançamento este mês</p>
            <Link href="/lancamentos/novo" style={{ fontSize:12,color:TERRA,fontWeight:600 }}>Adicionar primeiro →</Link>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            {grouped.map(([d,list]) => (
              <div key={d}>
                <p style={{ fontSize:13,fontWeight:600,color:TEXTLT,margin:'0 0 8px' }}>{dateLabel(d)}</p>
                <div style={{ background:PEBBLE,borderRadius:24,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                  {list.map((tx,i) => {
                    const isRec = tx.transaction_type==='receita'
                    return (
                      <button key={tx.id} onClick={()=>setSel(tx)}
                        style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderTop:i>0?`0.5px solid rgba(255,255,255,0.06)`:undefined,background:'none',border:'none',cursor:'pointer',textAlign:'left' }}>
                        <div style={{ width:38,height:38,borderRadius:12,background:isRec?GREENBG:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0 }}>
                          {CAT_ICONS[tx.category]||'📦'}
                        </div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ fontSize:14,fontWeight:500,color:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:0 }}>{tx.description}</p>
                          <p style={{ fontSize:11,color:TEXTMU,margin:'2px 0 0' }}>{tx.category} · {tx.holder}</p>
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <p style={{ fontSize:14,fontWeight:700,color:isRec?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const,margin:'0 0 4px' }}>
                            {isRec?'+':'-'}{v(tx.installment_value||tx.amount)}
                          </p>
                          <BadgeInline status={tx.status}/>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      {sel && (
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setSel(null)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'linear-gradient(180deg,#3D2810,#2C1C0E)',borderRadius:'32px 32px 0 0',padding:'20px 20px 48px',boxShadow:'0 -8px 40px rgba(0,0,0,0.6)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:3,background:'rgba(255,255,255,0.15)',borderRadius:2,margin:'0 auto 18px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:16,borderBottom:'0.5px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width:46,height:46,borderRadius:16,background:sel.transaction_type==='receita'?GREENBG:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>{CAT_ICONS[sel.category]||'📦'}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:16,fontWeight:600,color:TEXT,margin:'0 0 2px' }}>{sel.description}</p>
                <p style={{ fontSize:12,color:TEXTMU,margin:0 }}>{sel.category} · {sel.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:17,fontWeight:700,color:sel.transaction_type==='receita'?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const,margin:'0 0 4px' }}>
                  {sel.transaction_type==='receita'?'+':'-'}{formatCurrency(sel.installment_value||sel.amount)}
                </p>
                <BadgeInline status={sel.status}/>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {sel.transaction_type!=='receita'&&sel.status!=='pago'&&(
                <button onClick={()=>markPaid(sel)} style={{ width:'100%',height:50,background:TERRA,color:CREAM,fontWeight:700,fontSize:15,borderRadius:24,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(196,98,45,0.4)' }}>✓ Marcar como pago</button>
              )}
              {sel.transaction_type==='receita'&&sel.status==='previsto'&&(
                <Link href={`/lancamentos/editar/${sel.id}`} style={{ width:'100%',height:50,background:GREEN,color:CREAM,fontWeight:700,fontSize:15,borderRadius:24,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none' }}>✓ Confirmar recebimento</Link>
              )}
              <Link href={`/lancamentos/editar/${sel.id}`} onClick={()=>setSel(null)}
                style={{ width:'100%',height:46,background:'rgba(255,255,255,0.08)',color:TEXT,fontWeight:600,fontSize:14,borderRadius:24,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none' }}>
                ✏️ Editar lançamento
              </Link>
              <button onClick={()=>del(sel)} style={{ width:'100%',height:46,background:TERRABG,color:TERRA,fontWeight:600,fontSize:14,borderRadius:24,border:'none',cursor:'pointer' }}>🗑 Apagar</button>
              <button onClick={()=>setSel(null)} style={{ width:'100%',height:36,background:'none',color:TEXTMU,fontSize:13,border:'none',cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
