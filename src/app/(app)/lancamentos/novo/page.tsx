'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcBillingMonth, calcImplicitInterest, CATS_RECEITA, CATS_DESPESA, SUBCATS, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Plus, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TipoLanc = 'escolha' | 'parcelada' | 'avista' | 'recorrente' | 'receita'

const CARDS_CREDITO = ['Nubank — Lucas','Nubank — Nicoly','Santander — Lucas','Santander — Nicoly','Banco do Brasil — Lucas','Banco do Brasil — Nicoly','C6 Bank — Lucas','C6 Bank — Nicoly','Bradesco — Lucas','Bradesco — Nicoly','Mercado Pago — Lucas','Mercado Pago — Nicoly','Caixa — Lucas','Caixa — Nicoly']
const CONTAS_DEBITO = ['Nubank — Lucas','Nubank — Nicoly','Banco do Brasil — Lucas','Banco do Brasil — Nicoly','C6 Bank — Lucas','C6 Bank — Nicoly','Caixa — Lucas','Caixa — Nicoly']
const CARD_CLOSING: Record<string,number> = {'Nubank — Lucas':2,'Nubank — Nicoly':9,'Santander — Lucas':13,'Santander — Nicoly':13,'Banco do Brasil — Lucas':1,'Banco do Brasil — Nicoly':1,'C6 Bank — Lucas':5,'C6 Bank — Nicoly':5,'Bradesco — Lucas':18,'Bradesco — Nicoly':18,'Mercado Pago — Lucas':1,'Mercado Pago — Nicoly':1,'Caixa — Lucas':5,'Caixa — Nicoly':5}

const FORMAS_AVISTA = [{v:'debito',l:'Débito'},{v:'pix',l:'PIX'},{v:'dinheiro',l:'Dinheiro'},{v:'boleto',l:'Boleto'},{v:'debito_automatico',l:'Déb. automático'}]
const RECORRENTE_TIPOS = [{v:'contas_casa',l:'🏠 Contas de casa',d:'Energia, água, internet, condomínio...'},{v:'assinatura',l:'📺 Assinaturas',d:'Netflix, Spotify, academia...'},{v:'debito_bancario',l:'🏦 Débito bancário',d:'Financiamento, empréstimo...'},{v:'outros',l:'🔄 Outros recorrentes',d:'Qualquer coisa que se repete'}]
const CONTAS_CASA_ITEMS = ['Energia','Água','Internet','Condomínio','Aluguel','Gás','IPTU','Outros']
const ASSINATURAS_ITEMS = ['Netflix','Spotify','Amazon Prime','Disney+','YouTube Premium','HBO Max','Apple TV+','Academia','Curso online','Software','Outros']

export default function NovoLancamento() {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoLanc>('escolha')
  const [loading, setLoading] = useState(false)
  const [customCats, setCustomCats] = useState<string[]>([])
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCat, setNewCat] = useState('')

  // Campos comuns
  const [holder, setHolder]   = useState('Lucas')
  const [desc, setDesc]       = useState('')
  const [amount, setAmount]   = useState('')
  const [cat, setCat]         = useState('')
  const [subcat, setSubcat]   = useState('')
  const [date, setDate]       = useState(format(new Date(),'yyyy-MM-dd'))
  const [nature, setNature]   = useState('Variável')
  const [notes, setNotes]     = useState('')

  // Parcelada
  const [card, setCard]         = useState('Nubank — Lucas')
  const [installments, setInst] = useState('')
  const [instValue, setInstVal] = useState('')
  const [hasEntry, setHasEntry] = useState(false)
  const [entryAmt, setEntryAmt] = useState('')
  const [entryMethod, setEntryMethod] = useState('pix')
  const [entryCard, setEntryCard] = useState('Nubank — Lucas')

  // À vista
  const [method, setMethod]   = useState('pix')
  const [debitCard, setDebitCard] = useState('Nubank — Lucas')

  // Recorrente
  const [recTipo, setRecTipo] = useState('')
  const [recItem, setRecItem] = useState('')
  const [recDay, setRecDay]   = useState('')
  const [recCard, setRecCard] = useState('Nubank — Lucas')
  const [recMethod, setRecMethod] = useState('debito_automatico')

  // Receita
  const [recIsRec, setRecIsRec] = useState(false)
  const [recExpected, setRecExpected] = useState('')
  const [recAccount, setRecAccount] = useState('Nubank — Lucas')

  // Calcula fatura
  const billingMonth = tipo === 'parcelada' && date && card
    ? calcBillingMonth(parseISO(date), CARD_CLOSING[card] || 1)
    : null

  // Calcula juros
  const juros = tipo === 'parcelada' && amount && installments && instValue
    ? calcImplicitInterest(parseFloat(amount)||0, parseFloat(entryAmt)||0, parseFloat(instValue)||0, parseInt(installments)||1)
    : null

  const allCats = tipo === 'receita' ? [...CATS_RECEITA,...customCats] : [...CATS_DESPESA,...customCats]
  const allSubs = SUBCATS[cat] || []

  function addCustomCat() {
    if (!newCat.trim()) return
    setCustomCats(p=>[...p,newCat.trim()])
    setCat(newCat.trim())
    setNewCat(''); setShowAddCat(false)
    toast.success('Categoria adicionada!')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!desc || !amount || !cat) { toast.error('Preencha todos os campos obrigatórios'); return }

    const amtNum = parseFloat(amount) || 0
    if (amtNum <= 0) { toast.error('Valor deve ser maior que zero'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    try {
      if (tipo === 'parcelada') {
        const nInst = parseInt(installments) || 1
        const iVal  = parseFloat(instValue) || (amtNum - (parseFloat(entryAmt)||0)) / nInst
        const bm    = billingMonth ? format(billingMonth,'yyyy-MM-dd') : null
        const { error } = await supabase.from('transactions').insert({
          owner_id: user.id, holder, transaction_type:'parcelada',
          description: desc, amount: amtNum, category: cat, subcategory: subcat||null,
          nature, purchase_date: date, notes: notes||null,
          card_name: card, billing_month: bm, status:'pendente',
          payment_method:'cartao_credito',
          installment_total: nInst, installment_value: iVal,
          installment_interest: juros?.totalInterest || 0,
          has_entry: hasEntry, entry_amount: hasEntry?(parseFloat(entryAmt)||0):null,
          entry_payment_method: hasEntry?entryMethod:null,
          entry_card_name: hasEntry?entryCard:null, entry_paid: false,
        })
        if (error) throw error

        // Entrada como lançamento separado
        if (hasEntry && entryAmt) {
          const entryNum = parseFloat(entryAmt) || 0
          if (entryNum > 0) {
            const entBm = entryMethod==='cartao_credito' ? format(calcBillingMonth(parseISO(date),CARD_CLOSING[entryCard]||1),'yyyy-MM-dd') : null
            await supabase.from('transactions').insert({
              owner_id:user.id, holder, transaction_type:'avista',
              description:`${desc} — entrada`, amount:entryNum,
              category:cat, subcategory:subcat||null, nature, purchase_date:date,
              payment_method:entryMethod, card_name:entryCard, billing_month:entBm,
              status:['pix','dinheiro','debito'].includes(entryMethod)?'pago':'pendente',
            })
          }
        }

      } else if (tipo === 'avista') {
        const bm = method==='cartao_credito' ? format(calcBillingMonth(parseISO(date),CARD_CLOSING[debitCard]||1),'yyyy-MM-dd') : null
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, holder, transaction_type:'avista',
          description:desc, amount:amtNum, category:cat, subcategory:subcat||null,
          nature, purchase_date:date, notes:notes||null,
          payment_method:method, card_name:debitCard, billing_month:bm,
          status:['pix','dinheiro','debito'].includes(method)?'pago':'pendente',
        })
        if (error) throw error

      } else if (tipo === 'recorrente') {
        const bm = recMethod==='cartao_credito' ? format(calcBillingMonth(parseISO(date),CARD_CLOSING[recCard]||1),'yyyy-MM-dd') : null
        const finalDesc = desc || recItem
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, holder, transaction_type:'recorrente',
          description:finalDesc, amount:amtNum, category:cat, subcategory:subcat||null,
          nature:'Fixo', purchase_date:date, notes:notes||null,
          payment_method:recMethod, card_name:recCard, billing_month:bm,
          is_recurring:true, recurring_day:recDay?parseInt(recDay):null,
          status:'pendente',
        })
        if (error) throw error

      } else if (tipo === 'receita') {
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, holder, transaction_type:'receita',
          description:desc, amount:amtNum,
          expected_amount:recIsRec?(parseFloat(recExpected)||amtNum):null,
          category:cat, subcategory:subcat||null, nature,
          purchase_date:date, notes:notes||null,
          received_account:recAccount,
          is_recurring:recIsRec,
          status:recIsRec?'previsto':'pago',
        })
        if (error) throw error
      }

      toast.success('Lançamento salvo!')
      router.push('/lancamentos')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(`Erro ao salvar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── TELA DE ESCOLHA ─────────────────────────────────────
  if (tipo === 'escolha') {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
          <button onClick={()=>router.back()} className="p-1 -ml-1"><ChevronLeft size={22} color="#8E8E93"/></button>
          <h1 className="font-semibold text-gray-900">Novo lançamento</h1>
        </div>
        <div className="px-4 py-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">O que você quer registrar?</p>
          {[
            { tipo:'receita' as TipoLanc, emoji:'↑', label:'Receita', desc:'Salário, renda extra, investimento recebido', color:'#E1F5EE', tc:'#085041' },
            { tipo:'parcelada' as TipoLanc, emoji:'💳', label:'Compra parcelada', desc:'Pagamento em várias vezes no cartão de crédito', color:'#EEEDFE', tc:'#3C3489' },
            { tipo:'avista' as TipoLanc, emoji:'💵', label:'Compra à vista', desc:'Débito, PIX, dinheiro ou boleto', color:'#FFF3EE', tc:'#7B3010' },
            { tipo:'recorrente' as TipoLanc, emoji:'🔄', label:'Conta recorrente', desc:'Energia, assinatura, financiamento...', color:'#E6F1FB', tc:'#0C447C' },
          ].map(item => (
            <button key={item.tipo} onClick={()=>setTipo(item.tipo)}
              style={{ width:'100%', background:'#fff', borderRadius:20, border:'0.5px solid rgba(0,0,0,.08)', padding:'16px', display:'flex', alignItems:'center', gap:14, textAlign:'left' }}>
              <div style={{ width:46, height:46, borderRadius:14, background:item.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{item.emoji}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15, fontWeight:600, color:'#1C1C1E', marginBottom:3 }}>{item.label}</p>
                <p style={{ fontSize:12, color:'#8E8E93' }}>{item.desc}</p>
              </div>
              <ChevronLeft size={18} color="#C7C7CC" style={{ transform:'rotate(180deg)' }}/>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── FORMULÁRIOS ─────────────────────────────────────────
  const tipoLabels: Record<TipoLanc,string> = {
    escolha:'', parcelada:'Compra parcelada', avista:'Compra à vista',
    recorrente:'Conta recorrente', receita:'Receita'
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={()=>setTipo('escolha')} className="p-1 -ml-1"><ChevronLeft size={22} color="#8E8E93"/></button>
        <h1 className="font-semibold text-gray-900">{tipoLabels[tipo]}</h1>
      </div>

      <form onSubmit={handleSave} className="px-4 py-4 space-y-5 pb-8">
        {/* Responsável */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Responsável</label>
          <div className="grid grid-cols-3 gap-2">
            {['Lucas','Nicoly','Prata'].map(p=>(
              <button key={p} type="button" onClick={()=>setHolder(p)}
                className={`h-10 rounded-xl text-sm font-medium border transition-all ${holder===p?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {tipo==='receita'?'Valor recebido (R$) *':'Valor total (R$) *'}
          </label>
          <input type="number" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}
            placeholder="0,00" required className="input-base text-xl font-bold" step="0.01" min="0.01"/>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição *</label>
          <input type="text" value={desc} onChange={e=>setDesc(e.target.value)}
            placeholder={tipo==='receita'?'Ex: Salário junho...':tipo==='parcelada'?'Ex: Sofá, iPhone...':tipo==='avista'?'Ex: Mercado, Farmácia...':'Ex: Energia, Netflix...'}
            required className="input-base"/>
        </div>

        {/* Categoria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria *</label>
            <button type="button" onClick={()=>setShowAddCat(!showAddCat)} className="text-xs text-brand-500 font-medium flex items-center gap-1">
              <Plus size={12}/> Nova
            </button>
          </div>
          {showAddCat&&(
            <div className="flex gap-2 mb-2">
              <input type="text" value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Nome da categoria" className="input-base flex-1 h-9 text-sm" autoFocus/>
              <button type="button" onClick={addCustomCat} className="h-9 px-3 bg-brand-400 text-white rounded-xl text-sm font-medium">OK</button>
              <button type="button" onClick={()=>setShowAddCat(false)} className="h-9 px-2 bg-gray-100 rounded-xl"><X size={14} color="#8E8E93"/></button>
            </div>
          )}
          <select value={cat} onChange={e=>{setCat(e.target.value);setSubcat('')}} required className="input-base">
            <option value="">Selecione...</option>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Subcategoria */}
        {cat && allSubs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subcategoria</label>
            <select value={subcat} onChange={e=>setSubcat(e.target.value)} className="input-base">
              <option value="">Selecione...</option>
              {allSubs.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Data */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {tipo==='receita'?'Data do recebimento *':'Data da compra *'}
          </label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} required className="input-base"/>
        </div>

        {/* Natureza (exceto recorrente que é sempre Fixo) */}
        {tipo !== 'recorrente' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Natureza</label>
            <div className="grid grid-cols-2 gap-2">
              {['Fixo','Variável'].map(n=>(
                <button key={n} type="button" onClick={()=>setNature(n)}
                  className={`h-10 rounded-xl text-sm font-medium border transition-all ${nature===n?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CAMPOS ESPECÍFICOS POR TIPO ── */}

        {/* PARCELADA */}
        {tipo==='parcelada'&&(
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cartão de crédito</label>
              <select value={card} onChange={e=>setCard(e.target.value)} className="input-base">
                {CARDS_CREDITO.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              {billingMonth&&<p className="text-xs text-brand-500 mt-1.5 font-medium">📅 Entra na fatura de {format(billingMonth,'MMMM/yyyy',{locale:ptBR})}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nº de parcelas</label>
                <input type="number" value={installments} onChange={e=>setInst(e.target.value)} placeholder="Ex: 12" className="input-base" min="2"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor da parcela</label>
                <input type="number" inputMode="decimal" value={instValue} onChange={e=>setInstVal(e.target.value)} placeholder="R$ 0,00" className="input-base" step="0.01"/>
              </div>
            </div>
            {juros&&juros.totalInterest>0&&(
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs">
                <div className="flex justify-between mb-1"><span className="text-red-600">Total a pagar</span><span className="font-bold text-red-700 tabular-nums">{formatCurrency(juros.totalPaid)}</span></div>
                <div className="flex justify-between"><span className="text-red-600">Juros implícito</span><span className="font-bold text-red-700 tabular-nums">{formatCurrency(juros.totalInterest)} ({juros.interestPct.toFixed(1)}%)</span></div>
              </div>
            )}
            {/* Entrada */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagou entrada?</label>
                <button type="button" onClick={()=>setHasEntry(!hasEntry)}
                  style={{ width:40, height:22, borderRadius:11, background:hasEntry?'#1D9E75':'#E5E5EA', position:'relative', border:'none', cursor:'pointer', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:2, width:18, height:18, background:'#fff', borderRadius:'50%', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'transform 0.2s', transform:hasEntry?'translateX(20px)':'translateX(2px)' }}/>
                </button>
              </div>
              {hasEntry&&(
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Valor da entrada (R$)</label>
                    <input type="number" inputMode="decimal" value={entryAmt} onChange={e=>setEntryAmt(e.target.value)} placeholder="0,00" className="input-base h-10" step="0.01"/>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Como pagou a entrada</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{v:'pix',l:'PIX'},{v:'debito',l:'Débito'},{v:'dinheiro',l:'Dinheiro'},{v:'boleto',l:'Boleto'},{v:'cartao_credito',l:'Crédito'},{v:'debito_automatico',l:'Déb. auto.'}].map(m=>(
                        <button key={m.v} type="button" onClick={()=>setEntryMethod(m.v)}
                          className={`h-9 rounded-xl text-xs font-medium border transition-all ${entryMethod===m.v?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                          {m.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Conta da entrada</label>
                    <select value={entryCard} onChange={e=>setEntryCard(e.target.value)} className="input-base h-10 text-sm">
                      {[...CARDS_CREDITO,...CONTAS_DEBITO].filter((v,i,a)=>a.indexOf(v)===i).map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {entryAmt&&amount&&<p className="text-xs text-brand-500 font-medium">Valor a parcelar: {formatCurrency(Math.max(0,parseFloat(amount)-parseFloat(entryAmt)))}</p>}
                </div>
              )}
            </div>
          </>
        )}

        {/* À VISTA */}
        {tipo==='avista'&&(
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Como pagou</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {FORMAS_AVISTA.map(m=>(
                <button key={m.v} type="button" onClick={()=>setMethod(m.v)}
                  className={`h-10 rounded-xl text-sm font-medium border transition-all ${method===m.v?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                  {m.l}
                </button>
              ))}
            </div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conta / Cartão</label>
            <select value={debitCard} onChange={e=>setDebitCard(e.target.value)} className="input-base">
              {[...CARDS_CREDITO,...CONTAS_DEBITO].filter((v,i,a)=>a.indexOf(v)===i).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {method==='pix'||method==='debito'||method==='dinheiro'?<p className="text-xs text-green-600 mt-1.5 font-medium">✓ Será registrado como pago</p>:null}
            {method==='boleto'||method==='debito_automatico'?<p className="text-xs text-amber-600 mt-1.5 font-medium">⏳ Ficará pendente até você confirmar</p>:null}
          </div>
        )}

        {/* RECORRENTE */}
        {tipo==='recorrente'&&(
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de conta recorrente</label>
              <div className="space-y-2">
                {RECORRENTE_TIPOS.map(rt=>(
                  <button key={rt.v} type="button" onClick={()=>{setRecTipo(rt.v);setRecItem('');if(!cat){setCat(rt.v==='contas_casa'?'Moradia':rt.v==='assinatura'?'Lazer e Entretenimento':rt.v==='debito_bancario'?'Dívidas e Financiamentos':'Outros')}}}
                    className={`w-full text-left h-auto px-4 py-3 rounded-xl border transition-all ${recTipo===rt.v?'bg-brand-50 border-brand-300':'bg-white border-gray-200'}`}>
                    <p className={`text-sm font-medium ${recTipo===rt.v?'text-brand-700':'text-gray-700'}`}>{rt.l}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rt.d}</p>
                  </button>
                ))}
              </div>
            </div>
            {recTipo==='contas_casa'&&(
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Qual conta?</label>
                <div className="grid grid-cols-2 gap-2">
                  {CONTAS_CASA_ITEMS.map(i=>(
                    <button key={i} type="button" onClick={()=>{setRecItem(i);if(!desc)setDesc(i)}}
                      className={`h-10 rounded-xl text-sm font-medium border transition-all ${recItem===i?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recTipo==='assinatura'&&(
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Qual assinatura?</label>
                <div className="flex flex-wrap gap-2">
                  {['Netflix','Spotify','Amazon Prime','Disney+','YouTube Premium','HBO Max','Apple TV+','Academia','Outros'].map(i=>(
                    <button key={i} type="button" onClick={()=>{setRecItem(i);if(!desc)setDesc(i)}}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${recItem===i?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dia do vencimento</label>
              <input type="number" value={recDay} onChange={e=>setRecDay(e.target.value)} placeholder="Ex: 15" className="input-base" min="1" max="31"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Como é cobrado</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[{v:'debito_automatico',l:'Débito automático'},{v:'boleto',l:'Boleto'},{v:'cartao_credito',l:'Cartão crédito'},{v:'pix',l:'PIX'}].map(m=>(
                  <button key={m.v} type="button" onClick={()=>setRecMethod(m.v)}
                    className={`h-10 rounded-xl text-sm font-medium border transition-all ${recMethod===m.v?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                    {m.l}
                  </button>
                ))}
              </div>
              <select value={recCard} onChange={e=>setRecCard(e.target.value)} className="input-base">
                {[...CARDS_CREDITO,...CONTAS_DEBITO].filter((v,i,a)=>a.indexOf(v)===i).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}

        {/* RECEITA */}
        {tipo==='receita'&&(
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Esta receita se repete?</label>
                <button type="button" onClick={()=>setRecIsRec(!recIsRec)}
                  style={{ width:40, height:22, borderRadius:11, background:recIsRec?'#1D9E75':'#E5E5EA', position:'relative', border:'none', cursor:'pointer', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:2, width:18, height:18, background:'#fff', borderRadius:'50%', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'transform 0.2s', transform:recIsRec?'translateX(20px)':'translateX(2px)' }}/>
                </button>
              </div>
              {recIsRec&&(
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">Receita recorrente</p>
                  <p>Será registrada como <strong>prevista</strong> até você confirmar o recebimento com o valor e data real.</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Onde recebeu</label>
              <select value={recAccount} onChange={e=>setRecAccount(e.target.value)} className="input-base">
                {CONTAS_DEBITO.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional..." rows={2} className="input-base py-2.5 resize-none"/>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading?<><Loader2 size={18} className="animate-spin"/>Salvando...</>:`Salvar ${tipoLabels[tipo].toLowerCase()}`}
        </button>
      </form>
    </div>
  )
}
