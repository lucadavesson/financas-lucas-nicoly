'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import ModalPortal from '@/components/ui/ModalPortal'
import { excluirRecorrente, rotuloMes, mesDe, type EscopoExclusao } from '@/lib/utils/recurrents'

const TERRA = '#C4622D', TEXT = '#1C1C1E', TEXTMU = '#8E8E93'

/**
 * "Apagar" de uma conta recorrente: pergunta até onde vale, como na compra
 * parcelada. Usada na lista de Lançamentos e na tela de edição.
 */
export default function ExcluirRecorrenteModal({ tx, onClose, onDone }: {
  tx: any; onClose: () => void; onDone: () => void
}) {
  const [escopo, setEscopo] = useState<EscopoExclusao>('mes')
  const [carregando, setCarregando] = useState(false)
  const mes = rotuloMes(mesDe(tx.purchase_date))
  const nome = (tx.description || '').trim()

  const opcoes: { v: EscopoExclusao; t: string; d: string }[] = [
    { v: 'mes',   t: `Só ${mes}`,                  d: 'Pula este mês. A conta continua nos outros meses.' },
    { v: 'daqui', t: `${mes} em diante`,           d: 'Encerra a conta aqui. Os meses anteriores ficam no histórico.' },
    { v: 'todas', t: 'A conta inteira',            d: 'Apaga todos os meses, inclusive o histórico e o que já foi pago.' },
  ]

  async function confirmar() {
    setCarregando(true)
    const r = await excluirRecorrente(tx, escopo)
    setCarregando(false)
    if (!r.ok) { toast.error(`Não foi possível apagar: ${r.erro}`); return }
    toast.success(escopo === 'mes' ? `${mes} pulado` : escopo === 'daqui' ? 'Conta encerrada' : `Conta apagada (${r.afetadas} lançamentos)`)
    onDone()
  }

  return (
    <ModalPortal>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
          padding: '20px 16px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box',
        }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: 0 }}>Apagar &quot;{nome}&quot;</p>
          <p style={{ fontSize: 12, color: TEXTMU, margin: '4px 0 14px' }}>Conta recorrente: escolha até onde vale.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {opcoes.map(o => (
              <button key={o.v} type="button" onClick={() => setEscopo(o.v)} style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                border: `1.5px solid ${escopo === o.v ? TERRA : 'rgba(0,0,0,0.1)'}`,
                background: escopo === o.v ? 'rgba(196,98,45,0.08)' : '#fff',
              }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: TEXT }}>{escopo === o.v ? '● ' : '○ '}{o.t}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: TEXTMU, marginTop: 2 }}>{o.d}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} disabled={carregando} style={{ flex: 1, height: 46, borderRadius: 24, border: 'none', background: 'rgba(0,0,0,0.05)', color: TEXT, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={carregando} style={{ flex: 1, height: 46, borderRadius: 24, border: 'none', background: escopo === 'todas' ? '#FF3B30' : TERRA, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: carregando ? 0.6 : 1 }}>
              {carregando ? 'Apagando…' : escopo === 'mes' ? 'Pular o mês' : escopo === 'daqui' ? 'Encerrar' : 'Apagar tudo'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
