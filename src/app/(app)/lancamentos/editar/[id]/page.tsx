'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATS_DESPESA, CATS_RECEITA, SUBCATS } from '@/lib/utils'
import { ChevronLeft, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ── Paleta v3 Espresso ────────────────────────────────────────────────────────
const BG    = '#F5F5F7'
const TEXT  = '#1C1C1E'
const TEXTMU= '#8E8E93'
const TERRA = '#C4622D'
const CREAM = '#1C1C1E'
const GREENBG = 'rgba(74,140,92,0.18)'
const TERRABG = 'rgba(196,98,45,0.18)'

const inp: React.CSSProperties = {
  width:'100%', height:48,
  background:'rgba(0,0,0,0.03)',
  border:'0.5px solid rgba(0,0,0,0.08)',
  borderRadius:22, padding:'0 16px',
  fontSize:14, color:TEXT, outline:'none',
  boxSizing:'border-box',
}
const lbl: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:TEXTMU,
  textTransform:'uppercase', letterSpacing:'0.06em',
  display:'block', marginBottom:7,
}
const seg = (on: boolean, accent = TERRA): React.CSSProperties => ({
  flex:1, height:42, borderRadius:21, border:'none',
  background: on ? accent : 'rgba(0,0,0,0.03)',
  color: on ? CREAM : TEXTMU,
  fontSize:13, fontWeight: on ? 700 : 400,
  cursor:'pointer', transition:'all 0.15s',
})

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  Pendente: { label:'Pendente', color:'#FF3B30', bg:'rgba(196,98,45,0.25)' },
  Pago:     { label:'Pago',     color:'#34C759', bg:'rgba(74,140,92,0.25)' },
  Previsto: { label:'Previsto', color:'#FFCC55', bg:'rgba(160,110,10,0.25)' },
  atrasado: { label:'Atrasado', color:'#FF6B6B', bg:'rgba(180,30,30,0.25)' },
  cancelado:{ label:'Cancelado',color:'#9B9B9B', bg:'rgba(100,100,100,0.2)' },
}

export default function EditarLancamento() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [tx,      setTx]     = useState<any>(null)
  const [loading, setLoading]= useState(true)
  const [saving,  setSaving] = useState(false)
  const [form,    setForm]   = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    const { data } = await createClient().from('transactions').select('*').eq('id',id).single()
    if (data) { setTx(data); setForm(data) }
    setLoading(false)
  }

  function sf(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await createClient().from('transactions').update({
      holder:        form.holder,
      description:   form.description,
      amount:        parseFloat(form.amount) || 0,
      category:      form.category,
      subcategory:   form.subcategory || null,
      purchase_date: form.purchase_date,
      status:        form.status,
      notes:         form.notes || null,
      paid_amount:   form.paid_amount ? parseFloat(form.paid_amount) : null,
      paid_date:     form.paid_date || null,
    }).eq('id', id)
    if (error) { toast.error(`Erro: ${error.message}`); setSaving(false); return }
    toast.success('Salvo!')
    router.push('/lancamentos')
    router.refresh()
  }

  async function del() {
    if (!confirm('Apagar este lançamento?')) return
    await createClient().from('transactions').delete().eq('id', id)
    toast.success('Apagado!')
    router.push('/lancamentos')
    router.refresh()
  }

  if (loading) return (
    <div style={{ background:BG, minHeight:'100%', display:'flex', justifyContent:'center', alignItems:'center' }}>
      <div style={{ width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!tx) return (
    <div style={{ background:BG, minHeight:'100%', display:'flex', justifyContent:'center', alignItems:'center' }}>
      <p style={{ color:TEXTMU, fontSize:14 }}>Lançamento não encontrado</p>
    </div>
  )

  const isReceita = tx.transaction_type === 'receita'
  const cats = isReceita ? CATS_RECEITA : CATS_DESPESA
  const subs = SUBCATS[form.category] || []

  return (
    <div style={{ background:BG, minHeight:'100%' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, background:'#F5F5F7', borderBottom:'0.5px solid rgba(0,0,0,0.04)', padding:'12px 16px', display:'flex', alignItems:'center', gap:10, zIndex:10 }}>
        <button onClick={()=>router.back()} style={{ background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center' }}>
          <ChevronLeft size={22} color={TEXTMU}/>
        </button>
        <h1 style={{ fontSize:16, fontWeight:700, color:TEXT, flex:1, margin:0 }}>Editar lançamento</h1>
        <button onClick={del} style={{ width:36,height:36,background:'rgba(196,98,45,0.15)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Trash2 size={17} color={TERRA}/>
        </button>
      </div>

      <form onSubmit={save} style={{ padding:'18px 16px 160px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Info do lançamento (somente leitura) */}
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:20, padding:'14px 16px', border:'0.5px solid rgba(0,0,0,0.03)' }}>
          <p style={{ fontSize:11, color:TEXTMU, margin:'0 0 4px', letterSpacing:'0.05em', textTransform:'uppercase' }}>
            {isReceita ? '↑ Receita' : '↓ Despesa'} · {tx.transaction_type}
          </p>
          <p style={{ fontSize:18, fontWeight:700, color:TEXT, margin:'0 0 2px' }}>{tx.description}</p>
          <p style={{ fontSize:13, color:TEXTMU, margin:0 }}>{tx.category} · {tx.holder}</p>
        </div>

        {/* Responsável */}
        <div>
          <label style={lbl}>Responsável</label>
          <div style={{ display:'flex', gap:8 }}>
            {['Lucas','Nicoly','Prata'].map(p => (
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
          <input type="number" inputMode="decimal" value={form.amount||''} onChange={e=>sf('amount',e.target.value)}
            required style={{ ...inp, fontSize:18, fontWeight:700, color: isReceita ? '#34C759' : '#FF3B30' }}
            step="0.01" min="0.01"/>
        </div>

        {/* Categoria */}
        <div>
          <label style={lbl}>Categoria</label>
          <div style={{ position:'relative' }}>
            <select value={form.category||''} onChange={e=>{sf('category',e.target.value);sf('subcategory','')}}
              style={{ ...inp, appearance:'none' as const }}>
              <option value="">Selecione...</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} color={TEXTMU} style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}/>
          </div>
        </div>

        {/* Subcategoria */}
        {form.category && subs.length > 0 && (
          <div>
            <label style={lbl}>Subcategoria</label>
            <div style={{ position:'relative' }}>
              <select value={form.subcategory||''} onChange={e=>sf('subcategory',e.target.value)}
                style={{ ...inp, appearance:'none' as const }}>
                <option value="">Selecione...</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} color={TEXTMU} style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}/>
            </div>
          </div>
        )}

        {/* Data */}
        <div>
          <label style={lbl}>Data</label>
          <input type="date" value={form.purchase_date||''} onChange={e=>sf('purchase_date',e.target.value)} required style={inp}/>
        </div>

        {/* Status */}
        <div>
          <label style={lbl}>Status</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {Object.entries(STATUS_CFG).map(([s, cfg]) => (
              <button key={s} type="button" onClick={()=>sf('status',s)}
                style={{
                  height:40, borderRadius:20, border:'none', cursor:'pointer',
                  background: form.status===s ? cfg.bg : 'rgba(0,0,0,0.04)',
                  color: form.status===s ? cfg.color : TEXTMU,
                  fontSize:12, fontWeight: form.status===s ? 700 : 400,
                  outline: form.status===s ? `1px solid ${cfg.color}40` : 'none',
                  transition:'all 0.15s',
                }}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Confirmação de pagamento */}
        {(form.status==='Pago') && (
          <div style={{ background:GREENBG, borderRadius:20, padding:'14px 16px', border:'0.5px solid rgba(74,140,92,0.2)' }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#34C759', margin:'0 0 12px' }}>Confirmação de pagamento</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={{ ...lbl, color:'rgba(93,224,138,0.6)' }}>Valor pago (R$)</label>
                <input type="number" inputMode="decimal" value={form.paid_amount||''} onChange={e=>sf('paid_amount',e.target.value)}
                  placeholder="Valor real pago" style={{ ...inp, height:44 }} step="0.01"/>
              </div>
              <div>
                <label style={{ ...lbl, color:'rgba(93,224,138,0.6)' }}>Data do pagamento</label>
                <input type="date" value={form.paid_date||''} onChange={e=>sf('paid_date',e.target.value)} style={{ ...inp, height:44 }}/>
              </div>
            </div>
          </div>
        )}

        {/* Observações */}
        <div>
          <label style={lbl}>Observações</label>
          <textarea value={form.notes||''} onChange={e=>sf('notes',e.target.value)} rows={2}
            style={{ ...inp, height:'auto', padding:'12px 16px', resize:'none', lineHeight:1.5 }}/>
        </div>

        {/* Botão salvar */}
        <button type="submit" disabled={saving}
          style={{ width:'100%',height:52,background:TERRA,color:CREAM,fontWeight:700,fontSize:15,borderRadius:26,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(196,98,45,0.4)',marginTop:4 }}>
          {saving ? <><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</> : '✓ Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
