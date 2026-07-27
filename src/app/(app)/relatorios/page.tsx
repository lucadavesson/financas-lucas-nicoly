'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, TrendingDown, TrendingUp } from 'lucide-react'

// ── Paleta ────────────────────────────────────────────
const BG     = '#1A110A'
const CARD   = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#4A8C5C'
const TERRA  = '#C4622D'

const CHART_COLORS = [
  '#1D9E75','#7F77DD','#378ADD','#C8963C',
  '#E24B4A','#D85A30','#0F6E56','#9B59B6',
  '#E67E22','#2ECC71','#E74C3C','#3498DB'
]

export default function Relatorios() {
  const [txs,      setTxs]      = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [date,     setDate]     = useState(new Date())
  const [holder,   setHolder]   = useState('Todos')
  const [drill,    setDrill]    = useState<'cat'|'sub'|'hist'>('cat')
  const [selCat,   setSelCat]   = useState<string|null>(null)
  const [selSub,   setSelSub]   = useState<string|null>(null)
  const [compN,    setCompN]    = useState(4)
  const [modal,    setModal]    = useState<{title:string;txs:any[]}|null>(null)

  useEffect(() => { load() }, [date])

  async function load() {
    setLoading(true)
    const start = format(startOfMonth(subMonths(date,5)),'yyyy-MM-dd')
    const end   = format(endOfMonth(date),'yyyy-MM-dd')
    const {data} = await createClient().from('transactions').select('*').gte('purchase_date',start).lte('purchase_date',end)
    setTxs(data||[])
    setLoading(false)
  }

  function getMes(d=date) {
    const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
    return txs.filter(t=>t.purchase_date>=s&&t.purchase_date<=e&&(holder==='Todos'||t.holder===holder))
  }

  const mes      = getMes()
  const receitas = mes.filter(t=>t.transaction_type==='receita').reduce((s:number,t:any)=>s+t.amount,0)
  const despesas = mes.filter(t=>t.transaction_type!=='receita').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
  const saldo    = receitas - despesas

  const catMap: Record<string,number> = {}
  mes.filter(t=>t.transaction_type!=='receita').forEach((t:any)=>{
    catMap[t.category]=(catMap[t.category]||0)+(t.installment_value||t.amount)
  })
  const cats = Object.entries(catMap).sort(([,a],[,b])=>b-a)

  const subMap: Record<string,number> = {}
  if (selCat) mes.filter((t:any)=>t.transaction_type!=='receita'&&t.category===selCat).forEach((t:any)=>{
    const k=t.subcategory||'Outros'
    subMap[k]=(subMap[k]||0)+(t.installment_value||t.amount)
  })
  const subs = Object.entries(subMap).sort(([,a],[,b])=>b-a)

  const mesesComp = Array.from({length:compN},(_,i)=>subMonths(date,compN-1-i))
  const comp = mesesComp.map(m=>({
    label: format(m,'MMM',{locale:ptBR}),
    labelFull: format(m,"MMM 'yy",{locale:ptBR}),
    r: getMes(m).filter((t:any)=>t.transaction_type==='receita').reduce((s:number,t:any)=>s+t.amount,0),
    d: getMes(m).filter((t:any)=>t.transaction_type!=='receita').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0),
    atual: format(m,'yyyy-MM')===format(date,'yyyy-MM'),
  }))
  const maxComp = Math.max(...comp.flatMap(c=>[c.r,c.d]),1)

  const hist = selCat&&drill==='hist' ? mesesComp.map(m=>{
    const val=getMes(m).filter((t:any)=>t.transaction_type!=='receita'&&t.category===selCat&&(selSub?(t.subcategory||'Outros')===selSub:true)).reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
    return {label:format(m,'MMM',{locale:ptBR}),val,atual:format(m,'yyyy-MM')===format(date,'yyyy-MM')}
  }) : []
  const maxHist = Math.max(...hist.map(h=>h.val),1)

  // ── Componentes visuais ───────────────────────────────
  const pebble = (extra?:any) => ({
    background:CARD, borderRadius:24, padding:'16px 18px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    marginBottom:12, ...extra
  })

  const FilterBtn = ({label, active, onClick}: {label:string;active:boolean;onClick:()=>void}) => (
    <button onClick={onClick} style={{
      flex:1, height:34, borderRadius:17,
      background: active ? TERRA : 'transparent',
      color: active ? '#F4EFE8' : TEXTLT,
      border: `1px solid ${active ? TERRA : 'rgba(255,255,255,0.15)'}`,
      fontSize:12, fontWeight: active ? 700 : 500,
      cursor:'pointer', transition:'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ background:BG, minHeight:'100%', padding:'14px 14px 120px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:TEXT, margin:0 }}>Relatórios</h1>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={()=>setDate(d=>subMonths(d,1))} style={{ width:32,height:32,background:'rgba(255,255,255,0.07)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronLeft size={16} color={TEXTLT}/>
          </button>
          <span style={{ fontSize:13, fontWeight:700, color:TEXT, minWidth:60, textAlign:'center', textTransform:'capitalize' }}>
            {format(date,'MMM/yy',{locale:ptBR})}
          </span>
          <button onClick={()=>setDate(d=>subMonths(d,-1))} style={{ width:32,height:32,background:'rgba(255,255,255,0.07)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronRight size={16} color={TEXTLT}/>
          </button>
        </div>
      </div>

      {/* Filtro por pessoa */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['Todos','Lucas','Nicoly','Prata'].map(h => (
          <FilterBtn key={h} label={h} active={holder===h} onClick={()=>setHolder(h)}/>
        ))}
      </div>

      {/* Cards resumo — clicáveis */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <button onClick={()=>setModal({title:'Receitas',txs:mes.filter((t:any)=>t.transaction_type==='receita')})}
          style={{ background:'linear-gradient(145deg,rgba(34,100,60,0.4),rgba(20,70,40,0.5))', borderRadius:20, padding:'14px 16px', border:'0.5px solid rgba(74,140,92,0.35)', textAlign:'left', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <TrendingUp size={14} color='#5DE08A'/>
            <p style={{ fontSize:11, color:'rgba(93,224,138,0.7)', margin:0, fontWeight:600 }}>Receitas</p>
          </div>
          <p style={{ fontSize:22, fontWeight:800, color:'#5DE08A', margin:'0 0 4px', fontVariantNumeric:'tabular-nums' }}>
            {formatCurrency(receitas)}
          </p>
          <p style={{ fontSize:10, color:'rgba(93,224,138,0.5)', margin:0 }}>toque para ver →</p>
        </button>

        <button onClick={()=>setModal({title:'Despesas',txs:mes.filter((t:any)=>t.transaction_type!=='receita')})}
          style={{ background:'linear-gradient(145deg,rgba(120,30,20,0.4),rgba(80,20,10,0.5))', borderRadius:20, padding:'14px 16px', border:'0.5px solid rgba(196,98,45,0.35)', textAlign:'left', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <TrendingDown size={14} color='#FF8A5C'/>
            <p style={{ fontSize:11, color:'rgba(255,138,92,0.7)', margin:0, fontWeight:600 }}>Despesas</p>
          </div>
          <p style={{ fontSize:22, fontWeight:800, color:'#FF8A5C', margin:'0 0 4px', fontVariantNumeric:'tabular-nums' }}>
            {formatCurrency(despesas)}
          </p>
          <p style={{ fontSize:10, color:'rgba(255,138,92,0.5)', margin:0 }}>toque para ver →</p>
        </button>
      </div>

      {/* Saldo do mês */}
      <div style={{ ...pebble(), display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.07em' }}>Saldo do mês</p>
          <p style={{ fontSize:24, fontWeight:800, color: saldo>=0 ? '#5DE08A' : '#FF8A5C', margin:0, fontVariantNumeric:'tabular-nums' }}>
            {saldo>=0?'+':''}{formatCurrency(saldo)}
          </p>
        </div>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Taxa de poupança</p>
          <p style={{ fontSize:16, fontWeight:700, color: receitas>0&&saldo>0 ? '#5DE08A' : TEXTMU, margin:0 }}>
            {receitas>0 ? `${((saldo/receitas)*100).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Comparativo mensal — barras horizontais profissionais */}
      <div style={{ ...pebble() }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:0 }}>Evolução mensal</p>
          <div style={{ display:'flex', gap:6 }}>
            {[3,4,6].map(n => (
              <button key={n} onClick={()=>setCompN(n)} style={{
                width:32, height:26, borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                background: compN===n ? TERRA : 'rgba(255,255,255,0.07)',
                color: compN===n ? '#F4EFE8' : TEXTLT,
              }}>{n}m</button>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display:'flex', gap:16, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:'#5DE08A' }}/>
            <span style={{ fontSize:11, color:TEXTLT }}>Receitas</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:'#FF8A5C' }}/>
            <span style={{ fontSize:11, color:TEXTLT }}>Despesas</span>
          </div>
        </div>

        {/* Barras por mês */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {comp.map((c, i) => (
            <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight: c.atual ? 700 : 500, color: c.atual ? TEXT : TEXTLT, textTransform:'capitalize' }}>
                  {c.labelFull}
                </span>
                <span style={{ fontSize:11, color: c.d > c.r ? '#FF8A5C' : '#5DE08A', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                  {formatCurrency(c.d)}
                </span>
              </div>
              {/* Barra receita */}
              <div style={{ height:7, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden', marginBottom:3 }}>
                <div style={{
                  height:'100%', borderRadius:99,
                  width:`${(c.r/maxComp)*100}%`,
                  background: c.atual ? '#5DE08A' : 'rgba(93,224,138,0.4)',
                  transition:'width 0.5s ease',
                  minWidth: c.r>0 ? 4 : 0,
                }}/>
              </div>
              {/* Barra despesa */}
              <div style={{ height:7, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:99,
                  width:`${(c.d/maxComp)*100}%`,
                  background: c.atual ? '#FF8A5C' : 'rgba(255,138,92,0.4)',
                  transition:'width 0.5s ease',
                  minWidth: c.d>0 ? 4 : 0,
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categorias drill-down */}
      <div style={{ ...pebble() }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          {drill!=='cat' && (
            <button onClick={drill==='hist'?()=>{setSelSub(null);setDrill('sub')}:()=>{setSelCat(null);setDrill('cat')}}
              style={{ display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:TERRA,fontSize:12,fontWeight:600,padding:0 }}>
              <ChevronLeft size={13}/>{drill==='hist'?selCat:'Categorias'}
            </button>
          )}
          <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:0, flex:1 }}>
            {drill==='cat' ? 'Por categoria' : drill==='sub' ? selCat! : `${selSub||selCat}`}
          </p>
          {drill==='cat' && <p style={{ fontSize:11, color:TEXTMU, margin:0 }}>toque para detalhar</p>}
        </div>

        {/* Lista de categorias */}
        {drill==='cat' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {cats.length===0 ? (
              <p style={{ fontSize:13, color:TEXTMU, textAlign:'center', padding:'16px 0', margin:0 }}>Sem despesas neste mês</p>
            ) : cats.map(([cat,val],i) => {
              const pct = despesas>0 ? (val/despesas*100) : 0
              return (
                <button key={cat} onClick={()=>{setSelCat(cat);setDrill('sub')}}
                  style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:13, color:TEXT, fontWeight:500, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {CAT_ICONS[cat]||'📦'} {cat}
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                      <span style={{ fontSize:12, color:TEXTLT, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(val)}</span>
                      <span style={{ fontSize:11, color:TEXTMU, width:30, textAlign:'right' }}>{pct.toFixed(0)}%</span>
                      <ChevronRight size={12} color={TEXTMU}/>
                    </div>
                  </div>
                  <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:CHART_COLORS[i%CHART_COLORS.length], transition:'width 0.4s' }}/>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Sub-categorias */}
        {drill==='sub' && selCat && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {subs.length===0 ? (
              <p style={{ fontSize:13, color:TEXTMU, textAlign:'center', padding:'16px 0', margin:0 }}>Sem subcategorias</p>
            ) : subs.map(([sub,val],i) => {
              const tot = Object.values(subMap).reduce((s,v)=>s+v,0)
              const pct = tot>0 ? (val/tot*100) : 0
              return (
                <button key={sub} onClick={()=>{setSelSub(sub);setDrill('hist')}}
                  style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:13, color:TEXT, fontWeight:500 }}>{sub}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, color:TEXTLT, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(val)}</span>
                      <span style={{ fontSize:11, color:TEXTMU, width:30, textAlign:'right' }}>{pct.toFixed(0)}%</span>
                      <ChevronRight size={12} color={TEXTMU}/>
                    </div>
                  </div>
                  <div style={{ height:6, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:CHART_COLORS[i%CHART_COLORS.length] }}/>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Histórico da categoria */}
        {drill==='hist' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginBottom:14 }}>
              {[3,4,6].map(n => (
                <button key={n} onClick={()=>setCompN(n)} style={{
                  width:32, height:26, borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background: compN===n ? TERRA : 'rgba(255,255,255,0.07)',
                  color: compN===n ? '#F4EFE8' : TEXTLT,
                }}>{n}m</button>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {hist.map((h, i) => (
                <div key={i}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight: h.atual ? 700 : 500, color: h.atual ? TEXT : TEXTLT, textTransform:'capitalize' }}>
                      {h.label}
                    </span>
                    <span style={{ fontSize:12, color: h.atual ? '#FF8A5C' : TEXTLT, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                      {h.val>0 ? formatCurrency(h.val) : '—'}
                    </span>
                  </div>
                  <div style={{ height:8, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:99,
                      width:`${(h.val/maxHist)*100}%`,
                      background: h.atual ? '#FF8A5C' : 'rgba(255,138,92,0.45)',
                      transition:'width 0.5s ease',
                      minWidth: h.val>0 ? 4 : 0,
                    }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal lista de transações */}
      {modal && (
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setModal(null)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(10px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'linear-gradient(180deg,#3D2810,#2C1C0E)',borderRadius:'28px 28px 0 0',maxHeight:'82vh',display:'flex',flexDirection:'column',boxShadow:'0 -8px 40px rgba(0,0,0,0.6)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'18px 20px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.08)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div>
                <h3 style={{ fontSize:15,fontWeight:700,color:TEXT,margin:'0 0 2px' }}>{modal.title}</h3>
                <p style={{ fontSize:11,color:TEXTMU,margin:0 }}>
                  {modal.txs.length} lançamentos · {formatCurrency(modal.txs.reduce((s,t)=>s+(t.installment_value||t.amount),0))}
                </p>
              </div>
              <button onClick={()=>setModal(null)} style={{ background:'rgba(255,255,255,0.08)',border:'none',borderRadius:12,width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <X size={16} color={TEXTLT}/>
              </button>
            </div>
            <div style={{ overflowY:'auto',flex:1,padding:'12px 20px 24px' }}>
              {modal.txs.map((t:any,i:number) => (
                <div key={t.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:i>0?'0.5px solid rgba(255,255,255,0.06)':undefined }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:500,color:TEXT,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.description}</p>
                    <p style={{ fontSize:11,color:TEXTMU,margin:0 }}>{t.category} · {t.holder} · {format(parseISO(t.purchase_date),'dd/MM')}</p>
                  </div>
                  <p style={{ fontSize:13,fontWeight:700,fontVariantNumeric:'tabular-nums',margin:0,color:t.transaction_type==='receita'?'#5DE08A':'#FF8A5C',flexShrink:0 }}>
                    {t.transaction_type==='receita'?'+':'-'}{formatCurrency(t.installment_value||t.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
