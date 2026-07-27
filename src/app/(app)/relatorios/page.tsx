'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const CHART_COLORS = ['#1D9E75','#7F77DD','#378ADD','#BA7517','#E24B4A','#D85A30','#0F6E56','#0C447C']

export default function Relatorios() {
  const [txs, setTxs]         = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate]       = useState(new Date())
  const [holder, setHolder]   = useState('Todos')
  const [nature, setNature]   = useState('Todos')
  const [drill, setDrill]     = useState<'cat'|'sub'|'hist'>('cat')
  const [selCat, setSelCat]   = useState<string|null>(null)
  const [selSub, setSelSub]   = useState<string|null>(null)
  const [listModal, setListModal] = useState<{title:string;txs:any[]}|null>(null)
  const [compN, setCompN]     = useState(3)

  useEffect(() => { load() }, [date])

  async function load() {
    const start = format(startOfMonth(subMonths(date,5)),'yyyy-MM-dd')
    const end   = format(endOfMonth(date),'yyyy-MM-dd')
    const {data} = await createClient().from('transactions').select('*').gte('purchase_date',start).lte('purchase_date',end)
    setTxs(data||[])
    setLoading(false)
  }

  function getMes(d=date) {
    const s=format(startOfMonth(d),'yyyy-MM-dd'), e=format(endOfMonth(d),'yyyy-MM-dd')
    return txs.filter(t=>t.purchase_date>=s&&t.purchase_date<=e&&(holder==='Todos'||t.holder===holder)&&(nature==='Todos'||t.nature===nature))
  }

  const mes     = getMes()
  const receitas = mes.filter(t=>t.transaction_type==='receita').reduce((s:number,t:any)=>s+t.amount,0)
  const despesas = mes.filter(t=>t.transaction_type!=='receita').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)

  const catMap: Record<string,number> = {}
  mes.filter(t=>t.transaction_type!=='receita').forEach((t:any)=>{ catMap[t.category]=(catMap[t.category]||0)+(t.installment_value||t.amount) })
  const cats = Object.entries(catMap).sort(([,a],[,b])=>b-a)

  const subMap: Record<string,number> = {}
  if (selCat) mes.filter((t:any)=>t.transaction_type!=='receita'&&t.category===selCat).forEach((t:any)=>{const k=t.subcategory||'Outros';subMap[k]=(subMap[k]||0)+(t.installment_value||t.amount)})
  const subs = Object.entries(subMap).sort(([,a],[,b])=>b-a)

  const mesesComp = Array.from({length:compN},(_,i)=>subMonths(date,compN-1-i))
  const comp = mesesComp.map(m=>({
    label:format(m,'MMM',{locale:ptBR}),
    r:getMes(m).filter((t:any)=>t.transaction_type==='receita').reduce((s:number,t:any)=>s+t.amount,0),
    d:getMes(m).filter((t:any)=>t.transaction_type!=='receita').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0),
    atual:format(m,'yyyy-MM')===format(date,'yyyy-MM'),
  }))
  const maxComp = Math.max(...comp.flatMap(c=>[c.r,c.d]),1)

  const hist = selCat&&drill==='hist' ? mesesComp.map(m=>{
    const val=getMes(m).filter((t:any)=>t.transaction_type!=='receita'&&t.category===selCat&&(selSub?(t.subcategory||'Outros')===selSub:true)).reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
    return {label:format(m,'MMM',{locale:ptBR}),val,atual:format(m,'yyyy-MM')===format(date,'yyyy-MM')}
  }) : []
  const maxHist = Math.max(...hist.map(h=>h.val),1)

  return (
    <div className="px-4 py-4 animate-in space-y-4" style={{background:"#1A110A",minHeight:"100%",paddingBottom:110}}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-100">Relatórios</h1>
        <div className="flex gap-1">
          <button onClick={()=>setDate(d=>subMonths(d,1))} className="p-1.5 bg-stone-900 rounded-xl"><ChevronLeft size={16} color="#8E8E93"/></button>
          <span className="px-3 py-1.5 text-xs font-semibold text-stone-100 capitalize">{format(date,'MMM/yy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>subMonths(d,-1))} className="p-1.5 bg-stone-900 rounded-xl"><ChevronRight size={16} color="#8E8E93"/></button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['Todos','Lucas','Nicoly','Prata'].map(h=>(
          <button key={h} onClick={()=>setHolder(h)} className={`flex-1 h-8 rounded-xl text-xs font-semibold border transition-colors ${holder===h?'bg-orange-700 text-white border-orange-700':'bg-transparent text-stone-300 border-stone-600'}`}>{h}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {['Todos','Fixo','Variável'].map(n=>(
          <button key={n} onClick={()=>setNature(n)} className={`flex-1 h-8 rounded-xl text-xs font-semibold border transition-colors ${nature===n?'bg-orange-700 text-white border-orange-700':'bg-transparent text-stone-300 border-stone-600'}`}>{n}</button>
        ))}
      </div>

      {/* Cards clicáveis */}
      <div className="grid grid-cols-2 gap-3">
        {[{l:'Receitas',v:receitas,bg:'',tc:'text-green-400',type:'receita'},{l:'Despesas',v:despesas,bg:'',tc:'text-red-400',type:'despesa'}].map(c=>(
          <button key={c.l} onClick={()=>setListModal({title:c.l,txs:mes.filter((t:any)=>c.type==='receita'?t.transaction_type==='receita':t.transaction_type!=='receita')})}
            className={`${c.bg} rounded-xl p-3 border text-left`}>
            <p className={`text-xs ${c.tc} opacity-70 mb-1`}>{c.l}</p>
            <p className={`text-xl font-bold ${c.tc} tabular-nums`}>{formatCurrency(c.v)}</p>
            <p className="text-xs text-stone-400 mt-0.5">toque para ver →</p>
          </button>
        ))}
      </div>

      {/* Categorias drill-down */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          {drill!=='cat'&&<button onClick={drill==='hist'?()=>{setSelSub(null);setDrill('sub')}:()=>{setSelCat(null);setDrill('cat')}} className="text-brand-500 text-xs font-medium flex items-center gap-1"><ChevronLeft size={13}/>{drill==='hist'?selCat:'Cats.'}</button>}
          <p className="text-xs font-semibold text-stone-100 flex-1">{drill==='cat'?'Por categoria':drill==='sub'?selCat!:`${selSub||selCat} — histórico`}</p>
          {drill==='cat'&&<p className="text-xs text-stone-400">toque para detalhar</p>}
        </div>

        {drill==='cat'&&(
          <div className="space-y-2">
            {cats.length===0?<p className="text-xs text-stone-400 text-center py-4">Sem despesas</p>:cats.map(([cat,val],i)=>{
              const pct=despesas>0?(val/despesas*100):0
              return(
                <button key={cat} onClick={()=>{setSelCat(cat);setDrill('sub')}} className="w-full text-left hover:bg-stone-900 rounded-xl p-1 -mx-1 transition-colors">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-100 font-medium truncate flex-1">{CAT_ICONS[cat]||'📦'} {cat}</span>
                    <span className="text-stone-300 tabular-nums ml-2">{formatCurrency(val)}</span>
                    <span className="text-stone-400 ml-2 w-7 text-right">{pct.toFixed(0)}%</span>
                    <span className="text-stone-600 ml-1">›</span>
                  </div>
                  <div className="h-1.5 bg-stone-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${pct}%`,background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {drill==='sub'&&selCat&&(
          <div className="space-y-2">
            {subs.length===0?<p className="text-xs text-stone-400 text-center py-4">Sem subcategorias</p>:subs.map(([sub,val],i)=>{
              const tot=Object.values(subMap).reduce((s,v)=>s+v,0)
              const pct=tot>0?(val/tot*100):0
              return(
                <button key={sub} onClick={()=>{setSelSub(sub);setDrill('hist')}} className="w-full text-left hover:bg-stone-900 rounded-xl p-1 -mx-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-100 font-medium flex-1">{sub}</span>
                    <span className="text-stone-300 tabular-nums ml-2">{formatCurrency(val)}</span>
                    <span className="text-stone-400 ml-2 w-7 text-right">{pct.toFixed(0)}%</span>
                    <span className="text-stone-600 ml-1">›</span>
                  </div>
                  <div className="h-1.5 bg-stone-900 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${pct}%`,background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {drill==='hist'&&(
          <div>
            <div className="flex items-end gap-2 mb-3" style={{height:80}}>
              {hist.map((h,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-stone-300">{h.val>0?formatCurrency(h.val).replace('R$\u00a0',''):''}</span>
                  <div className="w-full flex items-end" style={{height:52}}>
                    <div className="w-full rounded-t-md" style={{height:`${(h.val/maxHist)*100}%`,background:h.atual?'#1D9E75':'#9FE1CB',minHeight:h.val>0?4:0}}/>
                  </div>
                  <span className={`text-[10px] font-medium capitalize ${h.atual?'text-stone-100':'text-stone-400'}`}>{h.label}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-1">
              {[3,4,6].map(n=><button key={n} onClick={()=>setCompN(n)} className={`px-2 py-1 rounded-lg text-xs font-medium ${compN===n?'bg-orange-700 text-white':'bg-stone-900 text-stone-300'}`}>{n}m</button>)}
            </div>
          </div>
        )}
      </div>

      {/* Comparativo */}
      {drill==='cat'&&(
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Comparativo</p>
            <div className="flex gap-1">
              {[3,4,6].map(n=><button key={n} onClick={()=>setCompN(n)} className={`px-2 py-1 rounded-lg text-xs font-medium ${compN===n?'bg-orange-700 text-white':'bg-stone-900 text-stone-300'}`}>{n}m</button>)}
            </div>
          </div>
          <div className="flex items-end gap-2" style={{height:80}}>
            {comp.map((c,i)=>(
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{height:64}}>
                  <div className="flex-1 rounded-t-sm" style={{height:`${(c.r/maxComp)*100}%`,background:c.atual?'#1D9E75':'#9FE1CB',minHeight:c.r>0?2:0}}/>
                  <div className="flex-1 rounded-t-sm" style={{height:`${(c.d/maxComp)*100}%`,background:c.atual?'#E24B4A':'#F09595',minHeight:c.d>0?2:0}}/>
                </div>
                <span className={`text-[10px] font-medium capitalize ${c.atual?'text-stone-100':'text-stone-400'}`}>{c.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-stone-300"><div className="w-2 h-2 rounded-sm bg-brand-400"/>Receitas</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-300"><div className="w-2 h-2 rounded-sm bg-red-400"/>Despesas</div>
          </div>
        </div>
      )}

      {/* Modal lista */}
      {listModal&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end'}} onClick={()=>setListModal(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.3)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'linear-gradient(180deg,#3D2810,#2C1C0E)',borderRadius:'24px 24px 0 0',maxHeight:'80vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'16px 20px 12px',borderBottom:'0.5px solid #F2F2F7',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <h3 style={{fontSize:15,fontWeight:600}}>{listModal.title}</h3>
                <p style={{fontSize:11,color:'#8E8E93'}}>{listModal.txs.length} lançamentos · Total: {formatCurrency(listModal.txs.reduce((s,t)=>s+(t.installment_value||t.amount),0))}</p>
              </div>
              <button onClick={()=>setListModal(null)}><X size={20} color="#8E8E93"/></button>
            </div>
            <div style={{overflowY:'auto',flex:1,padding:'12px 16px 24px'}}>
              <div className="space-y-2">
                {listModal.txs.map((t:any)=>(
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-100 truncate">{t.description}</p>
                      <p className="text-xs text-stone-400">{t.category} · {t.holder} · {format(parseISO(t.purchase_date),'dd/MM')}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.transaction_type==='receita'?'text-green-600':'text-red-500'}`}>
                      {t.transaction_type==='receita'?'+':'-'}{formatCurrency(t.installment_value||t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
