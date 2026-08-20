'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'

const BG='#F5F5F7',TEXT='#1C1C1E',TEXTLT='#48484A',TEXTMU='#8E8E93'
const GREEN='#34C759',TERRA='#C4622D'

const BANK_GRADIENT: Record<string,string> = {
  nubank:'linear-gradient(145deg,#5B2D8A,#3A1860)',
  santander:'linear-gradient(145deg,#C0281E,#7A1010)',
  bb:'linear-gradient(145deg,#1A5FAD,#0D3068)',
  c6:'linear-gradient(145deg,#2C2C2C,#121212)',
  bradesco:'linear-gradient(145deg,#A01010,#600808)',
  mercadopago:'linear-gradient(145deg,#0060A0,#003060)',
  caixa:'linear-gradient(145deg,#0A5A32,#043018)',
  inter:'linear-gradient(145deg,#A04818,#602808)',
  default:'linear-gradient(145deg,#6A4428,#3D2410)',
}
const BANK_SIGLA: Record<string,string> = {
  nubank:'NU',santander:'S',bb:'BB',c6:'C6',
  bradesco:'B',mercadopago:'MP',caixa:'CEF',inter:'IN',
}
function getBankKey(bank:string){
  const b=bank.toLowerCase()
  if(b.includes('nubank'))return 'nubank';if(b.includes('santander'))return 'santander'
  if(b.includes('brasil')||b==='bb')return 'bb';if(b.includes('c6'))return 'c6'
  if(b.includes('bradesco'))return 'bradesco';if(b.includes('mercado'))return 'mercadopago'
  if(b.includes('caixa'))return 'caixa';if(b.includes('inter'))return 'inter'
  return 'default'
}

interface Card { id:string;name:string;bank:string;holder:string;card_type?:string;credit_limit:number;closing_day:number;due_day:number;alert_pct?:number;color:string;is_active:boolean }
interface Tx { id:string;description:string;amount:number;installment_value?:number;installment_total?:number;total_installments?:number;installment_num?:number;installment_number?:number;status:string;purchase_date:string;category:string;holder:string;card_name?:string;payment_method?:string;transaction_type:string;paid_amount?:number }

export default function Cartoes() {
  const [cards,setCards]=useState<Card[]>([])
  const [txs,setTxs]=useState<Tx[]>([])
  const [loading,setLoading]=useState(true)
  const [expanded,setExpanded]=useState<string|null>(null)
  const [curMonth,setCurMonth]=useState(new Date())
  const [cardOrder,setCardOrder]=useState<string[]>([])
  const [showOrder,setShowOrder]=useState(false)

  useEffect(()=>{load()},[curMonth])

  async function load(){
    setLoading(true)
    const s=createClient()
    const [{data:cardsData},{data:txDataCartao},{data:txDataParc}]=await Promise.all([
      s.from('cards').select('*').eq('is_active',true).order('holder').order('name'),
      // Todas as transações de cartão de crédito (filtramos por billing_month depois,
      // não por purchase_date, para refletir corretamente antecipações)
      s.from('transactions').select('*')
        .eq('payment_method','cartao_credito')
        .neq('transaction_type','receita')
        .order('purchase_date',{ascending:false}),
      // Parcelas de TODOS os meses (para projetar em meses futuros)
      s.from('transactions').select('*')
        .neq('transaction_type','receita')
        .order('purchase_date',{ascending:false}),
    ])
    const c=cardsData||[]
    setCards(c)

    // Construir lista de transações do mês: usa billing_month (fallback purchase_date p/ dados antigos)
    const mesKey=format(curMonth,'yyyy-MM')
    const monthStart=format(startOfMonth(curMonth),'yyyy-MM-dd')
    const monthEnd=format(endOfMonth(curMonth),'yyyy-MM-dd')
    const txsDoMes=(txDataCartao||[]).filter((t:any)=>{
      const mesRef=t.billing_month||t.purchase_date
      return mesRef>=monthStart&&mesRef<=monthEnd
    })

    // Para cada parcela, projetar em meses futuros
    const jaAdicionado=new Set(txsDoMes.map((t:any)=>t.id))
    ;(txDataParc||[]).forEach((t:any)=>{
      // Detectar parcela: pela descrição (X/Y) OU por campos installment
      const match=t.description?.match(/\((\d+)\/(\d+)\)/)
      let numAtual=0, total=0
      
      if(match){
        numAtual=parseInt(match[1]); total=parseInt(match[2])
      } else {
        numAtual=t.installment_num||t.installment_number||1
        total=t.installment_total||t.total_installments||0
      }
      
      if(total<=1)return
      if(t.payment_method!=='cartao_credito')return
      
      const dataParcela=new Date(t.purchase_date+'T12:00:00')
      const nomeBase=t.description.replace(/\s*\(\d+\/\d+\)$/,'').trim()

      // Projetar parcelas futuras
      for(let i=1;i<=total-numAtual;i++){
        const mesFuturo=format(addMonths(dataParcela,i),'yyyy-MM')
        if(mesFuturo!==mesKey)continue
        
        const numFuturo=numAtual+i
        const novaDesc=`${nomeBase} (${numFuturo}/${total})`
        const projId=t.id+'_proj_'+numFuturo
        
        // Verificar se já existe (por id ou nome similar)
        if(jaAdicionado.has(projId))continue
        const jaExisteNome=txsDoMes.some((x:any)=>{
          const xBase=x.description.replace(/\s*\(\d+\/\d+\)$/,'').trim()
          const xMatch=x.description.match(/\((\d+)\/(\d+)\)/)
          return xBase===nomeBase && xMatch && parseInt(xMatch[1])===numFuturo
        })
        if(jaExisteNome)continue
        
        txsDoMes.push({
          ...t,
          id:projId,
          description:novaDesc,
          purchase_date:format(addMonths(dataParcela,i),'yyyy-MM-dd'),
          status:'Pendente',
          _projected:true,
        })
        jaAdicionado.add(projId)
      }
    })

    setTxs(txsDoMes)
    const savedOrder=localStorage.getItem('ln_card_order')
    if(savedOrder){
      try{setCardOrder(JSON.parse(savedOrder))}catch{setCardOrder(c.map(x=>x.id))}
    }else{setCardOrder(c.map(x=>x.id))}
    setLoading(false)
  }

  function txsDoCartao(card:Card):Tx[]{
    const nome=`${card.name} — ${card.holder}`
    const nomeLower=card.name.toLowerCase()
    return txs.filter(t=>{
      if(t.payment_method!=='cartao_credito'&&t.transaction_type!=='parcelada')return false
      const cn=(t.card_name||'').toLowerCase()
      return cn===nome.toLowerCase()||cn===nomeLower||cn.includes(nomeLower)||t.card_name===nome||t.card_name===card.name
    })
  }

  function moveCard(id:string,dir:-1|1){
    setCardOrder(prev=>{
      const arr=[...prev]
      const i=arr.indexOf(id)
      const ni=i+dir
      if(ni<0||ni>=arr.length)return arr
      ;[arr[i],arr[ni]]=[arr[ni],arr[i]]
      localStorage.setItem('ln_card_order',JSON.stringify(arr))
      return arr
    })
  }

  const monthLabel=format(curMonth,'MMMM yyyy',{locale:ptBR})
  const mes=format(curMonth,'MMM/yy',{locale:ptBR})
  const isCurrentMonth=format(curMonth,'yyyy-MM')===format(new Date(),'yyyy-MM')

  const credito=cards.filter(c=>!c.card_type||c.card_type==='credito')
  const contas=cards.filter(c=>c.card_type&&c.card_type!=='credito')
  const allCards=[...credito,...contas]

  // Ordenar por cardOrder
  const sortedCards=cardOrder.length>0
    ? [...allCards].sort((a,b)=>(cardOrder.indexOf(a.id)===-1?999:cardOrder.indexOf(a.id))-(cardOrder.indexOf(b.id)===-1?999:cardOrder.indexOf(b.id)))
    : allCards

  const totalUsado=credito.reduce((s,c)=>s+txsDoCartao(c).reduce((ss,t)=>ss+(t.installment_value||t.amount),0),0)
  const totalDisp=credito.reduce((s,c)=>s+c.credit_limit,0)-totalUsado
  const totalPago=credito.reduce((s,c)=>s+txsDoCartao(c).filter(t=>t.status==='Pago').reduce((ss,t)=>ss+(t.paid_amount||t.installment_value||t.amount),0),0)
  const totalPend=credito.reduce((s,c)=>s+txsDoCartao(c).filter(t=>t.status!=='Pago'&&t.status!=='Cancelado').reduce((ss,t)=>ss+(t.installment_value||t.amount),0),0)

  if(loading) return (
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center',paddingTop:80}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Navegação de meses */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={()=>setCurMonth(m=>subMonths(m,1))} style={{width:28,height:28,background:'rgba(0,0,0,0.04)',borderRadius:8,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:TEXTLT}}>‹</button>
          <p style={{fontSize:13,fontWeight:700,color:TEXT,textTransform:'capitalize',margin:0,minWidth:110,textAlign:'center'}}>{monthLabel}</p>
          <button onClick={()=>setCurMonth(m=>addMonths(m,1))} style={{width:28,height:28,background:'rgba(0,0,0,0.04)',borderRadius:8,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:TEXTLT}}>›</button>
          {!isCurrentMonth&&<button onClick={()=>setCurMonth(new Date())} style={{fontSize:10,color:TERRA,background:'rgba(196,98,45,0.08)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontWeight:600}}>Hoje</button>}
        </div>
        <button onClick={()=>setShowOrder(!showOrder)} style={{fontSize:11,color:showOrder?TERRA:TEXTMU,background:showOrder?'rgba(196,98,45,0.08)':'rgba(0,0,0,0.03)',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontWeight:600}}>
          {showOrder?'✓ Pronto':'↕ Ordenar'}
        </button>
      </div>

      {/* Visão Geral */}
      <div style={{background:'#FFFFFF',borderRadius:24,padding:'16px 18px',marginBottom:20,border:'1px solid rgba(0,0,0,0.06)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
        <p style={{fontSize:11,fontWeight:700,color:TEXTMU,margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'0.09em'}}>
          Visão Geral ({mes})
        </p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'rgba(34,199,89,0.06)',borderRadius:16,padding:'12px 14px',border:'1px solid rgba(34,199,89,0.15)'}}>
            <p style={{fontSize:10,color:'#1B8A3A',margin:'0 0 3px',fontWeight:600}}>Crédito Disponível</p>
            <p style={{fontSize:17,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalDisp)}</p>
          </div>
          <div style={{background:'rgba(255,59,48,0.05)',borderRadius:16,padding:'12px 14px',border:'1px solid rgba(255,59,48,0.12)'}}>
            <p style={{fontSize:10,color:'#C4622D',margin:'0 0 3px',fontWeight:600}}>Crédito Utilizado</p>
            <p style={{fontSize:17,fontWeight:800,color:'#FF3B30',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalUsado)}</p>
          </div>
          <div style={{background:'rgba(34,199,89,0.04)',borderRadius:16,padding:'10px 14px',border:'1px solid rgba(34,199,89,0.1)'}}>
            <p style={{fontSize:10,color:'#48484A',margin:'0 0 3px',fontWeight:600}}>Total Pago</p>
            <p style={{fontSize:15,fontWeight:700,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPago)}</p>
          </div>
          <div style={{background:'rgba(255,59,48,0.03)',borderRadius:16,padding:'10px 14px',border:'1px solid rgba(255,59,48,0.08)'}}>
            <p style={{fontSize:10,color:'#48484A',margin:'0 0 3px',fontWeight:600}}>A Pagar</p>
            <p style={{fontSize:15,fontWeight:700,color:'#FF3B30',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(totalPend)}</p>
          </div>
        </div>
      </div>

      {/* Cartões */}
      <p style={{fontSize:13,fontWeight:700,color:TEXTLT,margin:'0 0 12px'}}>Cartões & Contas</p>

      {cards.length===0?(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <p style={{fontSize:32,margin:'0 0 12px'}}>💳</p>
          <p style={{fontSize:13,color:TEXTMU}}>Nenhum cartão cadastrado</p>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {sortedCards.map((c,idx)=>{
            const itens=txsDoCartao(c)
            const gasto=itens.reduce((s,t)=>s+(t.installment_value||t.amount),0)
            const pago=itens.filter(t=>t.status==='Pago').reduce((s,t)=>s+(t.paid_amount||t.installment_value||t.amount),0)
            const pendente=itens.filter(t=>t.status!=='Pago'&&t.status!=='Cancelado').reduce((s,t)=>s+(t.installment_value||t.amount),0)
            const bk=getBankKey(c.bank)
            const grad=BANK_GRADIENT[bk]||BANK_GRADIENT.default
            const sigla=BANK_SIGLA[bk]||c.bank[0]
            const pct=c.credit_limit>0?(gasto/c.credit_limit)*100:0
            const over=pct>=(c.alert_pct||80)
            const disponivel=c.credit_limit-gasto
            const isExpanded=expanded===c.id

            return (
              <div key={c.id} style={{borderRadius:28,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.12)',border:'1px solid rgba(0,0,0,0.06)',position:'relative'}}>

                {/* Botões de ordenação */}
                {showOrder&&(
                  <div style={{position:'absolute',top:12,right:12,zIndex:10,display:'flex',flexDirection:'column',gap:2}}>
                    <button onClick={(e)=>{e.stopPropagation();moveCard(c.id,-1)}} disabled={idx===0}
                      style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,0.9)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:idx===0?0.3:1,boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
                      <ArrowUp size={14} color={TEXT}/>
                    </button>
                    <button onClick={(e)=>{e.stopPropagation();moveCard(c.id,1)}} disabled={idx===sortedCards.length-1}
                      style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,0.9)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:idx===sortedCards.length-1?0.3:1,boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}>
                      <ArrowDown size={14} color={TEXT}/>
                    </button>
                  </div>
                )}

                <button onClick={()=>!showOrder&&setExpanded(isExpanded?null:c.id)}
                  style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
                  <div style={{background:grad,padding:'20px 22px 16px',position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,position:'relative'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:38,height:38,borderRadius:13,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
                          <span style={{fontSize:11,fontWeight:800,color:'#fff',letterSpacing:'-0.5px'}}>{sigla}</span>
                        </div>
                        <div>
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',margin:'0 0 1px'}}>{c.bank}</p>
                          <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{c.name} | {c.holder}</p>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {!showOrder&&(isExpanded?<ChevronUp size={14} color="rgba(255,255,255,0.5)"/>:<ChevronDown size={14} color="rgba(255,255,255,0.5)"/>)}
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:14,position:'relative'}}>
                      <div>
                        <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',margin:'0 0 3px'}}>Fatura {mes}</p>
                        <p style={{fontSize:28,fontWeight:800,color:'#fff',margin:0,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}>{formatCurrency(gasto)}</p>
                      </div>
                      {c.credit_limit>0&&(
                        <div style={{textAlign:'right'}}>
                          <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',margin:'0 0 2px'}}>Disponível</p>
                          <p style={{fontSize:14,fontWeight:700,color:over?'rgba(255,120,120,0.9)':'rgba(93,224,138,0.9)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(disponivel)}</p>
                        </div>
                      )}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12,position:'relative'}}>
                      <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'8px 12px',backdropFilter:'blur(4px)'}}>
                        <p style={{fontSize:10,color:'rgba(255,255,255,0.45)',margin:'0 0 2px'}}>✓ Pago</p>
                        <p style={{fontSize:14,fontWeight:700,color:'rgba(93,224,138,0.9)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(pago)}</p>
                      </div>
                      <div style={{background:'rgba(0,0,0,0.2)',borderRadius:14,padding:'8px 12px',backdropFilter:'blur(4px)'}}>
                        <p style={{fontSize:10,color:'rgba(255,255,255,0.45)',margin:'0 0 2px'}}>⏳ Pendente</p>
                        <p style={{fontSize:14,fontWeight:700,color:'rgba(255,180,100,0.95)',margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(pendente)}</p>
                      </div>
                    </div>
                    {c.credit_limit>0&&(
                      <div style={{position:'relative'}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:5}}>
                          <span>Limite: {formatCurrency(c.credit_limit)}</span>
                          <span style={{color:over?'rgba(255,120,120,0.8)':'rgba(255,255,255,0.3)'}}>{over?`⚠️ ${pct.toFixed(0)}%`:`${pct.toFixed(0)}% usado`}</span>
                        </div>
                        <div style={{height:4,background:'rgba(255,255,255,0.1)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:99,width:`${Math.min(pct,100)}%`,background:over?'linear-gradient(90deg,#FF6B6B,#FF4444)':'linear-gradient(90deg,rgba(93,224,138,0.5),rgba(93,224,138,0.8))',transition:'width 0.5s'}}/>
                        </div>
                      </div>
                    )}
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.25)',margin:'10px 0 0',position:'relative'}}>Fecha dia {c.closing_day} · Vence dia {c.due_day}</p>
                  </div>
                </button>

                {isExpanded&&!showOrder&&(
                  <div style={{background:'#F8F8FA',borderTop:'0.5px solid rgba(0,0,0,0.05)'}}>
                    {itens.length===0?(
                      <div style={{padding:'20px 18px',textAlign:'center'}}>
                        <p style={{fontSize:12,color:TEXTMU,margin:0}}>Nenhuma compra nesta fatura</p>
                      </div>
                    ):(
                      <div style={{padding:'4px 16px 12px'}}>
                        <p style={{fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.07em',margin:'10px 0 6px'}}>
                          {itens.length} compra{itens.length>1?'s':''} nesta fatura
                        </p>
                        {itens.map((tx,i)=>(
                          <div key={tx.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderTop:i>0?'0.5px solid rgba(0,0,0,0.05)':undefined}}>
                            <div style={{width:34,height:34,borderRadius:11,background:'rgba(0,0,0,0.03)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
                              {CAT_ICONS[tx.category]||'📦'}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              {(()=>{
                                const m=tx.description?.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/)
                                const nome=m?m[1]:tx.description
                                const totalParc=tx.installment_total||tx.total_installments||0
                                const numParc=m?parseInt(m[2]):(tx.installment_num||tx.installment_number||(totalParc>1?1:0))
                                const totalP=m?parseInt(m[3]):totalParc
                                const parcInfo=totalP>1?`${numParc}/${totalP}`:null
                                return (<>
                                  <p style={{fontSize:13,fontWeight:500,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nome}</p>
                                  <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                                    {tx.category} · {format(parseISO(tx.purchase_date),'dd/MM')}
                                    {parcInfo&&<span style={{color:'#C4622D',fontWeight:600}}> · {parcInfo}</span>}
                                  </p>
                                </>)
                              })()}
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <p style={{fontSize:13,fontWeight:700,color:TEXTLT,fontVariantNumeric:'tabular-nums',margin:0}}>
                                {formatCurrency(tx.installment_value||tx.amount)}
                              </p>
                              <span style={{fontSize:9,fontWeight:600,padding:'1px 6px',borderRadius:4,
                                background:tx.status==='Pago'?'rgba(34,199,89,0.12)':'rgba(196,98,45,0.12)',
                                color:tx.status==='Pago'?'#1B8A3A':'#C4622D'}}>
                                {tx.status==='Pago'?'✓ Pago':'Pendente'}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'0.5px solid rgba(0,0,0,0.08)',marginTop:4}}>
                          <p style={{fontSize:13,fontWeight:700,color:TEXTLT,margin:0}}>Total da fatura</p>
                          <p style={{fontSize:14,fontWeight:800,color:TEXT,fontVariantNumeric:'tabular-nums',margin:0}}>{formatCurrency(gasto)}</p>
                        </div>
                      </div>
                    )}
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
