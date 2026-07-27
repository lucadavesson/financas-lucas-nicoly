'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

const BG     = '#1A110A'
const PEBBLE = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#5DE08A'
const TERRA  = '#C4622D'
const TERRABG= 'rgba(196,98,45,0.18)'
const GREENBG= 'rgba(74,140,92,0.18)'

function BadgeInline({status}: {status:string}) {
  const cfg: Record<string,{bg:string;color:string;border:string;label:string;pulse:boolean}> = {
    pago:     {bg:'rgba(34,120,60,0.35)',  color:'#5DE08A', border:'rgba(93,224,138,0.4)',  label:'Pago',     pulse:false},
    pendente: {bg:'rgba(180,60,20,0.35)',  color:'#FF8A5C', border:'rgba(255,138,92,0.45)', label:'Pendente', pulse:true},
    previsto: {bg:'rgba(160,110,10,0.3)',  color:'#FFCC55', border:'rgba(255,204,85,0.35)', label:'Previsto', pulse:false},
    atrasado: {bg:'rgba(180,30,30,0.35)',  color:'#FF6B6B', border:'rgba(255,107,107,0.4)', label:'Atrasado', pulse:true},
  }
  const c = cfg[status] || cfg.pendente
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:c.bg,color:c.color,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,border:`1px solid ${c.border}`,flexShrink:0}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.color,animation:c.pulse?'pulse 1.6s ease-in-out infinite':'none'}}/>
      {c.label}
    </span>
  )
}

interface Tx {
  id:string;description:string;amount:number;installment_value?:number
  status:string;purchase_date:string;category:string;holder:string
  transaction_type:string
}

export default function Pagamentos() {
  const [txs,     setTxs]     = useState<Tx[]>([])
  const [loading, setLoad]    = useState(true)
  const [paying,  setPaying]  = useState<string|null>(null)
  const [openGrp, setOpenGrp] = useState<Record<string,boolean>>({'lucas':true,'nicoly':true,'pagas':false})
  const now = new Date()

  useEffect(()=>{ load() },[])

  async function load() {
    setLoad(true)
    const {data} = await createClient().from('transactions')
      .select('*')
      .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
      .neq('transaction_type','receita')
      .order('purchase_date', {ascending:true})
    setTxs(data||[])
    setLoad(false)
  }

  async function toggle(tx: Tx) {
    setPaying(tx.id)
    if (tx.status === 'pago') {
      await createClient().from('transactions').update({status:'pendente',paid_date:null}).eq('id',tx.id)
      toast.success('Desmarcado como pendente')
    } else {
      await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
      toast.success(`✓ "${tx.description}" pago!`)
    }
    setPaying(null)
    load()
  }

  const val = (t:Tx) => t.installment_value||t.amount

  const pendentes = txs.filter(t=>t.status!=='pago'&&t.status!=='cancelado')
  const pagas     = txs.filter(t=>t.status==='pago')
  const lucasList = pendentes.filter(t=>t.holder==='Lucas'||t.holder==='Prata')
  const nicolyList= pendentes.filter(t=>t.holder==='Nicoly')

  const totalPendente = pendentes.reduce((s,t)=>s+val(t),0)
  const totalPago     = pagas.reduce((s,t)=>s+val(t),0)
  const totalGeral    = totalPendente+totalPago
  const pctPago       = totalGeral>0?(totalPago/totalGeral)*100:0
  const totalLucas    = lucasList.reduce((s,t)=>s+val(t),0)
  const totalNicoly   = nicolyList.reduce((s,t)=>s+val(t),0)

  function toggle_grp(k:string){setOpenGrp(p=>({...p,[k]:!p[k]}))}

  function TxItem({tx}:{tx:Tx}) {
    const isPago = tx.status==='pago'
    const v = val(tx)
    return (
      <button onClick={()=>toggle(tx)} disabled={paying===tx.id}
        style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12,padding:'12px 0',opacity:paying===tx.id?0.5:1}}>
        {/* Checkbox */}
        <div style={{
          width:26,height:26,borderRadius:8,flexShrink:0,
          background:isPago?'rgba(74,140,92,0.3)':'rgba(255,255,255,0.06)',
          border:`1.5px solid ${isPago?'rgba(93,224,138,0.5)':'rgba(255,255,255,0.15)'}`,
          display:'flex',alignItems:'center',justifyContent:'center',
          transition:'all 0.15s',
        }}>
          {isPago && <Check size={14} color={GREEN} strokeWidth={2.5}/>}
        </div>
        {/* Ícone + info */}
        <div style={{width:34,height:34,borderRadius:11,background:isPago?'rgba(255,255,255,0.04)':TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
          {CAT_ICONS[tx.category]||'📦'}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:500,color:isPago?TEXTMU:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:isPago?'line-through':'none'}}>
            {tx.description}
          </p>
          <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
            {tx.category} · {format(parseISO(tx.purchase_date),'dd/MM')}
          </p>
        </div>
        {/* Valor + badge */}
        <div style={{textAlign:'right',flexShrink:0}}>
          <p style={{fontSize:14,fontWeight:700,color:isPago?TEXTMU:TERRA,fontVariantNumeric:'tabular-nums',margin:'0 0 3px',textDecoration:isPago?'line-through':'none'}}>
            {formatCurrency(v)}
          </p>
          <BadgeInline status={tx.status}/>
        </div>
      </button>
    )
  }

  function Group({id,title,subtitle,list,total,color}:{id:string;title:string;subtitle:string;list:Tx[];total:number;color:string}) {
    if (list.length===0) return null
    const open = openGrp[id]
    const pagoCount = list.filter(t=>t.status==='pago').length
    return (
      <div style={{marginBottom:10}}>
        <button onClick={()=>toggle_grp(id)}
          style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 4px',marginBottom:open?6:0}}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 1px'}}>{title}</p>
            <p style={{fontSize:11,color:TEXTMU,margin:0}}>{subtitle} · {list.length} conta{list.length>1?'s':''}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <p style={{fontSize:14,fontWeight:800,color,fontVariantNumeric:'tabular-nums',margin:0}}>{formatCurrency(total)}</p>
            {open ? <ChevronUp size={14} color={TEXTMU}/> : <ChevronDown size={14} color={TEXTMU}/>}
          </div>
        </button>
        {open && (
          <div style={{background:PEBBLE,borderRadius:20,padding:'0 16px',boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)'}}>
            {list.map((tx,i)=>(
              <div key={tx.id} style={{borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
                <TxItem tx={tx}/>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 130px'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
      `}</style>

      {/* Header */}
      <div style={{marginBottom:16}}>
        <h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:'0 0 2px'}}>Pagamentos</h1>
        <p style={{fontSize:12,color:TEXTMU,margin:0,textTransform:'capitalize'}}>
          {format(now,"MMMM 'de' yyyy",{locale:ptBR})}
        </p>
      </div>

      {/* Resumo consolidado */}
      <div style={{background:'rgba(255,255,255,0.04)',borderRadius:24,padding:'16px 18px',marginBottom:16,border:'0.5px solid rgba(255,255,255,0.07)'}}>
        {/* Barra de progresso */}
        <div style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:11,color:TEXTMU}}>Progresso do mês</span>
            <span style={{fontSize:13,fontWeight:800,color:pctPago>=100?GREEN:TEXTLT}}>{pctPago.toFixed(0)}% pago</span>
          </div>
          <div style={{height:10,background:'rgba(255,255,255,0.07)',borderRadius:99,overflow:'hidden'}}>
            <div style={{
              height:'100%',borderRadius:99,
              width:`${pctPago}%`,
              background:pctPago>=100?'linear-gradient(90deg,#4A8C5C,#5DE08A)':'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.85))',
              transition:'width 0.5s ease',
            }}/>
          </div>
        </div>
        {/* 3 métricas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div style={{textAlign:'center',background:TERRABG,borderRadius:14,padding:'10px 6px',border:'0.5px solid rgba(255,138,92,0.15)'}}>
            <p style={{fontSize:9,color:'rgba(255,138,92,0.6)',margin:'0 0 3px',letterSpacing:'0.05em'}}>A PAGAR</p>
            <p style={{fontSize:15,fontWeight:800,color:'#FF8A5C',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPendente)}</p>
          </div>
          <div style={{textAlign:'center',background:GREENBG,borderRadius:14,padding:'10px 6px',border:'0.5px solid rgba(93,224,138,0.15)'}}>
            <p style={{fontSize:9,color:'rgba(93,224,138,0.6)',margin:'0 0 3px',letterSpacing:'0.05em'}}>PAGO</p>
            <p style={{fontSize:15,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'10px 6px',border:'0.5px solid rgba(255,255,255,0.08)'}}>
            <p style={{fontSize:9,color:TEXTMU,margin:'0 0 3px',letterSpacing:'0.05em'}}>TOTAL</p>
            <p style={{fontSize:15,fontWeight:800,color:TEXT,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalGeral)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:40}}>
          <div style={{width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        </div>
      ) : (
        <>
          {pendentes.length===0 && (
            <div style={{background:PEBBLE,borderRadius:24,padding:'32px 20px',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>
              <p style={{fontSize:36,margin:'0 0 10px'}}>🎉</p>
              <p style={{fontSize:15,fontWeight:700,color:GREEN,margin:'0 0 4px'}}>Tudo pago!</p>
              <p style={{fontSize:12,color:TEXTMU,margin:0}}>Nenhuma conta pendente este mês</p>
            </div>
          )}

          {/* Lucas */}
          <Group id="lucas" title="💼 Lucas & Prata" subtitle="Contas do ciclo salarial" list={lucasList} total={totalLucas} color="#FF8A5C"/>

          {/* Nicoly */}
          <Group id="nicoly" title="👩 Nicoly" subtitle="Responsabilidade da Nicoly" list={nicolyList} total={totalNicoly} color="#FF8A5C"/>

          {/* Já pagas — colapsado por padrão */}
          {pagas.length > 0 && (
            <div style={{marginBottom:10}}>
              <button onClick={()=>toggle_grp('pagas')}
                style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 4px',marginBottom:openGrp['pagas']?6:0}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:TEXTLT,margin:'0 0 1px'}}>✅ Já pagos ({pagas.length})</p>
                  <p style={{fontSize:11,color:TEXTMU,margin:0}}>Contas quitadas esse mês</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <p style={{fontSize:14,fontWeight:800,color:GREEN,fontVariantNumeric:'tabular-nums',margin:0}}>{formatCurrency(totalPago)}</p>
                  {openGrp['pagas'] ? <ChevronUp size={14} color={TEXTMU}/> : <ChevronDown size={14} color={TEXTMU}/>}
                </div>
              </button>
              {openGrp['pagas'] && (
                <div style={{background:PEBBLE,borderRadius:20,padding:'0 16px',boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)'}}>
                  {pagas.map((tx,i)=>(
                    <div key={tx.id} style={{borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
                      <TxItem tx={tx}/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
