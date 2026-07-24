'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, X, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

type Card = { id:string;name:string;bank:string;holder:string;card_type:string;closing_day:number;due_day:number;credit_limit:number;alert_pct:number;color:string;is_active:boolean }

// Paleta expandida de cores para cartões
const CARD_COLORS = [
  { name:'Nubank',    hex:'#6B3FA0' },
  { name:'Roxo',      hex:'#8B5CF6' },
  { name:'Santander', hex:'#CC0000' },
  { name:'Vermelho',  hex:'#E24B4A' },
  { name:'BB',        hex:'#1B4E9B' },
  { name:'Azul',      hex:'#3B82F6' },
  { name:'Caixa',     hex:'#006B3F' },
  { name:'Verde',     hex:'#10B981' },
  { name:'Preto',     hex:'#1C1C1E' },
  { name:'Grafite',   hex:'#374151' },
  { name:'Dourado',   hex:'#B8860B' },
  { name:'Bronze',    hex:'#8B5E3C' },
  { name:'Laranja',   hex:'#EA580C' },
  { name:'Rosa',      hex:'#DB2777' },
]

function formatMoney(raw: string): string {
  const nums = raw.replace(/\D/g,'')
  if (!nums) return ''
  const num = parseInt(nums)/100
  return num.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function parseMoney(s: string): number {
  return parseFloat(s.replace(/[R$\s.]/g,'').replace(',','.'))||0
}

const C = {
  page:   { minHeight:'100%', background:'#1A0F0A', padding:'14px 14px 80px' },
  float:  { background:'rgba(44,26,14,0.9)', borderRadius:20, border:'0.5px solid rgba(201,168,76,0.12)', padding:14, marginBottom:8 },
  lbl:    { fontSize:11, fontWeight:600 as const, color:'#C9A84C', textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:6 },
  inp:    { width:'100%', height:44, background:'rgba(26,15,10,0.8)', border:'0.5px solid rgba(201,168,76,0.2)', borderRadius:12, padding:'0 14px', fontSize:14, color:'#F5E6D3', outline:'none', boxSizing:'border-box' as const },
  seg:    (on:boolean) => ({ flex:1, height:38, borderRadius:10, border:on?'1px solid #C9A84C':'0.5px solid rgba(201,168,76,0.2)', background:on?'rgba(201,168,76,0.15)':'transparent', color:on?'#C9A84C':'rgba(245,230,211,0.4)', fontSize:13, fontWeight:on?600:400 as any, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }),
  btn:    { width:'100%', height:50, background:'linear-gradient(135deg,#C9A84C,#8B5E3C)', color:'#1A0F0A', borderRadius:16, border:'none', fontSize:15, fontWeight:700 as const, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
}

export default function Parametros() {
  const [section, setSection] = useState<'main'|'cartoes'>('main')
  const [cards, setCards]     = useState<Card[]>([])
  const [showCard, setShowCard] = useState(false)
  const [editCard, setEditCard] = useState<Card|null>(null)
  const [saving, setSaving]   = useState(false)
  const [previewColor, setPreviewColor] = useState('#6B3FA0')
  const [form, setForm] = useState({ name:'', bank:'', holder:'Lucas', card_type:'credito', closing_day:'', due_day:'', limitRaw:'', alertRaw:'80', color:'#6B3FA0' })

  useEffect(() => { if(section==='cartoes') loadCards() }, [section])

  async function loadCards() {
    const {data} = await createClient().from('cards').select('*').order('holder').order('name')
    setCards(data||[])
  }

  function sf(k:string,v:string) { setForm(f=>({...f,[k]:v})) }

  function openNew() {
    setForm({ name:'', bank:'', holder:'Lucas', card_type:'credito', closing_day:'', due_day:'', limitRaw:'', alertRaw:'80', color:'#6B3FA0' })
    setPreviewColor('#6B3FA0')
    setEditCard(null); setShowCard(true)
  }

  function openEdit(c: Card) {
    const f = {
      name:c.name, bank:c.bank, holder:c.holder, card_type:c.card_type,
      closing_day:c.closing_day.toString(), due_day:c.due_day.toString(),
      limitRaw: c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
      alertRaw: c.alert_pct.toString()+'%',
      color:c.color
    }
    setForm(f); setPreviewColor(c.color); setEditCard(c); setShowCard(true)
  }

  async function saveCard(e:React.FormEvent) {
    e.preventDefault()
    if(!form.name||!form.bank){toast.error('Preencha nome e banco');return}
    setSaving(true)
    const s=createClient()
    const {data:{user}}=await s.auth.getUser()
    if(!user){return}
    const payload={
      name:form.name, bank:form.bank, holder:form.holder,
      card_type:form.card_type,
      closing_day:parseInt(form.closing_day)||1,
      due_day:parseInt(form.due_day)||1,
      credit_limit:parseMoney(form.limitRaw),
      alert_pct:parseInt(form.alertRaw.replace('%',''))||80,
      color:form.color, is_active:true
    }
    const {error}=editCard
      ?await s.from('cards').update(payload).eq('id',editCard.id)
      :await s.from('cards').insert({...payload,owner_id:user.id})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editCard?'Cartão atualizado!':'Cartão adicionado!')
    setShowCard(false); loadCards(); setSaving(false)
  }

  async function toggleActive(c:Card) {
    await createClient().from('cards').update({is_active:!c.is_active}).eq('id',c.id)
    toast.success(c.is_active?'Arquivado':'Reativado')
    loadCards()
  }

  if (section==='cartoes') return (
    <div style={C.page}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <button onClick={()=>setSection('main')} style={{ background:'rgba(201,168,76,0.1)', border:'0.5px solid rgba(201,168,76,0.2)', borderRadius:10, padding:'6px 10px', cursor:'pointer', color:'#C9A84C', fontSize:13 }}>← Voltar</button>
        <h2 style={{ fontSize:16, fontWeight:600, color:'#F5E6D3', flex:1 }}>Cartões e Contas</h2>
        <button onClick={openNew} style={{ width:34, height:34, background:'linear-gradient(135deg,#C9A84C,#8B5E3C)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor:'pointer' }}>
          <Plus size={18} color="#1A0F0A"/>
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {cards.map(c => (
          <div key={c.id} style={{ ...C.float, display:'flex', alignItems:'center', gap:10, opacity:c.is_active?1:0.5 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:c.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
              {c.name[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'#F5E6D3' }}>{c.name} — {c.holder}</p>
              <p style={{ fontSize:10, color:'rgba(245,230,211,0.4)' }}>Fecha {c.closing_day} · Vence {c.due_day} · {c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>openEdit(c)} style={{ padding:'6px 8px', background:'rgba(201,168,76,0.1)', borderRadius:8, border:'none', cursor:'pointer' }}>
                <Pencil size={13} color="#C9A84C"/>
              </button>
              <button onClick={()=>toggleActive(c)} style={{ padding:'4px 8px', background:c.is_active?'rgba(196,98,45,0.1)':'rgba(90,138,106,0.1)', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, color:c.is_active?'#C4622D':'#5A8A6A' }}>
                {c.is_active?'Arquivar':'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal cartão */}
      {showCard && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end' }} onClick={()=>setShowCard(false)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}/>
          <div style={{ position:'relative', width:'100%', maxWidth:480, margin:'0 auto', background:'#2C1A0E', borderRadius:'24px 24px 0 0', border:'0.5px solid rgba(201,168,76,0.15)', maxHeight:'92vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'18px 20px 12px', borderBottom:'0.5px solid rgba(201,168,76,0.1)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ fontSize:15, fontWeight:600, color:'#F5E6D3' }}>{editCard?'Editar cartão':'Novo cartão'}</h3>
              <button onClick={()=>setShowCard(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={20} color="rgba(245,230,211,0.4)"/></button>
            </div>
            <div style={{ overflowY:'auto', overscrollBehavior:'none', flex:1 }}>
              <form onSubmit={saveCard} style={{ padding:'16px 20px 60px', display:'flex', flexDirection:'column', gap:14 }}>

                {/* Preview do cartão */}
                <div style={{ borderRadius:16, padding:'16px', background:previewColor, position:'relative', overflow:'hidden', marginBottom:4 }}>
                  <div style={{ position:'absolute', right:-10, top:-10, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }}/>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:4 }}>{form.bank||'Banco'}</p>
                  <p style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{form.holder}</p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:12 }}>
                    <div>
                      <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)' }}>Nome do cartão</p>
                      <p style={{ fontSize:14, fontWeight:600, color:'#fff' }}>{form.name||'Nome'}</p>
                    </div>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>Fecha {form.closing_day||'?'}</p>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={C.lbl}>Nome *</label><input value={form.name} onChange={e=>sf('name',e.target.value)} placeholder="Ex: Nubank" required style={C.inp}/></div>
                  <div><label style={C.lbl}>Banco *</label><input value={form.bank} onChange={e=>sf('bank',e.target.value)} placeholder="Ex: Nubank" required style={C.inp}/></div>
                </div>

                <div>
                  <label style={C.lbl}>Titular</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} style={C.seg(form.holder===p)}>{p}</button>)}
                  </div>
                </div>

                <div>
                  <label style={C.lbl}>Tipo</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {[{v:'credito',l:'Crédito'},{v:'debito',l:'Débito'},{v:'conta',l:'Conta'}].map(t=><button key={t.v} type="button" onClick={()=>sf('card_type',t.v)} style={C.seg(form.card_type===t.v)}>{t.l}</button>)}
                  </div>
                </div>

                {form.card_type==='credito'&&(<>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={C.lbl}>Dia fechamento</label><input type="number" value={form.closing_day} onChange={e=>sf('closing_day',e.target.value)} placeholder="Ex: 2" style={C.inp} min="1" max="31"/></div>
                    <div><label style={C.lbl}>Dia vencimento</label><input type="number" value={form.due_day} onChange={e=>sf('due_day',e.target.value)} placeholder="Ex: 9" style={C.inp} min="1" max="31"/></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={C.lbl}>Limite (R$)</label>
                      <input type="text" inputMode="numeric" value={form.limitRaw}
                        onChange={e=>sf('limitRaw',formatMoney(e.target.value))}
                        placeholder="R$ 0,00" style={C.inp}/>
                    </div>
                    <div>
                      <label style={C.lbl}>Alerta em</label>
                      <input type="text" inputMode="numeric" value={form.alertRaw}
                        onChange={e=>{ const n=e.target.value.replace(/\D/g,''); sf('alertRaw',n?n+'%':'') }}
                        placeholder="80%" style={C.inp}/>
                    </div>
                  </div>
                </>)}

                {/* Paleta de cores expandida */}
                <div>
                  <label style={C.lbl}>Cor do cartão</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {CARD_COLORS.map(c=>(
                      <button key={c.hex} type="button"
                        onClick={()=>{ sf('color',c.hex); setPreviewColor(c.hex) }}
                        title={c.name}
                        style={{ width:32, height:32, borderRadius:'50%', background:c.hex, border:form.color===c.hex?'3px solid #F5E6D3':'2px solid transparent', boxShadow:form.color===c.hex?`0 0 0 2px ${c.hex}`:'none', cursor:'pointer', flexShrink:0 }}/>
                    ))}
                  </div>
                  {/* Input de cor customizada */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                    <input type="color" value={form.color}
                      onChange={e=>{ sf('color',e.target.value); setPreviewColor(e.target.value) }}
                      style={{ width:36, height:36, borderRadius:10, border:'0.5px solid rgba(201,168,76,0.2)', cursor:'pointer', background:'none', padding:2 }}/>
                    <span style={{ fontSize:11, color:'rgba(245,230,211,0.4)' }}>Ou escolha uma cor personalizada</span>
                  </div>
                </div>

                <button type="submit" disabled={saving} style={C.btn}>
                  {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:editCard?'Salvar alterações':'Adicionar cartão'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Tela principal parâmetros
  return (
    <div style={C.page}>
      <h1 style={{ fontSize:18, fontWeight:700, color:'#F5E6D3', marginBottom:4 }}>Parâmetros</h1>
      <p style={{ fontSize:12, color:'rgba(245,230,211,0.4)', marginBottom:16 }}>Configure o app do seu jeito</p>
      {[
        { s:'cartoes', emoji:'💳', label:'Cartões e Contas', desc:'Limites, fechamento, vencimento, cores' },
        { s:'limites', emoji:'🎯', label:'Limites por categoria', desc:'Quanto quer gastar em cada área' },
        { s:'poupanca',emoji:'💰', label:'Meta de poupança', desc:'% da renda a guardar por mês' },
        { s:'categorias',emoji:'🏷️', label:'Categorias', desc:'Gerenciar categorias e subcategorias' },
      ].map(item=>(
        <button key={item.s} onClick={()=>item.s==='cartoes'?setSection('cartoes'):toast.info('Em breve!')}
          style={{ ...C.float, width:'100%', display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer' }}>
          <div style={{ width:42, height:42, background:'rgba(201,168,76,0.08)', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0 }}>{item.emoji}</div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14, fontWeight:600, color:'#F5E6D3' }}>{item.label}</p>
            <p style={{ fontSize:11, color:'rgba(245,230,211,0.4)', marginTop:2 }}>{item.desc}</p>
          </div>
          <ChevronRight size={16} color="rgba(201,168,76,0.4)"/>
        </button>
      ))}
    </div>
  )
}
