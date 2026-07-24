'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Bell } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string; holder:string; description:string; category:string; amount:number; status:string; purchase_date:string; transaction_type:string; installment_value?:number }

const BADGE: Record<string,string> = {
  pago:'badge-pago', pendente:'badge-pendente', previsto:'badge-previsto',
  atrasado:'badge-atrasado', cancelado:'badge-previsto'
}
const BADGE_LABEL: Record<string,string> = {
  pago:'Pago', pendente:'Pendente', previsto:'Previsto', atrasado:'Atrasado', cancelado:'Cancelado'
}

// Estilos comuns
const pebble = {
  background:'#3D2C20', borderRadius:32, padding:20,
  boxShadow:'0 4px 8px rgba(0,0,0,0.2)', marginBottom:14,
}
const pebbleSm = { ...pebble, borderRadius:24, padding:14 }

export default function Dashboard() {
  const [txs,setTxs]         = useState<Tx[]>([])
  const [loading,setLoading] = useState(true)
  const [hide,setHide]       = useState(false)
  const [selected,setSelected] = useState<Tx|null>(null)

  useEffect(()=>{load()},[])

  async function load() {
    setLoading(true)
    const now = new Date()
    const {data} = await createClient().from('transactions').select('*')
      .gte('purchase_date',format(startOfMonth(now),'yyyy-MM-dd'))
      .lte('purchase_date',format(endOfMonth(now),'yyyy-MM-dd'))
      .order('purchase_date',{ascending:false})
    setTxs(data||[]); setLoading(false)
  }

  async function markPaid(tx:Tx) {
    await createClient().from('transactions').update({status:'pago',paid_date:format(new Date(),'yyyy-MM-dd')}).eq('id',tx.id)
    toast.success('Pago!'); setSelected(null); load()
  }
  async function del(tx:Tx) {
    if(!confirm('Apagar?'))return
    await createClient().from('transactions').delete().eq('id',tx.id)
    toast.success('Apagado!'); setSelected(null); load()
  }

  const v = (n:number) => hide?'•••':formatCurrency(n)
  const recR = txs.filter(t=>t.transaction_type==='receita')
  const recD = txs.filter(t=>t.transaction_type!=='receita')
  const totalR   = recR.reduce((s,t)=>s+t.amount,0)
  const recebidas= recR.filter(t=>t.status==='pago').reduce((s,t)=>s+t.amount,0)
  const previstas= recR.filter(t=>t.status==='previsto').reduce((s,t)=>s+t.amount,0)
  const totalD   = recD.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const pagas    = recD.filter(t=>t.status==='pago').reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const pendentes= recD.filter(t=>['pendente','atrasado'].includes(t.status)).reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const economia = recebidas - pagas
  const diasRest = new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()-new Date().getDate()
  const gastoDia = diasRest>0?Math.max(0,economia/diasRest):0
  const hoje=new Date(); const em7=new Date(); em7.setDate(em7.getDate()+7)
  const venc = txs.filter(t=>t.status==='pendente'&&t.transaction_type!=='receita'&&new Date(t.purchase_date)>=hoje&&new Date(t.purchase_date)<=em7).slice(0,3)

  return (
    <div style={{ background:'linear-gradient(180deg,#2A1B12 0%,#1F140D 100%)', minHeight:'100%', padding:'14px 14px 100px' }}>

      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:700, color:'#A69C8F', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {format(new Date(),'MMMM yyyy',{locale:ptBR})}
        </p>
        <button onClick={()=>setHide(!hide)} style={{ fontSize:11, color:'#A69C8F', background:'none', border:'none', cursor:'pointer' }}>
          {hide?'👁 Mostrar':'🙈 Ocultar'}
        </button>
      </div>

      {/* Pode gastar */}
      <div style={{ ...pebbleSm, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:11, color:'#A69C8F', marginBottom:4 }}>Pode gastar hoje</p>
          <p style={{ fontSize:28, fontWeight:700, color:'#D88B5B', lineHeight:1, fontVariantNumeric:'tabular-nums' as const }}>
            {v(gastoDia)}<span style={{ fontSize:13, fontWeight:400, color:'#A69C8F' }}>/dia</span>
          </p>
          <p style={{ fontSize:11, color:'#A69C8F', marginTop:4 }}>{diasRest} dias restantes</p>
        </div>
        <div style={{ width:44, height:44, background:'rgba(216,139,91,0.15)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>💰</div>
      </div>

      {/* Hero economia */}
      <div style={{ ...pebble }}>
        <p style={{ fontSize:12, color:'#A69C8F', marginBottom:4 }}>Economia do mês</p>
        <p style={{ fontSize:32, fontWeight:700, color:'#F4EFE8', lineHeight:1, fontVariantNumeric:'tabular-nums' as const }}>{v(economia)}</p>
        <p style={{ fontSize:11, color:'#D88B5B', marginTop:4 }}>
          {recebidas>0?`${((economia/recebidas)*100).toFixed(1)}% de poupança`:'Confirme as receitas para calcular'}
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }}>
          <div style={{ background:'rgba(164,201,180,0.08)', borderRadius:20, padding:14, border:'0.5px solid rgba(164,201,180,0.15)' }}>
            <p style={{ fontSize:11, color:'#A69C8F', marginBottom:4 }}>↑ Receitas</p>
            <p style={{ fontSize:16, fontWeight:700, color:'#F4EFE8', fontVariantNumeric:'tabular-nums' as const }}>{v(totalR)}</p>
            <div style={{ marginTop:8, paddingTop:8, borderTop:'0.5px solid rgba(164,201,180,0.1)' }}>
              <p style={{ fontSize:10, color:'#A69C8F', marginBottom:2 }}>A confirmar</p>
              <p style={{ fontSize:12, fontWeight:600, color:previstas>0?'#A4C9B4':'#A69C8F', fontVariantNumeric:'tabular-nums' as const }}>
                {previstas>0?v(previstas):'—'}
              </p>
            </div>
          </div>
          <div style={{ background:'rgba(216,139,91,0.08)', borderRadius:20, padding:14, border:'0.5px solid rgba(216,139,91,0.15)' }}>
            <p style={{ fontSize:11, color:'#A69C8F', marginBottom:4 }}>↓ Despesas</p>
            <p style={{ fontSize:16, fontWeight:700, color:'#F4EFE8', fontVariantNumeric:'tabular-nums' as const }}>{v(totalD)}</p>
            <div style={{ marginTop:8, paddingTop:8, borderTop:'0.5px solid rgba(216,139,91,0.1)' }}>
              <p style={{ fontSize:10, color:'#A69C8F', marginBottom:2 }}>A pagar</p>
              <p style={{ fontSize:12, fontWeight:600, color:pendentes>0?'#D88B5B':'#A69C8F', fontVariantNumeric:'tabular-nums' as const }}>
                {pendentes>0?v(pendentes):'—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Por pessoa */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        {['Lucas','Nicoly'].map(p=>{
          const r=txs.filter(t=>t.holder===p&&t.transaction_type==='receita').reduce((s,t)=>s+t.amount,0)
          const d=txs.filter(t=>t.holder===p&&t.transaction_type!=='receita').reduce((s,t)=>s+(t.installment_value||t.amount),0)
          return (
            <div key={p} style={{ background:'#3D2C20', borderRadius:24, padding:16, boxShadow:'0 4px 8px rgba(0,0,0,.2)' }}>
              <div style={{ width:28,height:28,borderRadius:'50%',background:'rgba(216,139,91,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#D88B5B',marginBottom:8 }}>{p[0]}</div>
              <p style={{ fontSize:13,fontWeight:600,color:'#D8CCBF' }}>{p}</p>
              <p style={{ fontSize:16,fontWeight:700,fontVariantNumeric:'tabular-nums' as const,marginTop:3,color:r-d>=0?'#A4C9B4':'#D88B5B' }}>{v(r-d)}</p>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'#A69C8F',marginTop:4 }}>
                <span>↑{v(r)}</span><span>↓{v(d)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vencimentos */}
      {venc.length>0&&(
        <div style={{ ...pebbleSm, marginBottom:14 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
            <Bell size={14} color="#D88B5B"/>
            <p style={{ fontSize:13,fontWeight:600,color:'#F4EFE8' }}>Vencendo em breve</p>
          </div>
          {venc.map((tx,i)=>(
            <div key={tx.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:i>0?'0.5px solid rgba(216,139,91,0.1)':'none' }}>
              <div>
                <p style={{ fontSize:13,fontWeight:500,color:'#D8CCBF' }}>{tx.description}</p>
                <p style={{ fontSize:11,color:'#A69C8F' }}>{tx.holder} · {format(parseISO(tx.purchase_date),'dd/MM')}</p>
              </div>
              <p style={{ fontSize:13,fontWeight:700,color:'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>{v(tx.amount)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Últimas transações — sem botões inline */}
      <div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
          <p style={{ fontSize:11,fontWeight:700,color:'#A69C8F',textTransform:'uppercase',letterSpacing:'0.07em' }}>Últimas transações</p>
          <Link href="/lancamentos" style={{ fontSize:11,color:'#D88B5B',display:'flex',alignItems:'center',gap:2 }}>Ver todas <ChevronRight size={11}/></Link>
        </div>
        {loading?(
          <div style={{ display:'flex',justifyContent:'center',padding:32 }}>
            <div style={{ width:22,height:22,border:'2px solid #D88B5B',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
          </div>
        ):txs.length===0?(
          <div style={{ ...pebble,textAlign:'center' }}>
            <p style={{ fontSize:13,color:'#A69C8F',marginBottom:8 }}>Nenhum lançamento este mês</p>
            <Link href="/lancamentos/novo" style={{ fontSize:12,color:'#D88B5B',fontWeight:600 }}>Adicionar primeiro →</Link>
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {txs.slice(0,8).map(tx=>{
              const isRec=tx.transaction_type==='receita'
              return (
                <button key={tx.id} onClick={()=>setSelected(tx)}
                  style={{ background:'#3D2C20',borderRadius:24,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,textAlign:'left',width:'100%',cursor:'pointer',boxShadow:'0 4px 8px rgba(0,0,0,.15)',border:'none' }}>
                  <div style={{ width:40,height:40,borderRadius:14,background:isRec?'rgba(164,201,180,0.12)':'rgba(216,139,91,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>
                    {CAT_ICONS[tx.category]||'📦'}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:15,fontWeight:500,color:'#D8CCBF',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.description}</p>
                    <p style={{ fontSize:12,color:'#A69C8F',marginTop:2 }}>{tx.category} · {tx.holder}</p>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <p style={{ fontSize:14,fontWeight:700,color:isRec?'#A4C9B4':'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>
                      {isRec?'+':'-'}{v(tx.installment_value||tx.amount)}
                    </p>
                    <span className={BADGE[tx.status]||'badge-pendente'}>{BADGE_LABEL[tx.status]||tx.status}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom sheet ao clicar */}
      {selected&&(
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end' }} onClick={()=>setSelected(null)}>
          <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(6px)' }}/>
          <div style={{ position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:'#3D2C20',borderRadius:'32px 32px 0 0',padding:'20px 20px 48px',border:'0.5px solid rgba(216,139,91,0.15)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36,height:3,background:'rgba(216,139,91,0.3)',borderRadius:2,margin:'0 auto 18px' }}/>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16,paddingBottom:16,borderBottom:'0.5px solid rgba(216,139,91,0.1)' }}>
              <div style={{ width:46,height:46,borderRadius:16,background:'rgba(216,139,91,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>
                {CAT_ICONS[selected.category]||'📦'}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:16,fontWeight:600,color:'#F4EFE8' }}>{selected.description}</p>
                <p style={{ fontSize:12,color:'#A69C8F' }}>{selected.category} · {selected.holder}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontSize:17,fontWeight:700,color:selected.transaction_type==='receita'?'#A4C9B4':'#D88B5B',fontVariantNumeric:'tabular-nums' as const }}>
                  {selected.transaction_type==='receita'?'+':'-'}{formatCurrency(selected.installment_value||selected.amount)}
                </p>
                <span className={BADGE[selected.status]||'badge-pendente'}>{BADGE_LABEL[selected.status]||selected.status}</span>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {selected.transaction_type!=='receita'&&selected.status!=='pago'&&(
                <button onClick={()=>markPaid(selected)} style={{ width:'100%',height:50,background:'#D88B5B',color:'#2A1B12',fontWeight:700,fontSize:15,borderRadius:20,border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(216,139,91,0.3)' }}>
                  ✓ Marcar como pago
                </button>
              )}
              {selected.transaction_type==='receita'&&selected.status==='previsto'&&(
                <Link href={`/lancamentos/editar/${selected.id}`} style={{ width:'100%',height:50,background:'#D88B5B',color:'#2A1B12',fontWeight:700,fontSize:15,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  ✓ Confirmar recebimento
                </Link>
              )}
              <Link href={`/lancamentos/editar/${selected.id}`} onClick={()=>setSelected(null)}
                style={{ width:'100%',height:46,background:'rgba(216,139,91,0.12)',color:'#D88B5B',fontWeight:600,fontSize:14,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',border:'0.5px solid rgba(216,139,91,0.2)' }}>
                ✏️ Editar lançamento
              </Link>
              <button onClick={()=>del(selected)}
                style={{ width:'100%',height:46,background:'rgba(200,60,60,0.1)',color:'#E07070',fontWeight:600,fontSize:14,borderRadius:20,border:'0.5px solid rgba(200,60,60,0.2)',cursor:'pointer' }}>
                🗑 Apagar
              </button>
              <button onClick={()=>setSelected(null)} style={{ width:'100%',height:36,background:'none',color:'#A69C8F',fontSize:13,border:'none',cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
