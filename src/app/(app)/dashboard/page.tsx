'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string;holder:string;description:string;category:string;amount:number;status:string;purchase_date:string;transaction_type:string;installment_value?:number;payment_method?:string;card_name?:string }

const BG     = '#1A110A'
const PEBBLE = 'linear-gradient(145deg,#3D2810,#2C1C0E)'
const TEXT   = '#F4EFE8'
const TEXTLT = '#C8B89A'
const TEXTMU = '#8B7A6A'
const GREEN  = '#5DE08A'
const GREENBG= 'rgba(74,140,92,0.18)'
const TERRA  = '#C4622D'
const TERRABG= 'rgba(196,98,45,0.18)'
const CREAM  = '#F4EFE8'

export default function Dashboard() {
  const [txs,    setTxs]   = useState<Tx[]>([])
  const [loading,setLoad]  = useState(true)
  const [hide,   setHide]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoad(true)
    const now = new Date()
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
      .order('purchase_date', { ascending: false })
    setTxs(data || [])
    setLoad(false)
  }

  async function markPaid(id: string, desc: string) {
    await createClient().from('transactions')
      .update({ status: 'pago', paid_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', id)
    toast.success(`✓ "${desc}" marcado como pago`)
    load()
  }

  const v = (n: number) => hide ? '•••' : formatCurrency(n)

  // ── Cálculos ──────────────────────────────────────────────────
  const despesas  = txs.filter(t => t.transaction_type !== 'receita')
  const receitas  = txs.filter(t => t.transaction_type === 'receita')

  const totalEntrou  = receitas.filter(t => t.status === 'pago').reduce((s,t) => s + t.amount, 0)
  const totalPrevisto= receitas.filter(t => t.status === 'previsto').reduce((s,t) => s + t.amount, 0)
  const totalGastou  = despesas.reduce((s,t) => s + (t.installment_value||t.amount), 0)
  const totalPago    = despesas.filter(t => t.status === 'pago').reduce((s,t) => s + (t.installment_value||t.amount), 0)
  const totalPendente= despesas.filter(t => t.status !== 'pago' && t.status !== 'cancelado').reduce((s,t) => s + (t.installment_value||t.amount), 0)
  const saldo        = totalEntrou - totalPago
  const pctPago      = totalGastou > 0 ? Math.min(100, (totalPago / totalGastou) * 100) : 0

  const hoje = new Date()
  const em7  = addDays(hoje, 7)

  // Próximos pagamentos: só contas avulsas (não itens de cartão)
  const isCartao = (t: Tx) => t.payment_method === 'cartao_credito' || t.transaction_type === 'parcelada'
  const proximos = despesas
    .filter(t => t.status !== 'pago' && t.status !== 'cancelado' && !isCartao(t))
    .sort((a,b) => a.purchase_date.localeCompare(b.purchase_date))
    .slice(0, 5)

  // Atrasados
  // Atrasados: só contas avulsas com data passada (não compras de cartão)
  const atrasados = despesas.filter(t =>
    t.status === 'atrasado' || (
      t.status === 'pendente' &&
      !isCartao(t) &&
      new Date(t.purchase_date + 'T12:00:00') < hoje
    )
  )

  // Top categorias
  const catMap: Record<string,number> = {}
  despesas.forEach(t => { catMap[t.category] = (catMap[t.category]||0) + (t.installment_value||t.amount) })
  const topCats = Object.entries(catMap).sort(([,a],[,b]) => b-a).slice(0,4)

  // Por pessoa
  const pessoas = ['Lucas','Nicoly','Prata'].map(p => ({
    nome: p,
    entrou: receitas.filter(t=>t.holder===p&&t.status==='pago').reduce((s,t)=>s+t.amount,0),
    gastou: despesas.filter(t=>t.holder===p).reduce((s,t)=>s+(t.installment_value||t.amount),0),
    pago:   despesas.filter(t=>t.holder===p&&t.status==='pago').reduce((s,t)=>s+(t.installment_value||t.amount),0),
  })).filter(p => p.entrou > 0 || p.gastou > 0)

  const card = (extra?: any) => ({
    background: PEBBLE, borderRadius: 24, padding: '16px 18px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    marginBottom: 12, ...extra
  })

  const Row = ({ label, value, color, sub, bold }: { label:string; value:string; color?:string; sub?:string; bold?:boolean }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderTop:'0.5px solid rgba(255,255,255,0.06)' }}>
      <div>
        <p style={{ fontSize:13, color:TEXT, margin:0, fontWeight: bold ? 700 : 400 }}>{label}</p>
        {sub && <p style={{ fontSize:11, color:TEXTMU, margin:'2px 0 0' }}>{sub}</p>}
      </div>
      <p style={{ fontSize:14, fontWeight:700, color: color||TEXTLT, fontVariantNumeric:'tabular-nums' as const, margin:0 }}>{value}</p>
    </div>
  )

  if (loading) return (
    <div style={{ background:BG, minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:24, height:24, border:`2px solid ${TERRA}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  )

  return (
    <div style={{ background:BG, minHeight:'100%', padding:'14px 14px 130px' }}>
      <style>{`
        @keyframes spin  { to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
      `}</style>

      {/* Mês + ocultar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <p style={{ fontSize:11, fontWeight:700, color:TEXTMU, textTransform:'uppercase', letterSpacing:'0.09em', margin:0 }}>
          {format(new Date(), 'MMMM yyyy', { locale:ptBR })}
        </p>
        <button onClick={()=>setHide(h=>!h)} style={{ fontSize:11, color:TEXTMU, background:'none', border:'none', cursor:'pointer' }}>
          {hide ? '👁 Mostrar' : '🙈 Ocultar'}
        </button>
      </div>

      {/* ── BLOCO 1: Fluxo do mês ── */}
      <div style={{ ...card(), background:'linear-gradient(145deg,#2A1C0E,#1A1008)' }}>
        <p style={{ fontSize:11, fontWeight:700, color:TEXTMU, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 2px' }}>Resumo do mês</p>

        {/* Saldo em destaque */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', margin:'8px 0 14px' }}>
          <div>
            <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 3px' }}>Saldo disponível</p>
            <p style={{ fontSize:36, fontWeight:800, color: saldo >= 0 ? GREEN : '#FF6B6B', margin:0, lineHeight:1, fontVariantNumeric:'tabular-nums' as const }}>
              {v(saldo)}
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:10, color:TEXTMU, margin:'0 0 2px' }}>Taxa de poupança</p>
            <p style={{ fontSize:18, fontWeight:800, color: totalEntrou>0&&saldo>0 ? GREEN : TEXTMU, margin:0 }}>
              {totalEntrou > 0 ? `${((saldo/totalEntrou)*100).toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Grid 2x2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {/* Entrou */}
          <div style={{ background:'rgba(74,140,92,0.2)', borderRadius:18, padding:'12px 14px', border:'0.5px solid rgba(93,224,138,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
              <ArrowUpRight size={13} color={GREEN}/>
              <p style={{ fontSize:10, color:'rgba(93,224,138,0.7)', margin:0, fontWeight:600 }}>Entrou</p>
            </div>
            <p style={{ fontSize:18, fontWeight:800, color:GREEN, margin:'0 0 4px', fontVariantNumeric:'tabular-nums' as const }}>{v(totalEntrou)}</p>
            {totalPrevisto > 0 && (
              <p style={{ fontSize:10, color:'rgba(93,224,138,0.45)', margin:0 }}>+ {v(totalPrevisto)} previsto</p>
            )}
          </div>
          {/* Gastou */}
          <div style={{ background:TERRABG, borderRadius:18, padding:'12px 14px', border:'0.5px solid rgba(196,98,45,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
              <ArrowDownRight size={13} color='#FF8A5C'/>
              <p style={{ fontSize:10, color:'rgba(255,138,92,0.7)', margin:0, fontWeight:600 }}>Gastou</p>
            </div>
            <p style={{ fontSize:18, fontWeight:800, color:'#FF8A5C', margin:'0 0 4px', fontVariantNumeric:'tabular-nums' as const }}>{v(totalGastou)}</p>
            <p style={{ fontSize:10, color:'rgba(255,138,92,0.45)', margin:0 }}>{despesas.length} lançamentos</p>
          </div>
          {/* Já pagou */}
          <div style={{ background:'rgba(74,140,92,0.1)', borderRadius:18, padding:'12px 14px', border:'0.5px solid rgba(93,224,138,0.1)' }}>
            <p style={{ fontSize:10, color:'rgba(93,224,138,0.5)', margin:'0 0 6px', fontWeight:600 }}>✓ Já pagou</p>
            <p style={{ fontSize:18, fontWeight:800, color:GREEN, margin:0, fontVariantNumeric:'tabular-nums' as const }}>{v(totalPago)}</p>
          </div>
          {/* Falta pagar */}
          <div style={{ background:'rgba(196,98,45,0.1)', borderRadius:18, padding:'12px 14px', border:'0.5px solid rgba(196,98,45,0.1)' }}>
            <p style={{ fontSize:10, color:'rgba(255,138,92,0.5)', margin:'0 0 6px', fontWeight:600 }}>⏳ Falta pagar</p>
            <p style={{ fontSize:18, fontWeight:800, color:'#FF8A5C', margin:0, fontVariantNumeric:'tabular-nums' as const }}>{v(totalPendente)}</p>
          </div>
        </div>

        {/* Barra progresso pagamentos */}
        <div style={{ marginTop:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:TEXTMU, marginBottom:5 }}>
            <span>Contas pagas</span>
            <span style={{ fontWeight:700, color: pctPago>=100?GREEN:TEXTLT }}>{pctPago.toFixed(0)}% do total</span>
          </div>
          <div style={{ height:7, background:'rgba(255,255,255,0.07)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:99, width:`${pctPago}%`,
              background: pctPago>=100 ? 'linear-gradient(90deg,#4A8C5C,#5DE08A)' : 'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.85))',
              transition:'width 0.5s ease',
            }}/>
          </div>
        </div>
      </div>

      {/* ── BLOCO 2: Por pessoa ── */}
      {pessoas.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: pessoas.length === 1 ? '1fr' : '1fr 1fr', gap:10, marginBottom:12 }}>
          {pessoas.map(p => (
            <div key={p.nome} style={{ background:PEBBLE, borderRadius:20, padding:'14px 16px', boxShadow:'0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <div style={{ width:28,height:28,borderRadius:'50%',background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:TERRA,marginBottom:8 }}>{p.nome[0]}</div>
              <p style={{ fontSize:13,fontWeight:600,color:TEXT,margin:'0 0 6px' }}>{p.nome}</p>
              <p style={{ fontSize:18,fontWeight:800,color:p.entrou-p.gastou>=0?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const,margin:'0 0 6px' }}>{v(p.entrou-p.gastou)}</p>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:TEXTMU }}>
                <span style={{ color:'rgba(93,224,138,0.7)' }}>↑{v(p.entrou)}</span>
                <span style={{ color:'rgba(255,138,92,0.7)' }}>↓{v(p.gastou)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BLOCO 3: Alertas — Atrasados ── */}
      {atrasados.length > 0 && (
        <div style={{ ...card(), background:'linear-gradient(145deg,rgba(140,20,20,0.3),rgba(80,10,10,0.2))', border:'0.5px solid rgba(255,107,107,0.2)', padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>🚨</span>
              <p style={{ fontSize:13, fontWeight:700, color:'#FF6B6B', margin:0 }}>{atrasados.length} conta{atrasados.length>1?'s':''} atrasada{atrasados.length>1?'s':''}</p>
            </div>
            <p style={{ fontSize:13, fontWeight:800, color:'#FF6B6B', margin:0, fontVariantNumeric:'tabular-nums' as const }}>
              {v(atrasados.reduce((s,t)=>s+(t.installment_value||t.amount),0))}
            </p>
          </div>
          {atrasados.slice(0,3).map((tx,i) => (
            <div key={tx.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderTop:'0.5px solid rgba(255,107,107,0.1)' }}>
              <p style={{ fontSize:12,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200 }}>{tx.description}</p>
              <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
                <p style={{ fontSize:12,fontWeight:700,color:'#FF6B6B',fontVariantNumeric:'tabular-nums' as const,margin:0 }}>{v(tx.installment_value||tx.amount)}</p>
                <button onClick={()=>markPaid(tx.id,tx.description)} style={{ fontSize:10,background:'rgba(255,107,107,0.2)',border:'none',borderRadius:10,padding:'3px 8px',color:'#FF6B6B',cursor:'pointer',fontWeight:700 }}>Pagar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BLOCO 4: Próximos pagamentos ── */}
      {proximos.length > 0 && (
        <div style={{ ...card() }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:0 }}>Próximos pagamentos</p>
            <Link href="/pagamentos" style={{ fontSize:11, color:TERRA, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:2 }}>
              Ver todos <ChevronRight size={11}/>
            </Link>
          </div>
          {proximos.map((tx,i) => (
            <div key={tx.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:'0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width:34,height:34,borderRadius:11,background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>
                {CAT_ICONS[tx.category]||'📦'}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13,fontWeight:500,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.description}</p>
                <p style={{ fontSize:11,color:TEXTMU,margin:'2px 0 0' }}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
              </div>
              <div style={{ textAlign:'right',flexShrink:0 }}>
                <p style={{ fontSize:13,fontWeight:700,color:TERRA,fontVariantNumeric:'tabular-nums' as const,margin:'0 0 3px' }}>{v(tx.installment_value||tx.amount)}</p>
                <button onClick={()=>markPaid(tx.id,tx.description)} style={{ fontSize:10,background:TERRABG,border:'none',borderRadius:10,padding:'3px 8px',color:TERRA,cursor:'pointer',fontWeight:700 }}>Pagar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BLOCO 5: Maiores gastos por categoria ── */}
      {topCats.length > 0 && (
        <div style={{ ...card() }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <TrendingUp size={14} color={TERRA}/>
              <p style={{ fontSize:13, fontWeight:700, color:TEXT, margin:0 }}>Maiores gastos</p>
            </div>
            <Link href="/relatorios" style={{ fontSize:11, color:TERRA, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:2 }}>
              Relatório <ChevronRight size={11}/>
            </Link>
          </div>
          {topCats.map(([cat,val],i) => {
            const pct = totalGastou > 0 ? (val/totalGastou)*100 : 0
            const cores = ['#C4622D','#C8963C','#7F77DD','#378ADD']
            return (
              <div key={cat} style={{ marginBottom: i<topCats.length-1 ? 12 : 0 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5 }}>
                  <span style={{ fontSize:13,color:TEXT,fontWeight:500 }}>{CAT_ICONS[cat]||'📦'} {cat}</span>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <span style={{ fontSize:12,color:TEXTLT,fontVariantNumeric:'tabular-nums' }}>{v(val)}</span>
                    <span style={{ fontSize:11,color:TEXTMU,width:28,textAlign:'right' }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height:6,background:'rgba(255,255,255,0.07)',borderRadius:99,overflow:'hidden' }}>
                  <div style={{ height:'100%',borderRadius:99,width:`${pct}%`,background:cores[i]||TERRA,transition:'width 0.4s' }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Estado vazio ── */}
      {txs.length === 0 && (
        <div style={{ ...card(), textAlign:'center', padding:'40px 20px' }}>
          <p style={{ fontSize:36,margin:'0 0 10px' }}>📊</p>
          <p style={{ fontSize:15,fontWeight:600,color:TEXTLT,margin:'0 0 6px' }}>Nenhum lançamento ainda</p>
          <p style={{ fontSize:12,color:TEXTMU,margin:'0 0 20px' }}>Adicione receitas e despesas para ver o resumo</p>
          <Link href="/lancamentos/novo" style={{ background:TERRA,color:CREAM,borderRadius:24,padding:'12px 28px',fontSize:14,fontWeight:700,textDecoration:'none',display:'inline-block' }}>
            + Novo lançamento
          </Link>
        </div>
      )}
    </div>
  )
}
