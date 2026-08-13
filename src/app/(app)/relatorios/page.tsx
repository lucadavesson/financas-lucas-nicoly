'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, X } from 'lucide-react'

const BG='#F5F5F7',CARD='#FFFFFF',TEXT='#1C1C1E',TEXTLT='#48484A',TEXTMU='#8E8E93'
const GREEN='#34C759',RED='#FF3B30',TERRA='#C4622D'
const COLORS=['#1D9E75','#7F77DD','#378ADD','#C8963C','#E24B4A','#D85A30','#0F6E56','#9B59B6','#E67E22','#2ECC71','#E74C3C','#3498DB']

const v = formatCurrency

function Section({title,icon,count,total,children,defaultOpen=false}:{title:string;icon:string;count?:number;total?:number;children:React.ReactNode;defaultOpen?:boolean}) {
  const [open,setOpen]=useState(defaultOpen)
  return (
    <div style={{background:CARD,borderRadius:20,marginBottom:12,border:'1px solid rgba(0,0,0,0.04)',overflow:'hidden'}}>
      <button onClick={()=>setOpen(!open)} style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'14px 18px',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:16}}>{icon}</span>
          <span style={{fontSize:14,fontWeight:700,color:TEXT}}>{title}</span>
          {count!==undefined&&<span style={{fontSize:11,color:TEXTMU,background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'1px 7px',fontWeight:600}}>{count}</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {total!==undefined&&<span style={{fontSize:13,fontWeight:700,color:RED,fontVariantNumeric:'tabular-nums'}}>{v(total)}</span>}
          {open?<ChevronUp size={16} color={TEXTMU}/>:<ChevronDown size={16} color={TEXTMU}/>}
        </div>
      </button>
      {open&&<div style={{padding:'0 18px 16px',borderTop:'1px solid rgba(0,0,0,0.04)'}}>{children}</div>}
    </div>
  )
}

export default function Relatorios() {
  const [txs,setTxs]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [date,setDate]=useState(new Date())
  const [holder,setHolder]=useState('Todos')
  const [compN,setCompN]=useState(4)
  const [openCat,setOpenCat]=useState<string|null>(null)

  useEffect(()=>{load()},[date])

  async function load(){
    setLoading(true)
    const start=format(startOfMonth(subMonths(date,5)),'yyyy-MM-dd')
    const end=format(endOfMonth(date),'yyyy-MM-dd')
    const {data}=await createClient().from('transactions').select('*').gte('purchase_date',start).lte('purchase_date',end)
    setTxs(data||[]);setLoading(false)
  }

  function getMes(d=date){
    const s=format(startOfMonth(d),'yyyy-MM-dd'),e=format(endOfMonth(d),'yyyy-MM-dd')
    return txs.filter(t=>t.purchase_date>=s&&t.purchase_date<=e&&(holder==='Todos'||t.holder===holder))
  }

  const mes=getMes()
  const receitas=mes.filter(t=>t.transaction_type==='receita'||t.type==='Receita')
  const despesasTodas=mes.filter(t=>t.transaction_type!=='receita'&&t.type!=='Receita')
  const totalR=receitas.reduce((s:number,t:any)=>s+t.amount,0)
  const totalD=despesasTodas.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
  const saldo=totalR-totalD

  // Segregar despesas
  const isParcelada=(t:any)=>{
    const m=t.description?.match(/\((\d+)\/(\d+)\)/)
    return (m&&parseInt(m[2])>1)||(t.installment_total||t.total_installments||0)>1||t.transaction_type==='parcelada'
  }
  const isRecorrente=(t:any)=>t.is_recurring&&!isParcelada(t)
  const isCredito=(t:any)=>t.payment_method==='cartao_credito'&&!isParcelada(t)

  const parceladas=despesasTodas.filter(isParcelada)
  const recorrentes=despesasTodas.filter(isRecorrente)
  const avista=despesasTodas.filter(t=>!isParcelada(t)&&!isRecorrente(t))

  const totalParc=parceladas.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
  const totalRec=recorrentes.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
  const totalAv=avista.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)

  // Categorias
  const catMap:Record<string,{total:number;txs:any[]}>={}
  despesasTodas.forEach((t:any)=>{
    if(!catMap[t.category])catMap[t.category]={total:0,txs:[]}
    catMap[t.category].total+=(t.installment_value||t.amount)
    catMap[t.category].txs.push(t)
  })
  const cats=Object.entries(catMap).sort(([,a],[,b])=>b.total-a.total)

  // Comparativo
  const mesesComp=Array.from({length:compN},(_,i)=>subMonths(date,compN-1-i))
  const comp=mesesComp.map(m=>({
    label:format(m,"MMM 'yy",{locale:ptBR}),
    r:getMes(m).filter((t:any)=>t.transaction_type==='receita'||t.type==='Receita').reduce((s:number,t:any)=>s+t.amount,0),
    d:getMes(m).filter((t:any)=>t.transaction_type!=='receita'&&t.type!=='Receita').reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0),
    atual:format(m,'yyyy-MM')===format(date,'yyyy-MM'),
  }))
  const maxComp=Math.max(...comp.flatMap(c=>[c.r,c.d]),1)

  const mesLabel=format(date,'MMMM yyyy',{locale:ptBR})
  const isNow=format(date,'yyyy-MM')===format(new Date(),'yyyy-MM')

  if(loading)return(<div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center',paddingTop:100}}>
    <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>)

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>

      {/* Header + navegação */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <h1 style={{fontSize:20,fontWeight:800,color:TEXT,margin:0}}>Relatórios</h1>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={()=>setDate(d=>subMonths(d,1))} style={{width:30,height:30,background:'rgba(0,0,0,0.04)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <ChevronLeft size={16} color={TEXTLT}/>
          </button>
          <span style={{fontSize:13,fontWeight:700,color:TEXT,minWidth:60,textAlign:'center',textTransform:'capitalize'}}>{format(date,'MMM/yy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>subMonths(d,-1))} style={{width:30,height:30,background:'rgba(0,0,0,0.04)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <ChevronRight size={16} color={TEXTLT}/>
          </button>
          {!isNow&&<button onClick={()=>setDate(new Date())} style={{fontSize:10,color:TERRA,background:'rgba(196,98,45,0.08)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontWeight:600}}>Hoje</button>}
        </div>
      </div>

      {/* Filtro pessoa */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {['Todos','Lucas','Nicoly','Prata'].map(h=>(
          <button key={h} onClick={()=>setHolder(h)} style={{flex:1,height:32,borderRadius:16,border:holder===h?'none':`1px solid rgba(0,0,0,0.08)`,background:holder===h?TERRA:'transparent',color:holder===h?'#fff':TEXTLT,fontSize:12,fontWeight:holder===h?700:500,cursor:'pointer'}}>{h}</button>
        ))}
      </div>

      {/* Cards receita / despesa */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div style={{background:'rgba(34,199,89,0.06)',borderRadius:18,padding:'14px 16px',border:'1px solid rgba(34,199,89,0.15)'}}>
          <p style={{fontSize:10,color:'#1B8A3A',margin:'0 0 3px',fontWeight:600}}>Receitas</p>
          <p style={{fontSize:22,fontWeight:800,color:GREEN,margin:0,fontVariantNumeric:'tabular-nums'}}>{v(totalR)}</p>
        </div>
        <div style={{background:'rgba(255,59,48,0.05)',borderRadius:18,padding:'14px 16px',border:'1px solid rgba(255,59,48,0.12)'}}>
          <p style={{fontSize:10,color:'#C4622D',margin:'0 0 3px',fontWeight:600}}>Despesas</p>
          <p style={{fontSize:22,fontWeight:800,color:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{v(totalD)}</p>
        </div>
      </div>

      {/* Saldo */}
      <div style={{background:CARD,borderRadius:16,padding:'12px 18px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid rgba(0,0,0,0.04)'}}>
        <p style={{fontSize:12,color:TEXTMU,margin:0}}>Saldo do mês</p>
        <p style={{fontSize:20,fontWeight:800,color:saldo>=0?GREEN:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{saldo>=0?'+':''}{v(saldo)}</p>
      </div>

      {/* Breakdown de despesas */}
      <div style={{background:CARD,borderRadius:18,padding:'16px 18px',marginBottom:12,border:'1px solid rgba(0,0,0,0.04)'}}>
        <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 12px'}}>Composição das despesas</p>
        {[
          {label:'Compras à vista / avulsas',val:totalAv,count:avista.length,color:'#378ADD'},
          {label:'Parcelas do mês',val:totalParc,count:parceladas.length,color:TERRA},
          {label:'Contas recorrentes',val:totalRec,count:recorrentes.length,color:'#9B59B6'},
        ].map((item,i)=>{
          const pct=totalD>0?(item.val/totalD)*100:0
          return (
            <div key={i} style={{marginBottom:i<2?10:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:8,height:8,borderRadius:2,background:item.color}}/>
                  <span style={{fontSize:12,color:TEXT,fontWeight:500}}>{item.label}</span>
                  <span style={{fontSize:10,color:TEXTMU}}>({item.count})</span>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:TEXT,fontVariantNumeric:'tabular-nums'}}>{v(item.val)}</span>
              </div>
              <div style={{height:4,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:item.color,transition:'width 0.4s'}}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* SEÇÕES COLAPSÁVEIS */}

      {/* Evolução mensal */}
      <Section title="Evolução mensal" icon="📊" defaultOpen={false}>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:12,marginTop:8}}>
          {[3,4,6].map(n=>(<button key={n} onClick={()=>setCompN(n)} style={{width:32,height:26,borderRadius:8,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,background:compN===n?TERRA:'rgba(0,0,0,0.04)',color:compN===n?'#fff':TEXTLT}}>{n}m</button>))}
        </div>
        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:2,background:GREEN}}/><span style={{fontSize:11,color:TEXTLT}}>Receitas</span></div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:2,background:RED}}/><span style={{fontSize:11,color:TEXTLT}}>Despesas</span></div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {comp.map((c,i)=>(
            <div key={i}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:c.atual?700:500,color:c.atual?TEXT:TEXTLT,textTransform:'capitalize'}}>{c.label}</span>
                <span style={{fontSize:11,color:c.d>c.r?RED:GREEN,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{v(c.d)}</span>
              </div>
              <div style={{height:6,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden',marginBottom:2}}>
                <div style={{height:'100%',borderRadius:99,width:`${(c.r/maxComp)*100}%`,background:c.atual?GREEN:'rgba(93,224,138,0.4)',transition:'width 0.5s',minWidth:c.r>0?4:0}}/>
              </div>
              <div style={{height:6,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:99,width:`${(c.d/maxComp)*100}%`,background:c.atual?RED:'rgba(255,138,92,0.4)',transition:'width 0.5s',minWidth:c.d>0?4:0}}/>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Por categoria */}
      <Section title="Por categoria" icon="📂" count={cats.length} total={totalD}>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:10}}>
          {cats.map(([cat,{total,txs:catTxs}],i)=>{
            const pct=totalD>0?(total/totalD*100):0
            const isOpen=openCat===cat
            // Subcategorias
            const subMap:Record<string,{total:number;count:number}>={}
            catTxs.forEach((t:any)=>{
              const sub=t.subcategory||'Sem subcategoria'
              if(!subMap[sub])subMap[sub]={total:0,count:0}
              subMap[sub].total+=(t.installment_value||t.amount)
              subMap[sub].count++
            })
            const subs=Object.entries(subMap).sort(([,a],[,b])=>b.total-a.total)
            return (
              <div key={cat} style={{padding:'8px 0',borderBottom:i<cats.length-1?'0.5px solid rgba(0,0,0,0.04)':undefined}}>
                <button onClick={()=>setOpenCat(isOpen?null:cat)} style={{width:'100%',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:13,color:TEXT,fontWeight:600}}>{CAT_ICONS[cat]||'📦'} {cat}</span>
                      <span style={{fontSize:10,color:TEXTMU}}>({catTxs.length})</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:TEXT,fontVariantNumeric:'tabular-nums'}}>{v(total)}</span>
                      <span style={{fontSize:10,color:TEXTMU}}>{pct.toFixed(0)}%</span>
                      {isOpen?<ChevronUp size={12} color={TEXTMU}/>:<ChevronDown size={12} color={TEXTMU}/>}
                    </div>
                  </div>
                  <div style={{height:4,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:COLORS[i%COLORS.length],transition:'width 0.4s'}}/>
                  </div>
                </button>
                {isOpen&&(
                  <div style={{marginTop:8,paddingLeft:4}}>
                    {subs.map(([sub,{total:st,count}])=>(
                      <div key={sub} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',fontSize:12}}>
                        <span style={{color:TEXTLT}}>↳ {sub} <span style={{color:TEXTMU}}>({count})</span></span>
                        <span style={{fontWeight:600,color:TEXT,fontVariantNumeric:'tabular-nums'}}>{v(st)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Parcelamentos do mês */}
      {parceladas.length>0&&(
        <Section title="Parcelas do mês" icon="💳" count={parceladas.length} total={totalParc}>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8}}>
            {parceladas.sort((a:any,b:any)=>(b.installment_value||b.amount)-(a.installment_value||a.amount)).map((t:any)=>{
              const m=t.description?.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/)
              const base=m?m[1]:t.description
              const num=m?m[2]:(t.installment_num||t.installment_number||'?')
              const total=m?m[3]:(t.installment_total||t.total_installments||'?')
              const isPago=t.status==='Pago'
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)'}}>
                  <span style={{fontSize:15}}>{CAT_ICONS[t.category]||'📦'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{base}</p>
                    <p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>{t.holder} · {t.card_name||t.payment_method}</p>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:isPago?GREEN:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{v(t.installment_value||t.amount)}</p>
                    <span style={{fontSize:10,fontWeight:600,color:isPago?GREEN:TERRA}}>{num}/{total} {isPago?'✓':'⏳'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Recorrentes */}
      {recorrentes.length>0&&(
        <Section title="Contas recorrentes" icon="🔄" count={recorrentes.length} total={totalRec}>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8}}>
            {recorrentes.sort((a:any,b:any)=>(b.installment_value||b.amount)-(a.installment_value||a.amount)).map((t:any)=>{
              const isPago=t.status==='Pago'
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)'}}>
                  <span style={{fontSize:15}}>{CAT_ICONS[t.category]||'📦'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</p>
                    <p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>{t.holder} · Dia {new Date(t.purchase_date).getDate()}</p>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:isPago?GREEN:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{v(t.installment_value||t.amount)}</p>
                    <span style={{fontSize:10,fontWeight:600,color:isPago?GREEN:TERRA}}>{isPago?'✓ Pago':'⏳ Pendente'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Compras à vista */}
      {avista.length>0&&(
        <Section title="Compras à vista / avulsas" icon="🛒" count={avista.length} total={totalAv}>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8}}>
            {avista.sort((a:any,b:any)=>(b.installment_value||b.amount)-(a.installment_value||a.amount)).map((t:any)=>{
              const isPago=t.status==='Pago'
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)'}}>
                  <span style={{fontSize:15}}>{CAT_ICONS[t.category]||'📦'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</p>
                    <p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>{t.holder} · {t.category} · {format(parseISO(t.purchase_date),'dd/MM')}</p>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:isPago?GREEN:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{v(t.installment_value||t.amount)}</p>
                    <span style={{fontSize:10,fontWeight:600,color:isPago?GREEN:TERRA}}>{isPago?'✓ Pago':'⏳'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}
