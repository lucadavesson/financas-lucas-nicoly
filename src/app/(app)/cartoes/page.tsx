'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lock, Unlock } from 'lucide-react'

// ─── Paleta v3 (idêntica ao dashboard_v3) ────────────────────────────────────
const BG      = '#C4A882'
const SEBBLE  = 'linear-gradient(145deg,#CEAD8A,#B89068)'
const TEXT    = '#3D2C20'
const TEXTMU  = '#8B7060'
const GREEN   = '#3D7A4A'
const GREENBG = 'rgba(80,130,90,0.15)'
const TERRA   = '#C4622D'
const TERRABG = 'rgba(196,98,45,0.15)'

export default function Cartoes() {
  const [cards, setCards]     = useState<any[]>([])
  const [faturas, setFaturas] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const s = createClient()
    const { data: cardsData } = await s.from('cards').select('*').eq('is_active',true).order('holder').order('name')
    const now = new Date()
    const { data: txData } = await s.from('transactions').select('card_name,amount,status,installment_value')
      .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
      .neq('transaction_type','receita')
    const map: Record<string,any> = {}
    ;(cardsData||[]).forEach(c => {
      const nome  = `${c.name} — ${c.holder}`
      const txs   = (txData||[]).filter(t => t.card_name===nome || t.card_name===c.name)
      const gasto = txs.reduce((s:number,t:any) => s+(t.installment_value||t.amount), 0)
      const pago  = txs.filter((t:any) => t.status==='pago').reduce((s:number,t:any) => s+(t.installment_value||t.amount), 0)
      map[c.id]   = { gasto, pago, pendente:gasto-pago, status:now.getDate()>c.closing_day?'fechado':'aberto' }
    })
    setCards(cardsData||[])
    setFaturas(map)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ background:BG, minHeight:'100%', display:'flex', justifyContent:'center', padding:80 }}>
      <div style={{ width:24, height:24, border:`2px solid ${TERRA}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  const credito = cards.filter(c => c.card_type==='credito')
  const contas  = cards.filter(c => c.card_type!=='credito')
  const mes     = format(new Date(),'MMMM yyyy',{locale:ptBR})

  return (
    <div style={{ background:BG, minHeight:'100%', padding:'14px 14px 110px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h1 style={{ fontSize:18, fontWeight:700, color:TEXT, margin:0 }}>Cartões</h1>
        <p style={{ fontSize:11, color:TEXTMU, textTransform:'capitalize', margin:0 }}>{mes}</p>
      </div>

      {cards.length===0 ? (
        <div style={{ textAlign:'center', padding:'64px 0' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>💳</p>
          <p style={{ fontSize:13, color:TEXTMU }}>Execute o SQL no Supabase para carregar os cartões</p>
        </div>
      ) : (
        <>
          {/* ── Crédito ── */}
          {credito.length>0 && (
            <p style={{ fontSize:11, fontWeight:700, color:TEXT, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, opacity:0.5 }}>
              Crédito
            </p>
          )}

          {credito.map(c => {
            const f   = faturas[c.id]||{gasto:0,pago:0,pendente:0,status:'aberto'}
            const pct = c.credit_limit>0 ? (f.gasto/c.credit_limit)*100 : 0
            const over= pct>=(c.alert_pct||80)

            return (
              <div key={c.id} style={{ marginBottom:16, borderRadius:28, overflow:'hidden', boxShadow:'0 6px 20px rgba(61,44,32,0.2)' }}>

                {/* Frente do cartão — mantida igual ao original */}
                <div style={{ background:`linear-gradient(135deg,${c.color},${c.color}99)`, padding:20, color:'#fff', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }}/>
                  <div style={{ position:'absolute', right:20, bottom:-30, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, position:'relative' }}>
                    <div>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:2, margin:'0 0 2px' }}>{c.bank}</p>
                      <p style={{ fontSize:15, fontWeight:600, margin:0 }}>{c.holder}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.2)', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                      {f.status==='aberto' ? <><Unlock size={11}/>Aberta</> : <><Lock size={11}/>Fechada</>}
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', position:'relative' }}>
                    <div>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:'0 0 2px' }}>Fatura {mes}</p>
                      <p style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.5px', fontVariantNumeric:'tabular-nums', margin:0 }}>{formatCurrency(f.gasto)}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:'0 0 2px' }}>Limite</p>
                      <p style={{ fontSize:14, fontWeight:600, fontVariantNumeric:'tabular-nums', margin:0 }}>{formatCurrency(c.credit_limit)}</p>
                    </div>
                  </div>
                </div>

                {/* ── Parte inferior: SEBBLE taupe (era bg-white) ── */}
                <div style={{ background:SEBBLE, padding:'14px 16px 16px', borderTop:'0.5px solid rgba(255,255,255,0.2)' }}>
                  {/* Barra de uso */}
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:TEXTMU, marginBottom:6 }}>
                    <span>{pct.toFixed(0)}% do limite</span>
                    <span style={{ color:over?'#E24B4A':TEXTMU, fontWeight:over?600:400 }}>
                      {over ? `⚠️ Acima de ${c.alert_pct||80}%` : `${formatCurrency(c.credit_limit-f.gasto)} disponível`}
                    </span>
                  </div>
                  <div style={{ height:6, background:'rgba(61,44,32,0.12)', borderRadius:99, overflow:'hidden', marginBottom:12 }}>
                    <div style={{ height:'100%', borderRadius:99, transition:'width 0.4s', width:`${Math.min(pct,100)}%`, background:over?'#E24B4A':c.color }}/>
                  </div>

                  {/* Grid Pago / Pendente / Fecha dia — cores via globals.css + inline backup */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    <div style={{ background:GREENBG, borderRadius:16, padding:'10px 8px', textAlign:'center', border:'0.5px solid rgba(61,122,74,0.2)' }}>
                      <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 3px' }}>Pago</p>
                      <p style={{ fontSize:13, fontWeight:700, color:GREEN, margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pago)}</p>
                    </div>
                    <div style={{ background:TERRABG, borderRadius:16, padding:'10px 8px', textAlign:'center', border:'0.5px solid rgba(196,98,45,0.2)' }}>
                      <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 3px' }}>Pendente</p>
                      <p style={{ fontSize:13, fontWeight:700, color:TERRA, margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pendente)}</p>
                    </div>
                    <div style={{ background:'rgba(61,44,32,0.08)', borderRadius:16, padding:'10px 8px', textAlign:'center', border:'0.5px solid rgba(61,44,32,0.1)' }}>
                      <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 3px' }}>Fecha dia</p>
                      <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:0 }}>{c.closing_day}</p>
                    </div>
                  </div>

                  <p style={{ fontSize:11, color:TEXTMU, textAlign:'center', margin:'10px 0 0' }}>
                    Fecha dia {c.closing_day} · Vence dia {c.due_day}
                  </p>
                </div>
              </div>
            )
          })}

          {/* ── Contas ── */}
          {contas.length>0 && (
            <>
              <p style={{ fontSize:11, fontWeight:700, color:TEXT, textTransform:'uppercase', letterSpacing:'0.08em', margin:'8px 0 10px', opacity:0.5 }}>
                Contas
              </p>
              {contas.map(c => {
                const f = faturas[c.id]||{gasto:0,pago:0,pendente:0,status:'aberto'}
                return (
                  <div key={c.id} style={{ marginBottom:12, borderRadius:24, overflow:'hidden', boxShadow:'0 4px 14px rgba(61,44,32,0.15)' }}>
                    <div style={{ background:`linear-gradient(135deg,${c.color},${c.color}99)`, padding:'16px 18px', color:'#fff', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', right:-16, top:-16, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative' }}>
                        <div>
                          <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:'0 0 2px' }}>{c.bank}</p>
                          <p style={{ fontSize:14, fontWeight:600, margin:0 }}>{c.holder}</p>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', margin:'0 0 2px' }}>Movimentado</p>
                          <p style={{ fontSize:18, fontWeight:700, margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.gasto)}</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ background:SEBBLE, padding:'12px 16px', borderTop:'0.5px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <div style={{ background:GREENBG, borderRadius:14, padding:'8px 10px', textAlign:'center' }}>
                          <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Pago</p>
                          <p style={{ fontSize:13, fontWeight:700, color:GREEN, margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pago)}</p>
                        </div>
                        <div style={{ background:TERRABG, borderRadius:14, padding:'8px 10px', textAlign:'center' }}>
                          <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Pendente</p>
                          <p style={{ fontSize:13, fontWeight:700, color:TERRA, margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pendente)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}
