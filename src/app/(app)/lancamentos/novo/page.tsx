'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcBillingMonth, CATS_RECEITA, CATS_DESPESA, SUBCATS } from '@/lib/utils'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, Plus, X, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TipoLanc = 'escolha' | 'parcelada' | 'avista' | 'recorrente' | 'receita'

// Cartões carregados do Supabase (só ativos)
const CARDS_CREDITO_FALLBACK: string[] = []
const CONTAS_DEBITO_FALLBACK: string[] = []
const CARD_CLOSING: Record<string,number> = {
  'Nubank — Lucas':2,'Nubank — Nicoly':9,'Santander — Lucas':13,'Santander — Nicoly':13,
  'Banco do Brasil — Lucas':1,'Banco do Brasil — Nicoly':1,'C6 Bank — Lucas':5,'C6 Bank — Nicoly':5,
  'Bradesco — Lucas':18,'Bradesco — Nicoly':18,'Mercado Pago — Lucas':1,'Mercado Pago — Nicoly':1,
  'Caixa — Lucas':5,'Caixa — Nicoly':5
}

// Formata número como moeda enquanto digita
function formatMoneyInput(raw: string): string {
  const nums = raw.replace(/\D/g, '')
  if (!nums) return ''
  const num = parseInt(nums) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function parseMoneyInput(formatted: string): number {
  return parseFloat(formatted.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

const CONTAS_CASA_ITEMS = ['Energia','Água','Internet','Condomínio','Aluguel','Gás','IPTU','Outros']
const ASSINATURAS_ITEMS = ['Netflix','Spotify','Amazon Prime','Disney+','YouTube Premium','HBO Max','Apple TV+','Academia','Curso online','Software','Outros']

// Forma de pagamento → tipo de conta que mostra
const METODO_CONTA: Record<string, 'cartao_credito'|'conta_debito'|'nenhum'> = {
  cartao_credito: 'cartao_credito',
  debito:         'conta_debito',
  pix:            'conta_debito',
  dinheiro:       'nenhum',
  boleto:         'nenhum',
  debito_automatico: 'conta_debito',
}

export default function NovoLancamento() {
  const router = useRouter()
  const [tipo, setTipo]     = useState<TipoLanc>('escolha')
  const [loading, setLoading] = useState(false)

  // Campos comuns — resetam ao trocar tipo
  const [holder, setHolder] = useState('Lucas')
  const [amountRaw, setAmountRaw] = useState('')
  const [desc, setDesc]     = useState('')
  const [cat, setCat]       = useState('')
  const [subcat, setSubcat] = useState('')
  const [date, setDate]     = useState(format(new Date(),'yyyy-MM-dd'))
  const [notes, setNotes]   = useState('')

  // Parcelada
  // Cartões do Supabase
  const [cardsCredito, setCardsCredito] = useState<string[]>([])
  const [contasDebito, setContasDebito] = useState<string[]>([])
  const [cardClosing, setCardClosing]   = useState<Record<string,number>>({})

  useEffect(() => {
    async function loadCards() {
      const { data } = await createClient().from('cards').select('name,holder,card_type,closing_day').eq('is_active', true)
      if (data) {
        const cred = data.filter(c => !c.card_type || c.card_type === 'credito').map(c => `${c.name} — ${c.holder}`)
        const deb  = data.map(c => `${c.name} — ${c.holder}`)
        const closing: Record<string,number> = {}
        data.forEach(c => { closing[`${c.name} — ${c.holder}`] = c.closing_day || 1 })
        setCardsCredito(cred)
        setContasDebito(deb)
        setCardClosing(closing)
        if (cred.length > 0) { setCard(cred[0]); setEntryCard(cred[0]); setDebitCard(cred[0]); setRecCard(cred[0]); setRecAccount(deb[0]) }
      }
    }
    loadCards()
  }, [])

  const CARDS_CREDITO = cardsCredito.length > 0 ? cardsCredito : CARDS_CREDITO_FALLBACK
  const CONTAS_DEBITO = contasDebito.length > 0 ? contasDebito : CONTAS_DEBITO_FALLBACK

  const [card, setCard]         = useState('')
  const [installments, setInst] = useState('')
  const [instRaw, setInstRaw]   = useState('')
  const [hasEntry, setHasEntry] = useState(false)
  const [entryRaw, setEntryRaw] = useState('')
  const [entryMethod, setEntryMethod] = useState('pix')
  const [entryCard, setEntryCard]     = useState('')

  // À vista
  const [method, setMethod]       = useState('pix')
  const [debitCard, setDebitCard] = useState('')

  // Recorrente
  const [recTipo, setRecTipo]   = useState('')
  const [recItem, setRecItem]   = useState('')
  const [recDay, setRecDay]     = useState('')
  const [recMethod, setRecMethod] = useState('debito_automatico')
  const [recCard, setRecCard]   = useState('')

  // Receita
  const [recIsRec, setRecIsRec]   = useState(false)
  const [recAccount, setRecAccount] = useState('')

  // Subcategoria customizada
  const [customSubs, setCustomSubs] = useState<Record<string,string[]>>({})
  const [showAddSub, setShowAddSub] = useState(false)
  const [newSubName, setNewSubName] = useState('')

  // Reseta campos ao trocar tipo
  function changeTipo(t: TipoLanc) {
    setTipo(t)
    setAmountRaw(''); setDesc(''); setCat(''); setSubcat('')
    setDate(format(new Date(),'yyyy-MM-dd')); setNotes('')
    setInst(''); setInstRaw(''); setHasEntry(false); setEntryRaw('')
    setRecTipo(''); setRecItem(''); setRecDay('')
    setRecIsRec(false)
  }

  const amount    = parseMoneyInput(amountRaw)
  const instValue = parseMoneyInput(instRaw)
  const entryAmt  = parseMoneyInput(entryRaw)
  const nParcelas = parseInt(installments) || 0

  const totalPago    = instValue > 0 && nParcelas > 0 ? instValue * nParcelas : 0
  const totalJuros   = totalPago > 0 ? Math.max(0, totalPago - (amount - entryAmt)) : 0
  const pctJuros     = (amount - entryAmt) > 0 && totalJuros > 0 ? (totalJuros / (amount - entryAmt) * 100) : 0

  const billingMonth = tipo === 'parcelada' && date && card
    ? calcBillingMonth(parseISO(date), cardClosing[card] || 1)
    : tipo === 'avista' && method === 'cartao_credito' && date && debitCard
    ? calcBillingMonth(parseISO(date), cardClosing[debitCard] || 1)
    : null

  const allCats = tipo === 'receita' ? [...CATS_RECEITA,...Object.keys(customSubs).filter(k=>!CATS_RECEITA.includes(k))]
    : [...CATS_DESPESA,...Object.keys(customSubs).filter(k=>!CATS_DESPESA.includes(k))]
  const baseSubs   = SUBCATS[cat] || []
  const extraSubs  = customSubs[cat] || []
  const allSubs    = [...baseSubs, ...extraSubs]

  function addCustomSub() {
    if (!newSubName.trim() || !cat) return
    setCustomSubs(p => ({ ...p, [cat]: [...(p[cat]||[]), newSubName.trim()] }))
    setSubcat(newSubName.trim())
    setNewSubName(''); setShowAddSub(false)
    toast.success('Subcategoria criada!')
  }

  // Qual tipo de conta mostrar baseado na forma de pagamento
  const contaTipo = METODO_CONTA[method] || 'conta_debito'
  const recContaTipo = METODO_CONTA[recMethod] || 'conta_debito'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!desc || amount <= 0 || (!cat && tipo !== 'recorrente')) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    try {
      if (tipo === 'parcelada') {
        const iVal = instValue || (amount - entryAmt) / (nParcelas || 1)
        const bm   = billingMonth ? format(billingMonth,'yyyy-MM-dd') : null
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, owner_name:holder, holder, transaction_type:'parcelada',
          description:desc, amount, category:cat, subcategory:subcat||null,
          purchase_date:date, notes:notes||null,
          card_name:card, billing_month:bm, status:'pendente',
          payment_method:'cartao_credito',
          installment_total:nParcelas||1, installment_value:iVal,
          installment_interest:totalJuros,
          has_entry:hasEntry,
          entry_amount:hasEntry?entryAmt:null,
          entry_payment_method:hasEntry?entryMethod:null,
          entry_card_name:hasEntry?entryCard:null,
          entry_paid:hasEntry&&['pix','debito','dinheiro'].includes(entryMethod),
        })
        if (error) throw error
        // Entrada separada
        if (hasEntry && entryAmt > 0) {
          const entBm = entryMethod==='cartao_credito'
            ? format(calcBillingMonth(parseISO(date),cardClosing[entryCard]||1),'yyyy-MM-dd') : null
          await supabase.from('transactions').insert({
            owner_id:user.id, owner_name:holder, holder, transaction_type:'avista',
            description:`${desc} — entrada`, amount:entryAmt,
            category:cat, subcategory:subcat||null,
            purchase_date:date, payment_method:entryMethod,
            card_name:entryCard, billing_month:entBm,
            status:['pix','dinheiro','debito'].includes(entryMethod)?'pago':'pendente',
          })
        }

      } else if (tipo === 'avista') {
        const isCredito = method === 'cartao_credito'
        const bm = isCredito ? format(calcBillingMonth(parseISO(date),cardClosing[debitCard]||1),'yyyy-MM-dd') : null
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, owner_name:holder, holder, transaction_type:'avista',
          description:desc, amount, category:cat, subcategory:subcat||null,
          purchase_date:date, notes:notes||null,
          payment_method:method, card_name:debitCard, billing_month:bm,
          status:['pix','dinheiro','debito'].includes(method)?'pago':'pendente',
        })
        if (error) throw error

      } else if (tipo === 'recorrente') {
        const finalCat  = cat || (recTipo==='contas_casa'?'Moradia':recTipo==='assinatura'?'Lazer e Entretenimento':'Dívidas e Financiamentos')
        const finalDesc = desc || recItem
        const bm = recMethod==='cartao_credito'
          ? format(calcBillingMonth(parseISO(date),cardClosing[recCard]||1),'yyyy-MM-dd') : null
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, owner_name:holder, holder, transaction_type:'recorrente',
          description:finalDesc, amount, category:finalCat,
          subcategory:recItem||subcat||null,
          purchase_date:date, notes:notes||null,
          payment_method:recMethod, card_name:recContaTipo!=='nenhum'?recCard:null,
          billing_month:bm, is_recurring:true,
          recurring_day:recDay?parseInt(recDay):null,
          status:'pendente',
        })
        if (error) throw error

      } else if (tipo === 'receita') {
        const { error } = await supabase.from('transactions').insert({
          owner_id:user.id, owner_name:holder, holder, transaction_type:'receita',
          description:desc, amount,
          expected_amount:recIsRec?amount:null,
          category:cat, subcategory:subcat||null,
          purchase_date:date, notes:notes||null,
          received_account:recAccount,
          is_recurring:recIsRec,
          status:recIsRec?'previsto':'pago',
        })
        if (error) throw error
      }

      toast.success('Salvo com sucesso!')
      router.push('/lancamentos')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast.error(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── ESTILOS base ────────────────────────────────────
  const S = {
    page:  { minHeight:'100%', background:'#F5F5F7' },
    hdr:   { position:'sticky' as const, top:0, background:'#F5F5F7', borderBottom:'0.5px solid rgba(255,255,255,0.08)', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, zIndex:10 },
    form:  { padding:'16px', display:'flex', flexDirection:'column' as const, gap:16, paddingBottom:160 },
    lbl:   { fontSize:11, fontWeight:600 as const, color:'#8E8E93', textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:6 },
    inp:   { width:'100%', height:44, background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'0 14px', fontSize:15, color:'#1C1C1E', outline:'none' },
    inpMoney: { width:'100%', height:52, background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'0 14px', fontSize:20, fontWeight:700 as const, color:'#1C1C1E', outline:'none', fontVariantNumeric:'tabular-nums' as const },
    seg:   (on:boolean, accent='#C4622D') => ({
      flex:1, height:40, borderRadius:10, border: on?`1px solid ${accent}`:'0.5px solid rgba(255,255,255,0.12)',
      background: on?accent:'rgba(255,255,255,0.07)', color: on?'#F4EFE8':'#C8B89A',
      fontSize:13, fontWeight: on?600:400 as any, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
    }),
    card:  { background:'#FFFFFF', borderRadius:16, border:'0.5px solid rgba(255,255,255,0.1)', padding:'14px' },
    btn:   { width:'100%', height:52, background:'#C4622D', color:'#1C1C1E', borderRadius:16, border:'none', fontSize:15, fontWeight:600 as const, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:8 },
    sel:   { width:'100%', height:44, background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12, padding:'0 14px', fontSize:14, color:'#1C1C1E', outline:'none', appearance:'none' as const },
  }

  // ── TELA DE ESCOLHA ──────────────────────────────────
  if (tipo === 'escolha') return (
    <div style={S.page}>
      <div style={S.hdr}>
        <button onClick={()=>router.back()} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
          <ChevronLeft size={22} color="#C8B89A"/>
        </button>
        <span style={{fontSize:16,fontWeight:600,color:'#1C1C1E'}}>Novo lançamento</span>
      </div>
      <div style={{padding:'20px 16px'}}>
        <p style={{fontSize:12,fontWeight:600,color:'#C8963C',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:16}}>
          O que você quer registrar?
        </p>
        {[
          { t:'receita' as TipoLanc,    emoji:'↑', label:'Receita',           desc:'Salário, renda extra, investimento recebido',    bg:'rgba(74,140,92,0.2)', border:'rgba(74,140,92,0.4)', ec:'#F4EFE8' },
          { t:'parcelada' as TipoLanc,  emoji:'💳', label:'Compra parcelada',  desc:'Pagamento em várias vezes no cartão de crédito', bg:'rgba(196,98,45,0.2)', border:'rgba(196,98,45,0.4)', ec:'#F4EFE8' },
          { t:'avista' as TipoLanc,     emoji:'💵', label:'Compra à vista',    desc:'Crédito, débito, PIX, dinheiro ou boleto',       bg:'rgba(196,98,45,0.15)', border:'rgba(196,98,45,0.35)', ec:'#F4EFE8' },
          { t:'recorrente' as TipoLanc, emoji:'🔄', label:'Conta recorrente',  desc:'Energia, assinatura, financiamento...',           bg:'rgba(255,255,255,0.06)', border:'rgba(255,255,255,0.12)', ec:'#F4EFE8' },
        ].map(item => (
          <button key={item.t} onClick={()=>changeTipo(item.t)} style={{
            width:'100%', background:'#FFFFFF', borderRadius:18,
            border:`0.5px solid ${item.border}`, padding:'14px 16px',
            display:'flex', alignItems:'center', gap:14, textAlign:'left',
            marginBottom:10, cursor:'pointer',
          }}>
            <div style={{width:46,height:46,borderRadius:14,background:item.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
              {item.emoji}
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:15,fontWeight:600,color:'#1C1C1E',marginBottom:3}}>{item.label}</p>
              <p style={{fontSize:12,color:'#8E8E93'}}>{item.desc}</p>
            </div>
            <ChevronDown size={16} color="#C7C7CC" style={{transform:'rotate(-90deg)'}}/>
          </button>
        ))}
      </div>
    </div>
  )

  const tipoLabel: Record<TipoLanc,string> = {
    escolha:'', parcelada:'Compra parcelada', avista:'Compra à vista',
    recorrente:'Conta recorrente', receita:'Receita'
  }

  // ── CAMPOS COMUNS ────────────────────────────────────
  const CamposComuns = (
    <>
      {/* Responsável */}
      <div>
        <label style={S.lbl}>Responsável</label>
        <div style={{display:'flex',gap:8}}>
          {['Lucas','Nicoly','Prata'].map(p=>(
            <button key={p} type="button" onClick={()=>setHolder(p)} style={S.seg(holder===p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Valor */}
      <div>
        <label style={S.lbl}>
          {tipo==='receita' ? 'Valor recebido (R$)' : 'Valor total (R$)'}
        </label>
        <input
          type="text" inputMode="numeric"
          value={amountRaw}
          onChange={e => setAmountRaw(formatMoneyInput(e.target.value))}
          placeholder="R$ 0,00"
          style={S.inpMoney}
        />
      </div>

      {/* Descrição */}
      <div>
        <label style={S.lbl}>Descrição</label>
        <input type="text" value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder={tipo==='receita'?'Ex: Salário junho...':tipo==='parcelada'?'Ex: Sofá, iPhone...':tipo==='avista'?'Ex: Mercado, Farmácia...':'Ex: Netflix, Energia...'}
          style={S.inp} required/>
      </div>

      {/* Data */}
      <div>
        <label style={S.lbl}>{tipo==='receita'?'Data do recebimento':'Data da compra'}</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.inp}/>
      </div>
    </>
  )

  // Categoria + Subcategoria — para tipos que precisam
  const CampoCat = (
    <>
      <div>
        <label style={S.lbl}>Categoria</label>
        <div style={{position:'relative'}}>
          <select value={cat} onChange={e=>{setCat(e.target.value);setSubcat('')}} style={S.sel} required>
            <option value="">Selecione...</option>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
        </div>
      </div>
      {cat && (
        <div>
          <label style={S.lbl}>Subcategoria</label>
          <div style={{position:'relative'}}>
            <select value={subcat} onChange={e=>{
              if(e.target.value==='__nova__'){setShowAddSub(true)}
              else{setSubcat(e.target.value)}
            }} style={S.sel}>
              <option value="">Selecione...</option>
              {allSubs.map(s=><option key={s} value={s}>{s}</option>)}
              <option value="__nova__">+ Criar nova subcategoria...</option>
            </select>
            <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
          </div>
          {showAddSub && (
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <input type="text" value={newSubName} onChange={e=>setNewSubName(e.target.value)}
                placeholder="Nome da nova subcategoria" style={{...S.inp,flex:1,height:40,fontSize:13}} autoFocus/>
              <button type="button" onClick={addCustomSub}
                style={{height:40,padding:'0 14px',background:'#C4622D',color:'#1C1C1E',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
                OK
              </button>
              <button type="button" onClick={()=>setShowAddSub(false)}
                style={{height:40,padding:'0 10px',background:'#FFFFFF',borderRadius:10,border:'none',cursor:'pointer'}}>
                <X size={14} color="#C8963C"/>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )

  // ── FORMULÁRIO PRINCIPAL ────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <button onClick={()=>changeTipo('escolha')} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
          <ChevronLeft size={22} color="#C8B89A"/>
        </button>
        <span style={{fontSize:16,fontWeight:600,color:'#1C1C1E'}}>{tipoLabel[tipo]}</span>
      </div>

      <form onSubmit={handleSave} style={S.form}>
        {CamposComuns}
        {tipo !== 'recorrente' && CampoCat}

        {/* ── PARCELADA ── */}
        {tipo === 'parcelada' && (<>
          <div>
            <label style={S.lbl}>Cartão de crédito</label>
            <div style={{position:'relative'}}>
              <select value={card} onChange={e=>setCard(e.target.value)} style={S.sel}>
                {CARDS_CREDITO.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
            {billingMonth && (
              <p style={{fontSize:11,color:'#C8963C',fontWeight:500,marginTop:5}}>
                📅 Entra na fatura de {format(billingMonth,'MMMM/yyyy',{locale:ptBR})}
              </p>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={S.lbl}>Nº de parcelas</label>
              <input type="number" value={installments} onChange={e=>setInst(e.target.value)}
                placeholder="Ex: 12" style={S.inp} min="2"/>
            </div>
            <div>
              <label style={S.lbl}>Valor da parcela</label>
              <input type="text" inputMode="numeric" value={instRaw}
                onChange={e=>setInstRaw(formatMoneyInput(e.target.value))}
                placeholder="R$ 0,00" style={S.inp}/>
            </div>
          </div>
          {totalJuros > 0 && (
            <div style={{background:'rgba(196,98,45,0.15)',border:'0.5px solid rgba(196,98,45,0.3)',borderRadius:12,padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                <span style={{color:'#7B3020'}}>Total a pagar</span>
                <span style={{fontWeight:700,color:'#7B3020',fontVariantNumeric:'tabular-nums'}}>
                  {totalPago.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                </span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'#7B3020'}}>Juros implícito</span>
                <span style={{fontWeight:700,color:'#7B3020',fontVariantNumeric:'tabular-nums'}}>
                  {totalJuros.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} ({pctJuros.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
          {/* Entrada */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <label style={{...S.lbl,marginBottom:0}}>Pagou entrada?</label>
              <button type="button" onClick={()=>setHasEntry(!hasEntry)} style={{
                width:42,height:24,borderRadius:12,
                background:hasEntry?'#2C1810':'#D4C4B0',
                position:'relative',border:'none',cursor:'pointer',transition:'background 0.2s'
              }}>
                <div style={{position:'absolute',top:3,width:18,height:18,background:'#fff',borderRadius:'50%',boxShadow:'0 1px 3px rgba(0,0,0,.2)',transition:'transform 0.2s',transform:hasEntry?'translateX(21px)':'translateX(3px)'}}/>
              </button>
            </div>
            {hasEntry && (
              <div style={{background:'#FFFFFF',borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <label style={S.lbl}>Valor da entrada</label>
                  <input type="text" inputMode="numeric" value={entryRaw}
                    onChange={e=>setEntryRaw(formatMoneyInput(e.target.value))}
                    placeholder="R$ 0,00" style={S.inp}/>
                  {entryAmt > 0 && amount > 0 && (
                    <p style={{fontSize:11,color:'#C8963C',marginTop:4,fontWeight:500}}>
                      Valor a parcelar: {(amount-entryAmt).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    </p>
                  )}
                </div>
                <div>
                  <label style={S.lbl}>Como pagou a entrada</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {[{v:'pix',l:'PIX'},{v:'debito',l:'Débito'},{v:'dinheiro',l:'Dinheiro'},{v:'boleto',l:'Boleto'},{v:'cartao_credito',l:'Crédito'}].map(m=>(
                      <button key={m.v} type="button" onClick={()=>setEntryMethod(m.v)}
                        style={S.seg(entryMethod===m.v,'#C8963C')}>
                        {m.l}
                      </button>
                    ))}
                  </div>
                </div>
                {METODO_CONTA[entryMethod] !== 'nenhum' && (
                  <div>
                    <label style={S.lbl}>
                      {METODO_CONTA[entryMethod]==='cartao_credito'?'Cartão':'Conta'}
                    </label>
                    <select value={entryCard} onChange={e=>setEntryCard(e.target.value)} style={S.sel}>
                      {(METODO_CONTA[entryMethod]==='cartao_credito'?CARDS_CREDITO:CONTAS_DEBITO).map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </>)}

        {/* ── À VISTA ── */}
        {tipo === 'avista' && (<>
          <div>
            <label style={S.lbl}>Como pagou</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {v:'cartao_credito',l:'Crédito (fatura)'},
                {v:'debito',l:'Débito'},
                {v:'pix',l:'PIX'},
                {v:'dinheiro',l:'Dinheiro'},
                {v:'boleto',l:'Boleto'},
              ].map(m=>(
                <button key={m.v} type="button" onClick={()=>setMethod(m.v)}
                  style={S.seg(method===m.v)}>
                  {m.l}
                </button>
              ))}
            </div>
            {method==='cartao_credito' && billingMonth && (
              <p style={{fontSize:11,color:'#C8963C',fontWeight:500,marginTop:6}}>
                📅 Entra na fatura de {format(billingMonth,'MMMM/yyyy',{locale:ptBR})}
              </p>
            )}
            {['pix','debito','dinheiro'].includes(method) && (
              <p style={{fontSize:11,color:'#2C6E49',fontWeight:500,marginTop:6}}>✓ Será registrado como pago</p>
            )}
            {['boleto'].includes(method) && (
              <p style={{fontSize:11,color:'#C8963C',fontWeight:500,marginTop:6}}>⏳ Ficará pendente até confirmar</p>
            )}
          </div>
          {contaTipo !== 'nenhum' && (
            <div>
              <label style={S.lbl}>{contaTipo==='cartao_credito'?'Cartão de crédito':'Conta'}</label>
              <div style={{position:'relative'}}>
                <select value={debitCard} onChange={e=>setDebitCard(e.target.value)} style={S.sel}>
                  {(contaTipo==='cartao_credito'?CARDS_CREDITO:CONTAS_DEBITO).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
              </div>
            </div>
          )}
        </>)}

        {/* ── RECORRENTE ── */}
        {tipo === 'recorrente' && (<>
          <div>
            <label style={S.lbl}>Tipo de conta recorrente</label>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {v:'contas_casa', emoji:'🏠', l:'Contas de casa',    d:'Energia, água, internet, condomínio...'},
                {v:'assinatura',  emoji:'📺', l:'Assinaturas',       d:'Netflix, Spotify, academia...'},
                {v:'debito_bancario',emoji:'🏦',l:'Débito bancário', d:'Financiamento, empréstimo...'},
                {v:'outros',      emoji:'🔄', l:'Outros recorrentes',d:'Qualquer outra recorrência'},
              ].map(rt=>(
                <button key={rt.v} type="button"
                  onClick={()=>{setRecTipo(rt.v);setRecItem('')}}
                  style={{
                    textAlign:'left',padding:'12px 14px',borderRadius:14,
                    border:`0.5px solid ${recTipo===rt.v?'#C4622D':'rgba(255,255,255,0.1)'}`,
                    background:recTipo===rt.v?'rgba(196,98,45,0.2)':'rgba(255,255,255,0.05)',cursor:'pointer'
                  }}>
                  <p style={{fontSize:13,fontWeight:600,color:'#1C1C1E'}}>{rt.emoji} {rt.l}</p>
                  <p style={{fontSize:11,color:'#8E8E93',marginTop:2}}>{rt.d}</p>
                </button>
              ))}
            </div>
          </div>

          {recTipo==='contas_casa' && (
            <div>
              <label style={S.lbl}>Qual conta?</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {CONTAS_CASA_ITEMS.map(i=>(
                  <button key={i} type="button"
                    onClick={()=>{setRecItem(i);if(!desc)setDesc(i)}}
                    style={S.seg(recItem===i,'#C8963C')}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recTipo==='assinatura' && (
            <div>
              <label style={S.lbl}>Qual assinatura?</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                {ASSINATURAS_ITEMS.map(i=>(
                  <button key={i} type="button"
                    onClick={()=>{setRecItem(i);if(!desc)setDesc(i)}}
                    style={{
                      padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',
                      border:`0.5px solid ${recItem===i?'#2C1810':'#D4C4B0'}`,
                      background:recItem===i?'#C4622D':'rgba(255,255,255,0.07)',
                      color:recItem===i?'#F4EFE8':'#C8B89A'
                    }}>
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={S.lbl}>Dia do vencimento</label>
            <input type="number" value={recDay} onChange={e=>setRecDay(e.target.value)}
              placeholder="Ex: 15" style={S.inp} min="1" max="31"/>
          </div>

          <div>
            <label style={S.lbl}>Como é cobrado</label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {[
                {v:'debito_automatico',l:'Débito automático'},
                {v:'boleto',l:'Boleto'},
                {v:'cartao_credito',l:'Cartão de crédito'},
                {v:'pix',l:'PIX'},
              ].map(m=>(
                <button key={m.v} type="button" onClick={()=>setRecMethod(m.v)}
                  style={S.seg(recMethod===m.v)}>
                  {m.l}
                </button>
              ))}
            </div>
            {recContaTipo !== 'nenhum' && (
              <div>
                <label style={S.lbl}>{recContaTipo==='cartao_credito'?'Cartão':'Conta'}</label>
                <div style={{position:'relative'}}>
                  <select value={recCard} onChange={e=>setRecCard(e.target.value)} style={S.sel}>
                    {(recContaTipo==='cartao_credito'?CARDS_CREDITO:CONTAS_DEBITO).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* ── RECEITA ── */}
        {tipo === 'receita' && (<>
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <label style={{...S.lbl,marginBottom:0}}>Esta receita se repete?</label>
              <button type="button" onClick={()=>setRecIsRec(!recIsRec)} style={{
                width:42,height:24,borderRadius:12,
                background:recIsRec?'#2C1810':'#D4C4B0',
                position:'relative',border:'none',cursor:'pointer',transition:'background 0.2s'
              }}>
                <div style={{position:'absolute',top:3,width:18,height:18,background:'#fff',borderRadius:'50%',boxShadow:'0 1px 3px rgba(0,0,0,.2)',transition:'transform 0.2s',transform:recIsRec?'translateX(21px)':'translateX(3px)'}}/>
              </button>
            </div>
            {recIsRec && (
              <div style={{background:'#FFFFFF',borderRadius:12,padding:'10px 12px',fontSize:12,color:'#C8B89A'}}>
                Ficará como <strong>previsto</strong> até você confirmar o valor real recebido.
              </div>
            )}
          </div>
          <div>
            <label style={S.lbl}>Onde recebeu</label>
            <div style={{position:'relative'}}>
              <select value={recAccount} onChange={e=>setRecAccount(e.target.value)} style={S.sel}>
                {CONTAS_DEBITO.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} color="#C8963C" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
          </div>
        </>)}

        {/* Observações */}
        <div>
          <label style={S.lbl}>Observações</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Opcional..." rows={2}
            style={{...S.inp,height:'auto',padding:'10px 14px',resize:'none',fontSize:14}}/>
        </div>

        <button type="submit" disabled={loading} style={S.btn}>
          {loading
            ? <><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/> Salvando...</>
            : `Salvar ${tipoLabel[tipo].toLowerCase()}`
          }
        </button>
      </form>
    </div>
  )
}
