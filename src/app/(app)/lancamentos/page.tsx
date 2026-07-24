'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string; holder:string; description:string; category:string; subcategory?:string; amount:number; installment_value?:number; installment_total?:number; status:string; purchase_date:string; transaction_type:string }

const BADGE: Record<string,string> = { pago:'badge-pago', pendente:'badge-pendente', previsto:'badge-previsto', atrasado:'badge-atrasado', cancelado:'badge-previsto' }
const BADGE_LABEL: Record<string,string> = { pago:'Pago', pendente:'Pendente', previsto:'Previsto', atrasado:'Atrasado', cancelado:'Cancelado' }

export default function Lancamentos() {
  const [txs,setTxs]     = useState<Tx[]>([])
  const [loading,setLoad] = useState(true)
  const [date,setDate]   = useState(new Date())
  const [showF,setShowF] = useState(false)
  const [sel,setSel]     = useState<Tx|null>(null)
  const [fH,setFH]       = useState<string[]>([])
  const [fT,setFT]       = useState<string[]>([])

  useEffect(()=>{load()},[date])

  async function load() {
    setLoad(true)
    const {data} = await createClient().from('transactions').select('*')
      .gte('purchase_date',format(startOfMonth(date),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(date),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    setTxs(data||[]); setLoad(false)
  }

  async function markPaid(tx:Tx) {
    await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
    toast.success('Pago!'); setSel(null); load()
  }
  async function del(tx:Tx) {
    if(!confirm('Apagar?'))return
    await createClient().from('transactions').delete().eq('id',tx.id)
    toast.success('Apagado!'); setSel(null); load()
  }

  function tog(arr:string[],set:(v:string[])=>void,val:string){set(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val])}

  const filtered = useMemo(()=>{
    let t=txs
    if(fH.length) t=t.filter(x=>fH.includes(x.holder))
    if(fT.length) t=t.filter(x=>fT.includes(x.transaction_type==='receita'?'Receita':'Despesa'))
    return t
  },[txs,fH,fT])

  const grouped = useMemo(()=>{
    const g:Record<string,Tx[]>={}
    filtered.forEach(t=>{if(!g[t.purchase_date])g[t.purchase_date]=[];g[t.purchase_date].push(t)})
    return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))
  },[filtered])

  const totalR = filtered.filter(t=>t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
  const totalD = filtered.filter(t=>t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'linear-gradient(180deg,#2A1B12,#1F140D)' }}>
      {/* Header */}
      <div style={{ background:'#2A1B12', padding:'12px 16px', flexShrink:0, borderBottom:'0.5px solid rgba(216,139,91,0.1)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <button onClick={()=>setDate(d=>subMonths(d,1))} style={{ width:32,height:32,background:'#3D2C20',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronLeft size={18} color="#A69C8F"/>
          </button>
          <span style={{ fontWeight:700, fontSize:15, color:'#F4EFE8', textTransform:'capitalize' }}>{format(date,'MMMM yyyy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>addMonths(d,1))} style={{ width:32,height:32,background:'#3D2C20',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronRight size={18} color="#A69C8F"/>
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          <div style={{ background:'rgba(164,201,180,0.1)', borderRadius:16, padding:'10px 14px', border:'0.5px solid rgba(164,201,180,0.2)' }}>
            <p style={{ fontSize:11,color:'#A4C9B4',marginBottom:2 }}>Receitas</p>
            <p style={{ fontSize:16,fontWeight:700,color:'#A4C9B4',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalR)}</p>
          </div>
          <div style={{ background:'rgba(216,139,91,0.1)', borderRadius:16, padding:'10px 14px', border:'0.5px solid rgba(216,139,91,0.2)' }}>
            <p style={{ fontSize:11,color:'#D88B5B',marginBottom:2 }}>Despesas</p>
            <p style={{ fontSize:16,fontWeight:700,color:'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalD)}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={()=>setShowF(!showF)} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:showF||fH.length||fT.length?'#D88B5B':'#3D2C20',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:showF||fH.length||fT.length?'#2A1B12':'#A69C8F' }}>
            <SlidersHorizontal size={13}/> Filtros{(fH.length+fT.length)>0?` (${fH.length+fT.length})`:''}
          </button>
          {(fH.length||fT.length)?<button onClick={()=>{setFH([]);setFT([])}} style={{ fontSize:11,color:'#D88B5B',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4 }}><X size={12}/>Limpar</button>:null}
        </div>
        {showF&&(
          <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10 }}>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'#A69C8F',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Pessoa</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Lucas','Nicoly','Prata'].map(h=>(
                  <button key={h} onClick={()=>tog(fH,setFH,h)} style={{ padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fH.includes(h)?'#D88B5B':'#3D2C20',color:fH.includes(h)?'#2A1B12':'#A69C8F',border:'none' }}>{h}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'#A69C8F',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Tipo</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Receita','Despesa'].map(t=>(
                  <button key={t} onClick={()=>tog(fT,setFT,t)} style={{ padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fT.includes(t)?'#D88B5B':'#3D2C20',color:fT.includes(t)?'#2A1B12':'#A69C8F',border:'none' }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex:1, overflowY:'auto', overscrollBehavior:'none', padding:'12px 14px 20px' }}>
        {loading?(
          <div style={{ display:'flex',justifyContent:'center',padding:40 }}>
            <div style={{ width:22,height:22,border:'2px solid #D88B5B',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ):grouped.length===0?(
          <div style={{ textAlign:'center',padding:'48px 16px' }}>
            <p style={{ fontSize:24,marginBottom:12 }}>📭</p>
            <p style={{ fontSize:14,color:'#A69C8F',marginBottom:16 }}>Nenhum lançamento encontrado</p>
            <Link href="/lancamentos/novo" style={{ padding:'10px 20px',background:'#D88B5B',color:'#2A1B12',borderRadius:20,fontSize:13,fontWeight:700 }}>Adicionar</Link>
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            {grouped.map(([d,list])=>(
              <div key={d}>
                <p style={{ fontSize:12,fontWeight:700,color:'#A69C8F',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>{format(parseISO(d),"dd 'de' MMMM",{locale:ptBR})}</p>
                <div style={{ background:'#3D2C20',borderRadius:24,overflow:'hidden',boxShadow:'0 4px 8px rgba(0,0,0,.2)' }}>
                  {list.map((tx,i)=>(
                    <button key={tx.id} onClick={()=>setSel(tx)}
                      style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderTop:i>0?'0.5px solid rgba(216,139,91,0.08)':'none',background:'none',border:'none',cursor:'pointer',textAlign:'left' }}>
                      <div style={{ width:40,height:40,borderRadius:14,background:tx.transaction_type==='receita'?'rgba(164,201,180,0.12)':'rgba(216,139,91,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>
                        {CAT_ICONS[tx.category]||'📦'}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:14,fontWeight:500,color:'#D8CCBF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.description}</p>
                        <p style={{ fontSize:11,color:'#A69C8F',marginTop:2 }}>{tx.category}{tx.subcategory?` › ${tx.subcategory}`:''} · {tx.holder}</p>
                        {tx.installment_total&&<p style={{ fontSize:10,color:'#D88B5B',marginTop:1 }}>{tx.installment_total}x de {formatCurrency(tx.installment_value||0)}</p>}
                      </div>
                      <div style={{ textAlign:'right',flexShrink:0 }}>
                        <p style={{ fontSize:14,fontWeight:700,color:tx.transaction_type==='receita'?'#A4C9B4':'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>
                          {tx.transaction_type==='receita'?'+':'-'}{formatCurrency(tx.installment_value||tx.amount)}
                        </p>
                        <span className={BADGE[tx.status]||'badge-pendente'}>{BADGE_LABEL[tx.status]||tx.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      {sel&&(
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setSel(null)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.65)',backdropFilter:'blur(6px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#3D2C20',borderRadius:'32px 32px 0 0',padding:'20px 20px 48px',border:'0.5px solid rgba(216,139,91,0.15)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:3,background:'rgba(216,139,91,0.3)',borderRadius:2,margin:'0 auto 18px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:16,borderBottom:'0.5px solid rgba(216,139,91,0.1)' }}>
              <div style={{ width:44,height:44,borderRadius:16,background:'rgba(216,139,91,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{CAT_ICONS[sel.category]||'📦'}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15,fontWeight:600,color:'#F4EFE8' }}>{sel.description}</p>
                <p style={{ fontSize:12,color:'#A69C8F' }}>{sel.category} · {sel.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:16,fontWeight:700,color:sel.transaction_type==='receita'?'#A4C9B4':'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>
                  {sel.transaction_type==='receita'?'+':'-'}{formatCurrency(sel.installment_value||sel.amount)}
                </p>
                <span className={BADGE[sel.status]||'badge-pendente'}>{BADGE_LABEL[sel.status]||sel.status}</span>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {sel.transaction_type!=='receita'&&sel.status!=='pago'&&(
                <button onClick={()=>markPaid(sel)} style={{ width:'100%',height:50,background:'#D88B5B',color:'#2A1B12',fontWeight:700,fontSize:15,borderRadius:20,border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(216,139,91,0.3)' }}>✓ Marcar como pago</button>
              )}
              <Link href={`/lancamentos/editar/${sel.id}`} onClick={()=>setSel(null)}
                style={{ width:'100%',height:46,background:'rgba(216,139,91,0.12)',color:'#D88B5B',fontWeight:600,fontSize:14,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',border:'0.5px solid rgba(216,139,91,0.2)' }}>
                ✏️ Editar
              </Link>
              <button onClick={()=>del(sel)} style={{ width:'100%',height:46,background:'rgba(200,60,60,0.1)',color:'#E07070',fontWeight:600,fontSize:14,borderRadius:20,border:'0.5px solid rgba(200,60,60,0.2)',cursor:'pointer' }}>🗑 Apagar</button>
              <button onClick={()=>setSel(null)} style={{ width:'100%',height:36,background:'none',color:'#A69C8F',fontSize:13,border:'none',cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
