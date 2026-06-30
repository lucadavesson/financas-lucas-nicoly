'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, X, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

type Card = { id:string;name:string;bank:string;holder:string;card_type:string;closing_day:number;due_day:number;credit_limit:number;alert_pct:number;color:string;is_active:boolean;linked_account?:string }

const COLORS_CARD = ['#7F77DD','#E24B4A','#1D9E75','#378ADD','#1C1C1E','#BA7517','#D85A30']
const CONTAS_VINC = ['Nubank — Lucas','Nubank — Nicoly','BB — Lucas','BB — Nicoly','C6 — Lucas','C6 — Nicoly','Caixa — Lucas','Caixa — Nicoly']

export default function Parametros() {
  const [section, setSection] = useState<'main'|'cartoes'|'categorias'|'limites'|'poupanca'>('main')
  const [cards, setCards]     = useState<Card[]>([])
  const [showCard, setShowCard] = useState(false)
  const [editCard, setEditCard] = useState<Card|null>(null)
  const [saving, setSaving]   = useState(false)
  const [cardForm, setCardForm] = useState({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',credit_limit:'',alert_pct:'80',color:'#7F77DD',linked_account:''})

  useEffect(() => { if(section==='cartoes') loadCards() }, [section])

  async function loadCards() {
    const {data} = await createClient().from('cards').select('*').order('holder').order('name')
    setCards(data||[])
  }

  function scf(k:string,v:string){setCardForm(f=>({...f,[k]:v}))}

  function openNewCard() {
    setCardForm({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',credit_limit:'',alert_pct:'80',color:'#7F77DD',linked_account:''})
    setEditCard(null); setShowCard(true)
  }

  function openEditCard(c: Card) {
    setCardForm({name:c.name,bank:c.bank,holder:c.holder,card_type:c.card_type,closing_day:c.closing_day.toString(),due_day:c.due_day.toString(),credit_limit:c.credit_limit.toString(),alert_pct:c.alert_pct.toString(),color:c.color,linked_account:c.linked_account||''})
    setEditCard(c); setShowCard(true)
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault()
    if (!cardForm.name||!cardForm.bank){toast.error('Preencha nome e banco');return}
    setSaving(true)
    const s=createClient()
    const {data:{user}}=await s.auth.getUser()
    if(!user){return}
    const payload={name:cardForm.name,bank:cardForm.bank,holder:cardForm.holder,card_type:cardForm.card_type,closing_day:parseInt(cardForm.closing_day)||1,due_day:parseInt(cardForm.due_day)||1,credit_limit:parseFloat(cardForm.credit_limit)||0,alert_pct:parseInt(cardForm.alert_pct)||80,color:cardForm.color,linked_account:cardForm.linked_account||null,is_active:true}
    const {error}=editCard?await s.from('cards').update(payload).eq('id',editCard.id):await s.from('cards').insert({...payload,owner_id:user.id})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editCard?'Cartão atualizado!':'Cartão adicionado!')
    setShowCard(false); loadCards(); setSaving(false)
  }

  async function toggleActive(c: Card) {
    await createClient().from('cards').update({is_active:!c.is_active}).eq('id',c.id)
    toast.success(c.is_active?'Cartão arquivado':'Cartão reativado')
    loadCards()
  }

  // ── TELA PRINCIPAL ──
  if (section==='main') return (
    <div className="px-4 py-4 animate-in">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Parâmetros</h1>
      <p className="text-xs text-gray-400 mb-5">Configure o app do seu jeito</p>
      <div className="space-y-2">
        {[
          {s:'cartoes',emoji:'💳',label:'Cartões e Contas',desc:'Limites, fechamento, vencimento, cores'},
          {s:'limites',emoji:'🎯',label:'Limites por categoria',desc:'Quanto quer gastar em cada área'},
          {s:'poupanca',emoji:'💰',label:'Meta de poupança',desc:'% da renda a guardar por mês'},
          {s:'categorias',emoji:'🏷️',label:'Categorias',desc:'Gerenciar categorias e subcategorias'},
        ].map(item=>(
          <button key={item.s} onClick={()=>setSection(item.s as any)}
            className="w-full card flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
            <div className="w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{item.emoji}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
            <ChevronRight size={18} color="#C7C7CC"/>
          </button>
        ))}
      </div>
    </div>
  )

  // ── CARTÕES ──
  if (section==='cartoes') return (
    <div className="px-4 py-4 animate-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={()=>setSection('main')} className="p-1"><X size={20} color="#8E8E93"/></button>
        <h2 className="text-base font-semibold text-gray-900 flex-1">Cartões e Contas</h2>
        <button onClick={openNewCard} className="w-8 h-8 bg-brand-400 rounded-xl flex items-center justify-center"><Plus size={18} color="#fff"/></button>
      </div>

      <div className="space-y-2">
        {cards.map(c=>(
          <div key={c.id} className={`card flex items-center gap-3 ${!c.is_active?'opacity-50':''}`}>
            <div style={{width:36,height:36,borderRadius:10,background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#fff',fontWeight:700,flexShrink:0}}>
              {c.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{c.name} — {c.holder}</p>
              <p className="text-xs text-gray-400">Fecha {c.closing_day} · Vence {c.due_day} · R$ {c.credit_limit.toLocaleString('pt-BR')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>openEditCard(c)} className="p-1.5 bg-gray-50 rounded-xl"><Pencil size={14} color="#8E8E93"/></button>
              <button onClick={()=>toggleActive(c)} className={`px-2 py-1 rounded-xl text-xs font-medium ${c.is_active?'bg-gray-100 text-gray-500':'bg-brand-50 text-brand-600'}`}>
                {c.is_active?'Arquivar':'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal cartão */}
      {showCard&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end'}} onClick={()=>setShowCard(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.3)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#fff',borderRadius:'20px 20px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 20px 12px',borderBottom:'0.5px solid #F2F2F7',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{fontSize:15,fontWeight:600}}>{editCard?'Editar cartão':'Novo cartão'}</h3>
              <button onClick={()=>setShowCard(false)}><X size={20} color="#8E8E93"/></button>
            </div>
            <div style={{overflowY:'auto',overscrollBehavior:'none',flex:1}}>
              <form onSubmit={saveCard} style={{padding:'16px 20px 48px',display:'flex',flexDirection:'column',gap:14}}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome *</label><input type="text" value={cardForm.name} onChange={e=>scf('name',e.target.value)} placeholder="Ex: Nubank" required className="input-base"/></div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Banco *</label><input type="text" value={cardForm.bank} onChange={e=>scf('bank',e.target.value)} placeholder="Ex: Nubank" required className="input-base"/></div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Titular</label><div className="grid grid-cols-2 gap-2">{['Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>scf('holder',p)} className={`h-10 rounded-xl text-sm font-medium border ${cardForm.holder===p?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>{p}</button>)}</div></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo</label><div className="grid grid-cols-3 gap-2">{[{v:'credito',l:'Crédito'},{v:'debito',l:'Débito'},{v:'conta',l:'Conta'}].map(t=><button key={t.v} type="button" onClick={()=>scf('card_type',t.v)} className={`h-10 rounded-xl text-sm font-medium border ${cardForm.card_type===t.v?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>{t.l}</button>)}</div></div>
                {cardForm.card_type==='credito'&&<>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dia fechamento</label><input type="number" value={cardForm.closing_day} onChange={e=>scf('closing_day',e.target.value)} placeholder="Ex: 2" className="input-base" min="1" max="31"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dia vencimento</label><input type="number" value={cardForm.due_day} onChange={e=>scf('due_day',e.target.value)} placeholder="Ex: 9" className="input-base" min="1" max="31"/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Limite (R$)</label><input type="number" inputMode="decimal" value={cardForm.credit_limit} onChange={e=>scf('credit_limit',e.target.value)} placeholder="0,00" className="input-base" step="0.01"/></div>
                    <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alerta em (%)</label><input type="number" value={cardForm.alert_pct} onChange={e=>scf('alert_pct',e.target.value)} placeholder="80" className="input-base" min="1" max="100"/></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Conta bancária vinculada</label><select value={cardForm.linked_account} onChange={e=>scf('linked_account',e.target.value)} className="input-base"><option value="">Nenhuma</option>{CONTAS_VINC.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                </>}
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cor do cartão</label><div className="flex gap-3">{COLORS_CARD.map(c=><button key={c} type="button" onClick={()=>scf('color',c)} style={{width:32,height:32,borderRadius:'50%',background:c,border:cardForm.color===c?'3px solid #fff':'3px solid transparent',boxShadow:cardForm.color===c?`0 0 0 2px ${c}`:'none'}}/>)}</div></div>
                <button type="submit" disabled={saving} className="btn-primary">{saving?<><Loader2 size={18} className="animate-spin"/>Salvando...</>:editCard?'Salvar alterações':'Adicionar cartão'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Outras seções — placeholder
  return (
    <div className="px-4 py-4 animate-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={()=>setSection('main')} className="p-1"><X size={20} color="#8E8E93"/></button>
        <h2 className="text-base font-semibold text-gray-900">
          {section==='limites'?'Limites por categoria':section==='poupanca'?'Meta de poupança':'Categorias'}
        </h2>
      </div>
      <div className="card text-center py-12">
        <p className="text-2xl mb-3">🚧</p>
        <p className="text-sm font-medium text-gray-500">Em construção</p>
        <p className="text-xs text-gray-400 mt-1">Esta seção será implementada na próxima versão</p>
      </div>
    </div>
  )
}
