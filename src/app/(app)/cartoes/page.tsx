'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lock, Unlock } from 'lucide-react'

export default function Cartoes() {
  const [cards, setCards]     = useState<any[]>([])
  const [faturas, setFaturas] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const s = createClient()
    const { data: cardsData } = await s.from('cards').select('*').eq('is_active',true).order('holder').order('name')
    const now = new Date()
    const { data: txData } = await s.from('transactions').select('card_name,amount,status,installment_value')
      .gte('purchase_date',format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(now),'yyyy-MM-dd'))
      .neq('transaction_type','receita')
    const map: Record<string,any> = {}
    ;(cardsData||[]).forEach(c => {
      const nome = `${c.name} — ${c.holder}`
      const txs  = (txData||[]).filter(t=>t.card_name===nome||t.card_name===c.name)
      const gasto = txs.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
      const pago  = txs.filter((t:any)=>t.status==='pago').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
      const hoje  = now.getDate()
      map[c.id] = { gasto, pago, pendente:gasto-pago, status:hoje>c.closing_day?'fechado':'aberto' }
    })
    setCards(cardsData||[])
    setFaturas(map)
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>

  const credito = cards.filter(c=>c.card_type==='credito')
  const contas  = cards.filter(c=>c.card_type!=='credito')
  const mes     = format(new Date(),'MMMM yyyy',{locale:ptBR})

  return (
    <div className="px-4 py-4 animate-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Cartões</h1>
        <p className="text-xs text-gray-400 capitalize">{mes}</p>
      </div>

      {cards.length===0?(
        <div className="text-center py-16">
          <p className="text-3xl mb-3">💳</p>
          <p className="text-sm text-gray-400">Execute o SQL no Supabase para carregar os cartões</p>
        </div>
      ):(
        <>
          {credito.length>0&&<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Crédito</p>}
          {credito.map(c=>{
            const f = faturas[c.id]||{gasto:0,pago:0,pendente:0,status:'aberto'}
            const pct = c.credit_limit>0?(f.gasto/c.credit_limit)*100:0
            const over = pct>=(c.alert_pct||80)
            return (
              <div key={c.id} className="mb-4 rounded-3xl overflow-hidden shadow-sm">
                {/* Frente do cartão */}
                <div style={{background:`linear-gradient(135deg,${c.color},${c.color}99)`,padding:20,color:'#fff',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',right:-20,top:-20,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.1)'}}/>
                  <div style={{position:'absolute',right:20,bottom:-30,width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginBottom:2}}>{c.bank}</p>
                      <p style={{fontSize:15,fontWeight:600}}>{c.holder}</p>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.2)',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600}}>
                      {f.status==='aberto'?<><Unlock size={11}/>Aberta</>:<><Lock size={11}/>Fechada</>}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p style={{fontSize:11,color:'rgba(255,255,255,0.7)'}}>Fatura {mes}</p>
                      <p style={{fontSize:26,fontWeight:700,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>{formatCurrency(f.gasto)}</p>
                    </div>
                    <div className="text-right">
                      <p style={{fontSize:11,color:'rgba(255,255,255,0.7)'}}>Limite</p>
                      <p style={{fontSize:14,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(c.credit_limit)}</p>
                    </div>
                  </div>
                </div>
                {/* Detalhes */}
                <div className="bg-white p-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{pct.toFixed(0)}% do limite</span>
                    <span className={over?'text-red-500 font-semibold':''}>
                      {over?`⚠️ Acima de ${c.alert_pct||80}%`:`${formatCurrency(c.credit_limit-f.gasto)} disponível`}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div className="h-full rounded-full transition-all" style={{width:`${Math.min(pct,100)}%`,background:over?'#E24B4A':c.color}}/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['Pago',f.pago,'text-green-600','bg-green-50'],['Pendente',f.pendente,'text-amber-600','bg-amber-50'],['Fecha dia',c.closing_day,'text-gray-700','bg-gray-50']].map(([l,v,tc,bg])=>(
                      <div key={l as string} className={`${bg} rounded-xl p-2.5 text-center`}>
                        <p className="text-xs text-gray-400 mb-0.5">{l as string}</p>
                        <p className={`text-sm font-bold ${tc} tabular-nums`}>{typeof v==='number'&&(l==='Pago'||l==='Pendente')?formatCurrency(v):v}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-3">Fecha dia {c.closing_day} · Vence dia {c.due_day}</p>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
