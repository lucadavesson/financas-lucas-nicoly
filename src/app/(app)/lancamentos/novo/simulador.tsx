'use client'
import { useState, useEffect } from 'react'
import { formatCurrency, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { X, Trash2, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useBackGuard } from '@/lib/hooks/useBackGuard'

const TEXT='#1C1C1E',TEXTLT='#48484A',TEXTMU='#8E8E93',TERRA='#C4622D',GREEN='#34C759',RED='#FF3B30'
const inp:React.CSSProperties={width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'0 14px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box'}
const lbl:React.CSSProperties={fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}

type Sim = {
  id: string; name: string; totalValue: number; downPayment: number
  installments: number; installmentValue: number; interestRate: number
  totalPaid: number; interestCost: number; createdAt: string
}

export default function Simulador({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<'form'|'saved'>('form')
  const [saved, setSaved] = useState<Sim[]>([])
  const [detail, setDetail] = useState<Sim|null>(null)

  // Form
  const [name, setName] = useState('')
  const [totalRaw, setTotalRaw] = useState('')
  const [entradaRaw, setEntradaRaw] = useState('')
  const [parcelas, setParcelas] = useState('48')
  const [parcelaRaw, setParcelaRaw] = useState('')
  const [juros, setJuros] = useState('')

  useEffect(() => {
    const data = localStorage.getItem('ln_simulations')
    if (data) setSaved(JSON.parse(data))
  }, [])

  // Arrastar para voltar fecha o simulador em vez de sair da tela inteira
  useBackGuard(true, onClose)

  // Cálculos
  const total = unmaskCurrency(totalRaw)
  const entrada = unmaskCurrency(entradaRaw)
  const nParc = parseInt(parcelas) || 0
  const parcelaManual = unmaskCurrency(parcelaRaw)
  const jurosMes = parseFloat(juros?.replace(',', '.') || '0') || 0

  // Se tem parcela manual, usa ela; senão calcula
  let parcelaCalc = 0
  let totalPago = 0
  let custoJuros = 0
  const financiado = total - entrada

  if (parcelaManual > 0 && nParc > 0) {
    // Parcela informada manualmente
    parcelaCalc = parcelaManual
    totalPago = entrada + parcelaManual * nParc
    custoJuros = totalPago - total
  } else if (financiado > 0 && nParc > 0) {
    if (jurosMes > 0) {
      const j = jurosMes / 100
      parcelaCalc = financiado * (j * Math.pow(1+j, nParc)) / (Math.pow(1+j, nParc) - 1)
    } else {
      parcelaCalc = financiado / nParc
    }
    totalPago = entrada + parcelaCalc * nParc
    custoJuros = totalPago - total
  }

  // Projeção mensal - impacto nos próximos meses
  const projecao = Array.from({length: Math.min(nParc, 12)}, (_, i) => ({
    mes: i + 1,
    parcela: parcelaCalc,
    acumulado: entrada + parcelaCalc * (i + 1),
    restante: totalPago - entrada - parcelaCalc * (i + 1),
  }))

  // O botão fica desabilitado enquanto falta dado, com o motivo escrito ao
  // lado — melhor do que deixar clicar e devolver um toast que passa batido.
  const podeSalvar = !!name.trim() && total > 0 && nParc > 0

  function salvar() {
    if (!podeSalvar) { toast.error('Preencha o nome, o valor total e o nº de parcelas'); return }
    const sim: Sim = {
      id: Date.now().toString(),
      name, totalValue: total, downPayment: entrada,
      installments: nParc, installmentValue: parcelaCalc,
      interestRate: jurosMes, totalPaid: totalPago,
      interestCost: custoJuros, createdAt: new Date().toISOString(),
    }
    const updated = [sim, ...saved]
    setSaved(updated)
    localStorage.setItem('ln_simulations', JSON.stringify(updated))
    toast.success('Simulação salva!')
    setName(''); setTotalRaw(''); setEntradaRaw(''); setParcelas('48'); setParcelaRaw(''); setJuros('')
    // Leva para a lista: com o formulário limpo, quem salvava ficava sem
    // nenhum sinal de onde a simulação foi parar.
    setView('saved')
  }

  function excluir(id: string) {
    const updated = saved.filter(s => s.id !== id)
    setSaved(updated)
    localStorage.setItem('ln_simulations', JSON.stringify(updated))
    setDetail(null)
    toast.success('Simulação excluída')
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={onClose}>
      <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)' }}/>
      {/* Cabeçalho fixo / corpo rolável / rodapé fixo. Antes era um bloco só:
          o botão de salvar ficava no fim do conteúdo, abaixo da área visível
          do iPhone, e o toque nunca chegava nele. */}
      <div style={{ position:'relative',width:'100%',maxWidth:390,margin:'0 auto',background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 18px 12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',flexShrink:0 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
            <h3 style={{ fontSize:16,fontWeight:700,color:TEXT,margin:0 }}>🧮 Simulador</h3>
            <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer' }}><X size={20} color={TEXTMU}/></button>
          </div>
          <div style={{ display:'flex',gap:6 }}>
            <button onClick={()=>{setView('form');setDetail(null)}} style={{ flex:1,height:32,borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:view==='form'?700:500,background:view==='form'?TERRA:'rgba(0,0,0,0.03)',color:view==='form'?'#fff':TEXTMU }}>Nova simulação</button>
            <button onClick={()=>{setView('saved');setDetail(null)}} style={{ flex:1,height:32,borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:view==='saved'?700:500,background:view==='saved'?TERRA:'rgba(0,0,0,0.03)',color:view==='saved'?'#fff':TEXTMU }}>Salvas ({saved.length})</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY:'auto',WebkitOverflowScrolling:'touch',flex:1,minHeight:0,padding:'14px 18px 8px' }}>

          {view==='form'&&!detail&&(
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              <div>
                <label style={lbl}>O que está simulando?</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Compra do carro, Financiamento imóvel..." style={inp}/>
              </div>

              <div>
                <label style={lbl}>Valor total do bem/serviço</label>
                <input type="text" inputMode="numeric" value={totalRaw} onChange={e=>setTotalRaw(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={{...inp,fontSize:18,fontWeight:700}}/>
              </div>

              <div>
                <label style={lbl}>Entrada (se houver)</label>
                <input type="text" inputMode="numeric" value={entradaRaw} onChange={e=>setEntradaRaw(maskCurrency(e.target.value))} placeholder="R$ 0,00" style={inp}/>
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                <div>
                  <label style={lbl}>Nº de parcelas</label>
                  <input type="number" value={parcelas} onChange={e=>setParcelas(e.target.value)} style={inp} min="1" max="600"/>
                </div>
                <div>
                  <label style={lbl}>Juros ao mês (%)</label>
                  <input type="text" inputMode="decimal" value={juros} onChange={e=>setJuros(e.target.value)} placeholder="0" style={inp}/>
                </div>
              </div>

              <div>
                <label style={lbl}>Valor da parcela (se já sabe)</label>
                <input type="text" inputMode="numeric" value={parcelaRaw} onChange={e=>setParcelaRaw(maskCurrency(e.target.value))} placeholder="Deixe vazio para calcular" style={inp}/>
                <p style={{ fontSize:10,color:TEXTMU,margin:'4px 0 0' }}>Se informar a parcela, o sistema calcula os juros embutidos</p>
              </div>

              {/* Resultado */}
              {total>0&&nParc>0&&(
                <div style={{ background:'rgba(196,98,45,0.04)',borderRadius:16,padding:'16px',border:'1px solid rgba(196,98,45,0.1)',marginTop:4 }}>
                  <p style={{ fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 12px' }}>Resultado da simulação</p>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
                    <div>
                      <p style={{ fontSize:10,color:TEXTMU,margin:'0 0 2px',fontWeight:600 }}>PARCELA</p>
                      <p style={{ fontSize:20,fontWeight:800,color:TERRA,margin:0 }}>{formatCurrency(parcelaCalc)}</p>
                      <p style={{ fontSize:10,color:TEXTMU,margin:'2px 0 0' }}>{nParc}x</p>
                    </div>
                    <div>
                      <p style={{ fontSize:10,color:TEXTMU,margin:'0 0 2px',fontWeight:600 }}>TOTAL PAGO</p>
                      <p style={{ fontSize:20,fontWeight:800,color:TEXT,margin:0 }}>{formatCurrency(totalPago)}</p>
                    </div>
                  </div>

                  {entrada>0&&(
                    <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize:12,color:TEXTMU }}>Entrada</span>
                      <span style={{ fontSize:12,fontWeight:600,color:TEXT }}>{formatCurrency(entrada)}</span>
                    </div>
                  )}
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize:12,color:TEXTMU }}>Financiado</span>
                    <span style={{ fontSize:12,fontWeight:600,color:TEXT }}>{formatCurrency(financiado)}</span>
                  </div>
                  {custoJuros>0&&(
                    <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize:12,color:RED,fontWeight:600 }}>Juros pagos</span>
                      <span style={{ fontSize:12,fontWeight:700,color:RED }}>{formatCurrency(custoJuros)} ({jurosMes>0?`${jurosMes}%/mês`:`${(custoJuros/financiado*100).toFixed(1)}% total`})</span>
                    </div>
                  )}

                  {/* Projeção dos próximos meses */}
                  <div style={{ marginTop:14 }}>
                    <p style={{ fontSize:11,fontWeight:700,color:TEXTMU,margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.05em' }}>Projeção mensal (próximos {Math.min(nParc,12)} meses)</p>
                    <div style={{ maxHeight:180,overflowY:'auto' }}>
                      {projecao.map(p=>(
                        <div key={p.mes} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)',fontSize:11 }}>
                          <span style={{ color:TEXTMU,fontWeight:600,width:50 }}>Mês {p.mes}</span>
                          <span style={{ color:RED,fontWeight:600 }}>-{formatCurrency(p.parcela)}</span>
                          <span style={{ color:TEXTMU,fontSize:10 }}>Pago: {formatCurrency(p.acumulado)}</span>
                          <span style={{ color:TEXT,fontWeight:600,fontSize:10 }}>Resta: {formatCurrency(Math.max(0,p.restante))}</span>
                        </div>
                      ))}
                    </div>
                    {nParc>12&&<p style={{ fontSize:10,color:TEXTMU,margin:'6px 0 0',textAlign:'center' }}>... e mais {nParc-12} meses</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Simulações salvas */}
          {view==='saved'&&!detail&&(
            <div>
              {saved.length===0?(
                <div style={{ textAlign:'center',padding:'40px 0' }}>
                  <p style={{ fontSize:28,margin:'0 0 10px' }}>📋</p>
                  <p style={{ fontSize:13,color:TEXTMU }}>Nenhuma simulação salva</p>
                </div>
              ):(
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {saved.map(s=>(
                    <button key={s.id} onClick={()=>setDetail(s)} style={{ background:'#F5F5F7',borderRadius:14,padding:'14px 16px',border:'none',cursor:'pointer',textAlign:'left',width:'100%' }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                        <p style={{ fontSize:14,fontWeight:600,color:TEXT,margin:0 }}>{s.name}</p>
                        <p style={{ fontSize:12,fontWeight:700,color:TERRA,margin:0 }}>{s.installments}x {formatCurrency(s.installmentValue)}</p>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                        <p style={{ fontSize:11,color:TEXTMU,margin:0 }}>
                          Total: {formatCurrency(s.totalPaid)}
                          {s.downPayment>0?` · Entrada: ${formatCurrency(s.downPayment)}`:''}
                        </p>
                        {s.interestCost>0&&<p style={{ fontSize:10,color:RED,fontWeight:600,margin:0 }}>+{formatCurrency(s.interestCost)} juros</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detalhe de simulação salva */}
          {detail&&(
            <div>
              <button onClick={()=>setDetail(null)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:TERRA,fontWeight:600,padding:0,marginBottom:12 }}>← Voltar</button>
              <h4 style={{ fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 4px' }}>{detail.name}</h4>
              <p style={{ fontSize:11,color:TEXTMU,margin:'0 0 16px' }}>Salva em {new Date(detail.createdAt).toLocaleDateString('pt-BR')}</p>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
                <div style={{ background:'#F5F5F7',borderRadius:12,padding:'12px' }}>
                  <p style={{ fontSize:10,color:TEXTMU,margin:'0 0 2px',fontWeight:600 }}>VALOR DO BEM</p>
                  <p style={{ fontSize:17,fontWeight:800,color:TEXT,margin:0 }}>{formatCurrency(detail.totalValue)}</p>
                </div>
                <div style={{ background:'#F5F5F7',borderRadius:12,padding:'12px' }}>
                  <p style={{ fontSize:10,color:TEXTMU,margin:'0 0 2px',fontWeight:600 }}>PARCELA</p>
                  <p style={{ fontSize:17,fontWeight:800,color:TERRA,margin:0 }}>{detail.installments}x {formatCurrency(detail.installmentValue)}</p>
                </div>
              </div>

              <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:16 }}>
                {detail.downPayment>0&&(
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize:12,color:TEXTMU }}>Entrada</span>
                    <span style={{ fontSize:12,fontWeight:600,color:GREEN }}>{formatCurrency(detail.downPayment)}</span>
                  </div>
                )}
                <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize:12,color:TEXTMU }}>Financiado</span>
                  <span style={{ fontSize:12,fontWeight:600,color:TEXT }}>{formatCurrency(detail.totalValue-detail.downPayment)}</span>
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize:12,color:TEXTMU }}>Total pago</span>
                  <span style={{ fontSize:12,fontWeight:600,color:TEXT }}>{formatCurrency(detail.totalPaid)}</span>
                </div>
                {detail.interestCost>0&&(
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize:12,color:RED,fontWeight:600 }}>Custo dos juros</span>
                    <span style={{ fontSize:12,fontWeight:700,color:RED }}>{formatCurrency(detail.interestCost)}</span>
                  </div>
                )}
              </div>

              {/* Projeção */}
              <p style={{ fontSize:11,fontWeight:700,color:TEXTMU,margin:'0 0 8px',textTransform:'uppercase' }}>Impacto mensal</p>
              <div style={{ maxHeight:200,overflowY:'auto',marginBottom:16 }}>
                {Array.from({length:Math.min(detail.installments,12)},(_,i)=>{
                  const acum=detail.downPayment+detail.installmentValue*(i+1)
                  const resta=detail.totalPaid-acum
                  return (
                    <div key={i} style={{ display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)',fontSize:11 }}>
                      <span style={{ color:TEXTMU,fontWeight:600,width:50 }}>Mês {i+1}</span>
                      <span style={{ color:RED,fontWeight:600 }}>-{formatCurrency(detail.installmentValue)}</span>
                      <span style={{ color:TEXT,fontSize:10 }}>Resta: {formatCurrency(Math.max(0,resta))}</span>
                    </div>
                  )
                })}
                {detail.installments>12&&<p style={{ fontSize:10,color:TEXTMU,margin:'6px 0 0',textAlign:'center' }}>... e mais {detail.installments-12} meses</p>}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo — a ação principal de cada visão fica sempre à vista */}
        {(detail || view==='form') && (
          <div style={{ flexShrink:0,borderTop:'1px solid rgba(0,0,0,0.07)',background:'#fff',
            padding:'12px 18px calc(16px + env(safe-area-inset-bottom, 12px))' }}>
            {detail ? (
              <button onClick={()=>excluir(detail.id)} style={{ width:'100%',height:46,background:'rgba(255,59,48,0.06)',color:RED,borderRadius:14,border:'none',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                <Trash2 size={15}/> Excluir simulação
              </button>
            ) : (
              <>
                <button onClick={salvar} disabled={!podeSalvar} style={{ width:'100%',height:48,background:podeSalvar?TERRA:'#E5E5EA',color:podeSalvar?'#fff':TEXTMU,borderRadius:14,border:'none',fontSize:15,fontWeight:700,cursor:podeSalvar?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
                  <Save size={16}/> Salvar simulação
                </button>
                {!podeSalvar&&(
                  <p style={{ fontSize:11,color:TEXTMU,margin:'8px 0 0',textAlign:'center' }}>
                    Preencha o nome, o valor total e o nº de parcelas para salvar.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
