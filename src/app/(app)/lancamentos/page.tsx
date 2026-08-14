'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'


type Tx = { id:string;holder:string;description:string;category:string;subcategory?:string;amount:number;installment_value?:number;installment_total?:number;total_installments?:number;installment_num?:number;installment_number?:number;status:string;purchase_date:string;transaction_type:string;type?:string;payment_method?:string;card_name?:string;is_recurring?:boolean }

const BADGE: Record<string,string> = { Pago:'badge-pago',Pendente:'badge-pendente',Previsto:'badge-previsto',Atrasado:'badge-atrasado',Cancelado:'badge-previsto' }
const BADGE_LABEL: Record<string,string> = { Pago:'Pago',Pendente:'Pendente',Previsto:'Previsto',Atrasado:'Atrasado',Cancelado:'Cancelado' }

function BadgeInline({status}: {status:string}) {
  const cfg: Record<string,{bg:string;color:string;border:string;label:string;pulse:boolean}> = {
    Pago:      {bg:'rgba(34,199,89,0.12)',    color:'#1B8A3A', border:'rgba(34,199,89,0.25)', label:'Pago',      pulse:false},
    Pendente:  {bg:'rgba(196,98,45,0.12)',    color:'#C4622D', border:'rgba(196,98,45,0.25)', label:'Pendente',  pulse:true},
    Previsto:  {bg:'rgba(255,170,0,0.12)',    color:'#B37700', border:'rgba(255,170,0,0.25)', label:'Previsto',  pulse:false},
    Atrasado:  {bg:'rgba(255,59,48,0.12)',    color:'#D32920', border:'rgba(255,59,48,0.25)', label:'Atrasado',  pulse:true},
    Cancelado: {bg:'rgba(142,142,147,0.12)', color:'#8E8E93', border:'rgba(142,142,147,0.2)', label:'Cancelado', pulse:false},
  }
  const c = cfg[status] || cfg.Pendente
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:c.bg, color:c.color,
      fontSize:11, fontWeight:700,
      padding:'3px 10px', borderRadius:20,
      border:`1px solid ${c.border}`,
      letterSpacing:'0.03em', flexShrink:0,
    }}>
      <span style={{
        width:6, height:6, borderRadius:'50%',
        background:c.color, flexShrink:0,
        animation: c.pulse ? 'pulse 1.6s ease-in-out infinite' : 'none',
      }}/>
      {c.label}
    </span>
  )
}


const BG='#F5F5F7'; const SEBBLE='#FFFFFF'; const SEBBLE_DK='#FFFFFF'
const TEXT='#1C1C1E'; const TEXTMU='#8E8E93'; const TEXTLT='#48484A'
const GREEN='#34C759'; const GREENBG='rgba(52,199,89,0.08)'; const RED='#FF3B30'; const TERRA='#C4622D'; const TERRABG='rgba(255,59,48,0.06)'; const CREAM='#FFFFFF'

export default function Lancamentos() {
  const [txs,setTxs]   = useState<Tx[]>([])
  const [load,setLoad] = useState(true)
  const [date,setDate] = useState(new Date())
  const [showF,setShowF]=useState(false)
  const [search,setSearch]=useState('')
  const [openSecs,setOpenSecs]=useState<Record<string,boolean>>(()=>{try{const s=sessionStorage.getItem('ln_open_secs');return s?JSON.parse(s):{}}catch{return {}}})
  const [sel,setSel]   = useState<Tx|null>(null)
  const [fH,setFH]     = useState<string[]>([])
  const [fT,setFT]     = useState<string[]>([])

  useEffect(()=>{loadData()},[date])
  useEffect(()=>{try{sessionStorage.setItem('ln_open_secs',JSON.stringify(openSecs))}catch{}},[openSecs])

  async function loadData() {
    setLoad(true)
    const {data}=await createClient().from('transactions').select('*')
      .gte('purchase_date',format(startOfMonth(date),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(date),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    // Carrega TUDO do mês - segregação é visual, não por exclusão
    setTxs(data||[]); setLoad(false)
  }

  const [payConfirm, setPayConfirm] = useState<Tx|null>(null)
  const [payDate, setPayDate]       = useState(format(new Date(),'yyyy-MM-dd'))
  const [payValue, setPayValue]     = useState('')

  function openPay(tx: Tx) {
    setPayDate(format(new Date(),'yyyy-MM-dd'))
    setPayValue(maskCurrency(Math.round((tx.installment_value||tx.amount)*100).toString()))
    setPayConfirm(tx)
    setSel(null)
  }

  async function confirmPay() {
    if (!payConfirm) return
    await createClient().from('transactions').update({
      status:'Pago', paid_date: payDate,
      paid_amount: unmaskCurrency(payValue) || payConfirm.amount,
    }).eq('id', payConfirm.id)
    toast.success(`✓ "${payConfirm.description}" pago`)
    setPayConfirm(null)
    loadData()
  }
  async function del(tx:Tx) {
    if(!confirm('Apagar?'))return
    await createClient().from('transactions').delete().eq('id',tx.id)
    toast.success('Apagado!'); setSel(null); loadData()
  }

  function tog(arr:string[],set:(v:string[])=>void,val:string){set(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val])}

  // Helpers de classificação
  const isReceita=(t:Tx)=>t.transaction_type==='receita'||t.type==='Receita'
  const isParcelada=(t:Tx)=>{
    if(isReceita(t))return false // receita NUNCA é parcelada
    const m=t.description?.match(/\((\d+)\/(\d+)\)/)
    return (m&&parseInt(m[2])>1)||(t.installment_total||t.total_installments||0)>1||t.transaction_type==='parcelada'
  }
  const isCredito=(t:Tx)=>t.payment_method==='cartao_credito'&&!isParcelada(t)&&!isReceita(t)
  const isRecorrente=(t:Tx)=>!!t.is_recurring&&!isParcelada(t)&&!isCredito(t)&&!isReceita(t)
  const isDiaDia=(t:Tx)=>!isParcelada(t)&&!isCredito(t)&&!isRecorrente(t)&&!isReceita(t)

  const filtered=useMemo(()=>{
    let t=txs
    if(fH.length) t=t.filter(x=>fH.includes(x.holder))
    if(fT.length) t=t.filter(x=>fT.includes(x.transaction_type==='receita'||x.type==='Receita'?'Receita':'Despesa'))
    if(search.trim()) t=t.filter(x=>x.description.toLowerCase().includes(search.toLowerCase())||x.category.toLowerCase().includes(search.toLowerCase()))
    return t
  },[txs,fH,fT,search])

  // Segregar em 3 grupos
  const txDiaDia=filtered.filter(isDiaDia)
  const txCredito=filtered.filter(isCredito)
  const txParcelas=filtered.filter(isParcelada)
  const txRecorrentes=filtered.filter(isRecorrente)
  const txReceitas=filtered.filter(isReceita)

  const groupByDate=(arr:Tx[])=>{
    const g:Record<string,Tx[]>={}
    arr.forEach(t=>{if(!g[t.purchase_date])g[t.purchase_date]=[];g[t.purchase_date].push(t)})
    return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))
  }

  // grouped removido - agora usa groupByDate() por seção

  const totalR=filtered.filter(t=>isReceita(t)).reduce((s,t)=>s+t.amount,0)
  const totalD=filtered.filter(t=>!isReceita(t)).reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const aConfirmar=filtered.filter(t=>isReceita(t)&&t.status==='Previsto').reduce((s,t)=>s+t.amount,0)
  const aPagar=filtered.filter(t=>!isReceita(t)&&['Pendente','Atrasado'].includes(t.status)).reduce((s,t)=>s+(t.installment_value||t.amount),0)

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',background:BG }}>
      {/* Header */}
      <div style={{ background:'#FFFFFF', padding:'12px 16px 14px', flexShrink:0 }}>
        {/* Navegação de mês */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14 }}>
          <button onClick={()=>setDate(d=>subMonths(d,1))} style={{ width:32,height:32,background:'rgba(0,0,0,0.04)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronLeft size={18} color={TEXTLT}/>
          </button>
          <span style={{ fontWeight:700,fontSize:16,color:TEXT,textTransform:'capitalize',minWidth:130,textAlign:'center' }}>{format(date,'MMMM yyyy',{locale:ptBR})}</span>
          <button onClick={()=>setDate(d=>addMonths(d,1))} style={{ width:32,height:32,background:'rgba(0,0,0,0.04)',borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <ChevronRight size={18} color={TEXTLT}/>
          </button>
          {format(date,'yyyy-MM')!==format(new Date(),'yyyy-MM')&&(
            <button onClick={()=>setDate(new Date())} style={{fontSize:10,color:TERRA,background:'rgba(196,98,45,0.08)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontWeight:600}}>Hoje</button>
          )}
        </div>

        {/* Cards resumo */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
          <div style={{ background:'rgba(34,199,89,0.08)',borderRadius:20,padding:'12px 14px',border:'1px solid rgba(34,199,89,0.2)' }}>
            <p style={{ fontSize:11,color:'#1B8A3A',marginBottom:2,fontWeight:600 }}>Total Receitas ({format(date,'MMM/yy')})</p>
            <p style={{ fontSize:17,fontWeight:700,color:'#34C759',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalR)}</p>
            {aConfirmar>0&&<p style={{ fontSize:10,color:'#48484A',marginTop:2 }}>A confirmar: {formatCurrency(aConfirmar)}</p>}
          </div>
          <div style={{ background:'rgba(255,59,48,0.06)',borderRadius:20,padding:'12px 14px',border:'1px solid rgba(255,59,48,0.15)' }}>
            <p style={{ fontSize:11,color:'#C4622D',marginBottom:2,fontWeight:600 }}>Total Despesas ({format(date,'MMM/yy')})</p>
            <p style={{ fontSize:17,fontWeight:700,color:'#FF3B30',fontVariantNumeric:'tabular-nums' as const }}>{formatCurrency(totalD)}</p>
            {aPagar>0&&<p style={{ fontSize:10,color:'#48484A',marginTop:2 }}>A pagar: {formatCurrency(aPagar)}</p>}
          </div>
        </div>

        <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:8 }}>
          <div style={{flex:1,position:'relative'}}>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar lançamento..."
              style={{width:'100%',height:36,background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'0 14px 0 32px',fontSize:13,color:TEXT,outline:'none',boxSizing:'border-box'}}/>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14}}>🔍</span>
          </div>
          <button onClick={()=>setShowF(!showF)} style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:20,background:showF||fH.length||fT.length?TERRA:'rgba(0,0,0,0.04)',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,color:showF||fH.length||fT.length?'#fff':TEXT,flexShrink:0 }}>
            <SlidersHorizontal size={13}/> Filtros{(fH.length+fT.length)>0?` (${fH.length+fT.length})`:''}
          </button>
          {(fH.length||fT.length)?<button onClick={()=>{setFH([]);setFT([])}} style={{ fontSize:11,color:TERRA,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3 }}><X size={11}/>Limpar</button>:null}
        </div>
        {showF&&(
          <div style={{ marginTop:10,display:'flex',flexDirection:'column',gap:10 }}>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'#8E8E93',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Pessoa</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Lucas','Nicoly','Prata'].map(h=>(
                  <button key={h} onClick={()=>tog(fH,setFH,h)} style={{ padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fH.includes(h)?TERRA:'rgba(0,0,0,0.04)',color:fH.includes(h)?CREAM:'#48484A',border:'none' }}>{h}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize:10,fontWeight:600,color:'#8E8E93',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6 }}>Tipo</p>
              <div style={{ display:'flex',gap:6 }}>
                {['Receita','Despesa'].map(t=>(
                  <button key={t} onClick={()=>tog(fT,setFT,t)} style={{ padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:fT.includes(t)?TERRA:'rgba(0,0,0,0.04)',color:fT.includes(t)?CREAM:'#48484A',border:'none' }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex:1,overflowY:'auto',overscrollBehavior:'none',padding:'12px 14px 160px' }}>
        {/* Contagem de resultados */}
        {!load&&(search||fH.length||fT.length)&&filtered.length>0&&(
          <p style={{fontSize:11,color:TEXTMU,margin:'0 0 10px',paddingLeft:4}}>{filtered.length} lançamento{filtered.length!==1?'s':''} encontrado{filtered.length!==1?'s':''}</p>
        )}
        {load?(
          <div style={{ display:'flex',justifyContent:'center',padding:40 }}>
            <div style={{ width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ):filtered.length===0?(
          <div style={{ textAlign:'center',padding:'48px 16px' }}>
            <p style={{ fontSize:24,marginBottom:12 }}>{search?'🔍':'📭'}</p>
            <p style={{ fontSize:14,color:TEXTMU,marginBottom:16 }}>{search?`Nenhum resultado para "${search}"`:'Nenhum lançamento neste mês'}</p>
            {!search&&<Link href="/lancamentos/novo" style={{ padding:'10px 20px',background:TERRA,color:'#fff',borderRadius:24,fontSize:13,fontWeight:700,textDecoration:'none' }}>Adicionar</Link>}
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {([
              {key:'dia',title:'Compras à vista',items:txDiaDia,icon:'🛒',color:'#378ADD'},
              {key:'credito',title:'Compras no crédito',items:txCredito,icon:'💳',color:TERRA},
              {key:'parcela',title:'Compras parceladas',items:txParcelas,icon:'📋',color:'#9B59B6'},
              {key:'recorrente',title:'Contas recorrentes',items:txRecorrentes,icon:'🔄',color:'#1D9E75'},
              {key:'receita',title:'Receitas',items:txReceitas,icon:'💰',color:GREEN},
            ] as const).filter(s=>s.items.length>0).map(section=>{
              const isOpen=openSecs[section.key]!==false
              const total=section.items.reduce((s,t)=>s+(t.installment_value||t.amount),0)
              return (
                <div key={section.key} style={{background:'#FFFFFF',borderRadius:20,overflow:'hidden',border:'1px solid rgba(0,0,0,0.04)'}}>
                  {/* Header colapsável */}
                  <button onClick={()=>setOpenSecs(p=>({...p,[section.key]:!isOpen}))}
                    style={{width:'100%',background:'#FFFFFF',border:'none',cursor:'pointer',padding:'14px 16px',textAlign:'left',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky' as any,top:0,zIndex:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16}}>{section.icon}</span>
                      <span style={{fontSize:14,fontWeight:700,color:TEXT}}>{section.title}</span>
                      <span style={{fontSize:11,color:TEXTMU,background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'1px 7px',fontWeight:600}}>{section.items.length}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:section.color,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(total)}</span>
                      {isOpen?<ChevronUp size={16} color={TEXTMU}/>:<ChevronDown size={16} color={TEXTMU}/>}
                    </div>
                  </button>

                  {/* Lista expandida */}
                  {isOpen&&(
                    <div style={{padding:'0 8px 8px'}}>
                      {section.items.sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)).map((tx,i)=>(
                        <button key={tx.id} onClick={()=>setSel(tx)}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 10px',borderTop:i>0?'0.5px solid rgba(0,0,0,0.04)':undefined,background:'none',border:i===0?'none':undefined,borderTopStyle:i>0?'solid':undefined,borderTopColor:i>0?'rgba(0,0,0,0.04)':undefined,borderTopWidth:i>0?'0.5px':undefined,borderLeft:'none',borderRight:'none',borderBottom:'none',cursor:'pointer',textAlign:'left'}}>
                          <div style={{width:34,height:34,borderRadius:11,background:tx.transaction_type==='receita'||tx.type==='Receita'?GREENBG:'rgba(0,0,0,0.03)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
                            {CAT_ICONS[tx.category]||'📦'}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:13,fontWeight:500,color:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:0}}>{tx.description}</p>
                            <p style={{fontSize:10,color:TEXTMU,margin:'2px 0 0'}}>{tx.category} · {tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}{tx.card_name?` · ${tx.card_name}`:''}</p>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <p style={{fontSize:13,fontWeight:700,color:tx.transaction_type==='receita'||tx.type==='Receita'?GREEN:RED,fontVariantNumeric:'tabular-nums',margin:0}}>
                              {tx.transaction_type==='receita'||tx.type==='Receita'?'+':'-'}{formatCurrency(tx.installment_value||tx.amount)}
                            </p>
                            <BadgeInline status={tx.status}/>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      {sel&&(
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setSel(null)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#FFFFFF',borderRadius:'32px 32px 0 0',padding:'20px 20px 48px',boxShadow:'0 -8px 32px rgba(255,255,255,0.1)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,margin:'0 auto 18px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:16,borderBottom:`1px solid rgba(0,0,0,0.04)` }}>
              <div style={{ width:44,height:44,borderRadius:14,background:sel.transaction_type==='receita'?GREENBG:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{CAT_ICONS[sel.category]||'📦'}</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15,fontWeight:600,color:TEXT }}>{sel.description}</p>
                <p style={{ fontSize:12,color:TEXTMU }}>{sel.category} · {sel.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:16,fontWeight:700,color:sel.transaction_type==='receita'?GREEN:TERRA,fontVariantNumeric:'tabular-nums' as const }}>
                  {sel.transaction_type==='receita'?'+':'-'}{formatCurrency(sel.installment_value||sel.amount)}
                </p>
                <BadgeInline status={sel.status}/>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {sel.transaction_type!=='receita'&&sel.status!=='Pago'&&(
                <button onClick={()=>openPay(sel!)} style={{ width:'100%',height:50,background:TERRA,color:'#fff',fontWeight:700,fontSize:15,borderRadius:24,border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(196,98,45,0.3)' }}>✓ Marcar como pago</button>
              )}
              <Link href={`/lancamentos/editar/${sel.id}`} onClick={()=>setSel(null)}
                style={{ width:'100%',height:46,background:'rgba(0,0,0,0.03)',color:TEXT,fontWeight:600,fontSize:14,borderRadius:24,display:'flex',alignItems:'center',justifyContent:'center' }}>
                ✏️ Editar
              </Link>
              <button onClick={()=>del(sel)} style={{ width:'100%',height:46,background:TERRABG,color:TERRA,fontWeight:600,fontSize:14,borderRadius:24,border:'none',cursor:'pointer' }}>🗑 Apagar</button>
              <button onClick={()=>setSel(null)} style={{ width:'100%',height:36,background:'none',color:TEXTMU,fontSize:13,border:'none',cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmar pagamento */}
      {payConfirm&&(
        <div style={{position:'fixed',inset:0,zIndex:70,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPayConfirm(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}}/>
          <div style={{position:'relative',width:'88%',maxWidth:340,background:'#fff',borderRadius:20,padding:'24px 16px',boxShadow:'0 8px 40px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#1C1C1E',margin:'0 0 4px'}}>Confirmar pagamento</h3>
            <p style={{fontSize:13,color:'#8E8E93',margin:'0 0 18px'}}>{payConfirm.description}</p>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:'#8E8E93',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Data do pagamento</label>
              <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 12px',fontSize:14,color:'#1C1C1E',outline:'none',boxSizing:'border-box',WebkitAppearance:'none',maxWidth:'100%'}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:600,color:'#8E8E93',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor pago</label>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#8E8E93',fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" value={payValue}
                  onChange={e=>setPayValue(maskCurrency(e.target.value))}
                  style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 14px 0 40px',fontSize:16,fontWeight:700,color:'#1C1C1E',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPayConfirm(null)} style={{flex:1,height:46,background:'#F5F5F7',color:'#48484A',borderRadius:12,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={confirmPay} style={{flex:1,height:46,background:'#34C759',color:'#fff',borderRadius:12,border:'none',fontSize:14,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}