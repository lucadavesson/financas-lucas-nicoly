'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Paleta Gemini Espresso ────────────────────────────────────────────────────
const BG      = '#1A110A'
const PEBBLE  = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT    = '#F4EFE8'
const TEXTLT  = '#C8B89A'
const TEXTMU  = '#8B7A6A'
const GREEN   = '#4A8C5C'
const GREENBG = 'rgba(74,140,92,0.18)'
const TERRA   = '#C4622D'
const TERRABG = 'rgba(196,98,45,0.18)'
const GOLD    = '#C8963C'

// ── Gradientes por banco ──────────────────────────────────────────────────────
const BANK_GRADIENT: Record<string,string> = {
  nubank:     'linear-gradient(145deg,#4A2870,#2D1548)',
  santander:  'linear-gradient(145deg,#8B2020,#4A1010)',
  bb:         'linear-gradient(145deg,#1A4A8B,#0D2548)',
  c6:         'linear-gradient(145deg,#2A2A2A,#141414)',
  bradesco:   'linear-gradient(145deg,#8B1010,#4A0808)',
  mercadopago:'linear-gradient(145deg,#004A80,#002040)',
  caixa:      'linear-gradient(145deg,#0A4A2A,#052818)',
  inter:      'linear-gradient(145deg,#8B4010,#4A2008)',
  default:    'linear-gradient(145deg,#5A3C20,#3D2610)',
}

// Ícone/sigla por banco
const BANK_SIGLA: Record<string,string> = {
  nubank:'NU', santander:'S', bb:'BB', c6:'C6',
  bradesco:'B', mercadopago:'MP', caixa:'CEF', inter:'IN',
}

function getBankKey(bank: string) {
  const b = bank.toLowerCase()
  if (b.includes('nubank'))    return 'nubank'
  if (b.includes('santander')) return 'santander'
  if (b.includes('brasil')||b==='bb') return 'bb'
  if (b.includes('c6'))        return 'c6'
  if (b.includes('bradesco'))  return 'bradesco'
  if (b.includes('mercado'))   return 'mercadopago'
  if (b.includes('caixa'))     return 'caixa'
  if (b.includes('inter'))     return 'inter'
  return 'default'
}

// Dias até vencimento
function diasAteVencer(dueDay: number): number {
  const hoje = new Date().getDate()
  const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
  return dueDay >= hoje ? dueDay - hoje : diasMes - hoje + dueDay
}

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
      const txs   = (txData||[]).filter((t:any) => t.card_name===nome || t.card_name===c.name)
      const gasto = txs.reduce((s:number,t:any) => s+(t.installment_value||t.amount), 0)
      const pago  = txs.filter((t:any) => t.status==='pago').reduce((s:number,t:any) => s+(t.installment_value||t.amount), 0)
      map[c.id]   = { gasto, pago, pendente:gasto-pago, status:now.getDate()>c.closing_day?'fechado':'aberto' }
    })
    setCards(cardsData||[])
    setFaturas(map)
    setLoading(false)
  }

  const credito = cards.filter(c => c.card_type==='credito')
  const contas  = cards.filter(c => c.card_type!=='credito')
  const mes     = format(new Date(),'MMM/yy',{locale:ptBR})

  // Totais consolidados
  const totalDisp  = cards.filter(c=>c.card_type==='credito').reduce((s,c) => s+(c.credit_limit-(faturas[c.id]?.gasto||0)), 0)
  const totalUsado = cards.filter(c=>c.card_type==='credito').reduce((s,c) => s+(faturas[c.id]?.gasto||0), 0)

  if (loading) return (
    <div style={{ background:BG, minHeight:'100%', display:'flex', justifyContent:'center', alignItems:'center' }}>
      <div style={{ width:24, height:24, border:`2px solid ${TERRA}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  return (
    <div style={{ background:BG, minHeight:'100%', padding:'14px 14px 110px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Visão Geral de Limites ── */}
      <div style={{
        background:'linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))',
        borderRadius:24, padding:'16px 18px', marginBottom:20,
        border:'0.5px solid rgba(255,255,255,0.1)',
        backdropFilter:'blur(10px)',
      }}>
        <p style={{ fontSize:12, fontWeight:600, color:TEXTMU, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Visão Geral de Limites ({mes})
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div style={{ background:GREENBG, borderRadius:18, padding:'12px 14px', border:`0.5px solid rgba(74,140,92,0.3)` }}>
            <p style={{ fontSize:11, color:'rgba(110,201,138,0.7)', margin:'0 0 4px' }}>Crédito Disponível</p>
            <p style={{ fontSize:18, fontWeight:800, color:'#6EC98A', margin:0, fontVariantNumeric:'tabular-nums' }}>
              {formatCurrency(totalDisp)}
            </p>
          </div>
          <div style={{ background:TERRABG, borderRadius:18, padding:'12px 14px', border:`0.5px solid rgba(196,98,45,0.3)` }}>
            <p style={{ fontSize:11, color:'rgba(232,133,90,0.7)', margin:'0 0 4px' }}>Crédito Utilizado</p>
            <p style={{ fontSize:18, fontWeight:800, color:'#E8855A', margin:0, fontVariantNumeric:'tabular-nums' }}>
              {formatCurrency(totalUsado)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Cartões & Contas ── */}
      <p style={{ fontSize:13, fontWeight:700, color:TEXTLT, marginBottom:12 }}>Cartões & Contas</p>

      {cards.length===0 ? (
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>💳</p>
          <p style={{ fontSize:13, color:TEXTMU }}>Nenhum cartão cadastrado</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[...credito, ...contas].map(c => {
            const f   = faturas[c.id]||{gasto:0,pago:0,pendente:0,status:'aberto'}
            const bk  = getBankKey(c.bank)
            const grad = BANK_GRADIENT[bk] || BANK_GRADIENT.default
            const sigla = BANK_SIGLA[bk] || c.bank[0]
            const pct  = c.credit_limit>0 ? (f.gasto/c.credit_limit)*100 : 0
            const over = pct>=(c.alert_pct||80)
            const dias = diasAteVencer(c.due_day)
            const disponivel = c.credit_limit - f.gasto

            return (
              <div key={c.id} style={{
                borderRadius:28, overflow:'hidden',
                boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
                border:'0.5px solid rgba(255,255,255,0.08)',
              }}>
                {/* Corpo do cartão — sebble orgânico com gradiente do banco */}
                <div style={{ background:grad, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
                  {/* Efeito brilho sebble */}
                  <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
                  <div style={{ position:'absolute', bottom:-40, left:-20, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.03)' }}/>
                  {/* Barra de progresso orgânica no fundo */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.08)' }}>
                    <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: over?'rgba(220,80,80,0.8)':`rgba(110,201,138,0.7)`, borderRadius:'0 2px 0 0' }}/>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'relative', marginBottom:14 }}>
                    {/* Logo banco */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
                        <span style={{ fontSize:11, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>{sigla}</span>
                      </div>
                      <div>
                        <p style={{ fontSize:12, color:'rgba(255,255,255,0.6)', margin:0 }}>{c.bank}</p>
                        <p style={{ fontSize:15, fontWeight:700, color:'#fff', margin:0 }}>{c.name} | {c.holder}</p>
                      </div>
                    </div>
                    {/* Dias para vencer */}
                    <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 10px', backdropFilter:'blur(4px)' }}>
                      <p style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.8)', margin:0 }}>
                        Vence em {dias} dias
                      </p>
                    </div>
                  </div>

                  {/* Limite e fatura */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', position:'relative' }}>
                    <div>
                      <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', margin:'0 0 2px' }}>
                        {c.credit_limit>0 ? `R$ ${formatCurrency(c.credit_limit).replace('R$','').trim()}` : 'Conta corrente'}
                      </p>
                      <p style={{ fontSize:22, fontWeight:800, color:'#fff', margin:0, letterSpacing:'-0.5px', fontVariantNumeric:'tabular-nums' }}>
                        {formatCurrency(f.gasto)}
                      </p>
                    </div>
                    {c.credit_limit>0 && (
                      <p style={{ fontSize:12, color: over?'rgba(255,120,120,0.9)':'rgba(110,201,138,0.9)', fontWeight:600, margin:0 }}>
                        {over ? `⚠️ ${pct.toFixed(0)}%` : `Disponível: ${formatCurrency(disponivel)}`}
                      </p>
                    )}
                  </div>

                  {/* Fecha/Vence */}
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', margin:'10px 0 0', position:'relative' }}>
                    Fecha dia {c.closing_day} · Vence dia {c.due_day}
                  </p>
                </div>

                {/* Rodapé — totalmente no tema escuro, sem bg-white */}
                <div style={{
                  background:'linear-gradient(145deg,#2A1C0E,#1E1408)',
                  padding:'12px 16px',
                  borderTop:'0.5px solid rgba(255,255,255,0.05)',
                  display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:8,
                }}>
                  <div style={{ background:GREENBG, borderRadius:14, padding:'8px 12px', border:'0.5px solid rgba(74,140,92,0.2)' }}>
                    <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Pago</p>
                    <p style={{ fontSize:14, fontWeight:700, color:'#6EC98A', margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pago)}</p>
                  </div>
                  <div style={{ background:TERRABG, borderRadius:14, padding:'8px 12px', border:'0.5px solid rgba(196,98,45,0.2)' }}>
                    <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Pendente</p>
                    <p style={{ fontSize:14, fontWeight:700, color:'#E8855A', margin:0, fontVariantNumeric:'tabular-nums' }}>{formatCurrency(f.pendente)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
