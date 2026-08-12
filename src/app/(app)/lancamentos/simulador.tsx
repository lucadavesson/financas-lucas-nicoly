'use client'
import { useState } from 'react'
import { formatCurrency, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { X } from 'lucide-react'

const TEXT='#1C1C1E',TEXTMU='#8E8E93',TERRA='#C4622D',GREEN='#34C759'
const inp:React.CSSProperties={width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'0 14px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box'}
const lbl:React.CSSProperties={fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}

type Tab = 'parcela' | 'meta' | 'orcamento'

export default function Simulador({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('parcela')

  // Parcelamento
  const [pValor, setPValor] = useState('')
  const [pMeses, setPMeses] = useState('12')
  const [pJuros, setPJuros] = useState('0')
  const [pEntrada, setPEntrada] = useState('')

  // Meta
  const [mAlvo, setMAlvo] = useState('')
  const [mMensal, setMMensal] = useState('')
  const [mAtual, setMAtual] = useState('')

  // Orçamento
  const [oRenda, setORenda] = useState('')
  const [oFixas, setOFixas] = useState('')
  const [oParcelas, setOParcelas] = useState('')
  const [oCartao, setOCartao] = useState('')

  // Cálculos - Parcelamento
  const valorTotal = unmaskCurrency(pValor)
  const entrada = unmaskCurrency(pEntrada)
  const restante = valorTotal - entrada
  const meses = parseInt(pMeses) || 1
  const juros = parseFloat(pJuros.replace(',', '.')) || 0
  const parcelaSemJuros = restante / meses
  const parcelaComJuros = juros > 0
    ? restante * (juros/100 * Math.pow(1+juros/100, meses)) / (Math.pow(1+juros/100, meses) - 1)
    : parcelaSemJuros
  const totalComJuros = parcelaComJuros * meses + entrada
  const custoJuros = totalComJuros - valorTotal

  // Cálculos - Meta
  const alvo = unmaskCurrency(mAlvo)
  const mensal = unmaskCurrency(mMensal)
  const atual = unmaskCurrency(mAtual)
  const falta = Math.max(0, alvo - atual)
  const mesesMeta = mensal > 0 ? Math.ceil(falta / mensal) : 0

  // Cálculos - Orçamento
  const renda = unmaskCurrency(oRenda)
  const fixas = unmaskCurrency(oFixas)
  const parcelas = unmaskCurrency(oParcelas)
  const cartao = unmaskCurrency(oCartao)
  const totalDesp = fixas + parcelas + cartao
  const sobra = renda - totalDesp
  const pctComprometido = renda > 0 ? (totalDesp / renda * 100) : 0

  const tabBtn = (t: Tab, label: string, icon: string) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: tab === t ? TERRA : 'rgba(0,0,0,0.03)',
      color: tab === t ? '#fff' : TEXTMU,
      fontSize: 12, fontWeight: tab === t ? 700 : 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    }}>{icon} {label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '28px 28px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: 0 }}>🧮 Simulador Financeiro</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color={TEXTMU} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {tabBtn('parcela', 'Parcelas', '💳')}
            {tabBtn('meta', 'Meta', '🎯')}
            {tabBtn('orcamento', 'Orçamento', '📊')}
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px 40px' }}>

          {tab === 'parcela' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: TEXTMU, margin: 0 }}>Simule quanto vai pagar por mês ao parcelar uma compra</p>
              <div>
                <label style={lbl}>Valor total da compra</label>
                <input type="text" inputMode="numeric" value={pValor} onChange={e => setPValor(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Entrada (opcional)</label>
                <input type="text" inputMode="numeric" value={pEntrada} onChange={e => setPEntrada(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Parcelas</label>
                  <input type="number" value={pMeses} onChange={e => setPMeses(e.target.value)} style={inp} min="1" max="360" />
                </div>
                <div>
                  <label style={lbl}>Juros ao mês (%)</label>
                  <input type="text" inputMode="decimal" value={pJuros} onChange={e => setPJuros(e.target.value)} placeholder="0" style={inp} />
                </div>
              </div>

              {valorTotal > 0 && (
                <div style={{ background: 'rgba(196,98,45,0.04)', borderRadius: 16, padding: '16px', border: '1px solid rgba(196,98,45,0.12)', marginTop: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, color: TEXTMU, margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 600 }}>Parcela mensal</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: TERRA, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(parcelaComJuros)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: TEXTMU, margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 600 }}>{meses}x de</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(parcelaComJuros)}</p>
                    </div>
                  </div>
                  {entrada > 0 && <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 4px' }}>Entrada: {formatCurrency(entrada)}</p>}
                  <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 4px' }}>Total a pagar: {formatCurrency(totalComJuros)}</p>
                  {custoJuros > 0 && <p style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, margin: 0 }}>Custo dos juros: {formatCurrency(custoJuros)}</p>}
                  {custoJuros === 0 && juros === 0 && <p style={{ fontSize: 12, color: GREEN, fontWeight: 600, margin: 0 }}>✓ Sem juros!</p>}
                </div>
              )}
            </div>
          )}

          {tab === 'meta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: TEXTMU, margin: 0 }}>Descubra em quanto tempo atinge sua meta guardando por mês</p>
              <div>
                <label style={lbl}>Valor da meta</label>
                <input type="text" inputMode="numeric" value={mAlvo} onChange={e => setMAlvo(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Já tem guardado</label>
                <input type="text" inputMode="numeric" value={mAtual} onChange={e => setMAtual(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Quanto guarda por mês</label>
                <input type="text" inputMode="numeric" value={mMensal} onChange={e => setMMensal(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>

              {alvo > 0 && mensal > 0 && (
                <div style={{ background: 'rgba(52,199,89,0.04)', borderRadius: 16, padding: '16px', border: '1px solid rgba(52,199,89,0.12)', marginTop: 4 }}>
                  <p style={{ fontSize: 10, color: TEXTMU, margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 600 }}>Tempo estimado</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: GREEN, margin: '0 0 8px' }}>
                    {mesesMeta} {mesesMeta === 1 ? 'mês' : 'meses'}
                    {mesesMeta >= 12 && <span style={{ fontSize: 14, color: TEXTMU, fontWeight: 500 }}> ({(mesesMeta / 12).toFixed(1)} anos)</span>}
                  </p>
                  <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 4px' }}>Falta guardar: {formatCurrency(falta)}</p>
                  <div style={{ height: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, (atual / alvo) * 100)}%`, background: GREEN, transition: 'width 0.4s' }} />
                  </div>
                  <p style={{ fontSize: 11, color: TEXTMU, margin: '4px 0 0', textAlign: 'right' }}>{((atual / alvo) * 100).toFixed(0)}% atingido</p>
                </div>
              )}
            </div>
          )}

          {tab === 'orcamento' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: TEXTMU, margin: 0 }}>Veja quanto sobra do seu orçamento mensal</p>
              <div>
                <label style={lbl}>Renda mensal total</label>
                <input type="text" inputMode="numeric" value={oRenda} onChange={e => setORenda(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Contas fixas (aluguel, luz, água...)</label>
                <input type="text" inputMode="numeric" value={oFixas} onChange={e => setOFixas(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Parcelas do mês</label>
                <input type="text" inputMode="numeric" value={oParcelas} onChange={e => setOParcelas(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>
              <div>
                <label style={lbl}>Fatura cartão de crédito</label>
                <input type="text" inputMode="numeric" value={oCartao} onChange={e => setOCartao(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp} />
              </div>

              {renda > 0 && (
                <div style={{ background: sobra >= 0 ? 'rgba(52,199,89,0.04)' : 'rgba(255,59,48,0.04)', borderRadius: 16, padding: '16px', border: `1px solid ${sobra >= 0 ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.12)'}`, marginTop: 4 }}>
                  <p style={{ fontSize: 10, color: TEXTMU, margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 600 }}>Sobra no mês</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: sobra >= 0 ? GREEN : '#FF3B30', margin: '0 0 8px' }}>{formatCurrency(sobra)}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {[{ l: 'Contas fixas', v: fixas, c: '#378ADD' }, { l: 'Parcelas', v: parcelas, c: TERRA }, { l: 'Cartão crédito', v: cartao, c: '#9B59B6' }].map((item, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TEXTMU, marginBottom: 2 }}>
                          <span>{item.l}</span>
                          <span style={{ fontWeight: 600 }}>{formatCurrency(item.v)} ({renda > 0 ? (item.v / renda * 100).toFixed(0) : 0}%)</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(0,0,0,0.04)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, width: `${renda > 0 ? (item.v / renda * 100) : 0}%`, background: item.c }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 4px' }}>Comprometido: {pctComprometido.toFixed(0)}% da renda</p>
                  {sobra > 0 && <p style={{ fontSize: 12, color: GREEN, fontWeight: 600, margin: 0 }}>💡 Pode guardar até {formatCurrency(sobra)} por mês!</p>}
                  {sobra < 0 && <p style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, margin: 0 }}>⚠️ Gastos excedem a renda em {formatCurrency(Math.abs(sobra))}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
