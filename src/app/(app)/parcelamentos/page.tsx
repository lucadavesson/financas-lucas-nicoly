'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, parseISO, subMonths } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'

const BG='#F5F5F7',TEXT='#1C1C1E',TEXTLT='#48484A',TEXTMU='#8E8E93',TERRA='#C4622D',GREEN='#34C759',RED='#FF3B30'

interface Tx {
  id:string; description:string; amount:number; installment_value?:number
  installment_total?:number; total_installments?:number
  installment_num?:number; installment_number?:number
  status:string; purchase_date:string; category:string; holder:string
  card_name?:string; payment_method?:string; transaction_type:string
  paid_date?:string
}

export default function Parcelamentos() {
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)

  useEffect(()=>{load()},[])

  async function load() {
    setLoading(true)
    const from = format(subMonths(new Date(), 36), 'yyyy-MM-dd')
    const { data } = await createClient().from('transactions').select('*')
      .gte('purchase_date', from)
      .order('purchase_date', { ascending: false })
    setTxs(data || [])
    setLoading(false)
  }

  const grupos = useMemo(() => {
    const map = new Map<string, { base:string; parcelas:Tx[]; holder:string; card:string; category:string; totalParcelas:number; valorParcela:number; valorTotal:number }>()

    for (const tx of txs) {
      const match = tx.description?.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/)
      if (!match) {
        const total = tx.installment_total || tx.total_installments || 0
        if (total <= 1) continue
        const key = `${tx.description}|${tx.holder}|${tx.card_name||''}`
        if (!map.has(key)) {
          map.set(key, { base:tx.description, parcelas:[], holder:tx.holder, card:tx.card_name||'', category:tx.category, totalParcelas:total, valorParcela:tx.installment_value||tx.amount, valorTotal:tx.amount })
        }
        map.get(key)!.parcelas.push(tx)
        continue
      }
      const base = match[1].trim()
      const total = parseInt(match[3])
      const key = `${base}|${tx.holder}|${tx.card_name||''}`
      if (!map.has(key)) {
        map.set(key, { base, parcelas:[], holder:tx.holder, card:tx.card_name||'', category:tx.category, totalParcelas:total, valorParcela:tx.installment_value||tx.amount, valorTotal:(tx.installment_value||tx.amount)*total })
      }
      map.get(key)!.parcelas.push(tx)
    }

    for (const g of map.values()) g.parcelas.sort((a,b)=>a.purchase_date.localeCompare(b.purchase_date))

    return Array.from(map.values()).sort((a,b)=>{
      const aPend=a.parcelas.filter(p=>p.status!=='Pago').length
      const bPend=b.parcelas.filter(p=>p.status!=='Pago').length
      if(aPend>0&&bPend===0)return -1
      if(aPend===0&&bPend>0)return 1
      return a.base.localeCompare(b.base)
    })
  }, [txs])

  if (loading) return (
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center',paddingTop:80}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const totalPendente=grupos.reduce((s,g)=>s+g.parcelas.filter(p=>p.status!=='Pago').reduce((ss,p)=>ss+(p.installment_value||p.amount),0),0)
  const totalGeral=grupos.reduce((s,g)=>s+g.valorTotal,0)

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <h2 style={{fontSize:20,fontWeight:800,color:TEXT,margin:'0 0 4px'}}>Parcelamentos</h2>
      <p style={{fontSize:12,color:TEXTMU,margin:'0 0 16px'}}>Todas as compras parceladas em um só lugar</p>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        <div style={{background:'#fff',borderRadius:16,padding:'14px 16px',border:'1px solid rgba(0,0,0,0.05)'}}>
          <p style={{fontSize:10,color:TEXTMU,margin:'0 0 3px',fontWeight:600,textTransform:'uppercase'}}>A pagar (parcelas)</p>
          <p style={{fontSize:18,fontWeight:800,color:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPendente)}</p>
        </div>
        <div style={{background:'#fff',borderRadius:16,padding:'14px 16px',border:'1px solid rgba(0,0,0,0.05)'}}>
          <p style={{fontSize:10,color:TEXTMU,margin:'0 0 3px',fontWeight:600,textTransform:'uppercase'}}>Total comprometido</p>
          <p style={{fontSize:18,fontWeight:800,color:TEXT,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalGeral)}</p>
        </div>
      </div>

      {grupos.length===0?(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <p style={{fontSize:32,margin:'0 0 12px'}}>🎉</p>
          <p style={{fontSize:14,fontWeight:600,color:GREEN}}>Nenhuma compra parcelada!</p>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {grupos.map((g,gi)=>{
            const pagas=g.parcelas.filter(p=>p.status==='Pago').length
            const total=g.totalParcelas
            const pct=total>0?Math.round((pagas/total)*100):0
            const isOpen=expanded===g.base+g.holder
            const finalizada=pagas>=total

            return (
              <div key={gi} style={{background:'#fff',borderRadius:20,overflow:'hidden',border:'1px solid rgba(0,0,0,0.05)',opacity:finalizada?0.55:1}}>
                <button onClick={()=>setExpanded(isOpen?null:g.base+g.holder)}
                  style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'16px 18px',textAlign:'left'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:22}}>{CAT_ICONS[g.category]||'📦'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'80%'}}>{g.base}</p>
                        {isOpen?<ChevronUp size={16} color={TEXTMU}/>:<ChevronDown size={16} color={TEXTMU}/>}
                      </div>
                      <p style={{fontSize:11,color:TEXTMU,margin:'3px 0 0'}}>
                        {g.holder} · {g.card||'Sem cartão'} · {formatCurrency(g.valorParcela)}/mês
                      </p>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                        <div style={{flex:1,height:4,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:finalizada?GREEN:TERRA,transition:'width 0.5s'}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:finalizada?GREEN:TERRA,flexShrink:0}}>{pagas}/{total}</span>
                      </div>
                    </div>
                  </div>
                </button>
                {isOpen&&(
                  <div style={{padding:'0 18px 16px'}}>
                    <div style={{borderTop:'1px solid rgba(0,0,0,0.04)',paddingTop:12}}>
                      {Array.from({length:total},(_,i)=>{
                        const num=i+1
                        const parcela=g.parcelas.find(p=>{
                          const m=p.description?.match(/\((\d+)\/(\d+)\)/)
                          if(m)return parseInt(m[1])===num
                          return(p.installment_num||p.installment_number)===num
                        })
                        const isPago=parcela?.status==='Pago'
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<total-1?'0.5px solid rgba(0,0,0,0.04)':undefined}}>
                            <div style={{width:24,height:24,borderRadius:12,background:isPago?'rgba(34,199,89,0.12)':parcela?'rgba(196,98,45,0.12)':'rgba(0,0,0,0.03)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <span style={{fontSize:10,fontWeight:700,color:isPago?GREEN:parcela?TERRA:TEXTMU}}>{isPago?'✓':num}</span>
                            </div>
                            <div style={{flex:1}}>
                              <p style={{fontSize:12,fontWeight:500,color:parcela?TEXT:TEXTMU,margin:0}}>Parcela {num}/{total}</p>
                              {parcela&&<p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>{format(parseISO(parcela.purchase_date),'dd/MM/yyyy')}{isPago&&parcela.paid_date?` · Pago ${format(parseISO(parcela.paid_date),'dd/MM')}`:''}</p>}
                            </div>
                            <div style={{textAlign:'right'}}>
                              <p style={{fontSize:12,fontWeight:600,color:isPago?GREEN:parcela?RED:TEXTMU,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(g.valorParcela)}</p>
                              {!parcela&&<p style={{fontSize:9,color:TEXTMU,margin:0}}>Futuro</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',marginTop:4}}>
                      <p style={{fontSize:12,fontWeight:600,color:TEXTMU,margin:0}}>Restam {total-pagas} parcela{total-pagas!==1?'s':''}</p>
                      <p style={{fontSize:13,fontWeight:700,color:RED,margin:0}}>{formatCurrency((total-pagas)*g.valorParcela)}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
