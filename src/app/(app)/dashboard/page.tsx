'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, Pencil, Trash2, ChevronRight, Bell } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = {
  id: string; holder: string; description: string; category: string
  amount: number; status: string; purchase_date: string
  transaction_type: string; installment_value?: number
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pago:      { bg: '#E8F5E9', color: '#2E7D32' },
  pendente:  { bg: '#FFF3E0', color: '#8B4513' },
  previsto:  { bg: '#E8EAF6', color: '#3949AB' },
  atrasado:  { bg: '#FFEBEE', color: '#C62828' },
  cancelado: { bg: '#F5F5F5', color: '#757575' },
}

export default function Dashboard() {
  const [txs, setTxs]               = useState<Tx[]>([])
  const [loading, setLoading]       = useState(true)
  const [hideValues, setHideValues] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', format(startOfMonth(now), 'yyyy-MM-dd'))
      .lte('purchase_date', format(endOfMonth(now), 'yyyy-MM-dd'))
      .order('purchase_date', { ascending: false })
    setTxs(data || [])
    setLoading(false)
  }

  async function markPaid(id: string) {
    await createClient().from('transactions')
      .update({ status: 'pago', paid_date: format(new Date(), 'yyyy-MM-dd') }).eq('id', id)
    toast.success('Marcado como pago!')
    load()
  }

  async function deleteTx(id: string) {
    if (!confirm('Apagar este lançamento?')) return
    await createClient().from('transactions').delete().eq('id', id)
    toast.success('Apagado!')
    load()
  }

  const val = (v: number) => hideValues ? '•••' : formatCurrency(v)

  // Receitas
  const recR  = txs.filter(t => t.transaction_type === 'receita')
  const totalR = recR.reduce((s, t) => s + t.amount, 0)
  const recebidas  = recR.filter(t => t.status === 'pago').reduce((s, t) => s + t.amount, 0)
  const previstas  = recR.filter(t => t.status === 'previsto').reduce((s, t) => s + t.amount, 0)

  // Despesas
  const recD  = txs.filter(t => t.transaction_type !== 'receita')
  const totalD = recD.reduce((s, t) => s + (t.installment_value || t.amount), 0)
  const pagas    = recD.filter(t => t.status === 'pago').reduce((s, t) => s + (t.installment_value || t.amount), 0)
  const pendentes = recD.filter(t => ['pendente','atrasado'].includes(t.status)).reduce((s, t) => s + (t.installment_value || t.amount), 0)

  const economia = recebidas - pagas
  const poupanca = recebidas > 0 ? (economia / recebidas * 100) : 0
  const diasRest = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()
  const gastoDia = diasRest > 0 ? Math.max(0, economia / diasRest) : 0

  const vencimentos = txs.filter(t => {
    const d = new Date(t.purchase_date)
    const em7 = new Date(); em7.setDate(em7.getDate() + 7)
    return t.status === 'pendente' && t.transaction_type !== 'receita' && d >= new Date() && d <= em7
  }).slice(0, 3)

  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
        </p>
        <button onClick={() => setHideValues(!hideValues)}
          style={{ fontSize: 11, color: '#5C3D2E', background: 'none', border: 'none', cursor: 'pointer' }}>
          {hideValues ? '👁 Mostrar' : '🙈 Ocultar'}
        </button>
      </div>

      {/* Pode gastar hoje */}
      <div style={{ background: '#fff', borderRadius: 18, border: '0.5px solid rgba(44,24,16,0.08)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, color: '#8B6914', marginBottom: 2 }}>Pode gastar hoje</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#2C1810', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {val(gastoDia)}<span style={{ fontSize: 13, fontWeight: 400, color: '#C4A882' }}>/dia</span>
          </p>
          <p style={{ fontSize: 11, color: '#C4A882', marginTop: 3 }}>{diasRest} dias restantes</p>
        </div>
        <div style={{ width: 44, height: 44, background: '#F5EDD8', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💰</div>
      </div>

      {/* Hero — economia com breakdown */}
      <div style={{ background: '#1C1C1E', borderRadius: 20, padding: 16, border: '0.5px solid rgba(139,105,20,0.3)' }}>
        <p style={{ fontSize: 11, color: 'rgba(250,247,244,0.5)', marginBottom: 2 }}>Economia do mês</p>
        <p style={{ fontSize: 28, fontWeight: 700, color: '#FAF7F4', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {val(economia)}
        </p>
        <p style={{ fontSize: 11, color: '#8B6914', marginTop: 3 }}>
          {recebidas > 0 ? `${poupanca.toFixed(1)}% de poupança` : 'Confirme as receitas para calcular'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {/* Receitas */}
          <div style={{ background: 'rgba(139,105,20,0.12)', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(139,105,20,0.2)' }}>
            <p style={{ fontSize: 10, color: 'rgba(250,247,244,0.5)', marginBottom: 2 }}>↑ Receitas</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#FAF7F4', fontVariantNumeric: 'tabular-nums' }}>{val(totalR)}</p>
            {/* Breakdown */}
            <div style={{ marginTop: 8, paddingTop: 7, borderTop: '0.5px solid rgba(139,105,20,0.2)' }}>
              <p style={{ fontSize: 10, color: 'rgba(250,247,244,0.35)', marginBottom: 2 }}>A confirmar</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: previstas > 0 ? '#8B6914' : 'rgba(250,247,244,0.25)', fontVariantNumeric: 'tabular-nums' }}>
                {previstas > 0 ? val(previstas) : '—'}
              </p>
            </div>
          </div>

          {/* Despesas */}
          <div style={{ background: 'rgba(196,98,45,0.1)', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(196,98,45,0.2)' }}>
            <p style={{ fontSize: 10, color: 'rgba(250,247,244,0.5)', marginBottom: 2 }}>↓ Despesas</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#FAF7F4', fontVariantNumeric: 'tabular-nums' }}>{val(totalD)}</p>
            {/* Breakdown */}
            <div style={{ marginTop: 8, paddingTop: 7, borderTop: '0.5px solid rgba(196,98,45,0.2)' }}>
              <p style={{ fontSize: 10, color: 'rgba(250,247,244,0.35)', marginBottom: 2 }}>A pagar</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: pendentes > 0 ? '#C4622D' : 'rgba(250,247,244,0.25)', fontVariantNumeric: 'tabular-nums' }}>
                {pendentes > 0 ? val(pendentes) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Por pessoa */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['Lucas', 'Nicoly'].map(p => {
          const r = txs.filter(t => t.holder === p && t.transaction_type === 'receita').reduce((s, t) => s + t.amount, 0)
          const d = txs.filter(t => t.holder === p && t.transaction_type !== 'receita').reduce((s, t) => s + (t.installment_value || t.amount), 0)
          return (
            <div key={p} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid rgba(44,24,16,0.08)', padding: '12px' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#F5EDD8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8B6914', marginBottom: 6 }}>{p[0]}</div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#2C1810' }}>{p}</p>
              <p style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: r - d >= 0 ? '#2C6E49' : '#C4622D' }}>{val(r - d)}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#C4A882', marginTop: 4 }}>
                <span>↑ {val(r)}</span><span>↓ {val(d)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vencimentos */}
      {vencimentos.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(196,98,45,0.2)', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Bell size={14} color="#C4622D" />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2C1810' }}>Vencendo em breve</p>
          </div>
          {vencimentos.map((tx, i) => (
            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i > 0 ? '0.5px solid #F0E8DF' : 'none' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#1C1C1E' }}>{tx.description}</p>
                <p style={{ fontSize: 10, color: '#C4A882' }}>{tx.holder} · {format(new Date(tx.purchase_date), 'dd/MM')}</p>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#C4622D', fontVariantNumeric: 'tabular-nums' }}>{val(tx.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Receitas previstas aviso */}
      {previstas > 0 && (
        <div style={{ background: '#F5EDD8', borderRadius: 14, padding: '11px 14px', border: '0.5px solid #D4C4B0' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#8B6914', marginBottom: 3 }}>💡 Receitas a confirmar</p>
          <p style={{ fontSize: 11, color: '#5C4A0A', lineHeight: 1.5 }}>
            {val(previstas)} em receitas previstas aguardam confirmação do valor real recebido.
          </p>
        </div>
      )}

      {/* Últimas transações */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8B6914', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Últimas transações</p>
          <Link href="/lancamentos" style={{ fontSize: 11, color: '#C4622D', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 2 }}>
            Ver todas <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 20, height: 20, border: '2px solid #8B6914', borderTopColor: 'transparent', borderRadius: '50', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : txs.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(44,24,16,0.08)', padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#C4A882', marginBottom: 8 }}>Nenhum lançamento este mês</p>
            <Link href="/lancamentos/novo" style={{ fontSize: 12, color: '#8B6914', fontWeight: 600 }}>Adicionar primeiro →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txs.slice(0, 5).map(tx => {
              const isRec = tx.transaction_type === 'receita'
              const isPrev = tx.status === 'previsto'
              const isPago = tx.status === 'pago'
              const st = STATUS_STYLE[tx.status] || STATUS_STYLE.pendente
              return (
                <div key={tx.id} style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(44,24,16,0.08)', padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: isRec ? '#F5EDD8' : '#FAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {CAT_ICONS[tx.category] || '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</p>
                      <p style={{ fontSize: 10, color: '#C4A882', marginTop: 1 }}>{tx.category} · {tx.holder}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isRec ? '#2C6E49' : '#7B3B3B', fontVariantNumeric: 'tabular-nums' }}>
                        {isRec ? '+' : '-'}{val(tx.installment_value || tx.amount)}
                      </p>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: st.bg, color: st.color }}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isRec && isPrev ? (
                      <Link href={`/lancamentos/editar/${tx.id}`} style={{ flex: 1, height: 30, background: '#F5EDD8', color: '#8B6914', fontSize: 11, fontWeight: 600, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        ✓ Confirmar recebimento
                      </Link>
                    ) : !isRec && !isPago && tx.status !== 'cancelado' ? (
                      <button onClick={() => markPaid(tx.id)} style={{ flex: 1, height: 30, background: '#2C1810', color: '#FAF7F4', fontSize: 11, fontWeight: 600, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Pagar
                      </button>
                    ) : (
                      <div style={{ flex: 1, height: 30, background: '#F0FAF4', color: '#2C6E49', fontSize: 11, fontWeight: 500, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> {isRec ? 'Recebido' : 'Pago'}
                      </div>
                    )}
                    <Link href={`/lancamentos/editar/${tx.id}`} style={{ flex: 1, height: 30, background: '#F5EDD8', color: '#5C3D2E', fontSize: 11, fontWeight: 500, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Pencil size={11} /> Editar
                    </Link>
                    <button onClick={() => deleteTx(tx.id)} style={{ width: 30, height: 30, background: '#FBF0EC', color: '#C4622D', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
