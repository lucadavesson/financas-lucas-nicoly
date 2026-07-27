'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

const BG     = '#1A110A'
const PEBBLE = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#5DE08A'
const TERRA  = '#C4622D'
const GREENBG= 'rgba(74,140,92,0.18)'
const TERRABG= 'rgba(196,98,45,0.18)'

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
    <span style={{display:'inline-flex',alignItems:'center',gap:5,background:c.bg,color:c.color,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,border:`1px solid ${c.border}`,letterSpacing:'0.03em',flexShrink:0}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.color,flexShrink:0,animation:c.pulse?'pulse 1.6s ease-in-out infinite':'none'}}/>
      {c.label}
    </span>
  )
}

interface Tx {
  id:string; description:string; amount:number; installment_value?:number
  status:string; purchase_date:string; category:string; holder:string; due_date?:string
  transaction_type:string; payment_method?:string; card_name?:string
}

export default function Pagamentos() {
  const [txs,      setTxs]     = useState<Tx[]>([])
  const [loading,  setLoad]    = useState(true)
  const [paying,   setPaying]  = useState<string|null>(null)
  const [showPago, setShowPago]= useState(false)
  const now = new Date()
  const mes = format(now, "MMMM 'de' yyyy", {locale:ptBR})

  useEffect(()=>{ load() }, [])

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

  async function marcarPago(tx: Tx) {
    setPaying(tx.id)
    const {error} = await createClient().from('transactions')
      .update({status:'pago', paid_date: format(new Date(),'yyyy-MM-dd')})
      .eq('id', tx.id)
    if (error) { toast.error('Erro ao atualizar'); setPaying(null); return }
    toast.success(`"${tx.description}" marcado como pago!`)
    setPaying(null)
    load()
  }

  async function desmarcarPago(tx: Tx) {
    setPaying(tx.id)
    await createClient().from('transactions')
      .update({status:'pendente', paid_date: null})
      .eq('id', tx.id)
    toast.success('Desmarcado')
    setPaying(null)
    load()
  }

  const pendentes = txs.filter(t => t.status !== 'pago' && t.status !== 'cancelado')
  const pagos     = txs.filter(t => t.status === 'pago')

  // Dia 1 = Lucas paga. Após dia 1 = Nicoly assume.
  // "Lucas paga" = contas de holder Lucas com vencimento até dia 15
  // "Nicoly assume" = demais
  const lucasPaga  = pendentes.filter(t => t.holder === 'Lucas' || t.holder === 'Prata')
  const nicolyPaga = pendentes.filter(t => t.holder === 'Nicoly')

  const totalPendente  = pendentes.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalPago      = pagos.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalLucas     = lucasPaga.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalNicoly    = nicolyPaga.reduce((s,t)=>s+(t.installment_value||t.amount),0)

  const pebble = (extra?:any) => ({
    background:PEBBLE, borderRadius:24, padding:'16px 18px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    marginBottom:12, ...extra
  })

  function TxRow({tx, onToggle}: {tx:Tx; onToggle:(tx:Tx)=>void}) {
    const isPago = tx.status === 'pago'
    const val = tx.installment_value || tx.amount
    return (
      <button
        onClick={()=>onToggle(tx)}
        disabled={paying===tx.id}
        style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',
          display:'flex',alignItems:'center',gap:12,padding:'11px 0',
          opacity:paying===tx.id?0.5:1
        }}
      >
        {/* Check */}
        <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
          background:isPago?'rgba(74,140,92,0.25)':'rgba(255,255,255,0.06)',
          border:`1.5px solid ${isPago?'rgba(93,224,138,0.5)':'rgba(255,255,255,0.12)'}`,
          display:'flex',alignItems:'center',justifyContent:'center'
        }}>
          {isPago && <span style={{color:GREEN,fontSize:14}}>✓</span>}
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:500,color:isPago?TEXTMU:TEXT,margin:0,
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
            textDecoration:isPago?'line-through':'none'
          }}>{tx.description}</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
            {tx.category} · {tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}
          </p>
        </div>
        {/* Valor + badge */}
        <div style={{textAlign:'right',flexShrink:0}}>
          <p style={{fontSize:13,fontWeight:700,color:isPago?TEXTMU:TERRA,fontVariantNumeric:'tabular-nums',margin:'0 0 3px',textDecoration:isPago?'line-through':'none'}}>
            {formatCurrency(val)}
          </p>
          <BadgeInline status={tx.status}/>
        </div>
      </button>
    )
  }

  function GroupSection({title, subtitle, txList, total, accentColor}: {title:string;subtitle:string;txList:Tx[];total:number;accentColor:string}) {
    if (txList.length === 0) return null
    return (
      <div style={{...pebble()}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 2px'}}>{title}</p>
            <p style={{fontSize:11,color:TEXTMU,margin:0}}>{subtitle}</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:11,color:TEXTMU,margin:'0 0 2px'}}>{txList.length} contas</p>
            <p style={{fontSize:15,fontWeight:800,color:accentColor,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(total)}</p>
          </div>
        </div>
        <div style={{borderTop:'0.5px solid rgba(255,255,255,0.06)'}}>
          {txList.map((tx,i)=>(
            <div key={tx.id} style={{borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
              <TxRow tx={tx} onToggle={tx.status==='pago'?desmarcarPago:marcarPago}/>
            </div>
          ))}
        </div>
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
        <p style={{fontSize:12,color:TEXTMU,margin:0,textTransform:'capitalize'}}>{mes}</p>
      </div>

      {/* Resumo geral */}
      <div style={{background:'rgba(255,255,255,0.04)',borderRadius:24,padding:'16px 18px',marginBottom:16,border:'0.5px solid rgba(255,255,255,0.07)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:10,color:TEXTMU,margin:'0 0 4px',letterSpacing:'0.05em'}}>A PAGAR</p>
            <p style={{fontSize:18,fontWeight:800,color:'#FF8A5C',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPendente)}</p>
          </div>
          <div style={{textAlign:'center',borderLeft:'0.5px solid rgba(255,255,255,0.07)',borderRight:'0.5px solid rgba(255,255,255,0.07)'}}>
            <p style={{fontSize:10,color:TEXTMU,margin:'0 0 4px',letterSpacing:'0.05em'}}>PAGO</p>
            <p style={{fontSize:18,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:10,color:TEXTMU,margin:'0 0 4px',letterSpacing:'0.05em'}}>TOTAL</p>
            <p style={{fontSize:18,fontWeight:800,color:TEXT,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPendente+totalPago)}</p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        {(totalPago+totalPendente) > 0 && (
          <div style={{marginTop:14}}>
            <div style={{height:6,background:'rgba(255,255,255,0.07)',borderRadius:99,overflow:'hidden'}}>
              <div style={{
                height:'100%',borderRadius:99,
                width:`${(totalPago/(totalPago+totalPendente))*100}%`,
                background:'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.85))',
                transition:'width 0.5s ease',
              }}/>
            </div>
            <p style={{fontSize:10,color:TEXTMU,margin:'5px 0 0',textAlign:'center'}}>
              {((totalPago/(totalPago+totalPendente))*100).toFixed(0)}% do mês pago
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:40}}>
          <div style={{width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        </div>
      ) : (
        <>
          {/* Contas de Lucas / Prata */}
          <GroupSection
            title="💼 Responsabilidade de Lucas"
            subtitle="Contas do ciclo salarial do dia 1"
            txList={lucasPaga}
            total={totalLucas}
            accentColor="#FF8A5C"
          />

          {/* Contas de Nicoly */}
          <GroupSection
            title="👩 Responsabilidade de Nicoly"
            subtitle="Contas assumidas pela Nicoly"
            txList={nicolyPaga}
            total={totalNicoly}
            accentColor="#FF8A5C"
          />

          {pendentes.length === 0 && (
            <div style={{...pebble(),textAlign:'center',padding:'32px 20px'}}>
              <p style={{fontSize:32,margin:'0 0 10px'}}>🎉</p>
              <p style={{fontSize:15,fontWeight:700,color:GREEN,margin:'0 0 4px'}}>Tudo pago!</p>
              <p style={{fontSize:12,color:TEXTMU,margin:0}}>Nenhuma conta pendente este mês</p>
            </div>
          )}

          {/* Já pagos */}
          {pagos.length > 0 && (
            <div>
              <button
                onClick={()=>setShowPago(!showPago)}
                style={{width:'100%',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 4px',marginBottom:8}}
              >
                <p style={{fontSize:12,fontWeight:600,color:TEXTMU,margin:0,textTransform:'uppercase',letterSpacing:'0.07em'}}>
                  Já pagos ({pagos.length})
                </p>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:GREEN,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</span>
                  {showPago ? <ChevronUp size={14} color={TEXTMU}/> : <ChevronDown size={14} color={TEXTMU}/>}
                </div>
              </button>
              {showPago && (
                <div style={{...pebble()}}>
                  {pagos.map((tx,i)=>(
                    <div key={tx.id} style={{borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':'none'}}>
                      <TxRow tx={tx} onToggle={desmarcarPago}/>
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
