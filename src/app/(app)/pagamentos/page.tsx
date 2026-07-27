'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronDown, ChevronUp, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const BG     = '#1A110A'
const PEBBLE = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#5DE08A'
const TERRA  = '#C4622D'
const TERRABG= 'rgba(196,98,45,0.18)'
const GREENBG= 'rgba(74,140,92,0.18)'

// Gradientes dos bancos para os cards de fatura
const BANK_GRAD: Record<string,string> = {
  nubank:'linear-gradient(135deg,#5B2D8A,#3A1860)',
  santander:'linear-gradient(135deg,#C0281E,#7A1010)',
  bb:'linear-gradient(135deg,#1A5FAD,#0D3068)',
  c6:'linear-gradient(135deg,#2C2C2C,#121212)',
  bradesco:'linear-gradient(135deg,#A01010,#600808)',
  mercadopago:'linear-gradient(135deg,#0060A0,#003060)',
  caixa:'linear-gradient(135deg,#0A5A32,#043018)',
  inter:'linear-gradient(135deg,#A04818,#602808)',
  default:'linear-gradient(135deg,#6A4428,#3D2410)',
}
function bankGrad(name: string) {
  const n = name.toLowerCase()
  if (n.includes('nubank'))    return BANK_GRAD.nubank
  if (n.includes('santander')) return BANK_GRAD.santander
  if (n.includes('brasil')||n.includes(' bb')) return BANK_GRAD.bb
  if (n.includes('c6'))        return BANK_GRAD.c6
  if (n.includes('bradesco'))  return BANK_GRAD.bradesco
  if (n.includes('mercado'))   return BANK_GRAD.mercadopago
  if (n.includes('caixa'))     return BANK_GRAD.caixa
  if (n.includes('inter'))     return BANK_GRAD.inter
  return BANK_GRAD.default
}

interface Tx {
  id:string; description:string; amount:number; installment_value?:number
  status:string; purchase_date:string; category:string; holder:string
  transaction_type:string; payment_method?:string; card_name?:string
  due_day?: number; billing_month?: string
}
interface Card { id:string; name:string; bank:string; holder:string; card_type?:string; due_day:number; closing_day:number; credit_limit:number; color:string }

function BadgeStatus({ status }: { status: string }) {
  const cfg: Record<string,{bg:string;color:string;label:string;pulse:boolean}> = {
    pago:     { bg:'rgba(34,120,60,0.35)',  color:'#5DE08A', label:'Pago',     pulse:false },
    pendente: { bg:'rgba(180,60,20,0.35)',  color:'#FF8A5C', label:'Pendente', pulse:true  },
    atrasado: { bg:'rgba(180,30,30,0.35)',  color:'#FF6B6B', label:'Atrasado', pulse:true  },
    previsto: { bg:'rgba(160,110,10,0.3)',  color:'#FFCC55', label:'Previsto', pulse:false },
  }
  const c = cfg[status] || cfg.pendente
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:c.bg,color:c.color,fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:20,border:`1px solid ${c.color}30`,flexShrink:0}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.color,animation:c.pulse?'pulse 1.6s ease-in-out infinite':'none'}}/>
      {c.label}
    </span>
  )
}

export default function Pagamentos() {
  const [txs,      setTxs]     = useState<Tx[]>([])
  const [cards,    setCards]   = useState<Card[]>([])
  const [loading,  setLoad]    = useState(true)
  const [paying,   setPaying]  = useState<string|null>(null)
  const [openGrp,  setOpenGrp] = useState<Record<string,boolean>>({})
  const now = new Date()

  useEffect(()=>{ load() },[])

  async function load() {
    setLoad(true)
    const s = createClient()
    const [{ data: txData }, { data: cardData }] = await Promise.all([
      s.from('transactions').select('*')
        .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
        .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
        .neq('transaction_type','receita')
        .order('purchase_date', { ascending: true }),
      s.from('cards').select('*').eq('is_active', true),
    ])
    setTxs(txData||[])
    setCards(cardData||[])
    // Abrir todos os grupos por padrão
    const grps: Record<string,boolean> = { pagas: false }
    ;(cardData||[]).forEach(c => { grps[c.id] = true })
    grps['avulsas'] = true
    setOpenGrp(grps)
    setLoad(false)
  }

  async function pagarFatura(cardId: string, cardName: string) {
    // Marca TODAS as transações pendentes daquele cartão como pagas
    setPaying(cardId)
    const txsDoCartao = txs.filter(t =>
      (t.card_name === cardName || t.card_name?.includes(cardName.split('—')[0]?.trim())) &&
      t.payment_method === 'cartao_credito' && t.status !== 'pago'
    )
    if (txsDoCartao.length === 0) { setPaying(null); return }
    await createClient().from('transactions')
      .update({ status: 'pago', paid_date: format(new Date(),'yyyy-MM-dd') })
      .in('id', txsDoCartao.map(t=>t.id))
    toast.success(`Fatura ${cardName.split('—')[0]?.trim()} paga! ${txsDoCartao.length} lançamentos atualizados`)
    setPaying(null)
    load()
  }

  async function toggleAvulsa(tx: Tx) {
    setPaying(tx.id)
    const novo = tx.status === 'pago' ? 'pendente' : 'pago'
    await createClient().from('transactions')
      .update({ status: novo, paid_date: novo==='pago' ? format(new Date(),'yyyy-MM-dd') : null })
      .eq('id', tx.id)
    toast.success(novo==='pago' ? `✓ "${tx.description}" pago!` : 'Desmarcado')
    setPaying(null)
    load()
  }

  function tog(k:string){setOpenGrp(p=>({...p,[k]:!p[k]}))}

  // ── Separação lógica ──────────────────────────────────────────
  // 1. Transações de cartão de crédito (pagamento é da fatura, não individual)
  // Transações de cartão de crédito: payment_method explícito OU parcelada
  const txCartao = txs.filter(t => 
    t.payment_method === 'cartao_credito' || 
    t.transaction_type === 'parcelada'
  )

  // 2. Transações avulsas (débito, PIX, boleto, dinheiro — pagas individualmente)
  // Contas avulsas: tudo que NÃO é cartão de crédito
  const txAvulsas = txs.filter(t => 
    t.payment_method !== 'cartao_credito' && 
    t.transaction_type !== 'parcelada'
  )
  const avulsasPendentes = txAvulsas.filter(t => t.status !== 'pago' && t.status !== 'cancelado')
  const avulsasPagas     = txAvulsas.filter(t => t.status === 'pago')

  // 3. Faturas por cartão
  type FaturaCard = {
    card: Card
    txs: Tx[]
    total: number
    pago: number
    pendente: number
    isPago: boolean
  }
  const faturas: FaturaCard[] = cards
    .filter(c => c.card_type === 'credito' || !c.card_type || c.card_type === undefined)
    .map(card => {
      const itens = txCartao.filter(t =>
        t.card_name === `${card.name} — ${card.holder}` ||
        t.card_name === card.name ||
        t.holder === card.holder && t.card_name?.toLowerCase().includes(card.name.toLowerCase().split(' ')[0])
      )
      const total    = itens.reduce((s,t)=>s+(t.installment_value||t.amount),0)
      const pago     = itens.filter(t=>t.status==='pago').reduce((s,t)=>s+(t.installment_value||t.amount),0)
      const pendente = total - pago
      return { card, txs: itens, total, pago, pendente, isPago: total>0&&pendente===0 }
    })
    .filter(f => f.total > 0)  // só mostra cartões com movimentação

  // Totais consolidados
  const totalFaturas  = faturas.reduce((s,f)=>s+f.pendente,0)
  const totalAvulsas  = avulsasPendentes.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalPago     = faturas.reduce((s,f)=>s+f.pago,0) + avulsasPagas.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalGeral    = faturas.reduce((s,f)=>s+f.total,0) + txAvulsas.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const pctPago       = totalGeral>0?(totalPago/totalGeral)*100:0

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
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
        {/* Barra */}
        <div style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
            <span style={{fontSize:11,color:TEXTMU}}>Progresso do mês</span>
            <span style={{fontSize:13,fontWeight:800,color:pctPago>=100?GREEN:TEXTLT}}>{pctPago.toFixed(0)}% pago</span>
          </div>
          <div style={{height:8,background:'rgba(255,255,255,0.07)',borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:99,width:`${pctPago}%`,background:pctPago>=100?'linear-gradient(90deg,#4A8C5C,#5DE08A)':'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.85))',transition:'width 0.5s'}}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div style={{textAlign:'center',background:TERRABG,borderRadius:14,padding:'10px 4px',border:'0.5px solid rgba(255,138,92,0.15)'}}>
            <p style={{fontSize:9,color:'rgba(255,138,92,0.6)',margin:'0 0 3px',letterSpacing:'0.05em'}}>A PAGAR</p>
            <p style={{fontSize:14,fontWeight:800,color:'#FF8A5C',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalFaturas+totalAvulsas)}</p>
          </div>
          <div style={{textAlign:'center',background:GREENBG,borderRadius:14,padding:'10px 4px',border:'0.5px solid rgba(93,224,138,0.15)'}}>
            <p style={{fontSize:9,color:'rgba(93,224,138,0.6)',margin:'0 0 3px',letterSpacing:'0.05em'}}>PAGO</p>
            <p style={{fontSize:14,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:14,padding:'10px 4px',border:'0.5px solid rgba(255,255,255,0.07)'}}>
            <p style={{fontSize:9,color:TEXTMU,margin:'0 0 3px',letterSpacing:'0.05em'}}>TOTAL</p>
            <p style={{fontSize:14,fontWeight:800,color:TEXT,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalGeral)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}>
          <div style={{width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        </div>
      ) : (
        <>
          {/* ── SEÇÃO: Faturas de cartão ── */}
          {faturas.length > 0 && (
            <div style={{marginBottom:8}}>
              <p style={{fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 10px 4px'}}>
                💳 Faturas de cartão
              </p>
              {faturas.map(f => (
                <div key={f.card.id} style={{marginBottom:12}}>
                  {/* Card da fatura — visual do banco */}
                  <div style={{borderRadius:22,overflow:'hidden',boxShadow:'0 6px 24px rgba(0,0,0,0.5)'}}>
                    <div style={{background:bankGrad(f.card.bank),padding:'16px 18px',position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>

                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <div>
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',margin:'0 0 2px'}}>{f.card.bank}</p>
                          <p style={{fontSize:14,fontWeight:700,color:'#fff',margin:0}}>{f.card.name} | {f.card.holder}</p>
                        </div>
                        {f.isPago ? (
                          <span style={{background:'rgba(74,140,92,0.3)',color:'#5DE08A',fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20,border:'1px solid rgba(93,224,138,0.4)'}}>
                            ✓ Paga
                          </span>
                        ) : (
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',margin:0}}>Vence dia {f.card.due_day}</p>
                        )}
                      </div>

                      {/* Valor da fatura */}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:14}}>
                        <div>
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',margin:'0 0 3px'}}>Total da fatura</p>
                          <p style={{fontSize:28,fontWeight:800,color:'#fff',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.total)}</p>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',margin:'0 0 2px'}}>{f.txs.length} compras</p>
                          <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',margin:0}}>Fecha dia {f.card.closing_day}</p>
                        </div>
                      </div>

                      {/* Pago / Pendente dentro do card */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                        <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'8px 12px',backdropFilter:'blur(4px)'}}>
                          <p style={{fontSize:10,color:'rgba(255,255,255,0.45)',margin:'0 0 2px'}}>✓ Pago</p>
                          <p style={{fontSize:14,fontWeight:700,color:'rgba(93,224,138,0.9)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.pago)}</p>
                        </div>
                        <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'8px 12px',backdropFilter:'blur(4px)'}}>
                          <p style={{fontSize:10,color:'rgba(255,255,255,0.45)',margin:'0 0 2px'}}>⏳ Pendente</p>
                          <p style={{fontSize:14,fontWeight:700,color:'rgba(255,180,100,0.95)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.pendente)}</p>
                        </div>
                      </div>

                      {/* Botão pagar fatura inteira */}
                      {!f.isPago && f.pendente > 0 && (
                        <button
                          onClick={()=>pagarFatura(f.card.id, `${f.card.name} — ${f.card.holder}`)}
                          disabled={paying===f.card.id}
                          style={{width:'100%',height:42,background:'rgba(255,255,255,0.15)',backdropFilter:'blur(4px)',border:'0.5px solid rgba(255,255,255,0.2)',borderRadius:16,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                        >
                          {paying===f.card.id ? '...' : `✓ Marcar fatura como paga — ${formatCurrency(f.pendente)}`}
                        </button>
                      )}
                    </div>

                    {/* Itens da fatura — colapsável */}
                    <button onClick={()=>tog(f.card.id)}
                      style={{width:'100%',background:'#1E1408',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 18px',borderTop:'0.5px solid rgba(255,255,255,0.05)'}}>
                      <p style={{fontSize:12,color:TEXTMU,margin:0,fontWeight:600}}>
                        {openGrp[f.card.id] ? 'Ocultar' : 'Ver'} compras desta fatura
                      </p>
                      {openGrp[f.card.id] ? <ChevronUp size={14} color={TEXTMU}/> : <ChevronDown size={14} color={TEXTMU}/>}
                    </button>

                    {openGrp[f.card.id] && (
                      <div style={{background:'#1E1408',padding:'0 16px 12px'}}>
                        {f.txs.map((tx,i) => (
                          <div key={tx.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':undefined}}>
                            <div style={{width:32,height:32,borderRadius:10,background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                              {CAT_ICONS[tx.category]||'📦'}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:13,fontWeight:500,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                              <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>{tx.category} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
                            </div>
                            <p style={{fontSize:13,fontWeight:700,color:TEXTLT,fontVariantNumeric:'tabular-nums',margin:0,flexShrink:0}}>
                              {formatCurrency(tx.installment_value||tx.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SEÇÃO: Contas avulsas (débito, PIX, boleto) ── */}
          {txAvulsas.length > 0 && (
            <div style={{marginBottom:8}}>
              <p style={{fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.08em',margin:'4px 0 10px 4px'}}>
                📋 Contas avulsas
              </p>

              {/* Pendentes */}
              {avulsasPendentes.length > 0 && (
                <div style={{background:PEBBLE,borderRadius:22,padding:'0 16px',boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)',marginBottom:10}}>
                  {avulsasPendentes.map((tx,i) => (
                    <button key={tx.id} onClick={()=>toggleAvulsa(tx)} disabled={paying===tx.id}
                      style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':undefined,opacity:paying===tx.id?0.5:1}}>
                      <div style={{width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      </div>
                      <div style={{width:32,height:32,borderRadius:10,background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                        {CAT_ICONS[tx.category]||'📦'}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:500,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                        <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')} · {tx.payment_method?.replace('_',' ')}</p>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <p style={{fontSize:13,fontWeight:700,color:TERRA,fontVariantNumeric:'tabular-nums',margin:'0 0 3px'}}>{formatCurrency(tx.installment_value||tx.amount)}</p>
                        <BadgeStatus status={tx.status}/>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagas — colapsável */}
              {avulsasPagas.length > 0 && (
                <>
                  <button onClick={()=>tog('avulsas_pagas')}
                    style={{width:'100%',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 4px',marginBottom:openGrp['avulsas_pagas']?6:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:TEXTMU,margin:0}}>✅ Já pagas ({avulsasPagas.length})</p>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <p style={{fontSize:12,fontWeight:700,color:GREEN,fontVariantNumeric:'tabular-nums',margin:0}}>{formatCurrency(avulsasPagas.reduce((s,t)=>s+(t.installment_value||t.amount),0))}</p>
                      {openGrp['avulsas_pagas'] ? <ChevronUp size={13} color={TEXTMU}/> : <ChevronDown size={13} color={TEXTMU}/>}
                    </div>
                  </button>
                  {openGrp['avulsas_pagas'] && (
                    <div style={{background:PEBBLE,borderRadius:22,padding:'0 16px',boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>
                      {avulsasPagas.map((tx,i) => (
                        <button key={tx.id} onClick={()=>toggleAvulsa(tx)}
                          style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:i>0?'0.5px solid rgba(255,255,255,0.05)':undefined}}>
                          <div style={{width:26,height:26,borderRadius:8,background:'rgba(74,140,92,0.25)',border:'1.5px solid rgba(93,224,138,0.4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <Check size={13} color={GREEN} strokeWidth={2.5}/>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:13,color:TEXTMU,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:'line-through'}}>{tx.description}</p>
                            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0',opacity:0.6}}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
                          </div>
                          <p style={{fontSize:13,fontWeight:600,color:TEXTMU,fontVariantNumeric:'tabular-nums',margin:0,textDecoration:'line-through',flexShrink:0}}>{formatCurrency(tx.installment_value||tx.amount)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Estado vazio */}
          {faturas.length===0 && txAvulsas.length===0 && (
            <div style={{background:PEBBLE,borderRadius:24,padding:'32px 20px',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>
              <p style={{fontSize:36,margin:'0 0 10px'}}>🎉</p>
              <p style={{fontSize:15,fontWeight:700,color:GREEN,margin:'0 0 4px'}}>Nenhuma conta esse mês!</p>
              <p style={{fontSize:12,color:TEXTMU,margin:0}}>Adicione lançamentos para ver aqui</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
