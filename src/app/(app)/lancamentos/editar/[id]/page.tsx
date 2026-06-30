'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CATS_DESPESA, CATS_RECEITA, SUBCATS } from '@/lib/utils'
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function EditarLancamento() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [tx, setTx] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => { load() }, [id])

  async function load() {
    const {data} = await createClient().from('transactions').select('*').eq('id',id).single()
    if (data) { setTx(data); setForm(data) }
    setLoading(false)
  }

  function sf(k:string,v:any){setForm((f:any)=>({...f,[k]:v}))}

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const {error} = await createClient().from('transactions').update({
      holder:form.holder, description:form.description, amount:parseFloat(form.amount)||0,
      category:form.category, subcategory:form.subcategory||null, nature:form.nature,
      purchase_date:form.purchase_date, status:form.status, notes:form.notes||null,
      paid_amount:form.paid_amount?parseFloat(form.paid_amount):null,
      paid_date:form.paid_date||null,
    }).eq('id',id)
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success('Salvo!')
    router.push('/lancamentos')
    router.refresh()
  }

  async function del() {
    if(!confirm('Apagar este lançamento?'))return
    await createClient().from('transactions').delete().eq('id',id)
    toast.success('Apagado!')
    router.push('/lancamentos')
    router.refresh()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>
  if (!tx) return <div className="text-center py-20"><p className="text-sm text-gray-400">Lançamento não encontrado</p></div>

  const isReceita = tx.transaction_type === 'receita'
  const cats = isReceita ? CATS_RECEITA : CATS_DESPESA
  const subs = SUBCATS[form.category] || []

  return (
    <div className="min-h-full bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={()=>router.back()} className="p-1 -ml-1"><ChevronLeft size={22} color="#8E8E93"/></button>
        <h1 className="font-semibold text-gray-900 flex-1">Editar lançamento</h1>
        <button onClick={del} className="p-1.5 bg-red-50 rounded-xl"><Trash2 size={18} color="#E24B4A"/></button>
      </div>

      <form onSubmit={save} className="px-4 py-4 space-y-5 pb-8">
        {/* Responsável */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Responsável</label>
          <div className="grid grid-cols-3 gap-2">
            {['Lucas','Nicoly','Prata'].map(p=>(
              <button key={p} type="button" onClick={()=>sf('holder',p)}
                className={`h-10 rounded-xl text-sm font-medium border transition-all ${form.holder===p?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição</label><input type="text" value={form.description||''} onChange={e=>sf('description',e.target.value)} required className="input-base"/></div>
        <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor (R$)</label><input type="number" inputMode="decimal" value={form.amount||''} onChange={e=>sf('amount',e.target.value)} required className="input-base" step="0.01" min="0.01"/></div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoria</label>
          <select value={form.category||''} onChange={e=>{sf('category',e.target.value);sf('subcategory','')}} className="input-base">
            <option value="">Selecione...</option>
            {cats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {form.category&&subs.length>0&&(
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subcategoria</label>
            <select value={form.subcategory||''} onChange={e=>sf('subcategory',e.target.value)} className="input-base">
              <option value="">Selecione...</option>
              {subs.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Natureza</label>
          <div className="grid grid-cols-2 gap-2">
            {['Fixo','Variável'].map(n=><button key={n} type="button" onClick={()=>sf('nature',n)} className={`h-10 rounded-xl text-sm font-medium border ${form.nature===n?'bg-brand-50 text-brand-600 border-brand-300':'bg-white text-gray-600 border-gray-200'}`}>{n}</button>)}
          </div>
        </div>

        <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data</label><input type="date" value={form.purchase_date||''} onChange={e=>sf('purchase_date',e.target.value)} required className="input-base"/></div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</label>
          <div className="grid grid-cols-3 gap-2">
            {['pendente','pago','atrasado','previsto','cancelado'].map(s=>(
              <button key={s} type="button" onClick={()=>sf('status',s)}
                className={`h-10 rounded-xl text-xs font-medium border capitalize transition-all ${form.status===s?'bg-gray-900 text-white border-gray-900':'bg-white text-gray-600 border-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {(form.status==='pago'||form.status==='atrasado')&&(
          <div className="bg-green-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-green-700">Confirmação de pagamento</p>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Valor pago (R$)</label><input type="number" inputMode="decimal" value={form.paid_amount||''} onChange={e=>sf('paid_amount',e.target.value)} placeholder="Valor real pago" className="input-base h-10" step="0.01"/></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Data do pagamento</label><input type="date" value={form.paid_date||''} onChange={e=>sf('paid_date',e.target.value)} className="input-base h-10"/></div>
          </div>
        )}

        <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações</label><textarea value={form.notes||''} onChange={e=>sf('notes',e.target.value)} rows={2} className="input-base py-2.5 resize-none"/></div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving?<><Loader2 size={18} className="animate-spin"/>Salvando...</>:'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
