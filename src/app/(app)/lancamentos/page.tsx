'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string;holder:string;description:string;category:string;subcategory?:string;amount:number;installment_value?:number;installment_total?:number;status:string;purchase_date:string;transaction_type:string }

const BADGE: Record<string,string> = { pago:'badge-pago',pendente:'badge-pendente',previsto:'badge-previsto',atrasado:'badge-atrasado',cancelado:'badge-previsto' }
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


const BG='#F5F5F7'; const SEBBLE='#FFFFFF'; const SEBBLE_DK='#FFFFFF'
const TEXT='#1C1C1E'; const TEXTMU='#8E8E93'; const TEXTLT='#48484A'
const GREEN='#34C759'; const GREENBG='rgba(52,199,89,0.08)'; const TERRA='#C4622D'; const TERRABG='rgba(255,59,48,0.06)'; const CREAM='#FFFFFF'

export default function Lancamentos() {
  const [txs,setTxs]   = useState<Tx[]>([])
  const [load,setLoad] = useState(true)
  const [date,setDate] = useState(new Date())
  const [showF,setShowF]=useState(false)
  const [sel,setSel]   = useState<Tx|null>(null)
  const [fH,setFH]     = useState<string[]>([])
  const [fT,setFT]     = useState<string[]>([])

  useEffect(()=>{loadData()},[date])

  async function loadData() {
    setLoad(true)
    const {data}=await createClient().from('transactions').select('*')
      .gte('purchase_date',format(startOfMonth(date),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(date),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    setTxs(data||[]); setLoad(false)
  }

  async function markPaid(tx:Tx) {
    await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
    toast.success('Pago!'); setSel(null); loadData()
  }
  async function del(tx:Tx) {
    if(!confirm('Apagar?'))return
    await createClient().from('transactions').delete().eq('id',tx.id)
    toast.success('Apagado!'); setSel(null); loadData()
  }

  function tog(arr:string[],set:(v:string[])=>void,val:string){set(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val])}

  const filtered=useMemo(()=>{
    let t=txs
    if(fH.length) t=t.filter(x=>fH.includes(x.holder))
    if(fT.length) t=t.filter(x=>fT.includes(x.transaction_type==='receita'?'Receita':'Despesa'))
    return t
  },[txs,fH,fT])

  const grouped=useMemo(()=>{
    const g:Record<string,Tx[]>={}
    filtered.forEach(t=>{if(!g[t.purchase_date])g[t.purchase_date]=[];g[t.purchase_date].push(t)})
    return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))
  },[filtered])

  const totalR=filtered.filter(t=>t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
  const totalD=filtered.filter(t=>t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const aConfirmar=filtered.filter(t=>t.transaction_type==='receita'&&t.status==='previsto').reduce((s,t)=>s+t.amount,0)
  const aPagar=filtered.filter(t=>t.transaction_type!=='receita'&&['pendente','atrasado'].includes(t.status)).reduce((s,t)=>s+(t.installment_value||t.amount),0)

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',background:BG }}>
      {/* Header */}
      <div style={{ background:'#FFFFFF', padding:'12px 16px 14px', flexShrink:0 }}>
        {/* Navegação de mês */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
          <button onClick={()=>setDate(d=>subMonths(d,1))} style={{ width:32,height:32,background:'rgba(244,239,232,0.1)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronLeft size={18} color={CREAM}/>
          </button>
          <span style={{ fontWeight:700,fontSize:15,color:CREAM,textTransform:'capitalize' }}>{format(date,'MMMM yyyy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>addMonths(d,1))} style={{ width:32,height:32,background:'rgba(244,239,232,0.1)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronRight size={18} color={CREAM}/>
          </button>
        </div>

        {/* Cards resumo */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
          <div style={{ background:'rgba(80,130,90,0.2)',borderRadius:20,padding:'12px 14px',border:'0.5px solid rgba(80,130,90,0.25)' }}>
            <p style={{ fontSize:11,color:'rgba(164,201,180,0.8)',marginBottom:2 }}>Total Receitas ({format(date,'MMM/yy')})</p>
            <p style={{ fontSize:17,fontWeight:700,color:'#A4C9B4',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalR)}</p>
            {aConfirmar>0&&<p style={{ fontSize:10,color:'rgba(164,201,180,0.6)',marginTop:2 }}>A confirmar: {formatCurrency(aConfirmar)}</p>}
          </div>
          <div style={{ background:'rgba(196,98,45,0.2)',borderRadius:20,padding:'12px 14px',border:'0.5px solid rgba(196,98,45,0.25)' }}>
            <p style={{ fontSize:11,color:'rgba(244,200,170,0.8)',marginBottom:2 }}>Total Despesas ({format(date,'MMM/yy')})</p>
            <p style={{ fontSize:17,fontWeight:700,color:'#F4C8AA',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalD)}</p>
            {aPagar>0&&<p style={{ fontSize:10,color:'rgba(244,200,170,0.6)',marginTop:2 }}>A pagar: {formatCurrency(aPagar)}</p>}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <button onClick={()=>setShowF(!showF)} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:20,background:showF||fH.length||fT.length?TERRA:'rgba(244,239,232,0.12)',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:showF||fH.length||fT.length?CREAM:'rgba(244,239,232,0.7)' }}>
            <SlidersHorizontal size={13}/> Filtros{(fH.length+fT.length)>0?` (${fH.length+fT.length})`:''}
          </button>
          {(fH.length||fT.length)?<button onClick={()=>{setFH([]);setFT([])}} style={{ fontSize:11,color:TERRA,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3 }}><X size={11}/>Limpar</button>:null}
        </div>
        {showF&&(
          <div style={{ marginTop:10,display:'flex',flexDirection:'column',gap:10 }}>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'rgba(244,239,232,0.5)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Pessoa</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Lucas','Nicoly','Prata'].map(h=>(
                  <button key={h} onClick={()=>tog(fH,setFH,h)} style={{ padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fH.includes(h)?TERRA:'rgba(244,239,232,0.1)',color:fH.includes(h)?CREAM:'rgba(244,239,232,0.6)',border:'none' }}>{h}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'rgba(244,239,232,0.5)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Tipo</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Receita','Despesa'].map(t=>(
                  <button key={t} onClick={()=>tog(fT,setFT,t)} style={{ padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fT.includes(t)?TERRA:'rgba(244,239,232,0.1)',color:fT.includes(t)?CREAM:'rgba(244,239,232,0.6)',border:'none' }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex:1,overflowY:'auto',overscrollBehavior:'none',padding:'12px 14px 160px' }}>
        {load?(
          <div style={{ display:'flex',justifyContent:'center',padding:40 }}>
            <div style={{ width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ):grouped.length===0?(
          <div style={{ textAlign:'center',padding:'48px 16px' }}>
            <p style={{ fontSize:24,marginBottom:12 }}>📭</p>
            <p style={{ fontSize:14,color:TEXTMU,marginBottom:16 }}>Nenhum lançamento</p>
            <Link href="/lancamentos/novo" style={{ padding:'10px 20px',background:TERRA,color:CREAM,borderRadius:24,fontSize:13,fontWeight:700 }}>Adicionar</Link>
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            {grouped.map(([d,list])=>(
              <div key={d}>
                <p style={{ fontSize:13,fontWeight:600,color:TEXTLT,marginBottom:8 }}>{format(parseISO(d),"dd 'de' MMMM",{locale:ptBR})}</p>
                <div style={{ background:SEBBLE,borderRadius:24,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                  {list.map((tx,i)=>(
                    <button key={tx.id} onClick={()=>setSel(tx)}
                      style={{ width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderTop:i>0?`0.5px solid rgba(0,0,0,0.03)`:undefined,background:'none',border:'none',cursor:'pointer',textAlign:'left' }}>
                      <div style={{ width:38,height:38,borderRadius:12,background:tx.transaction_type==='receita'?GREENBG:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0 }}>
                        {CAT_ICONS[tx.category]||'📦'}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:15,fontWeight:500,color:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.description}</p>
                        <p style={{ fontSize:11,color:TEXTMU,marginTop:2 }}>{tx.category}{tx.subcategory?` › ${tx.subcategory}`:''} | {tx.holder}</p>
                        {tx.status==='pago'&&<p style={{ fontSize:10,color:GREEN,marginTop:1 }}>Pago - Confirmado</p>}
                        {tx.status==='pendente'&&<p style={{ fontSize:10,color:TERRA,marginTop:1 }}>Pendente - {tx.installment_value?`Parcela`:''}{tx.installment_total?` (${tx.installment_total}x)`:''}</p>}
                      </div>
                      <div style={{ textAlign:'right',flexShrink:0 }}>
                        <p style={{ fontSize:14,fontWeight:700,color:tx.transaction_type==='receita'?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const }}>
                          {tx.transaction_type==='receita'?'+':'-'}{formatCurrency(tx.installment_value||tx.amount)}
                        </p>
                        <BadgeInline status={tx.status}/>
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
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#FFFFFF',borderRadius:'32px 32px 0 0',padding:'20px 20px 48px',boxShadow:'0 -8px 32px rgba(255,255,255,0.1)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,margin:'0 auto 18px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:16,borderBottom:`1px solid rgba(0,0,0,0.04)` }}>
              <div style={{ width:44,height:44,borderRadius:14,background:sel.transaction_type==='receita'?GREENBG:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{CAT_ICONS[sel.category]||'📦'}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15,fontWeight:600,color:TEXT }}>{sel.description}</p>
                <p style={{ fontSize:12,color:TEXTMU }}>{sel.category} · {sel.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:16,fontWeight:700,color:sel.transaction_type==='receita'?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const }}>
                  {sel.transaction_type==='receita'?'+':'-'}{formatCurrency(sel.installment_value||sel.amount)}
                </p>
                <BadgeInline status={sel.status}/>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {sel.transaction_type!=='receita'&&sel.status!=='pago'&&(
                <button onClick={()=>markPaid(sel)} style={{ width:'100%',height:50,background:TERRA,color:CREAM,fontWeight:700,fontSize:15,borderRadius:24,border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(196,98,45,0.3)' }}>✓ Marcar como pago</button>
              )}
              <Link href={`/lancamentos/editar/${sel.id}`} onClick={()=>setSel(null)}
                style={{ width:'100%',height:46,background:'rgba(0,0,0,0.03)',color:TEXT,fontWeight:600,fontSize:14,borderRadius:24,display:'flex',alignItems:'center',justifyContent:'center' }}>
                ✏️ Editar
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
