'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Bell, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = {
  id:string; holder:string; description:string; category:string
  amount:number; status:string; purchase_date:string
  transaction_type:string; installment_value?:number
}

const STATUS = {
  pago:      { bg:'rgba(90,138,106,0.15)', color:'#5A8A6A', label:'Pago' },
  pendente:  { bg:'rgba(196,98,45,0.15)',  color:'#C4622D', label:'Pendente' },
  previsto:  { bg:'rgba(201,168,76,0.15)', color:'#C9A84C', label:'Previsto' },
  atrasado:  { bg:'rgba(196,98,45,0.25)',  color:'#E05020', label:'Atrasado' },
  cancelado: { bg:'rgba(245,230,211,0.08)',color:'rgba(245,230,211,0.3)', label:'Cancelado' },
}

export default function Dashboard() {
  const [txs, setTxs]           = useState<Tx[]>([])
  const [loading, setLoading]   = useState(true)
  const [hide, setHide]         = useState(false)
  const [selected, setSelected] = useState<Tx|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now),'yyyy-MM-dd'))
      .order('purchase_date', { ascending:false })
    setTxs(data||[])
    setLoading(false)
  }

  async function markPaid(tx: Tx) {
    await createClient().from('transactions')
      .update({ status:'pago', paid_date:format(new Date(),'yyyy-MM-dd') })
      .eq('id', tx.id)
    toast.success('Marcado como pago!')
    setSelected(null); load()
  }

  async function deleteTx(tx: Tx) {
    if (!confirm('Apagar este lançamento?')) return
    await createClient().from('transactions').delete().eq('id', tx.id)
    toast.success('Apagado!')
    setSelected(null); load()
  }

  const val = (v:number) => hide ? '•••' : formatCurrency(v)

  const recR  = txs.filter(t => t.transaction_type==='receita')
  const totalR = recR.reduce((s,t) => s+t.amount, 0)
  const recebidas = recR.filter(t => t.status==='pago').reduce((s,t) => s+t.amount, 0)
  const previstas = recR.filter(t => t.status==='previsto').reduce((s,t) => s+t.amount, 0)
  const recD  = txs.filter(t => t.transaction_type!=='receita')
  const totalD = recD.reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const pagas = recD.filter(t => t.status==='pago').reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const pendentes = recD.filter(t => ['pendente','atrasado'].includes(t.status)).reduce((s,t) => s+(t.installment_value||t.amount), 0)
  const economia = recebidas - pagas
  const diasRest = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate() - new Date().getDate()
  const gastoDia = diasRest > 0 ? Math.max(0, economia/diasRest) : 0

  // Próximos vencimentos
  const hoje = new Date(); const em7 = new Date(); em7.setDate(em7.getDate()+7)
  const venc = txs.filter(t => t.status==='pendente' && t.transaction_type!=='receita' && new Date(t.purchase_date)>=hoje && new Date(t.purchase_date)<=em7).slice(0,3)

  const C = {
    page:    { minHeight:'100%', background:'#1A0F0A', padding:'14px 14px 0' },
    section: { fontSize:10, fontWeight:600 as const, color:'rgba(201,168,76,0.7)', textTransform:'uppercase' as const, letterSpacing:'0.07em', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' },
    float:   { background:'rgba(44,26,14,0.9)', backdropFilter:'blur(12px)', borderRadius:24, border:'0.5px solid rgba(201,168,76,0.12)', padding:16, marginBottom:10 },
    floatSm: { background:'rgba(44,26,14,0.9)', backdropFilter:'blur(12px)', borderRadius:20, border:'0.5px solid rgba(201,168,76,0.12)', padding:12 },
    tag:     (st:string) => ({ fontSize:10, fontWeight:600 as const, padding:'3px 8px', borderRadius:6, background:(STATUS[st as keyof typeof STATUS]||STATUS.pendente).bg, color:(STATUS[st as keyof typeof STATUS]||STATUS.pendente).color }),
  }

  return (
    <div style={C.page}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <p style={{ fontSize:11, fontWeight:600, color:'#C9A84C', textTransform:'uppercase', letterSpacing:'0.07em' }}>
          {format(new Date(),'MMMM yyyy',{locale:ptBR})}
        </p>
        <button onClick={()=>setHide(!hide)} style={{ fontSize:10, color:'rgba(245,230,211,0.4)', background:'none', border:'none', cursor:'pointer' }}>
          {hide?'👁 Mostrar':'🙈 Ocultar'}
        </button>
      </div>

      {/* Pode gastar */}
      <div style={{ ...C.floatSm, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <p style={{ fontSize:10, color:'rgba(245,230,211,0.5)', marginBottom:3 }}>Pode gastar hoje</p>
          <p style={{ fontSize:26, fontWeight:700, color:'#C9A84C', lineHeight:1, fontVariantNumeric:'tabular-nums' as const }}>
            {val(gastoDia)}<span style={{ fontSize:12, fontWeight:400, color:'rgba(245,230,211,0.4)' }}>/dia</span>
          </p>
          <p style={{ fontSize:10, color:'rgba(245,230,211,0.35)', marginTop:3 }}>{diasRest} dias restantes</p>
        </div>
        <div style={{ width:42, height:42, background:'rgba(201,168,76,0.1)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💰</div>
      </div>

      {/* Hero economia */}
      <div style={{ ...C.float, marginBottom:10 }}>
        <p style={{ fontSize:10, color:'rgba(245,230,211,0.45)', marginBottom:3 }}>Economia do mês</p>
        <p style={{ fontSize:30, fontWeight:700, color:'#F5E6D3', lineHeight:1, fontVariantNumeric:'tabular-nums' as const }}>{val(economia)}</p>
        <p style={{ fontSize:10, color:'#C9A84C', marginTop:4 }}>
          {recebidas>0 ? `${((economia/recebidas)*100).toFixed(1)}% de poupança` : 'Confirme as receitas para calcular'}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
          {/* Receitas */}
          <div style={{ background:'rgba(201,168,76,0.07)', borderRadius:14, padding:'10px 12px', border:'0.5px solid rgba(201,168,76,0.12)' }}>
            <p style={{ fontSize:10, color:'rgba(245,230,211,0.45)', marginBottom:3 }}>↑ Receitas</p>
            <p style={{ fontSize:15, fontWeight:700, color:'#F5E6D3', fontVariantNumeric:'tabular-nums' as const }}>{val(totalR)}</p>
            <div style={{ marginTop:8, paddingTop:7, borderTop:'0.5px solid rgba(201,168,76,0.12)' }}>
              <p style={{ fontSize:9, color:'rgba(245,230,211,0.3)', marginBottom:2 }}>A confirmar</p>
              <p style={{ fontSize:11, fontWeight:600, color:previstas>0?'#C9A84C':'rgba(245,230,211,0.2)', fontVariantNumeric:'tabular-nums' as const }}>
                {previstas>0?val(previstas):'—'}
              </p>
            </div>
          </div>
          {/* Despesas */}
          <div style={{ background:'rgba(196,98,45,0.07)', borderRadius:14, padding:'10px 12px', border:'0.5px solid rgba(196,98,45,0.15)' }}>
            <p style={{ fontSize:10, color:'rgba(245,230,211,0.45)', marginBottom:3 }}>↓ Despesas</p>
            <p style={{ fontSize:15, fontWeight:700, color:'#F5E6D3', fontVariantNumeric:'tabular-nums' as const }}>{val(totalD)}</p>
            <div style={{ marginTop:8, paddingTop:7, borderTop:'0.5px solid rgba(196,98,45,0.15)' }}>
              <p style={{ fontSize:9, color:'rgba(245,230,211,0.3)', marginBottom:2 }}>A pagar</p>
              <p style={{ fontSize:11, fontWeight:600, color:pendentes>0?'#C4622D':'rgba(245,230,211,0.2)', fontVariantNumeric:'tabular-nums' as const }}>
                {pendentes>0?val(pendentes):'—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Por pessoa */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
        {['Lucas','Nicoly'].map(p => {
          const r = txs.filter(t=>t.holder===p&&t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
          const d = txs.filter(t=>t.holder===p&&t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)
          return (
            <div key={p} style={{ ...C.floatSm }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(201,168,76,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#C9A84C', marginBottom:6 }}>{p[0]}</div>
              <p style={{ fontSize:12, fontWeight:600, color:'#F5E6D3' }}>{p}</p>
              <p style={{ fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums' as const, marginTop:2, color:r-d>=0?'#5A8A6A':'#C4622D' }}>{val(r-d)}</p>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(245,230,211,0.3)', marginTop:4 }}>
                <span>↑{val(r)}</span><span>↓{val(d)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vencimentos */}
      {venc.length>0 && (
        <div style={{ ...C.floatSm, marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
            <Bell size={13} color="#C4622D"/>
            <p style={{ fontSize:11, fontWeight:600, color:'#F5E6D3' }}>Vencendo em breve</p>
          </div>
          {venc.map((tx,i) => (
            <div key={tx.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderTop:i>0?'0.5px solid rgba(201,168,76,0.08)':'none' }}>
              <div>
                <p style={{ fontSize:12, fontWeight:500, color:'#F5E6D3' }}>{tx.description}</p>
                <p style={{ fontSize:10, color:'rgba(245,230,211,0.4)' }}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
              </div>
              <p style={{ fontSize:12, fontWeight:700, color:'#C4622D', fontVariantNumeric:'tabular-nums' as const }}>{val(tx.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Últimas transações — SEM botões inline */}
      <div style={{ marginBottom:80 }}>
        <div style={C.section}>
          <span>Últimas transações</span>
          <Link href="/lancamentos" style={{ color:'#C9A84C', fontSize:10, display:'flex', alignItems:'center', gap:2 }}>
            Ver todas <ChevronRight size={11}/>
          </Link>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}>
            <div style={{ width:20, height:20, border:'2px solid #C9A84C', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          </div>
        ) : txs.length===0 ? (
          <div style={{ ...C.float, textAlign:'center', padding:'28px 16px' }}>
            <p style={{ fontSize:13, color:'rgba(245,230,211,0.4)', marginBottom:8 }}>Nenhum lançamento este mês</p>
            <Link href="/lancamentos/novo" style={{ fontSize:12, color:'#C9A84C', fontWeight:600 }}>Adicionar primeiro →</Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {txs.slice(0,8).map(tx => {
              const isRec = tx.transaction_type==='receita'
              const st = STATUS[tx.status as keyof typeof STATUS] || STATUS.pendente
              return (
                <button key={tx.id} onClick={()=>setSelected(tx)}
                  style={{ ...C.floatSm, display:'flex', alignItems:'center', gap:10, textAlign:'left', width:'100%', cursor:'pointer' }}>
                  <div style={{ width:38, height:38, borderRadius:12, background:isRec?'rgba(90,138,106,0.15)':'rgba(196,98,45,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                    {CAT_ICONS[tx.category]||'📦'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:500, color:'#F5E6D3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.description}</p>
                    <p style={{ fontSize:10, color:'rgba(245,230,211,0.4)', marginTop:1 }}>{tx.category} · {tx.holder}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:isRec?'#5A8A6A':'#C4622D', fontVariantNumeric:'tabular-nums' as const }}>
                      {isRec?'+':'-'}{val(tx.installment_value||tx.amount)}
                    </p>
                    <span style={C.tag(tx.status)}>{st.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom sheet detalhes ao clicar */}
      {selected && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end' }} onClick={()=>setSelected(null)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}/>
          <div style={{ position:'relative', width:'100%', maxWidth:480, margin:'0 auto', background:'#2C1A0E', borderRadius:'24px 24px 0 0', border:'0.5px solid rgba(201,168,76,0.15)', padding:'20px 20px 40px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:32, height:3, background:'rgba(201,168,76,0.3)', borderRadius:2, margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, paddingBottom:16, borderBottom:'0.5px solid rgba(201,168,76,0.1)' }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(196,98,45,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                {CAT_ICONS[selected.category]||'📦'}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15, fontWeight:600, color:'#F5E6D3' }}>{selected.description}</p>
                <p style={{ fontSize:11, color:'rgba(245,230,211,0.5)' }}>{selected.category} · {selected.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:16, fontWeight:700, color:selected.transaction_type==='receita'?'#5A8A6A':'#C4622D', fontVariantNumeric:'tabular-nums' as const }}>
                  {selected.transaction_type==='receita'?'+':'-'}{formatCurrency(selected.installment_value||selected.amount)}
                </p>
                <span style={(STATUS[selected.status as keyof typeof STATUS]||STATUS.pendente) && {
                  fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:6,
                  background:(STATUS[selected.status as keyof typeof STATUS]||STATUS.pendente).bg,
                  color:(STATUS[selected.status as keyof typeof STATUS]||STATUS.pendente).color
                }}>{(STATUS[selected.status as keyof typeof STATUS]||STATUS.pendente).label}</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {selected.transaction_type!=='receita' && selected.status!=='pago' && (
                <button onClick={()=>markPaid(selected)} style={{ width:'100%', height:48, background:'linear-gradient(135deg,#C9A84C,#8B5E3C)', color:'#1A0F0A', fontWeight:700, fontSize:14, borderRadius:16, border:'none', cursor:'pointer' }}>
                  ✓ Marcar como pago
                </button>
              )}
              {selected.transaction_type==='receita' && selected.status==='previsto' && (
                <Link href={`/lancamentos/editar/${selected.id}`} style={{ width:'100%', height:48, background:'linear-gradient(135deg,#C9A84C,#8B5E3C)', color:'#1A0F0A', fontWeight:700, fontSize:14, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  ✓ Confirmar recebimento
                </Link>
              )}
              <Link href={`/lancamentos/editar/${selected.id}`} style={{ width:'100%', height:44, background:'rgba(201,168,76,0.1)', color:'#C9A84C', fontWeight:600, fontSize:13, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', border:'0.5px solid rgba(201,168,76,0.2)' }}
                onClick={()=>setSelected(null)}>
                ✏️ Editar lançamento
              </Link>
              <button onClick={()=>deleteTx(selected)} style={{ width:'100%', height:44, background:'rgba(196,98,45,0.1)', color:'#C4622D', fontWeight:600, fontSize:13, borderRadius:14, border:'0.5px solid rgba(196,98,45,0.2)', cursor:'pointer' }}>
                🗑 Apagar
              </button>
              <button onClick={()=>setSelected(null)} style={{ width:'100%', height:36, background:'none', color:'rgba(245,230,211,0.3)', fontSize:12, border:'none', cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
