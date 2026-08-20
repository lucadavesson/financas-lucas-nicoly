'use client'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATS_DESPESA, CATS_RECEITA, SUBCATS, maskCurrency, unmaskCurrency, formatCurrency } from '@/lib/utils'
import { ChevronLeft, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

const BG='#F5F5F7',TEXT='#1C1C1E',TEXTMU='#8E8E93',TERRA='#C4622D',GREEN='#34C759'

const inp:React.CSSProperties={width:'100%',height:48,background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:14,padding:'0 16px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box'}
const lbl:React.CSSProperties={fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}
const seg=(on:boolean):React.CSSProperties=>({flex:1,height:40,borderRadius:12,border:'none',background:on?TERRA:'rgba(0,0,0,0.03)',color:on?'#fff':TEXT,fontSize:13,fontWeight:on?600:400,cursor:'pointer'})

const METHODS=[{v:'cartao_credito',l:'Crédito (fatura)'},{v:'debito',l:'Débito'},{v:'pix',l:'PIX'},{v:'dinheiro',l:'Dinheiro'},{v:'boleto',l:'Boleto'}]

export default function EditarLancamento(){
  const router=useRouter()
  const {id}=useParams() as {id:string}
  const [tx,setTx]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState<any>({})
  const [cards,setCards]=useState<any[]>([])
  const [valRaw,setValRaw]=useState('')
  const [instValRaw,setInstValRaw]=useState('')
  const [paidAmountRaw,setPaidAmountRaw]=useState('')

  useEffect(()=>{
    load()
    // Scroll to top - funciona dentro do main com overflow
    setTimeout(()=>{
      const main=document.querySelector('main')
      if(main)main.scrollTop=0
      window.scrollTo(0,0)
    },100)
  },[id])

  async function load(){
    const s=createClient()
    const [{data},{data:cardsData}]=await Promise.all([
      s.from('transactions').select('*').eq('id',id).single(),
      s.from('cards').select('*').eq('is_active',true).order('holder').order('name'),
    ])
    if(data){
      setTx(data);setForm(data);setValRaw(maskCurrency(Math.round((data.amount||0)*100).toString()))
      if(data.installment_value){setInstValRaw(maskCurrency(Math.round(data.installment_value*100).toString()))}
      if(data.paid_amount){setPaidAmountRaw(maskCurrency(Math.round(data.paid_amount*100).toString()))}
    }
    setCards(cardsData||[])
    setLoading(false)
  }

  function sf(k:string,v:any){setForm((f:any)=>({...f,[k]:v}))}

  async function save(e:React.FormEvent){
    e.preventDefault()
    setSaving(true)
    const amount=unmaskCurrency(valRaw)||parseFloat(form.amount)||0
    const {error}=await createClient().from('transactions').update({
      holder:form.holder,
      owner_name:(form.holder==='Prata'?'Lucas':form.holder)||'Lucas',
      transaction_type:form.transaction_type,
      type:form.type||(form.transaction_type==='receita'?'Receita':'Despesa'),
      description:form.description,
      amount,
      category:form.category,
      subcategory:form.subcategory||null,
      purchase_date:form.purchase_date,
      payment_method:form.payment_method||null,
      card_name:form.card_name||null,
      status:form.payment_method==='cartao_credito'?'Pendente':form.status,
      notes:form.notes||null,
      paid_amount:paidAmountRaw?unmaskCurrency(paidAmountRaw):null,
      paid_date:form.paid_date||null,
      installment_value:instValRaw?unmaskCurrency(instValRaw):null,
      installment_total:form.installment_total?parseInt(form.installment_total):null,
      is_recurring:form.transaction_type==='recorrente',
    }).eq('id',id)
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success('Salvo!')
    router.push('/lancamentos')
  }

  async function del(){
    if(!confirm('Apagar este lançamento?'))return
    await createClient().from('transactions').delete().eq('id',id)
    toast.success('Apagado!')
    router.push('/lancamentos')
  }

  if(loading)return(
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center'}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if(!tx)return(
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center'}}>
      <p style={{color:TEXTMU,fontSize:14}}>Lançamento não encontrado</p>
    </div>
  )

  const isReceita=form.transaction_type==='receita'||form.type==='Receita'
  const cats=isReceita?CATS_RECEITA:CATS_DESPESA
  const subs=SUBCATS[form.category]||[]
  const isCredito=form.payment_method==='cartao_credito'

  return(
    <div style={{background:BG,minHeight:'100%'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{position:'sticky',top:0,background:BG,borderBottom:'1px solid rgba(0,0,0,0.04)',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,zIndex:10}}>
        <button onClick={()=>router.back()} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}>
          <ChevronLeft size={22} color={TEXTMU}/>
        </button>
        <h1 style={{fontSize:16,fontWeight:700,color:TEXT,flex:1,margin:0}}>Editar lançamento</h1>
        <button onClick={async()=>{
          const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
          const {id:_,...copy}=tx;delete (copy as any).created_at;delete (copy as any).updated_at
          const {error}=await s.from('transactions').insert({...copy,description:`${copy.description} (cópia)`,purchase_date:format(new Date(),'yyyy-MM-dd')})
          if(error){toast.error(`Erro: ${error.message}`);return}
          toast.success('Lançamento duplicado!')
          router.push('/lancamentos')
        }} style={{width:36,height:36,background:'rgba(0,122,255,0.08)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}} title="Duplicar">
          📋
        </button>
        <button onClick={del} style={{width:36,height:36,background:'rgba(255,59,48,0.08)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Trash2 size={17} color="#FF3B30"/>
        </button>
      </div>

      <div style={{padding:'18px 16px 160px',display:'flex',flexDirection:'column',gap:16}}>

        {/* Tipo do lançamento - editável */}
        <div>
          <label style={lbl}>Tipo do lançamento</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {[{v:'avista',l:'À vista',t:'Despesa'},{v:'parcelada',l:'Parcelada',t:'Despesa'},{v:'recorrente',l:'Recorrente',t:'Despesa'},{v:'receita',l:'Receita',t:'Receita'}].map(tp=>{
              const on=form.transaction_type===tp.v
              return(
                <button key={tp.v} type="button" onClick={()=>{sf('transaction_type',tp.v);sf('type',tp.t)}}
                  style={{height:34,padding:'0 14px',borderRadius:10,border:on?`1px solid ${tp.t==='Receita'?GREEN:TERRA}40`:'1px solid rgba(0,0,0,0.06)',cursor:'pointer',fontSize:12,fontWeight:on?600:400,
                    background:on?`${tp.t==='Receita'?GREEN:TERRA}15`:'#fff',color:on?(tp.t==='Receita'?GREEN:TERRA):TEXTMU}}>
                  {tp.l}
                </button>
              )
            })}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label style={lbl}>Responsável</label>
          <div style={{display:'flex',gap:8}}>
            {['Lucas','Nicoly','Prata'].map(p=>(
              <button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label style={lbl}>Descrição</label>
          <input type="text" value={form.description||''} onChange={e=>sf('description',e.target.value)} required style={inp}/>
        </div>

        {/* Valor */}
        <div>
          <label style={lbl}>Valor (R$)</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:TEXTMU,fontWeight:600}}>R$</span>
            <input type="text" inputMode="numeric" value={valRaw}
              onChange={e=>setValRaw(maskCurrency(e.target.value))}
              required style={{...inp,paddingLeft:40,fontSize:18,fontWeight:700,color:isReceita?GREEN:'#FF3B30'}}/>
          </div>
        </div>

        {/* Data */}
        <div>
          <label style={lbl}>Data da compra</label>
          <input type="date" value={form.purchase_date||''} onChange={e=>sf('purchase_date',e.target.value)} required style={{...inp,WebkitAppearance:'none' as any,maxWidth:'100%'}}/>
        </div>

        {/* Campos de parcelamento (quando tipo=parcelada) */}
        {form.transaction_type==='parcelada'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={lbl}>Nº de parcelas</label>
              <input type="number" value={form.installment_total||form.total_installments||''} onChange={e=>sf('installment_total',parseInt(e.target.value)||null)} style={inp} min="2" max="600"/>
            </div>
            <div>
              <label style={lbl}>Valor da parcela</label>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:TEXTMU,fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" value={instValRaw}
                  onChange={e=>setInstValRaw(maskCurrency(e.target.value))}
                  style={{...inp,paddingLeft:38}} placeholder="Calc. automático"/>
              </div>
            </div>
          </div>
        )}

        {/* Categoria */}
        <div>
          <label style={lbl}>Categoria</label>
          <div style={{position:'relative'}}>
            <select value={form.category||''} onChange={e=>{sf('category',e.target.value);sf('subcategory','')}}
              style={{...inp,appearance:'none' as const}}>
              <option value="">Selecione...</option>
              {cats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
          </div>
        </div>

        {/* Subcategoria */}
        {form.category&&subs.length>0&&(
          <div>
            <label style={lbl}>Subcategoria</label>
            <div style={{position:'relative'}}>
              <select value={form.subcategory||''} onChange={e=>sf('subcategory',e.target.value)}
                style={{...inp,appearance:'none' as const}}>
                <option value="">Selecione...</option>
                {subs.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
          </div>
        )}

        {/* Como pagou */}
        {!isReceita&&(
          <div>
            <label style={lbl}>Como pagou</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {METHODS.map(m=>(
                <button key={m.v} type="button" onClick={()=>sf('payment_method',m.v)}
                  style={{height:36,padding:'0 14px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:form.payment_method===m.v?600:400,
                    background:form.payment_method===m.v?TERRA:'rgba(0,0,0,0.03)',
                    color:form.payment_method===m.v?'#fff':TEXT}}>
                  {m.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cartão de crédito */}
        {isCredito&&cards.length>0&&(
          <div>
            <label style={lbl}>Cartão de crédito</label>
            <div style={{position:'relative'}}>
              <select value={form.card_name||''} onChange={e=>sf('card_name',e.target.value)}
                style={{...inp,appearance:'none' as const}}>
                <option value="">Selecione...</option>
                {cards.filter(c=>!c.card_type||c.card_type==='credito').map(c=>(
                  <option key={c.id} value={`${c.name} — ${c.holder}`}>{c.name} — {c.holder}</option>
                ))}
              </select>
              <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
          </div>
        )}

        {/* Status — só mostra se NÃO for crédito (crédito vai pra fatura automaticamente) */}
        {!isCredito&&(
          <div>
            <label style={lbl}>Status</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {['Previsto','Pendente','Pago','Atrasado','Cancelado'].map(s=>{
                const colors:Record<string,string>={Pago:GREEN,Pendente:TERRA,Previsto:'#B37700',Atrasado:'#FF3B30',Cancelado:TEXTMU}
                const on=form.status===s
                return(
                  <button key={s} type="button" onClick={()=>sf('status',s)}
                    style={{height:36,padding:'0 14px',borderRadius:10,border:on?`1px solid ${colors[s]}40`:'1px solid transparent',cursor:'pointer',fontSize:12,fontWeight:on?600:400,
                      background:on?`${colors[s]}18`:'rgba(0,0,0,0.03)',color:on?colors[s]:TEXTMU}}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {isCredito&&(
          <div style={{background:'rgba(196,98,45,0.06)',borderRadius:12,padding:'10px 14px',border:'1px solid rgba(196,98,45,0.12)'}}>
            <p style={{fontSize:12,color:TERRA,margin:0,fontWeight:600}}>💳 Compra no crédito — entra na fatura automaticamente</p>
          </div>
        )}

        {/* Pagamento confirmação */}
        {form.status==='Pago'&&(
          <div style={{background:'rgba(34,199,89,0.06)',borderRadius:16,padding:'14px 16px',border:'1px solid rgba(34,199,89,0.15)'}}>
            <p style={{fontSize:12,fontWeight:700,color:GREEN,margin:'0 0 12px'}}>Confirmação de pagamento</p>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1}}>
                <label style={{...lbl,color:'#48484A'}}>Valor pago (R$)</label>
                <input type="text" inputMode="numeric" value={paidAmountRaw}
                  onChange={e=>setPaidAmountRaw(maskCurrency(e.target.value))}
                  placeholder="Valor real" style={{...inp,height:42}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{...lbl,color:'#48484A'}}>Data</label>
                <input type="date" value={form.paid_date||''} onChange={e=>sf('paid_date',e.target.value)} style={{...inp,height:42}}/>
              </div>
            </div>
            {(()=>{
              const valorOriginal = instValRaw ? unmaskCurrency(instValRaw) : unmaskCurrency(valRaw)
              const valorPago = unmaskCurrency(paidAmountRaw)
              const desconto = valorOriginal - valorPago
              if (valorPago > 0 && desconto > 0.01 && desconto < valorOriginal) {
                return (
                  <div style={{marginTop:10,background:'rgba(52,199,89,0.08)',borderRadius:10,padding:'8px 12px'}}>
                    <p style={{fontSize:12,color:GREEN,fontWeight:600,margin:0}}>
                      💰 Desconto obtido: {formatCurrency(desconto)} ({((desconto/valorOriginal)*100).toFixed(1)}%)
                    </p>
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}

        {/* Observações */}
        <div>
          <label style={lbl}>Observações</label>
          <textarea value={form.notes||''} onChange={e=>sf('notes',e.target.value)} rows={2}
            style={{...inp,height:'auto',padding:'12px 16px',resize:'none',lineHeight:1.5}} placeholder="Opcional..."/>
        </div>

        {/* Salvar */}
        <button onClick={save} disabled={saving}
          style={{width:'100%',height:52,background:TERRA,color:'#fff',fontWeight:700,fontSize:15,borderRadius:14,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(196,98,45,0.3)',marginTop:4}}>
          {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:'✓ Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
