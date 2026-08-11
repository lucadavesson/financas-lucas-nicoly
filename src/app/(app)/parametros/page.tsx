'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CreditCard, Target, PiggyBank, Tag, ChevronRight, ChevronLeft, Plus, Pencil, X, Loader2, Shield, LogOut, Calendar, RefreshCw, Download, Trash2, Users, DollarSign, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, CATS_DESPESA, SUBCATS, CAT_ICONS, maskCurrency, unmaskCurrency } from '@/lib/utils'

const BG='#F5F5F7', CARD='#FFFFFF', TEXT='#1C1C1E', TEXTLT='#48484A', TEXTMU='#8E8E93'
const TERRA='#C4622D', GREEN='#34C759', RED='#FF3B30', ACCENT='#007AFF'

const CARD_COLORS = [
  {name:'Nubank',hex:'#6B3FA0'},{name:'Roxo',hex:'#8B5CF6'},{name:'Santander',hex:'#CC0000'},
  {name:'Vermelho',hex:'#E24B4A'},{name:'BB',hex:'#1B4E9B'},{name:'Azul',hex:'#3B82F6'},
  {name:'Caixa',hex:'#006B3F'},{name:'Verde',hex:'#10B981'},{name:'Preto',hex:'#1C1C1E'},
  {name:'Grafite',hex:'#374151'},{name:'Dourado',hex:'#B8860B'},{name:'Bronze',hex:'#8B5E3C'},
  {name:'Laranja',hex:'#EA580C'},{name:'Rosa',hex:'#DB2777'},
]

function fmtM(raw:string):string{const n=raw.replace(/\D/g,'');if(!n)return '';return (parseInt(n)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function parsM(s:string):number{return parseFloat(s.replace(/[R$\s.]/g,'').replace(',','.'))||0}

type Section = 'main'|'cartoes'|'limites'|'salario'|'recorrentes'|'seguranca'|'categorias'|'dados'|'titulares'

export default function Parametros() {
  const router = useRouter()
  const [sec,setSec]=useState<Section>('main')
  // Cartões
  const [cards,setCards]=useState<any[]>([])
  const [showC,setShowC]=useState(false)
  const [editC,setEditC]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [prevColor,setPrevColor]=useState('#6B3FA0')
  const [form,setForm]=useState({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'})
  // Limites
  const [limits, setLimits] = useState<Record<string,number>>({})
  const [limitsLoading, setLimitsLoading] = useState(false)
  // Salário
  const [salaryDay, setSalaryDay] = useState('1')
  const [salaryAmountL, setSalaryAmountL] = useState('')
  const [salaryAmountN, setSalaryAmountN] = useState('')
  // Recorrentes
  const [recurrents, setRecurrents] = useState<any[]>([])
  // Segurança
  const [faceIdEnabled, setFaceIdEnabled] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(()=>{
    if(sec==='cartoes') loadCards()
    if(sec==='limites') loadLimits()
    if(sec==='salario') loadSalary()
    if(sec==='recorrentes') loadRecurrents()
    if(sec==='seguranca') loadSecurity()
  },[sec])

  // ── Cartões ──
  async function loadCards(){const {data}=await createClient().from('cards').select('*').order('holder').order('name');setCards(data||[])}
  function sf(k:string,v:string){setForm(f=>({...f,[k]:v}))}
  function openNew(){setForm({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'});setPrevColor('#6B3FA0');setEditC(null);setShowC(true)}
  function openEdit(c:any){setForm({name:c.name,bank:c.bank,holder:c.holder,card_type:c.card_type,closing_day:c.closing_day?.toString()||'',due_day:c.due_day?.toString()||'',limitRaw:c.credit_limit?c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'',alertRaw:c.alert_pct?c.alert_pct+'%':'80%',color:c.color||'#6B3FA0'});setPrevColor(c.color||'#6B3FA0');setEditC(c);setShowC(true)}
  async function saveCard(e:React.FormEvent){
    e.preventDefault()
    if(!form.name||!form.bank){toast.error('Preencha nome e banco');return}
    setSaving(true)
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    const p={name:form.name,bank:form.bank,holder:form.holder,card_type:form.card_type,closing_day:parseInt(form.closing_day)||1,due_day:parseInt(form.due_day)||1,credit_limit:parsM(form.limitRaw),alert_pct:parseInt(form.alertRaw.replace('%',''))||80,color:form.color,is_active:true}
    const {error}=editC?await s.from('cards').update(p).eq('id',editC.id):await s.from('cards').insert({...p,owner_id:user.id})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editC?'Cartão atualizado!':'Cartão adicionado!');setShowC(false);loadCards();setSaving(false)
  }

  // ── Limites ──
  async function loadLimits(){
    setLimitsLoading(true)
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(!user){setLimitsLoading(false);return}
    const {data}=await s.from('category_limits').select('*').eq('owner_id',user.id)
    const map:Record<string,number>={}
    data?.forEach((r:any)=>{map[r.category]=r.limit_amount})
    setLimits(map);setLimitsLoading(false)
  }
  async function saveLimit(cat:string, val:string){
    const amount=unmaskCurrency(val)
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    if(amount<=0){
      await s.from('category_limits').delete().eq('owner_id',user.id).eq('category',cat)
      setLimits(p=>{const n={...p};delete n[cat];return n})
      return
    }
    const {data:existing}=await s.from('category_limits').select('id').eq('owner_id',user.id).eq('category',cat).single()
    if(existing){
      await s.from('category_limits').update({limit_amount:amount}).eq('id',existing.id)
    }else{
      await s.from('category_limits').insert({owner_id:user.id,category:cat,limit_amount:amount})
    }
    setLimits(p=>({...p,[cat]:amount}))
    toast.success(`Limite de ${cat} salvo!`)
  }

  // ── Salário ──
  async function loadSalary(){
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    const {data}=await s.from('app_settings').select('*').eq('owner_id',user.id).single()
    if(data){
      setSalaryDay(data.salary_day?.toString()||'1')
      setSalaryAmountL(data.salary_lucas?maskCurrency(Math.round(data.salary_lucas*100).toString()):'')
      setSalaryAmountN(data.salary_nicoly?maskCurrency(Math.round(data.salary_nicoly*100).toString()):'')
    }
  }
  async function saveSalary(){
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    const payload={salary_day:parseInt(salaryDay)||1,salary_lucas:unmaskCurrency(salaryAmountL),salary_nicoly:unmaskCurrency(salaryAmountN)}
    const {data:existing}=await s.from('app_settings').select('id').eq('owner_id',user.id).single()
    if(existing){await s.from('app_settings').update(payload).eq('id',existing.id)}
    else{await s.from('app_settings').insert({...payload,owner_id:user.id})}
    toast.success('Configuração salarial salva!')
  }

  // ── Recorrentes ──
  async function loadRecurrents(){
    const {data}=await createClient().from('transactions').select('*').eq('is_recurring',true).order('description')
    setRecurrents(data||[])
  }

  // ── Segurança ──
  async function loadSecurity(){
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(user){
      setUserId(user.id);setUserEmail(user.email||'')
      setFaceIdEnabled(localStorage.getItem(`ln_faceid_${user.id}`)==='1')
    }
  }
  async function toggleFaceId(){
    if(faceIdEnabled){
      localStorage.removeItem(`ln_faceid_${userId}`)
      localStorage.removeItem('ln_saved_pw')
      setFaceIdEnabled(false)
      toast.success('Face ID desativado')
    }else{
      try{
        const challenge=crypto.getRandomValues(new Uint8Array(32))
        const uid8=new TextEncoder().encode(userId.slice(0,16))
        await navigator.credentials.create({
          publicKey:{
            challenge,rp:{name:'Finanças L&N',id:window.location.hostname},
            user:{id:uid8,name:userEmail,displayName:userEmail.split('@')[0]},
            pubKeyCredParams:[{alg:-7,type:'public-key'},{alg:-257,type:'public-key'}],
            authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',requireResidentKey:true},
            timeout:30000,
          }
        })
        localStorage.setItem(`ln_faceid_${userId}`,'1')
        setFaceIdEnabled(true)
        toast.success('Face ID ativado! 🔒')
      }catch{toast.error('Não foi possível configurar o Face ID')}
    }
  }
  async function handleLogout(){
    await createClient().auth.signOut()
    localStorage.removeItem('ln_last_email')
    sessionStorage.clear()
    router.push('/login')
  }

  // ── Styles ──
  const sCard={background:CARD,borderRadius:20,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}
  const sLbl={fontSize:11,fontWeight:600 as const,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase' as const,letterSpacing:'0.05em'}
  const sInp={width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'0 14px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box' as const}
  const sBtn=(bg:string,color:string)=>({width:'100%',height:48,background:bg,color,borderRadius:14,border:'none',fontSize:15,fontWeight:600 as const,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8})
  const seg=(on:boolean)=>({flex:1,height:38,borderRadius:12,border:'none',background:on?TERRA:'rgba(0,0,0,0.03)',color:on?'#fff':TEXT,fontSize:13,fontWeight:on?600:400 as any,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'})
  const backBtn=()=><button onClick={()=>setSec('main')} style={{background:'rgba(0,0,0,0.03)',border:'none',borderRadius:12,padding:'8px 14px',cursor:'pointer',fontSize:13,color:TEXT,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><ChevronLeft size={16}/>Voltar</button>

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CARTÕES
  // ────────────────────────────────────────────────────────────
  if(sec==='cartoes') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Cartões e Contas</h2>
        <button onClick={openNew} style={{width:34,height:34,background:TERRA,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}><Plus size={18} color="#fff"/></button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {cards.map(c=>(
          <div key={c.id} style={{...sCard,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,opacity:c.is_active?1:0.5}}>
            <div style={{width:38,height:38,borderRadius:12,background:c.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{c.name} — {c.holder}</p>
              <p style={{fontSize:10,color:TEXTMU,margin:'2px 0 0'}}>Fecha {c.closing_day} · Vence {c.due_day} · {formatCurrency(c.credit_limit)}</p>
            </div>
            <button onClick={()=>openEdit(c)} style={{padding:'6px 8px',background:'rgba(0,0,0,0.03)',borderRadius:10,border:'none',cursor:'pointer'}}><Pencil size={13} color={TEXTMU}/></button>
            <button onClick={async()=>{await createClient().from('cards').update({is_active:!c.is_active}).eq('id',c.id);toast.success(c.is_active?'Arquivado':'Ativado');loadCards()}}
              style={{padding:'4px 10px',background:c.is_active?'rgba(196,98,45,0.1)':'rgba(52,199,89,0.1)',borderRadius:10,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,color:c.is_active?TERRA:GREEN}}>
              {c.is_active?'Arquivar':'Ativar'}
            </button>
          </div>
        ))}
        {cards.length===0&&<p style={{fontSize:13,color:TEXTMU,textAlign:'center',padding:20}}>Nenhum cartão cadastrado</p>}
      </div>
      {showC&&(
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setShowC(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:CARD,borderRadius:'28px 28px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 20px 12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:0}}>{editC?'Editar cartão':'Novo cartão'}</h3>
              <button onClick={()=>setShowC(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color={TEXTMU}/></button>
            </div>
            <div style={{overflowY:'auto',overscrollBehavior:'none',flex:1}}>
              <form onSubmit={saveCard} style={{padding:'16px 20px 40px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{borderRadius:20,padding:16,background:prevColor,position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',right:-10,top:-10,width:70,height:70,borderRadius:'50%',background:'rgba(255,255,255,0.1)'}}/>
                  <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',margin:'0 0 3px'}}>{form.bank||'Banco'}</p>
                  <p style={{fontSize:15,fontWeight:600,color:'#fff',margin:0}}>{form.holder}</p>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginTop:14}}>
                    <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{form.name||'Nome do cartão'}</p>
                    <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',margin:0}}>Fecha {form.closing_day||'?'}</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={sLbl}>Nome *</label><input value={form.name} onChange={e=>sf('name',e.target.value)} placeholder="Ex: Nubank" required style={sInp}/></div>
                  <div><label style={sLbl}>Banco *</label><input value={form.bank} onChange={e=>sf('bank',e.target.value)} placeholder="Ex: Nubank" required style={sInp}/></div>
                </div>
                <div><label style={sLbl}>Titular</label><div style={{display:'flex',gap:8}}>{['Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>)}</div></div>
                <div><label style={sLbl}>Tipo</label><div style={{display:'flex',gap:8}}>{[{v:'credito',l:'Crédito'},{v:'debito',l:'Débito'},{v:'conta',l:'Conta'}].map(t=><button key={t.v} type="button" onClick={()=>sf('card_type',t.v)} style={seg(form.card_type===t.v)}>{t.l}</button>)}</div></div>
                {form.card_type==='credito'&&<>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={sLbl}>Dia fechamento</label><input type="number" value={form.closing_day} onChange={e=>sf('closing_day',e.target.value)} placeholder="Ex: 2" style={sInp} min="1" max="31"/></div>
                    <div><label style={sLbl}>Dia vencimento</label><input type="number" value={form.due_day} onChange={e=>sf('due_day',e.target.value)} placeholder="Ex: 9" style={sInp} min="1" max="31"/></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={sLbl}>Limite (R$)</label><input type="text" inputMode="numeric" value={form.limitRaw} onChange={e=>sf('limitRaw',fmtM(e.target.value))} placeholder="R$ 0,00" style={sInp}/></div>
                    <div><label style={sLbl}>Alerta em</label><input type="text" inputMode="numeric" value={form.alertRaw} onChange={e=>{const n=e.target.value.replace(/\D/g,'');sf('alertRaw',n?n+'%':'')}} placeholder="80%" style={sInp}/></div>
                  </div>
                </>}
                <div>
                  <label style={sLbl}>Cor do cartão</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
                    {CARD_COLORS.map(c=>(<button key={c.hex} type="button" onClick={()=>{sf('color',c.hex);setPrevColor(c.hex)}} title={c.name}
                      style={{width:32,height:32,borderRadius:'50%',background:c.hex,border:form.color===c.hex?`3px solid ${TEXT}`:'2px solid transparent',cursor:'pointer',flexShrink:0}}/>))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="color" value={form.color} onChange={e=>{sf('color',e.target.value);setPrevColor(e.target.value)}} style={{width:36,height:36,borderRadius:12,border:'1px solid rgba(0,0,0,0.08)',cursor:'pointer',padding:2}}/>
                    <span style={{fontSize:11,color:TEXTMU}}>Cor personalizada</span>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={sBtn(TERRA,'#fff')}>
                  {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:editC?'Salvar alterações':'Adicionar cartão'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: LIMITES POR CATEGORIA
  // ────────────────────────────────────────────────────────────
  if(sec==='limites') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Limites por Categoria</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Defina quanto quer gastar no máximo em cada categoria. Deixe vazio para sem limite.</p>
      {limitsLoading?<div style={{textAlign:'center',padding:40}}><Loader2 size={24} color={TERRA} style={{animation:'spin 0.8s linear infinite'}}/></div>:
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {CATS_DESPESA.map(cat=>{
          const icon=CAT_ICONS[cat]||'📦'
          const val=limits[cat]
          return (
            <div key={cat} style={{...sCard,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:20}}>{icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{cat}</p>
              </div>
              <div style={{position:'relative',width:120}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:TEXTMU,fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" placeholder="Sem limite"
                  defaultValue={val?maskCurrency(Math.round(val*100).toString()):''}
                  onBlur={e=>saveLimit(cat,e.target.value)}
                  style={{width:'100%',height:36,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:10,padding:'0 10px 0 32px',fontSize:13,fontWeight:600,color:TEXT,outline:'none',boxSizing:'border-box',textAlign:'right'}}/>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CICLO SALARIAL
  // ────────────────────────────────────────────────────────────
  if(sec==='salario') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Ciclo Salarial</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:20,paddingLeft:4}}>Configure o dia do salário e os valores para cada titular.</p>
      <div style={{...sCard,padding:'20px 16px',display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <label style={sLbl}>Dia do salário</label>
          <input type="number" min="1" max="31" value={salaryDay} onChange={e=>setSalaryDay(e.target.value)} style={sInp} placeholder="Ex: 5"/>
        </div>
        <div>
          <label style={sLbl}>Salário do Lucas (R$)</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:TEXTMU,fontWeight:600}}>R$</span>
            <input type="text" inputMode="numeric" value={salaryAmountL}
              onChange={e=>setSalaryAmountL(maskCurrency(e.target.value))}
              style={{...sInp,paddingLeft:40}} placeholder="0,00"/>
          </div>
        </div>
        <div>
          <label style={sLbl}>Salário da Nicoly (R$)</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:TEXTMU,fontWeight:600}}>R$</span>
            <input type="text" inputMode="numeric" value={salaryAmountN}
              onChange={e=>setSalaryAmountN(maskCurrency(e.target.value))}
              style={{...sInp,paddingLeft:40}} placeholder="0,00"/>
          </div>
        </div>
        <button onClick={saveSalary} style={sBtn(TERRA,'#fff')}>Salvar configuração</button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CONTAS RECORRENTES
  // ────────────────────────────────────────────────────────────
  if(sec==='recorrentes') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Contas Recorrentes</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Lançamentos marcados como recorrentes. Eles serão gerados automaticamente todo mês.</p>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {recurrents.map(tx=>(
          <div key={tx.id} style={{...sCard,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18}}>{CAT_ICONS[tx.category]||'📦'}</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{tx.description}</p>
              <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>{tx.holder} · Dia {tx.recurring_day||'?'} · {tx.payment_method}</p>
            </div>
            <p style={{fontSize:14,fontWeight:700,color:RED,margin:0}}>{formatCurrency(tx.expected_amount||tx.amount)}</p>
          </div>
        ))}
        {recurrents.length===0&&<p style={{fontSize:13,color:TEXTMU,textAlign:'center',padding:20}}>Nenhuma conta recorrente cadastrada. Crie um lançamento do tipo "Recorrente".</p>}
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: SEGURANÇA
  // ────────────────────────────────────────────────────────────
  if(sec==='seguranca') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Segurança</h2>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* Face ID */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:22}}>🔒</span>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Face ID / Biometria</p>
                <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Desbloqueio rápido ao abrir o app</p>
              </div>
            </div>
            <button onClick={toggleFaceId} style={{width:52,height:30,borderRadius:15,background:faceIdEnabled?GREEN:'#D1D1D6',border:'none',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
              <div style={{width:26,height:26,borderRadius:13,background:'#fff',position:'absolute',top:2,left:faceIdEnabled?24:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
            </button>
          </div>
        </div>

        {/* Info da conta */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 10px'}}>Conta</p>
          <p style={{fontSize:14,color:TEXT,margin:0}}>{userEmail}</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'4px 0 0'}}>ID: {userId.slice(0,8)}...</p>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{...sCard,padding:'16px 18px',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left'}}>
          <LogOut size={20} color={RED}/>
          <p style={{fontSize:14,fontWeight:600,color:RED,margin:0}}>Sair da conta</p>
        </button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: DADOS
  // ────────────────────────────────────────────────────────────
  if(sec==='dados') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Dados do App</h2>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <button onClick={()=>{localStorage.clear();sessionStorage.clear();toast.success('Cache limpo! Recarregue o app.');setTimeout(()=>window.location.reload(),1000)}}
          style={{...sCard,padding:'16px 18px',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left'}}>
          <RefreshCw size={20} color={ACCENT}/>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Limpar cache local</p>
            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Remove dados salvos no navegador (não apaga seus lançamentos)</p>
          </div>
        </button>
        <button onClick={async()=>{
          const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
          const {data}=await s.from('transactions').select('*').eq('owner_id',user.id).order('purchase_date',{ascending:false})
          if(!data||data.length===0){toast.error('Nenhum lançamento encontrado');return}
          const headers=['Data','Descrição','Categoria','Subcategoria','Valor','Parcela','Status','Método','Cartão','Titular','Tipo','Observações']
          const rows=data.map((t:any)=>[
            t.purchase_date,t.description,t.category,t.subcategory||'',
            (t.installment_value||t.amount)?.toString().replace('.',','),
            t.installment_total?`${t.installment_num||''}/${t.installment_total}`:'',
            t.status,t.payment_method||'',t.card_name||'',t.holder,t.transaction_type,t.notes||''
          ])
          const csv='\uFEFF'+[headers,...rows].map(r=>r.map((c:string)=>`"${(c||'').replace(/"/g,'""')}"`).join(';')).join('\n')
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'})
          const url=URL.createObjectURL(blob)
          const a=document.createElement('a');a.href=url;a.download=`financas-ln-${new Date().toISOString().slice(0,10)}.csv`;a.click()
          URL.revokeObjectURL(url)
          toast.success(`Exportado! ${data.length} lançamentos`)
        }} style={{...sCard,padding:'16px 18px',display:'flex',alignItems:'center',gap:12,border:'none',cursor:'pointer',width:'100%',textAlign:'left'}}>
          <Download size={20} color={ACCENT}/>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Exportar dados (CSV)</p>
            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Baixar todos os lançamentos em formato CSV (Excel)</p>
          </div>
        </button>
        <div style={{...sCard,padding:'16px 18px'}}>
          <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 8px'}}>Versão</p>
          <p style={{fontSize:14,color:TEXT,margin:0}}>Finanças L&N v1.0</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Desenvolvido por Lucas & Claude</p>
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // TELA PRINCIPAL: MENU DE CONFIGURAÇÕES
  // ────────────────────────────────────────────────────────────
  const MenuItem = ({icon,label,desc,section,color}:{icon:React.ReactNode,label:string,desc:string,section:Section,color?:string}) => (
    <button onClick={()=>setSec(section)}
      style={{...sCard,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,textAlign:'left',cursor:'pointer',border:'none',width:'100%'}}>
      <div style={{width:42,height:42,background:'rgba(0,0,0,0.03)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>{label}</p>
        <p style={{fontSize:11,color:TEXTMU,margin:'3px 0 0'}}>{desc}</p>
      </div>
      <ChevronRight size={18} color={TEXTMU}/>
    </button>
  )

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <h1 style={{fontSize:24,fontWeight:700,color:TEXT,marginBottom:2}}>Configurações</h1>
      <p style={{fontSize:13,color:TEXTMU,marginBottom:20}}>Personalize o app do seu jeito</p>

      {/* Financeiro */}
      <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,paddingLeft:4}}>Financeiro</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
        <MenuItem icon={<CreditCard size={20} color={TERRA}/>} label="Cartões e Contas" desc="Gerenciar cartões, limites e vencimentos" section="cartoes"/>
        <MenuItem icon={<Target size={20} color={TERRA}/>} label="Limites por Categoria" desc="Definir teto de gastos por categoria" section="limites"/>
        <MenuItem icon={<Calendar size={20} color={TERRA}/>} label="Ciclo Salarial" desc="Dia do pagamento e valores de cada titular" section="salario"/>
        <MenuItem icon={<RefreshCw size={20} color={TERRA}/>} label="Contas Recorrentes" desc="Ver e gerenciar contas que repetem todo mês" section="recorrentes"/>
      </div>

      {/* Segurança e Conta */}
      <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,paddingLeft:4}}>Segurança e Conta</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
        <MenuItem icon={<Shield size={20} color={ACCENT}/>} label="Segurança" desc="Face ID, biometria e logout" section="seguranca"/>
        <MenuItem icon={<Download size={20} color={ACCENT}/>} label="Dados do App" desc="Cache, exportar dados e versão" section="dados"/>
      </div>

      <div style={{textAlign:'center',paddingTop:8}}>
        <p style={{fontSize:11,color:TEXTMU}}>Finanças L&N · Agosto 2026</p>
      </div>
    </div>
  )
}
