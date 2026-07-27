'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BG     = '#1A110A'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#5DE08A'
const TERRA  = '#C4622D'

const BANK_GRADIENT: Record<string,string> = {
  nubank:     'linear-gradient(145deg,#5B2D8A,#3A1860)',
  santander:  'linear-gradient(145deg,#C0281E,#7A1010)',
  bb:         'linear-gradient(145deg,#1A5FAD,#0D3068)',
  c6:         'linear-gradient(145deg,#2C2C2C,#121212)',
  bradesco:   'linear-gradient(145deg,#A01010,#600808)',
  mercadopago:'linear-gradient(145deg,#0060A0,#003060)',
  caixa:      'linear-gradient(145deg,#0A5A32,#043018)',
  inter:      'linear-gradient(145deg,#A04818,#602808)',
  default:    'linear-gradient(145deg,#6A4428,#3D2410)',
}
const BANK_SIGLA: Record<string,string> = {
  nubank:'NU', santander:'S', bb:'BB', c6:'C6',
  bradesco:'B', mercadopago:'MP', caixa:'CEF', inter:'IN',
}
function getBankKey(bank:string) {
  const b=bank.toLowerCase()
  if(b.includes('nubank'))    return 'nubank'
  if(b.includes('santander')) return 'santander'
  if(b.includes('brasil')||b==='bb') return 'bb'
  if(b.includes('c6'))        return 'c6'
  if(b.includes('bradesco'))  return 'bradesco'
  if(b.includes('mercado'))   return 'mercadopago'
  if(b.includes('caixa'))     return 'caixa'
  if(b.includes('inter'))     return 'inter'
  return 'default'
}
function diasAteVencer(dueDay:number) {
  const hoje=new Date().getDate()
  const diasMes=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()
  return dueDay>=hoje ? dueDay-hoje : diasMes-hoje+dueDay
}

export default function Cartoes() {
  const [cards,   setCards]   = useState<any[]>([])
  const [faturas, setFaturas] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ load() },[])

  async function load() {
    const s=createClient()
    const {data:cardsData}=await s.from('cards').select('*').eq('is_active',true).order('holder').order('name')
    const now=new Date()
    const {data:txData}=await s.from('transactions').select('card_name,amount,status,installment_value')
      .gte('purchase_date',format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(now),'yyyy-MM-dd'))
      .neq('transaction_type','receita')
    const map:Record<string,any>={}
    ;(cardsData||[]).forEach(c=>{
      const nome=`${c.name} — ${c.holder}`
      const txs=(txData||[]).filter((t:any)=>t.card_name===nome||t.card_name===c.name)
      const gasto=txs.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
      const pago=txs.filter((t:any)=>t.status==='pago').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
      map[c.id]={gasto,pago,pendente:gasto-pago,status:now.getDate()>c.closing_day?'fechado':'aberto'}
    })
    setCards(cardsData||[])
    setFaturas(map)
    setLoading(false)
  }

  const credito=cards.filter(c=>c.card_type==='credito')
  const contas=cards.filter(c=>c.card_type!=='credito')
  const mes=format(new Date(),'MMM/yy',{locale:ptBR})
  const totalDisp=credito.reduce((s,c)=>s+(c.credit_limit-(faturas[c.id]?.gasto||0)),0)
  const totalUsado=credito.reduce((s,c)=>s+(faturas[c.id]?.gasto||0),0)
  const totalPago=credito.reduce((s,c)=>s+(faturas[c.id]?.pago||0),0)
  const totalPendente=credito.reduce((s,c)=>s+(faturas[c.id]?.pendente||0),0)

  if(loading) return (
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center',paddingTop:80}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 130px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Visão Geral ── */}
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:24,padding:'16px 18px',marginBottom:20,border:'0.5px solid rgba(255,255,255,0.08)'}}>
        <p style={{fontSize:11,fontWeight:700,color:TEXTMU,margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'0.09em'}}>
          Visão Geral ({mes})
        </p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'rgba(74,140,92,0.2)',borderRadius:16,padding:'12px 14px',border:'0.5px solid rgba(93,224,138,0.2)'}}>
            <p style={{fontSize:10,color:'rgba(93,224,138,0.6)',margin:'0 0 3px'}}>Crédito Disponível</p>
            <p style={{fontSize:17,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalDisp)}</p>
          </div>
          <div style={{background:'rgba(196,98,45,0.2)',borderRadius:16,padding:'12px 14px',border:'0.5px solid rgba(255,138,92,0.2)'}}>
            <p style={{fontSize:10,color:'rgba(255,138,92,0.6)',margin:'0 0 3px'}}>Crédito Utilizado</p>
            <p style={{fontSize:17,fontWeight:800,color:'#FF8A5C',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalUsado)}</p>
          </div>
          <div style={{background:'rgba(74,140,92,0.1)',borderRadius:16,padding:'12px 14px',border:'0.5px solid rgba(93,224,138,0.1)'}}>
            <p style={{fontSize:10,color:'rgba(93,224,138,0.5)',margin:'0 0 3px'}}>Total Pago</p>
            <p style={{fontSize:15,fontWeight:700,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{background:'rgba(196,98,45,0.1)',borderRadius:16,padding:'12px 14px',border:'0.5px solid rgba(255,138,92,0.1)'}}>
            <p style={{fontSize:10,color:'rgba(255,138,92,0.5)',margin:'0 0 3px'}}>A Pagar</p>
            <p style={{fontSize:15,fontWeight:700,color:'#FF8A5C',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPendente)}</p>
          </div>
        </div>
      </div>

      <p style={{fontSize:13,fontWeight:700,color:TEXTLT,margin:'0 0 12px'}}>Cartões & Contas</p>

      {cards.length===0 ? (
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <p style={{fontSize:32,margin:'0 0 12px'}}>💳</p>
          <p style={{fontSize:13,color:TEXTMU}}>Nenhum cartão cadastrado</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {[...credito,...contas].map(c=>{
            const f=faturas[c.id]||{gasto:0,pago:0,pendente:0,status:'aberto'}
            const bk=getBankKey(c.bank)
            const grad=BANK_GRADIENT[bk]||BANK_GRADIENT.default
            const sigla=BANK_SIGLA[bk]||c.bank[0]
            const pct=c.credit_limit>0?(f.gasto/c.credit_limit)*100:0
            const over=pct>=(c.alert_pct||80)
            const dias=diasAteVencer(c.due_day)
            const disponivel=c.credit_limit-f.gasto

            return (
              <div key={c.id} style={{borderRadius:28,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.55)',border:'0.5px solid rgba(255,255,255,0.07)'}}>
                {/* Corpo do cartão */}
                <div style={{background:grad,padding:'20px 22px 16px',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
                  <div style={{position:'absolute',bottom:-60,left:-30,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>

                  {/* Header banco + dias */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:13,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
                        <span style={{fontSize:11,fontWeight:800,color:'#fff',letterSpacing:'-0.5px'}}>{sigla}</span>
                      </div>
                      <div>
                        <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',margin:'0 0 1px'}}>{c.bank}</p>
                        <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{c.name} | {c.holder}</p>
                      </div>
                    </div>
                    <div style={{background:'rgba(255,255,255,0.13)',borderRadius:20,padding:'4px 12px',backdropFilter:'blur(4px)'}}>
                      <p style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.85)',margin:0}}>Vence em {dias}d</p>
                    </div>
                  </div>

                  {/* Fatura + disponível */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:14,position:'relative'}}>
                    <div>
                      <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',margin:'0 0 3px'}}>Fatura {mes}</p>
                      <p style={{fontSize:28,fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.gasto)}</p>
                    </div>
                    {c.credit_limit>0&&(
                      <div style={{textAlign:'right'}}>
                        <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',margin:'0 0 2px'}}>Disponível</p>
                        <p style={{fontSize:14,fontWeight:700,color:over?'rgba(255,120,120,0.9)':'rgba(93,224,138,0.9)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(disponivel)}</p>
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  {c.credit_limit>0&&(
                    <div style={{position:'relative'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:5}}>
                        <span>Limite: {formatCurrency(c.credit_limit)}</span>
                        <span style={{color:over?'rgba(255,120,120,0.8)':'rgba(255,255,255,0.3)'}}>{over?`⚠️ ${pct.toFixed(0)}%`:`${pct.toFixed(0)}% usado`}</span>
                      </div>
                      <div style={{height:4,background:'rgba(255,255,255,0.1)',borderRadius:99,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:99,width:`${Math.min(pct,100)}%`,background:over?'linear-gradient(90deg,#FF6B6B,#FF4444)':'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.8))',transition:'width 0.5s'}}/>
                      </div>
                    </div>
                  )}
                  {/* ── Pago / Pendente — dentro do card, mesmo gradiente ── */}
                  <div style={{marginTop:14,paddingTop:12,borderTop:'0.5px solid rgba(255,255,255,0.12)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,position:'relative'}}>
                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'9px 12px',backdropFilter:'blur(4px)'}}>
                      <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',margin:'0 0 3px',letterSpacing:'0.04em'}}>✓ Pago</p>
                      <p style={{fontSize:15,fontWeight:700,color:'rgba(93,224,138,0.9)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.pago)}</p>
                    </div>
                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'9px 12px',backdropFilter:'blur(4px)'}}>
                      <p style={{fontSize:10,color:'rgba(255,255,255,0.5)',margin:'0 0 3px',letterSpacing:'0.04em'}}>⏳ Pendente</p>
                      <p style={{fontSize:15,fontWeight:700,color:'rgba(255,180,100,0.95)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.pendente)}</p>
                    </div>
                  </div>

                  <p style={{fontSize:10,color:'rgba(255,255,255,0.25)',margin:'10px 0 0',position:'relative'}}>Fecha dia {c.closing_day} · Vence dia {c.due_day}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
