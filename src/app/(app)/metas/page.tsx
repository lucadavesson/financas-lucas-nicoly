'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const BG     = '#F5F5F7'
const PEBBLE = '#FFFFFF'
const TEXT   = '#1C1C1E'
const TEXTLT = '#48484A'
const TEXTMU = '#8E8E93'
const TERRA  = '#C4622D'
const CREAM  = '#FFFFFF'

const ICONS_MAP:Record<string,string>={diamond:'💍',plane:'✈️',home:'🏠',shield:'🛡️',star:'⭐',target:'🎯',car:'🚗',ring:'💍',piggy:'🐷',book:'📚'}
const GOAL_COLORS=['#1D9E75','#7F77DD','#378ADD','#C8963C','#E24B4A','#C4622D','#0F6E56','#9B59B6']

export default function Metas() {
  const [goals,   setGoals]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [show,    setShow]    = useState(false)
  const [editId,  setEditId]  = useState<string|null>(null)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75'})

  useEffect(()=>{ load() },[])

  async function load() {
    const {data} = await createClient().from('goals').select('*').eq('status','ativa').order('created_at',{ascending:true})
    setGoals(data||[])
    setLoading(false)
  }
  function sf(k:string,v:string){setForm(f=>({...f,[k]:v}))}

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const t=parseFloat(form.target_amount)
    if(!form.name||isNaN(t)||t<=0){toast.error('Preencha nome e valor');return}
    setSaving(true)
    const s=createClient()
    const {data:{user}}=await s.auth.getUser()
    if(!user){return}
    const payload={name:form.name,holder:form.holder,target_amount:t,current_amount:parseFloat(form.current_amount||'0'),monthly_target:form.monthly_target?parseFloat(form.monthly_target):null,deadline:form.deadline?form.deadline+'-01':null,icon:form.icon,color:form.color,status:'ativa'}
    const {error}=editId?await s.from('goals').update(payload).eq('id',editId):await s.from('goals').insert({...payload,owner_id:user.id})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editId?'Atualizada!':'Meta criada!')
    setShow(false);setEditId(null)
    setForm({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75'})
    load();setSaving(false)
  }

  const inp = {width:'100%',height:46,background:'rgba(0,0,0,0.03)',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:22,padding:'0 16px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box' as const}
  const seg = (on:boolean,col?:string)=>({flex:1,height:38,borderRadius:19,border:'none',background:on?(col||TERRA):'rgba(0,0,0,0.03)',color:on?CREAM:TEXTLT,fontSize:13,fontWeight:on?700:400 as any,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'})

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:'0 0 2px'}}>Metas</h1>
          <p style={{fontSize:12,color:TEXTMU,margin:0}}>{goals.length} ativa{goals.length!==1?'s':''}</p>
        </div>
        <button onClick={()=>{setForm({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75'});setEditId(null);setShow(true)}}
          style={{width:40,height:40,background:TERRA,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer',boxShadow:'0 4px 14px rgba(196,98,45,0.4)'}}>
          <Plus size={20} color={CREAM}/>
        </button>
      </div>

      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}>
          <div style={{width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        </div>
      ) : goals.length===0 ? (
        <div style={{textAlign:'center',padding:'64px 0'}}>
          <p style={{fontSize:40,margin:'0 0 12px'}}>🎯</p>
          <p style={{fontSize:15,fontWeight:600,color:TEXTLT,margin:'0 0 6px'}}>Nenhuma meta ainda</p>
          <p style={{fontSize:12,color:TEXTMU,margin:'0 0 20px'}}>Crie sua primeira meta financeira</p>
          <button onClick={()=>setShow(true)} style={{background:TERRA,color:CREAM,border:'none',borderRadius:24,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {goals.map(g=>{
            const pct=g.target_amount>0?Math.min(100,g.current_amount/g.target_amount*100):0
            const rem=g.target_amount-g.current_amount
            const proj=g.monthly_target&&g.monthly_target>0&&rem>0?`~${Math.ceil(rem/g.monthly_target)} meses no ritmo atual`:rem<=0?'🎉 Meta atingida!':''
            return(
              <div key={g.id} style={{background:PEBBLE,borderRadius:24,padding:'16px 18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <div style={{width:42,height:42,borderRadius:14,background:`${g.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{ICONS_MAP[g.icon]||'🎯'}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:14,fontWeight:700,color:TEXT,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.name}</p>
                    <p style={{fontSize:11,color:TEXTMU,margin:0}}>{g.holder}</p>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <p style={{fontSize:14,fontWeight:800,margin:0,color:g.color,fontVariantNumeric:'tabular-nums'}}>{pct.toFixed(0)}%</p>
                    <button onClick={()=>{setForm({name:g.name,holder:g.holder,target_amount:g.target_amount.toString(),current_amount:g.current_amount.toString(),monthly_target:g.monthly_target?.toString()||'',deadline:g.deadline?.slice(0,7)||'',icon:g.icon||'target',color:g.color||'#1D9E75'});setEditId(g.id);setShow(true)}}
                      style={{width:30,height:30,background:'rgba(0,0,0,0.03)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Pencil size={13} color={TEXTMU}/>
                    </button>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div style={{height:8,background:'rgba(0,0,0,0.03)',borderRadius:99,overflow:'hidden',marginBottom:8}}>
                  <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:g.color,transition:'width 0.5s ease'}}/>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:TEXTMU,marginBottom:proj?8:0}}>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>{formatCurrency(g.current_amount)} acumulado</span>
                  <span style={{fontVariantNumeric:'tabular-nums'}}>Meta: {formatCurrency(g.target_amount)}</span>
                </div>

                {proj&&(
                  <div style={{background:`${g.color}18`,borderRadius:14,padding:'7px 12px',border:`0.5px solid ${g.color}30`}}>
                    <p style={{fontSize:11,fontWeight:600,color:g.color,margin:0}}>{proj}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom sheet form */}
      {show&&(
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setShow(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#FFFFFF',borderRadius:'28px 28px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 -8px 40px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 20px 12px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:0}}>{editId?'Editar meta':'Nova meta'}</h3>
              <button onClick={()=>setShow(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color={TEXTMU}/></button>
            </div>
            <div style={{overflowY:'auto',overscrollBehavior:'none',flex:1}}>
              <form onSubmit={save} style={{padding:'16px 20px 60px',display:'flex',flexDirection:'column',gap:14}}>

                {/* Tipo */}
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>Tipo</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[{v:'target',l:'🎯 Meta'},{v:'diamond',l:'💍 Casamento'},{v:'plane',l:'✈️ Viagem'},{v:'home',l:'🏠 Casa'},{v:'shield',l:'🛡️ Reserva'},{v:'car',l:'🚗 Veículo'}].map(i=>(
                      <button key={i.v} type="button" onClick={()=>sf('icon',i.v)}
                        style={{height:40,borderRadius:14,fontSize:12,fontWeight:500,cursor:'pointer',border:'none',
                          background:form.icon===i.v?`${TERRA}30`:'rgba(0,0,0,0.03)',
                          color:form.icon===i.v?TERRA:TEXTLT,
                          outline:form.icon===i.v?`1px solid ${TERRA}40`:'none'
                        }}>{i.l}</button>
                    ))}
                  </div>
                </div>

                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Nome *</label><input type="text" value={form.name} onChange={e=>sf('name',e.target.value)} required placeholder="Ex: Viagem para Europa" style={inp}/></div>

                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>De quem</label><div style={{display:'flex',gap:8}}>{['Casal','Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>)}</div></div>

                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Valor da meta (R$) *</label><input type="number" inputMode="decimal" value={form.target_amount} onChange={e=>sf('target_amount',e.target.value)} required placeholder="0.00" style={inp} step="0.01" min="0.01"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Já acumulado (R$)</label><input type="number" inputMode="decimal" value={form.current_amount} onChange={e=>sf('current_amount',e.target.value)} placeholder="0.00" style={inp} step="0.01" min="0"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Aporte mensal (R$)</label><input type="number" inputMode="decimal" value={form.monthly_target} onChange={e=>sf('monthly_target',e.target.value)} placeholder="Para calcular projeção" style={inp} step="0.01" min="0"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Prazo</label><input type="month" value={form.deadline} onChange={e=>sf('deadline',e.target.value)} style={inp}/></div>

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:TEXTMU,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>Cor</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {GOAL_COLORS.map(c=>(
                      <button key={c} type="button" onClick={()=>sf('color',c)}
                        style={{width:32,height:32,borderRadius:'50%',background:c,border:form.color===c?`3px solid #F4EFE8`:'2px solid transparent',cursor:'pointer',flexShrink:0,boxShadow:form.color===c?`0 0 0 2px ${c}`:undefined}}/>
                    ))}
                  </div>
                </div>

                <div style={{display:'flex',gap:8,paddingTop:4}}>
                  {editId&&(
                    <button type="button" onClick={async()=>{await createClient().from('goals').update({status:'cancelada'}).eq('id',editId);toast.success('Removida');setShow(false);load()}}
                      style={{height:50,padding:'0 18px',background:'rgba(196,98,45,0.15)',color:TERRA,fontWeight:600,fontSize:13,borderRadius:24,border:'none',cursor:'pointer'}}>
                      Apagar
                    </button>
                  )}
                  <button type="submit" disabled={saving}
                    style={{flex:1,height:50,background:TERRA,color:CREAM,borderRadius:24,border:'none',fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 16px rgba(196,98,45,0.35)'}}>
                    {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:editId?'Salvar':'Criar meta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
