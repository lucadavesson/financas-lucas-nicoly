'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Metas() {
  const [goals, setGoals]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [show, setShow]         = useState(false)
  const [editId, setEditId]     = useState<string|null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75',category_link:''})

  useEffect(()=>{load()},[])

  async function load() {
    const {data} = await createClient().from('goals').select('*').eq('status','ativa').order('created_at',{ascending:true})
    setGoals(data||[]); setLoading(false)
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
    const payload={name:form.name,holder:form.holder,target_amount:t,current_amount:parseFloat(form.current_amount||'0'),monthly_target:form.monthly_target?parseFloat(form.monthly_target):null,deadline:form.deadline?form.deadline+'-01':null,icon:form.icon,color:form.color,category_link:form.category_link||null,status:'ativa'}
    const {error}=editId?await s.from('goals').update(payload).eq('id',editId):await s.from('goals').insert({...payload,owner_id:user.id})
    if(error){console.error(error);toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editId?'Atualizada!':'Meta criada!')
    setShow(false);setEditId(null);setForm({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75',category_link:''})
    load();setSaving(false)
  }

  const ICONS_MAP:Record<string,string>={diamond:'💍',plane:'✈️',home:'🏠',shield:'🛡️',star:'⭐',target:'🎯',car:'🚗',ring:'💍'}
  const COLORS=['#1D9E75','#7F77DD','#378ADD','#BA7517','#E24B4A']

  return (
    <div className="px-4 py-4 animate-in">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-lg font-semibold text-gray-900">Metas & Projetos</h1><p className="text-xs text-gray-400">{goals.length} ativas</p></div>
        <button onClick={()=>{setForm({name:'',holder:'Casal',target_amount:'',current_amount:'0',monthly_target:'',deadline:'',icon:'target',color:'#1D9E75',category_link:''});setEditId(null);setShow(true)}} className="w-9 h-9 bg-brand-400 rounded-xl flex items-center justify-center"><Plus size={20} color="#fff"/></button>
      </div>

      {loading?<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>
      :goals.length===0?<div className="text-center py-16"><p className="text-3xl mb-3">🎯</p><p className="text-sm text-gray-400 mb-4">Nenhuma meta ainda</p><button onClick={()=>setShow(true)} className="btn-primary max-w-xs mx-auto">Criar primeira meta</button></div>
      :<div className="space-y-3">
        {goals.map(g=>{
          const pct=g.target_amount>0?Math.min(100,g.current_amount/g.target_amount*100):0
          const rem=g.target_amount-g.current_amount
          const proj=g.monthly_target&&g.monthly_target>0&&rem>0?`~${Math.ceil(rem/g.monthly_target)} meses`:rem<=0?'🎉 Meta atingida!':''
          return(
            <div key={g.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div style={{width:38,height:38,borderRadius:12,background:`${g.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{ICONS_MAP[g.icon]||'🎯'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.holder}</p>
                </div>
                <button onClick={()=>{setForm({name:g.name,holder:g.holder,target_amount:g.target_amount.toString(),current_amount:g.current_amount.toString(),monthly_target:g.monthly_target?.toString()||'',deadline:g.deadline?.slice(0,7)||'',icon:g.icon||'target',color:g.color||'#1D9E75',category_link:g.category_link||''});setEditId(g.id);setShow(true)}} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil size={14} color="#8E8E93"/></button>
                <p className="text-sm font-bold tabular-nums" style={{color:g.color}}>{pct.toFixed(0)}%</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2"><div className="h-full rounded-full" style={{width:`${pct}%`,background:g.color}}/></div>
              <div className="flex justify-between text-xs text-gray-400"><span>{formatCurrency(g.current_amount)}</span><span>Meta {formatCurrency(g.target_amount)}</span></div>
              {proj&&<p className="mt-2 px-3 py-1.5 rounded-xl text-xs font-medium" style={{background:`${g.color}15`,color:g.color}}>{proj}</p>}
            </div>
          )
        })}
      </div>}

      {show&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end'}} onClick={()=>setShow(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.3)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#fff',borderRadius:'20px 20px 0 0',maxHeight:'92vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 20px 12px',borderBottom:'0.5px solid #F2F2F7',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h2 style={{fontSize:15,fontWeight:600}}>{editId?'Editar meta':'Nova meta'}</h2>
              <button onClick={()=>setShow(false)}><X size={20} color="#8E8E93"/></button>
            </div>
            <div style={{overflowY:'auto',overscrollBehavior:'none',flex:1}}>
              <form onSubmit={save} style={{padding:'16px 20px 48px',display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{v:'target',l:'🎯 Meta'},{v:'diamond',l:'💍 Casamento'},{v:'plane',l:'✈️ Viagem'},{v:'home',l:'🏠 Casa'},{v:'shield',l:'🛡️ Reserva'},{v:'car',l:'🚗 Veículo'}].map(i=>(
                      <button key={i.v} type="button" onClick={()=>sf('icon',i.v)} className={`h-10 rounded-xl text-xs font-medium border transition-all ${form.icon===i.v?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>{i.l}</button>
                    ))}
                  </div>
                </div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nome *</label><input type="text" value={form.name} onChange={e=>sf('name',e.target.value)} required className="input-base"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">De quem</label><div className="grid grid-cols-3 gap-2">{['Casal','Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} className={`h-10 rounded-xl text-sm font-medium border transition-all ${form.holder===p?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>{p}</button>)}</div></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor da meta (R$) *</label><input type="number" inputMode="decimal" value={form.target_amount} onChange={e=>sf('target_amount',e.target.value)} required className="input-base" step="0.01" min="0.01"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Já acumulado (R$)</label><input type="number" inputMode="decimal" value={form.current_amount} onChange={e=>sf('current_amount',e.target.value)} className="input-base" step="0.01" min="0"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aporte mensal (R$)</label><input type="number" inputMode="decimal" value={form.monthly_target} onChange={e=>sf('monthly_target',e.target.value)} placeholder="Para calcular projeção" className="input-base" step="0.01" min="0"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prazo</label><input type="month" value={form.deadline} onChange={e=>sf('deadline',e.target.value)} className="input-base"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cor</label><div className="flex gap-3">{COLORS.map(c=><button key={c} type="button" onClick={()=>sf('color',c)} style={{width:32,height:32,borderRadius:'50%',background:c,border:form.color===c?`3px solid ${c}`:'3px solid transparent',outline:form.color===c?'2px solid #fff':'none',boxShadow:form.color===c?`0 0 0 2px ${c}`:'none'}}/>)}</div></div>
                <div className="flex gap-2 pt-2">
                  {editId&&<button type="button" onClick={async()=>{await createClient().from('goals').update({status:'cancelada'}).eq('id',editId);toast.success('Removida');setShow(false);load()}} className="h-12 px-4 bg-red-50 text-red-500 font-medium rounded-2xl text-sm">Apagar</button>}
                  <button type="submit" disabled={saving} className="btn-primary flex-1">{saving?<><Loader2 size={18} className="animate-spin"/>Salvando...</>:editId?'Salvar':'Criar meta'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
