'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS, STATUS_COLORS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Trash2, CheckCircle, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string; holder:string; description:string; category:string; subcategory?:string; amount:number; installment_value?:number; installment_total?:number; status:string; purchase_date:string; transaction_type:string; nature:string; card_name?:string }

export default function Lancamentos() {
  const [txs, setTxs]               = useState<Tx[]>([])
  const [loading, setLoading]       = useState(true)
  const [date, setDate]             = useState(new Date())
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected]     = useState<Tx|null>(null)
  // Filtros cumulativos
  const [fHolders, setFHolders]     = useState<string[]>([])
  const [fTypes, setFTypes]         = useState<string[]>([])
  const [fNature, setFNature]       = useState<string[]>([])
  const [fCat, setFCat]             = useState('')
  const [fSub, setFSub]             = useState('')

  useEffect(() => { load() }, [date])

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', format(startOfMonth(date),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(date),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    setTxs(data||[])
    setLoading(false)
  }

  async function markPaid(tx: Tx) {
    await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
    toast.success('Pago!')
    setSelected(null)
    load()
  }

  async function del(id: string) {
    if (!confirm('Apagar?')) return
    await createClient().from('transactions').delete().eq('id',id)
    toast.success('Apagado!')
    setSelected(null)
    load()
  }

  function toggle(arr:string[],set:(v:string[])=>void,val:string){set(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val])}

  const filtered = useMemo(() => {
    let t = txs
    if (fHolders.length) t = t.filter(x=>fHolders.includes(x.holder))
    if (fTypes.length)   t = t.filter(x=>fTypes.includes(x.transaction_type==='receita'?'Receita':'Despesa'))
    if (fNature.length)  t = t.filter(x=>fNature.includes(x.nature))
    if (fCat)            t = t.filter(x=>x.category===fCat)
    if (fSub)            t = t.filter(x=>x.subcategory===fSub)
    return t
  },[txs,fHolders,fTypes,fNature,fCat,fSub])

  const grouped = useMemo(()=>{
    const g:Record<string,Tx[]>={}
    filtered.forEach(t=>{if(!g[t.purchase_date])g[t.purchase_date]=[];g[t.purchase_date].push(t)})
    return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))
  },[filtered])

  const totalR = filtered.filter(t=>t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
  const totalD = filtered.filter(t=>t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const hasF   = fHolders.length||fTypes.length||fNature.length||fCat||fSub
  const cats   = [...new Set(txs.map(t=>t.category))]
  const subs   = fCat?[...new Set(txs.filter(t=>t.category===fCat&&t.subcategory).map(t=>t.subcategory!))]:[]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,.06)',padding:'12px 16px',flexShrink:0}}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={()=>setDate(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} className="p-1.5 rounded-xl bg-gray-50"><ChevronLeft size={18} color="#8E8E93"/></button>
          <span className="font-semibold text-gray-900 capitalize">{format(date,'MMMM yyyy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} className="p-1.5 rounded-xl bg-gray-50"><ChevronRight size={18} color="#8E8E93"/></button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-green-50 rounded-xl px-3 py-2"><p className="text-xs text-green-600 mb-0.5">Receitas</p><p className="text-sm font-bold text-green-700 tabular-nums">{formatCurrency(totalR)}</p></div>
          <div className="bg-red-50 rounded-xl px-3 py-2"><p className="text-xs text-red-500 mb-0.5">Despesas</p><p className="text-sm font-bold text-red-600 tabular-nums">{formatCurrency(totalD)}</p></div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="mb-3 bg-gray-50 rounded-2xl p-3 space-y-3">
            {[
              {label:'Pessoa',items:['Lucas','Nicoly','Prata'],arr:fHolders,set:setFHolders},
              {label:'Tipo',items:['Receita','Despesa'],arr:fTypes,set:setFTypes},
              {label:'Natureza',items:['Fixo','Variável'],arr:fNature,set:setFNature},
            ].map(f=>(
              <div key={f.label}>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">{f.label}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {f.items.map(item=>(
                    <button key={item} onClick={()=>toggle(f.arr,f.set,item)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${f.arr.includes(item)?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-500 border-gray-200'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Categoria</p>
              <select value={fCat} onChange={e=>{setFCat(e.target.value);setFSub('')}} className="input-base h-9 text-sm">
                <option value="">Todas</option>
                {cats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {fCat&&subs.length>0&&(
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Subcategoria</p>
                <select value={fSub} onChange={e=>setFSub(e.target.value)} className="input-base h-9 text-sm">
                  <option value="">Todas</option>
                  {subs.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {hasF&&<button onClick={()=>{setFHolders([]);setFTypes([]);setFNature([]);setFCat('');setFSub('')}} className="text-xs text-red-500 font-medium flex items-center gap-1"><X size={12}/> Limpar filtros</button>}
          </div>
        )}

        <button onClick={()=>setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${showFilters||hasF?'bg-brand-400 text-white':'bg-gray-100 text-gray-500'}`}>
          <SlidersHorizontal size={13}/>
          Filtros{hasF?` (${fHolders.length+fTypes.length+fNature.length+(fCat?1:0)})` : ''}
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{overscrollBehavior:'none'}}>
        {loading?(
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>
        ):grouped.length===0?(
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-3xl mb-3">📭</div>
            <p className="text-sm text-gray-400">Nenhum lançamento encontrado</p>
            <Link href="/lancamentos/novo" className="mt-3 bg-brand-400 text-white text-sm font-medium px-4 py-2 rounded-xl">Adicionar</Link>
          </div>
        ):(
          <div className="space-y-4 pb-4">
            {grouped.map(([date,list])=>(
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{format(parseISO(date),"dd 'de' MMMM",{locale:ptBR})}</span>
                  <div className="flex-1 h-px bg-gray-100"/>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {list.map((tx,i)=>(
                    <button key={tx.id} onClick={()=>setSelected(tx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i>0?'border-t border-gray-50':''}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${tx.transaction_type==='receita'?'bg-green-50':'bg-gray-50'}`}>
                        {CAT_ICONS[tx.category]||'📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-400 truncate">{tx.category}{tx.subcategory?` › ${tx.subcategory}`:''} · {tx.holder}</p>
                        {tx.installment_total&&<p className="text-xs text-brand-500">{tx.installment_total}x de {formatCurrency(tx.installment_value||0)}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${tx.transaction_type==='receita'?'text-green-600':'text-red-500'}`}>
                          {tx.transaction_type==='receita'?'+':'-'}{formatCurrency(tx.installment_value||tx.amount)}
                        </p>
                        <span className={`badge ${STATUS_COLORS[tx.status]||'bg-gray-100 text-gray-500'}`}>{tx.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet ações */}
      {selected&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end'}} onClick={()=>setSelected(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.3)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 20px 36px'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:32,height:4,background:'#E5E5EA',borderRadius:2,margin:'0 auto 16px'}}/>
            <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg">{CAT_ICONS[selected.category]||'📦'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{selected.description}</p>
                <p className="text-xs text-gray-400">{selected.category} · {selected.holder}</p>
              </div>
              <p className={`text-sm font-bold tabular-nums ${selected.transaction_type==='receita'?'text-green-600':'text-red-500'}`}>
                {selected.transaction_type==='receita'?'+':'-'}{formatCurrency(selected.installment_value||selected.amount)}
              </p>
            </div>
            <div className="space-y-2">
              {selected.transaction_type!=='receita'&&selected.status!=='pago'&&(
                <button onClick={()=>markPaid(selected)} className="btn-primary"><CheckCircle size={18}/> Marcar como pago</button>
              )}
              <Link href={`/lancamentos/editar/${selected.id}`} className="w-full h-12 bg-gray-100 text-gray-700 font-medium rounded-2xl flex items-center justify-center gap-2 text-sm" onClick={()=>setSelected(null)}>
                <Pencil size={16}/> Editar lançamento
              </Link>
              <button onClick={()=>del(selected.id)} className="w-full h-12 bg-red-50 text-red-600 font-medium rounded-2xl flex items-center justify-center gap-2 text-sm">
                <Trash2 size={16}/> Apagar
              </button>
              <button onClick={()=>setSelected(null)} className="w-full h-10 text-gray-400 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
