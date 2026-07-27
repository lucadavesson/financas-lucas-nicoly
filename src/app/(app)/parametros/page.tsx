'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Target, PiggyBank, Tag, ChevronRight, Plus, Pencil, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const BG='#1A110A'; const SEBBLE='linear-gradient(145deg,#3D2810,#2C1C0E)'; const SEBBLE_DK='linear-gradient(145deg,#2A1C0E,#1A1208)'
const TEXT='#F4EFE8'; const TEXTMU='#8B7A6A'; const TERRA='#C4622D'; const CREAM='#F4EFE8'

const CARD_COLORS = [
  {name:'Nubank',hex:'#6B3FA0'},{name:'Roxo',hex:'#8B5CF6'},{name:'Santander',hex:'#CC0000'},
  {name:'Vermelho',hex:'#E24B4A'},{name:'BB',hex:'#1B4E9B'},{name:'Azul',hex:'#3B82F6'},
  {name:'Caixa',hex:'#006B3F'},{name:'Verde',hex:'#10B981'},{name:'Preto',hex:'#1C1C1E'},
  {name:'Grafite',hex:'#374151'},{name:'Dourado',hex:'#B8860B'},{name:'Bronze',hex:'#8B5E3C'},
  {name:'Laranja',hex:'#EA580C'},{name:'Rosa',hex:'#DB2777'},
]

function fmtM(raw:string):string{const n=raw.replace(/\D/g,'');if(!n)return '';return (parseInt(n)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function parsM(s:string):number{return parseFloat(s.replace(/[R$\s.]/g,'').replace(',','.'))||0}

export default function Parametros() {
  const [sec,setSec]=useState<'main'|'cartoes'>('main')
  const [cards,setCards]=useState<any[]>([])
  const [showC,setShowC]=useState(false)
  const [editC,setEditC]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [prevColor,setPrevColor]=useState('#6B3FA0')
  const [form,setForm]=useState({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'})

  useEffect(()=>{if(sec==='cartoes')load()},[sec])

  async function load(){const {data}=await createClient().from('cards').select('*').order('holder').order('name');setCards(data||[])}
  function sf(k:string,v:string){setForm(f=>({...f,[k]:v}))}

  function openNew(){setForm({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'});setPrevColor('#6B3FA0');setEditC(null);setShowC(true)}
  function openEdit(c:any){setForm({name:c.name,bank:c.bank,holder:c.holder,card_type:c.card_type,closing_day:c.closing_day.toString(),due_day:c.due_day.toString(),limitRaw:c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),alertRaw:c.alert_pct+'%',color:c.color});setPrevColor(c.color);setEditC(c);setShowC(true)}

  async function saveCard(e:React.FormEvent){
    e.preventDefault()
    if(!form.name||!form.bank){toast.error('Preencha nome e banco');return}
    setSaving(true)
    const s=createClient(); const {data:{user}}=await s.auth.getUser(); if(!user)return
    const p={name:form.name,bank:form.bank,holder:form.holder,card_type:form.card_type,closing_day:parseInt(form.closing_day)||1,due_day:parseInt(form.due_day)||1,credit_limit:parsM(form.limitRaw),alert_pct:parseInt(form.alertRaw.replace('%',''))||80,color:form.color,is_active:true}
    const {error}=editC?await s.from('cards').update(p).eq('id',editC.id):await s.from('cards').insert({...p,owner_id:user.id})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editC?'Atualizado!':'Adicionado!');setShowC(false);load();setSaving(false)
  }

  const inp = {width:'100%',height:46,background:'rgba(255,255,255,0.07)',border:'0.5px solid rgba(255,255,255,0.12)',borderRadius:22,padding:'0 16px',fontSize:14,color:'#F4EFE8',outline:'none',boxSizing:'border-box' as const}
  const seg = (on:boolean)=>({flex:1,height:38,borderRadius:19,border:'none',background:on?TERRA:'rgba(61,44,32,0.1)',color:on?CREAM:TEXT,fontSize:13,fontWeight:on?600:400 as any,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'})

  if (sec==='cartoes') return (
    <div style={{ background:BG,minHeight:'100%',padding:'14px 14px 100px' }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
        <button onClick={()=>setSec('main')} style={{ background:'rgba(61,44,32,0.1)',border:'none',borderRadius:12,padding:'6px 12px',cursor:'pointer',fontSize:13,color:TEXT,fontWeight:600 }}>← Voltar</button>
        <h2 style={{ fontSize:17,fontWeight:700,color:TEXT,flex:1 }}>Cartões e Contas</h2>
        <button onClick={openNew} style={{ width:34,height:34,background:TERRA,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer' }}>
          <Plus size={18} color={CREAM}/>
        </button>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {cards.map(c=>(
          <div key={c.id} style={{ background:SEBBLE,borderRadius:24,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 3px 10px rgba(61,44,32,0.12),inset 0 1px 0 rgba(255,255,255,0.25)',opacity:c.is_active?1:0.5 }}>
            <div style={{ width:38,height:38,borderRadius:12,background:c.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700,flexShrink:0 }}>{c.name[0]}</div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:13,fontWeight:600,color:TEXT }}>{c.name} — {c.holder}</p>
              <p style={{ fontSize:10,color:TEXTMU }}>Fecha {c.closing_day} · Vence {c.due_day} · {c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
            </div>
            <button onClick={()=>openEdit(c)} style={{ padding:'6px 8px',background:'rgba(61,44,32,0.1)',borderRadius:10,border:'none',cursor:'pointer' }}><Pencil size={13} color={TEXTMU}/></button>
            <button onClick={async()=>{await createClient().from('cards').update({is_active:!c.is_active}).eq('id',c.id);toast.success(c.is_active?'Arquivado':'Ativado');load()}}
              style={{ padding:'4px 10px',background:c.is_active?'rgba(196,98,45,0.1)':'rgba(80,130,90,0.1)',borderRadius:10,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,color:c.is_active?TERRA:'#3D7A4A' }}>
              {c.is_active?'Arquivar':'Ativar'}
            </button>
          </div>
        ))}
      </div>

      {showC&&(
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setShowC(false)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(61,44,32,0.55)',backdropFilter:'blur(8px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'linear-gradient(180deg,#3D2810,#2C1C0E)',borderRadius:'32px 32px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'18px 20px 12px',borderBottom:'0.5px solid rgba(61,44,32,0.12)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:TEXT }}>{editC?'Editar cartão':'Novo cartão'}</h3>
              <button onClick={()=>setShowC(false)} style={{ background:'none',border:'none',cursor:'pointer' }}><X size={20} color={TEXTMU}/></button>
            </div>
            <div style={{ overflowY:'auto',overscrollBehavior:'none',flex:1 }}>
              <form onSubmit={saveCard} style={{ padding:'16px 20px 60px',display:'flex',flexDirection:'column',gap:14 }}>
                {/* Preview */}
                <div style={{ borderRadius:20,padding:'16px',background:prevColor,position:'relative',overflow:'hidden' }}>
                  <div style={{ position:'absolute',right:-10,top:-10,width:70,height:70,borderRadius:'50%',background:'rgba(255,255,255,0.12)' }}/>
                  <p style={{ fontSize:11,color:'rgba(255,255,255,0.7)',marginBottom:3 }}>{form.bank||'Banco'}</p>
                  <p style={{ fontSize:15,fontWeight:600,color:'#fff' }}>{form.holder}</p>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginTop:14 }}>
                    <p style={{ fontSize:15,fontWeight:700,color:'#fff' }}>{form.name||'Nome do cartão'}</p>
                    <p style={{ fontSize:11,color:'rgba(255,255,255,0.7)' }}>Fecha {form.closing_day||'?'}</p>
                  </div>
                </div>

                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                  <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Nome *</label><input value={form.name} onChange={e=>sf('name',e.target.value)} placeholder="Ex: Nubank" required style={inp}/></div>
                  <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Banco *</label><input value={form.bank} onChange={e=>sf('bank',e.target.value)} placeholder="Ex: Nubank" required style={inp}/></div>
                </div>
                <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Titular</label><div style={{ display:'flex',gap:8 }}>{['Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>)}</div></div>
                <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Tipo</label><div style={{ display:'flex',gap:8 }}>{[{v:'credito',l:'Crédito'},{v:'debito',l:'Débito'},{v:'conta',l:'Conta'}].map(t=><button key={t.v} type="button" onClick={()=>sf('card_type',t.v)} style={seg(form.card_type===t.v)}>{t.l}</button>)}</div></div>
                {form.card_type==='credito'&&<>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Dia fechamento</label><input type="number" value={form.closing_day} onChange={e=>sf('closing_day',e.target.value)} placeholder="Ex: 2" style={inp} min="1" max="31"/></div>
                    <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Dia vencimento</label><input type="number" value={form.due_day} onChange={e=>sf('due_day',e.target.value)} placeholder="Ex: 9" style={inp} min="1" max="31"/></div>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Limite (R$)</label><input type="text" inputMode="numeric" value={form.limitRaw} onChange={e=>sf('limitRaw',fmtM(e.target.value))} placeholder="R$ 0,00" style={inp}/></div>
                    <div><label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Alerta em</label><input type="text" inputMode="numeric" value={form.alertRaw} onChange={e=>{const n=e.target.value.replace(/\D/g,'');sf('alertRaw',n?n+'%':'')}} placeholder="80%" style={inp}/></div>
                  </div>
                </>}
                <div>
                  <label style={{ fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Cor do cartão</label>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:8 }}>
                    {CARD_COLORS.map(c=>(
                      <button key={c.hex} type="button" onClick={()=>{sf('color',c.hex);setPrevColor(c.hex)}} title={c.name}
                        style={{ width:32,height:32,borderRadius:'50%',background:c.hex,border:form.color===c.hex?`3px solid ${TEXT}`:'2px solid transparent',cursor:'pointer',flexShrink:0,boxShadow:form.color===c.hex?'0 0 0 2px rgba(61,44,32,0.3)':undefined }}/>
                    ))}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <input type="color" value={form.color} onChange={e=>{sf('color',e.target.value);setPrevColor(e.target.value)}} style={{ width:36,height:36,borderRadius:12,border:'0.5px solid rgba(61,44,32,0.2)',cursor:'pointer',padding:2 }}/>
                    <span style={{ fontSize:11,color:TEXTMU }}>Cor personalizada</span>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={{ width:'100%',height:50,background:TERRA,color:CREAM,borderRadius:24,border:'none',fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 16px rgba(196,98,45,0.3)' }}>
                  {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:editC?'Salvar':'Adicionar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Tela principal
  return (
    <div style={{ background:BG,minHeight:'100%',padding:'14px 14px 100px' }}>
      <h1 style={{ fontSize:24,fontWeight:700,color:TEXT,marginBottom:4 }}>Parâmetros</h1>
      <p style={{ fontSize:13,color:TEXTMU,marginBottom:20 }}>Configure o app do seu jeito</p>
      <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
        {[
          {s:'cartoes',Icon:CreditCard,label:'Cartões e Contas',desc:'Limites, fechamento, vencimento, cores'},
          {s:'limites',Icon:Target,label:'Limites por categoria',desc:'Quanto quer gastar em cada área'},
          {s:'poupanca',Icon:PiggyBank,label:'Meta de poupança',desc:'% da renda a guardar por mês'},
          {s:'categorias',Icon:Tag,label:'Categorias',desc:'Gerenciar categorias e subcategorias'},
        ].map(item=>(
          <button key={item.s} onClick={()=>item.s==='cartoes'?setSec('cartoes'):toast.info('Em breve!')}
            style={{ background:SEBBLE,borderRadius:28,padding:'16px 20px',display:'flex',alignItems:'center',gap:14,textAlign:'left',cursor:'pointer',boxShadow:'0 4px 12px rgba(61,44,32,0.15),inset 0 1px 0 rgba(255,255,255,0.25)',border:'none',width:'100%' }}>
            <div style={{ width:44,height:44,background:'rgba(61,44,32,0.1)',borderRadius:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <item.Icon size={20} color={TERRA}/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15,fontWeight:600,color:TEXT }}>{item.label}</p>
              <p style={{ fontSize:12,color:TEXTMU,marginTop:2 }}>{item.desc}</p>
            </div>
            <ChevronRight size={18} color={TEXTMU}/>
          </button>
        ))}
      </div>
      <div style={{ marginTop:20,background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'12px 16px',display:'flex',alignItems:'center',gap:10 }}>
        <span style={{ fontSize:16 }}>🔄</span>
        <p style={{ fontSize:13,color:TEXTMU,fontWeight:500 }}>Sincronização: Automática</p>
      </div>
    </div>
  )
}
