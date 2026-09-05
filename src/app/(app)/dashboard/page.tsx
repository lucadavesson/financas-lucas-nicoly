'use client'
import { generateRecurrents } from '@/lib/utils/recurrents'
import { autoCorrigirStatusVencido } from '@/lib/utils/statusEngine'
import { getCicloFechado, cicloEhRecente } from '@/lib/utils/faturaEngine'
import { useState, useEffect } from 'react'
import { useBackGuard } from '@/lib/hooks/useBackGuard'
import ModalPortal from '@/components/ui/ModalPortal'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS, maskCurrency, unmaskCurrency, dataParaExibir } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type Tx = { id:string;holder:string;description:string;category:string;amount:number;status:string;purchase_date:string;transaction_type:string;type?:string;installment_value?:number;payment_method?:string;card_name?:string;paid_amount?:number;is_recurring?:boolean;recurring_day?:number;paid_date?:string }

type Conta = {
  key:string; txId?:string; titulo:string; subtitulo:string; valor:number
  dueDate:string; tipo:'conta'|'fatura'; pago:boolean; categoria?:string
}

const BG='#F5F5F7'; const TEXT='#1C1C1E'; const TEXTLT='#48484A'; const TEXTMU='#8E8E93'
const GREEN='#34C759'; const GREENBG='rgba(52,199,89,0.08)'; const RED='#FF3B30'; const REDBG='rgba(255,59,48,0.06)'
const TERRA='#C4622D'; const TERRABG='rgba(196,98,45,0.06)'; const BLUE='#007AFF'

function BadgeInline({status}: {status:string}) {
  const cfg: Record<string,{bg:string;color:string;label:string;pulse:boolean}> = {
    Pago:     {bg:'rgba(52,199,89,0.1)',  color:'#30A14E', label:'Pago',     pulse:false},
    Pendente: {bg:'rgba(255,149,0,0.1)',  color:'#CC7700', label:'Pendente', pulse:true},
    Previsto: {bg:'rgba(0,122,255,0.08)', color:'#007AFF', label:'Previsto', pulse:false},
    Atrasado: {bg:'rgba(255,59,48,0.08)', color:'#FF3B30', label:'Atrasado', pulse:true},
    Cancelado:{bg:'rgba(0,0,0,0.04)',     color:'#8E8E93', label:'Cancelado',pulse:false},
  }
  const c = cfg[status] || cfg.Pendente
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:c.bg,color:c.color,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,flexShrink:0}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.color,animation:c.pulse?'pulse 1.5s ease-in-out infinite':'none'}}/>
      {c.label}
    </span>
  )
}

export default function Dashboard() {
  const [txs,setTxs]=useState<Tx[]>([]); const [loading,setLoad]=useState(true); const [hide,setHide]=useState(false)
  const [dashSecs,setDashSecs]=useState<Record<string,boolean>>(()=>{try{const s=sessionStorage.getItem('ln_dash_secs');return s?JSON.parse(s):{resumo:false,pessoas:false,alertas:true,metas:false,gastos:false,ultimas:false}}catch{return {}}})
  const [curMonth, setCurMonth] = useState(new Date())
  const [settings,setSettings]=useState<any>(null)
  const [catLimits,setCatLimits]=useState<Record<string,number>>({})
  const [goals,setGoals]=useState<any[]>([])
  const [cards,setCards]=useState<any[]>([])
  const [faturaPorCartao,setFaturaPorCartao]=useState<Record<string,number>>({})
  const [semCartao,setSemCartao]=useState<{valor:number;qtd:number}>({valor:0,qtd:0})
  const [faturasFechadas,setFaturasFechadas]=useState<{cardId:string;cardName:string;ciclo:string;total:number}[]>([])
  const [confirmandoFatura,setConfirmandoFatura]=useState<{cardId:string;cardName:string;ciclo:string;total:number}|null>(null)
  const [confirmValorRaw,setConfirmValorRaw]=useState('')
  const [abaContas,setAbaContas]=useState<'a_pagar'|'vencidas'|'pagas'>('a_pagar')
  useEffect(()=>{load()}, [curMonth])
  useEffect(()=>{try{sessionStorage.setItem('ln_dash_secs',JSON.stringify(dashSecs))}catch{}},[dashSecs])
  const togSec=(k:string)=>setDashSecs(p=>({...p,[k]:!p[k]}))

  async function load() {
    setLoad(true)
    await autoCorrigirStatusVencido()
    const s=createClient()
    const {data:{user}}=await s.auth.getUser()
    const monthStart=format(startOfMonth(curMonth),'yyyy-MM-dd')
    const monthEnd=format(endOfMonth(curMonth),'yyyy-MM-dd')
    const [{data},{data:settingsData},{data:limitsData},{data:goalsData},{data:cardsData},{data:faturaTxs}]=await Promise.all([
      s.from('transactions').select('*')
        .gte('purchase_date',monthStart)
        .lte('purchase_date',monthEnd)
        .order('purchase_date',{ascending:false}),
      s.from('app_settings').select('*').limit(1).maybeSingle(),
      s.from('category_limits').select('*').eq('owner_id',user?.id||''),
      s.from('goals').select('*').eq('status','ativa').order('name'),
      s.from('cards').select('*').eq('is_active',true),
      // Transações de cartão cuja fatura vence neste mês (billing_month, com fallback pra purchase_date se billing_month faltar)
      s.from('transactions').select('card_name,amount,installment_value,status,billing_month,purchase_date')
        .eq('payment_method','cartao_credito')
        .neq('status','Cancelado'),
    ])
    setTxs(data||[])
    setSettings(settingsData)
    setGoals(goalsData||[])
    setCards(cardsData||[])
    // Agrupar fatura pendente por cartão - usa billing_month, ou purchase_date como fallback (dados antigos)
    const faturaMap:Record<string,number>={}
    let semCartaoValor=0, semCartaoQtd=0
    ;(faturaTxs||[]).forEach((t:any)=>{
      if(t.status==='Pago')return
      const mesRef=t.billing_month||t.purchase_date
      if(!mesRef||mesRef<monthStart||mesRef>monthEnd)return
      // Compra no crédito sem cartão escolhido não é fatura de ninguém. Antes
      // caía num balde chamado "Cartão" e virava uma "Fatura Cartão" fantasma,
      // que não batia com nenhum cartão da tela de Cartões.
      const nome=(t.card_name||'').trim()
      if(!nome){ semCartaoValor+=(t.installment_value||t.amount||0); semCartaoQtd++; return }
      faturaMap[nome]=(faturaMap[nome]||0)+(t.installment_value||t.amount||0)
    })
    setFaturaPorCartao(faturaMap)
    setSemCartao({valor:semCartaoValor,qtd:semCartaoQtd})

    // Detectar faturas que acabaram de fechar e ainda não foram confirmadas pelo usuário
    const pendentesConfirmacao:{cardId:string;cardName:string;ciclo:string;total:number}[]=[]
    ;(cardsData||[]).forEach((c:any)=>{
      if(c.card_type&&c.card_type!=='credito')return
      const ciclo=getCicloFechado(c.closing_day||1)
      if(!cicloEhRecente(ciclo))return
      if(c.last_confirmed_billing_month===ciclo)return // já confirmada
      const cardName=`${c.name} — ${c.holder}`
      const total=(faturaTxs||[]).filter((t:any)=>t.card_name===cardName&&(t.billing_month||t.purchase_date)===ciclo)
        .reduce((sum:number,t:any)=>sum+(t.installment_value||t.amount||0),0)
      if(total<=0)return
      pendentesConfirmacao.push({cardId:c.id,cardName,ciclo,total})
    })
    setFaturasFechadas(pendentesConfirmacao)

    const lm:Record<string,number>={}
    limitsData?.forEach((r:any)=>{lm[r.category]=r.limit_amount})
    setCatLimits(lm)
    setLoad(false)
    // Gerar recorrentes do mês se necessário (background, não bloqueia).
    // Antes só rodava no mês corrente, então navegar para outubro mostrava um
    // mês sem nenhuma conta fixa. Agora vale para qualquer mês visitado — o
    // próprio generateRecurrents recusa mês passado e mês longe demais.
    {
      generateRecurrents(curMonth).then(r => {
        if (r.generated > 0) {
          toast.success(`${r.generated} conta${r.generated>1?'s':''} recorrente${r.generated>1?'s':''} gerada${r.generated>1?'s':''}`)
          // Recarregar dados
          s.from('transactions').select('*')
            .gte('purchase_date',format(startOfMonth(curMonth),'yyyy-MM-dd'))
            .lte('purchase_date',format(endOfMonth(curMonth),'yyyy-MM-dd'))
            .order('purchase_date',{ascending:false})
            .then(({data:fresh})=>setTxs(fresh||[]))
        }
      }).catch(err => console.error('generateRecurrents error:', err))
    }
  }

  function prevMonth(){setCurMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}
  function nextMonth(){setCurMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}
  const monthLabel = format(curMonth,'MMMM yyyy',{locale:ptBR})
  const isCurrentMonth = format(curMonth,'yyyy-MM')===format(new Date(),'yyyy-MM')

  const [payModal, setPayModal] = useState<{id:string;desc:string;amount:number}|null>(null)
  const [payDate, setPayDate]   = useState(format(new Date(),'yyyy-MM-dd'))
  const [payValue, setPayValue] = useState('')
  useBackGuard(!!payModal, ()=>setPayModal(null))
  useBackGuard(!!confirmandoFatura, ()=>setConfirmandoFatura(null))

  function openPayModal(id:string, desc:string, amount:number) {
    setPayDate(format(new Date(),'yyyy-MM-dd'))
    setPayValue(maskCurrency(Math.round(amount*100).toString()))
    setPayModal({id,desc,amount})
  }

  async function confirmPay() {
    if (!payModal) return
    await createClient().from('transactions').update({
      status:'Pago',
      paid_date: payDate,
      paid_amount: unmaskCurrency(payValue) || payModal.amount,
    }).eq('id', payModal.id)
    toast.success(`✓ "${payModal.desc}" pago`)
    setPayModal(null)
    load()
  }

  function openConfirmFatura(f:{cardId:string;cardName:string;ciclo:string;total:number}) {
    setConfirmValorRaw(maskCurrency(Math.round(f.total*100).toString()))
    setConfirmandoFatura(f)
  }

  async function confirmFatura() {
    if (!confirmandoFatura) return
    const valorReal = unmaskCurrency(confirmValorRaw) || confirmandoFatura.total
    const { error } = await createClient().from('cards').update({
      last_confirmed_billing_month: confirmandoFatura.ciclo,
      last_confirmed_total: valorReal,
    }).eq('id', confirmandoFatura.cardId)
    if (error) {
      toast.error('Ainda não é possível salvar — falta rodar a migration supabase-fatura-confirmation.sql no banco')
      return
    }
    toast.success(`✓ Fatura ${confirmandoFatura.cardName} confirmada`)
    setConfirmandoFatura(null)
    load()
  }

  const v=(n:number)=>hide?'•••':formatCurrency(n)
  const isReceita=(t:Tx)=>t.transaction_type==='receita'||t.type==='Receita'
  const despesas=txs.filter(t=>!isReceita(t))
  const receitas=txs.filter(t=>isReceita(t))
  const totalEntrou=receitas.filter(t=>t.status==='Pago').reduce((s,t)=>s+t.amount,0)
  const totalPrevisto=receitas.filter(t=>t.status==='Previsto').reduce((s,t)=>s+t.amount,0)
  const totalGastou=despesas.reduce((s,t)=>s+(t.installment_value||t.amount),0)
  const totalPago=despesas.filter(t=>t.status==='Pago').reduce((s,t)=>s+(t.paid_amount||t.installment_value||t.amount),0)
  const salarioEsperado=(settings?.salary_lucas||0)+(settings?.salary_nicoly||0)
  const saldo=totalEntrou-totalGastou
  const pctPago=totalGastou>0?Math.min(100,(totalPago/totalGastou)*100):0

  const hoje=new Date()
  const hojeStr=format(hoje,'yyyy-MM-dd')
  const isCartao=(t:Tx)=>t.payment_method==='cartao_credito'

  // ── Central de Contas ──────────────────────────────────────
  // Data em que a conta REALMENTE precisa ser paga. Para recorrentes usamos o
  // dia de vencimento configurado (clampado no último dia do mês, p/ dia 31 em
  // fevereiro); para o resto, a própria data do lançamento.
  function dueDateDe(t:Tx):string{
    if(t.recurring_day){
      const [y,m]=t.purchase_date.split('-').map(Number)
      const ultimoDia=new Date(y,m,0).getDate()
      const dia=Math.min(t.recurring_day,ultimoDia)
      return `${t.purchase_date.slice(0,8)}${String(dia).padStart(2,'0')}`
    }
    return t.purchase_date
  }

  const contasDespesa:Conta[]=despesas
    .filter(t=>t.status!=='Cancelado'&&!isCartao(t))
    .map(t=>({
      key:t.id, txId:t.id,
      titulo:t.description,
      subtitulo:`${t.holder} · ${t.category}`,
      valor:t.status==='Pago'?(t.paid_amount||t.installment_value||t.amount):(t.installment_value||t.amount),
      dueDate:dueDateDe(t),
      tipo:'conta' as const,
      pago:t.status==='Pago',
      categoria:t.category,
    }))

  const ultimoDiaMes=new Date(curMonth.getFullYear(),curMonth.getMonth()+1,0).getDate()
  const contasFatura:Conta[]=Object.entries(faturaPorCartao)
    .filter(([,total])=>total>0)
    .map(([cardName,total])=>{
      const cardInfo=cards.find(c=>`${c.name} — ${c.holder}`===cardName)
      const dia=Math.min(cardInfo?.due_day||1,ultimoDiaMes)
      return {
        key:'fatura_'+cardName,
        titulo:`Fatura ${cardName}`,
        subtitulo:'Cartão de crédito',
        valor:total,
        dueDate:format(new Date(curMonth.getFullYear(),curMonth.getMonth(),dia),'yyyy-MM-dd'),
        tipo:'fatura' as const,
        pago:false,
      }
    })

  const todasContas=[...contasDespesa,...contasFatura]
  const porVencimento=(a:Conta,b:Conta)=>a.dueDate.localeCompare(b.dueDate)
  const contasVencidas=todasContas.filter(c=>!c.pago&&c.dueDate<hojeStr).sort(porVencimento)
  // "A pagar" é TUDO que está em aberto — conta vencida continua sendo conta a
  // pagar. Antes as vencidas eram excluídas daqui, então a aba aparecia vazia
  // mesmo havendo 8 contas atrasadas. As vencidas vêm primeiro na ordenação.
  const contasAPagar=todasContas.filter(c=>!c.pago).sort(porVencimento)
  const contasPagas=todasContas.filter(c=>c.pago).sort((a,b)=>b.dueDate.localeCompare(a.dueDate))
  const contasVisiveis=abaContas==='vencidas'?contasVencidas:abaContas==='pagas'?contasPagas:contasAPagar
  const totalVencidas=contasVencidas.reduce((s,c)=>s+c.valor,0)
  const totalAPagar=contasAPagar.reduce((s,c)=>s+c.valor,0)

  // Rótulo de status no estilo do extrato de boletos do banco
  function labelVencimento(c:Conta){
    const dias=Math.round((parseISO(c.dueDate).getTime()-parseISO(hojeStr).getTime())/86400000)
    if(c.pago)return {txt:`Pago · ${format(parseISO(c.dueDate),'dd/MM/yy')}`,cor:GREEN,icone:'✓'}
    if(dias<0)return {txt:`Venceu em ${format(parseISO(c.dueDate),'dd/MM/yy')}`,cor:RED,icone:'⚠️'}
    if(dias===0)return {txt:`Vence hoje, ${format(parseISO(c.dueDate),'dd/MM/yy')}`,cor:'#CC7700',icone:'🔔'}
    if(dias<=3)return {txt:`Vence em ${format(parseISO(c.dueDate),'dd/MM/yy')}`,cor:'#CC7700',icone:'⏰'}
    return {txt:`Vence em ${format(parseISO(c.dueDate),'dd/MM/yy')}`,cor:TEXTLT,icone:'📅'}
  }

  const catMap:Record<string,number>={}
  despesas.forEach(t=>{catMap[t.category]=(catMap[t.category]||0)+(t.installment_value||t.amount)})
  const topCats=Object.entries(catMap).sort(([,a],[,b])=>b-a).slice(0,4)

  // Alertas de limite por categoria
  const catAlertas=Object.entries(catLimits).filter(([cat,lim])=>{
    const gasto=catMap[cat]||0
    return lim>0 && gasto>=lim*0.8 // alerta a partir de 80%
  }).map(([cat,lim])=>({cat,lim,gasto:catMap[cat]||0,pct:Math.round(((catMap[cat]||0)/lim)*100)}))

  const card=(extra?:any)=>({background:'#fff',borderRadius:16,padding:'16px 18px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',marginBottom:12,...extra})

  if(loading) return <div style={{background:BG,minHeight:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:22,height:22,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>

  return (
    <div style={{background:BG,minHeight:'100%',padding:'16px 16px 160px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.5)}}`}</style>

      {/* Mês navegável + ocultar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={prevMonth} style={{width:28,height:28,background:'rgba(0,0,0,0.04)',borderRadius:8,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:TEXTLT}}>‹</button>
          <p style={{fontSize:13,fontWeight:700,color:TEXT,textTransform:'capitalize',margin:0,minWidth:110,textAlign:'center'}}>{monthLabel}</p>
          <button onClick={nextMonth} style={{width:28,height:28,background:'rgba(0,0,0,0.04)',borderRadius:8,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:TEXTLT}}>›</button>
          {!isCurrentMonth&&<button onClick={()=>setCurMonth(new Date())} style={{fontSize:10,color:TERRA,background:'rgba(196,98,45,0.08)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontWeight:600}}>Hoje</button>}
        </div>
        <button onClick={()=>setHide(h=>!h)} style={{fontSize:12,color:TEXTMU,background:'none',border:'none',cursor:'pointer'}}>{hide?'👁 Mostrar':'👁 Ocultar'}</button>
      </div>

      
      
      {/* ── Hero: saldo do mês ────────────────────────────── */}
      <div style={{borderRadius:26,padding:'22px 22px 20px',marginBottom:12,position:'relative',overflow:'hidden',
        background:'linear-gradient(150deg,#3A2016 0%,#5C3320 55%,#7A4526 100%)',boxShadow:'0 6px 22px rgba(58,32,22,0.28)'}}>
        <div style={{position:'absolute',top:-70,right:-50,width:210,height:210,borderRadius:'50%',background:'rgba(255,255,255,0.05)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-90,left:-40,width:170,height:170,borderRadius:'50%',background:'rgba(255,255,255,0.035)',pointerEvents:'none'}}/>

        <div style={{position:'relative'}}>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.55)',margin:'0 0 6px',letterSpacing:'0.02em'}}>Saldo disponível</p>
          <p style={{fontSize:36,fontWeight:800,color:'#fff',margin:0,lineHeight:1.05,letterSpacing:'-1px',fontVariantNumeric:'tabular-nums'}}>{v(saldo)}</p>
          {saldo<0&&(
            <p style={{fontSize:12,color:'rgba(255,140,130,0.95)',fontWeight:600,margin:'8px 0 0'}}>Orçamento estourado neste mês</p>
          )}

          <div style={{display:'flex',gap:10,marginTop:20}}>
            <div style={{flex:1,background:'rgba(255,255,255,0.09)',borderRadius:16,padding:'11px 13px',backdropFilter:'blur(6px)'}}>
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:5}}>
                <ArrowUpRight size={13} color="rgba(120,230,160,0.95)"/>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.6)',fontWeight:600}}>Entrou</span>
              </div>
              <p style={{fontSize:16,fontWeight:700,color:'#fff',margin:0,fontVariantNumeric:'tabular-nums'}}>{v(totalEntrou)}</p>
              {totalPrevisto>0&&<p style={{fontSize:10,color:'rgba(255,255,255,0.4)',margin:'2px 0 0'}}>+{v(totalPrevisto)} previsto</p>}
            </div>
            <div style={{flex:1,background:'rgba(255,255,255,0.09)',borderRadius:16,padding:'11px 13px',backdropFilter:'blur(6px)'}}>
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:5}}>
                <ArrowDownRight size={13} color="rgba(255,150,140,0.95)"/>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.6)',fontWeight:600}}>Gastou</span>
              </div>
              <p style={{fontSize:16,fontWeight:700,color:'#fff',margin:0,fontVariantNumeric:'tabular-nums'}}>{v(totalGastou)}</p>
              <p style={{fontSize:10,color:'rgba(255,255,255,0.4)',margin:'2px 0 0'}}>{despesas.length} lançamentos</p>
            </div>
          </div>

          <div style={{marginTop:16}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:6}}>
              <span>{v(totalPago)} pago de {v(totalGastou)}</span>
              <span style={{fontWeight:700,color:pctPago>=100?'rgba(120,230,160,0.95)':'rgba(255,255,255,0.8)'}}>{pctPago.toFixed(0)}%</span>
            </div>
            <div style={{height:5,background:'rgba(255,255,255,0.13)',borderRadius:99,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:99,width:`${pctPago}%`,background:'linear-gradient(90deg,rgba(120,230,160,0.7),rgba(120,230,160,1))',transition:'width 0.5s'}}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Atalhos rápidos ────────────────────────────────── */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[
          {href:'/lancamentos/novo',emoji:'＋',label:'Lançar'},
          {href:'/pagamentos',emoji:'✓',label:'Pagar'},
          {href:'/cartoes',emoji:'💳',label:'Cartões'},
          {href:'/parcelamentos',emoji:'📄',label:'Parcelas'},
        ].map(a=>(
          <Link key={a.href} href={a.href} style={{flex:1,background:'#fff',borderRadius:16,padding:'12px 6px',textAlign:'center',textDecoration:'none',border:'1px solid rgba(0,0,0,0.05)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
            <p style={{fontSize:17,margin:'0 0 4px',lineHeight:1,color:TERRA}}>{a.emoji}</p>
            <p style={{fontSize:11,fontWeight:600,color:TEXTLT,margin:0}}>{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Por pessoa */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        {['Lucas','Nicoly'].map(p=>{
          const r=txs.filter(t=>t.holder===p&&isReceita(t)).reduce((s,t)=>s+t.amount,0)
          const d=txs.filter(t=>t.holder===p&&!isReceita(t)).reduce((s,t)=>s+(t.installment_value||t.amount),0)
          return(
            <div key={p} style={{...card({marginBottom:0})}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:TERRABG,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:TERRA,marginBottom:8}}>{p[0]}</div>
              <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:'0 0 4px'}}>{p}</p>
              <p style={{fontSize:18,fontWeight:700,color:r-d>=0?GREEN:RED,fontVariantNumeric:'tabular-nums',margin:'0 0 4px'}}>{v(r-d)}</p>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:TEXTMU}}>
                <span style={{color:GREEN}}>↑{v(r)}</span><span style={{color:RED}}>↓{v(d)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lançamento no crédito sem cartão — dado incompleto, não fatura */}
      {semCartao.qtd>0&&(
        <div style={{...card(),background:'rgba(255,149,0,0.06)',border:'1px solid rgba(255,149,0,0.22)',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
            <span style={{fontSize:14}}>⚠️</span>
            <p style={{fontSize:13,fontWeight:700,color:'#B37700',margin:0}}>
              {semCartao.qtd} lançamento{semCartao.qtd>1?'s':''} no crédito sem cartão
            </p>
          </div>
          <p style={{fontSize:11.5,color:TEXTMU,margin:'0 0 10px',lineHeight:1.45}}>
            Somam {v(semCartao.valor)} e não entram na fatura de nenhum cartão. Abra cada um e escolha o cartão para eles aparecerem no lugar certo.
          </p>
          <Link href="/lancamentos" style={{fontSize:11.5,fontWeight:700,color:'#fff',background:'#FF9500',borderRadius:8,padding:'6px 12px',textDecoration:'none',display:'inline-block'}}>
            Corrigir lançamentos
          </Link>
        </div>
      )}

      {/* ── Fatura fechou: confirmar valor real ───────────── */}
      {faturasFechadas.length>0&&(
        <div style={{...card(),background:'rgba(0,122,255,0.05)',border:'1px solid rgba(0,122,255,0.18)',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <span style={{fontSize:14}}>🔒</span>
            <p style={{fontSize:13,fontWeight:700,color:BLUE,margin:0}}>Fatura{faturasFechadas.length>1?'s':''} fechada{faturasFechadas.length>1?'s':''} — confirme o valor</p>
          </div>
          {faturasFechadas.map((f,i)=>(
            <div key={f.cardId} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderTop:i>0?'0.5px solid rgba(0,0,0,0.05)':undefined}}>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{f.cardName}</p>
                <p style={{fontSize:11,color:BLUE,fontWeight:600,margin:'2px 0 0'}}>Calculado: {v(f.total)}</p>
              </div>
              <button onClick={()=>openConfirmFatura(f)} style={{fontSize:11,fontWeight:700,color:'#fff',background:BLUE,border:'none',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>Confirmar</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Central de Contas ──────────────────────────────── */}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
          <h3 style={{fontSize:16,fontWeight:800,color:TEXT,margin:0}}>Central de Contas</h3>
          <Link href="/pagamentos" style={{fontSize:11,color:TERRA,fontWeight:700,textDecoration:'none'}}>Ver todas →</Link>
        </div>

        {/* Abas */}
        <div style={{display:'flex',gap:6,marginBottom:12,borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
          {([
            {k:'a_pagar' as const, label:'A pagar', n:contasAPagar.length},
            {k:'vencidas' as const,label:'Vencidas',n:contasVencidas.length},
            {k:'pagas' as const,   label:'Pagas',   n:contasPagas.length},
          ]).map(t=>{
            const on=abaContas===t.k
            const cor=t.k==='vencidas'&&t.n>0?RED:t.k==='pagas'?GREEN:TERRA
            return (
              <button key={t.k} onClick={()=>setAbaContas(t.k)}
                style={{background:'none',border:'none',cursor:'pointer',padding:'8px 12px 10px',position:'relative',
                  fontSize:13,fontWeight:on?800:600,color:on?cor:TEXTMU}}>
                {t.label} ({t.n})
                {on&&<div style={{position:'absolute',left:8,right:8,bottom:-1,height:2.5,borderRadius:99,background:cor}}/>}
              </button>
            )
          })}
        </div>

        {/* Resumo da aba */}
        {abaContas!=='pagas'&&contasVisiveis.length>0&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 2px 10px'}}>
            <span style={{fontSize:11,color:TEXTMU,fontWeight:600}}>
              {abaContas==='vencidas'
                ?'Total vencido'
                :contasVencidas.length>0
                  ?`Total a pagar · ${contasVencidas.length} já vencida${contasVencidas.length>1?'s':''}`
                  :'Total a pagar'}
            </span>
            <span style={{fontSize:15,fontWeight:800,color:abaContas==='vencidas'?RED:TEXT,fontVariantNumeric:'tabular-nums'}}>
              {v(abaContas==='vencidas'?totalVencidas:totalAPagar)}
            </span>
          </div>
        )}

        {contasVisiveis.length===0?(
          <div style={{background:'#fff',borderRadius:18,padding:'28px 20px',textAlign:'center',border:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:26,margin:'0 0 8px'}}>{abaContas==='vencidas'?'🎉':abaContas==='pagas'?'📭':'✨'}</p>
            <p style={{fontSize:13,fontWeight:600,color:abaContas==='vencidas'?GREEN:TEXTMU,margin:0}}>
              {abaContas==='vencidas'?'Nenhuma conta vencida!':abaContas==='pagas'?'Nada pago ainda neste mês':'Nenhuma conta a pagar'}
            </p>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {contasVisiveis.map(c=>{
              const st=labelVencimento(c)
              const linha={display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 15px'}
              return (
                <div key={c.key} style={{background:'#fff',borderRadius:18,overflow:'hidden',border:'1px solid rgba(0,0,0,0.05)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  {/* Cabeçalho: nome + ação */}
                  <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'13px 15px 11px'}}>
                    <div style={{width:34,height:34,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,
                      background:c.tipo==='fatura'?'rgba(196,98,45,0.1)':'rgba(0,0,0,0.035)'}}>
                      {c.tipo==='fatura'?'💳':(CAT_ICONS[c.categoria||'']||'📦')}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:14,fontWeight:700,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.titulo}</p>
                      <p style={{fontSize:11.5,color:TEXTMU,margin:'2px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.subtitulo}</p>
                    </div>
                    {!c.pago&&(c.tipo==='fatura'?(
                      <Link href="/pagamentos" style={{fontSize:12.5,fontWeight:700,color:TERRA,textDecoration:'none',flexShrink:0,paddingTop:2}}>Pagar</Link>
                    ):(
                      <button onClick={()=>openPayModal(c.txId!,c.titulo,c.valor)}
                        style={{fontSize:12.5,fontWeight:700,color:TERRA,background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:'2px 0 0'}}>Pagar</button>
                    ))}
                  </div>

                  {/* Status */}
                  <div style={{...linha,background:'rgba(0,0,0,0.018)',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
                    <span style={{fontSize:12,color:TEXTMU}}>Status</span>
                    <span style={{fontSize:12,fontWeight:700,color:st.cor,display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:11}}>{st.icone}</span>{st.txt}
                    </span>
                  </div>

                  {/* Valor */}
                  <div style={{...linha,background:'rgba(0,0,0,0.018)',borderTop:'1px solid rgba(0,0,0,0.04)'}}>
                    <span style={{fontSize:12,color:TEXTMU}}>Valor</span>
                    <span style={{fontSize:14,fontWeight:800,color:c.pago?GREEN:TEXT,fontVariantNumeric:'tabular-nums'}}>{v(c.valor)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Alertas de limite */}
      {catAlertas.length>0&&(
        <div style={{...card({marginBottom:12})}}>
          <p style={{fontSize:14,fontWeight:700,color:'#FF3B30',margin:'0 0 12px'}}>⚠️ Alertas de limite</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {catAlertas.map(a=>(
              <div key={a.cat}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:16}}>{CAT_ICONS[a.cat]||'📦'}</span>
                    <span style={{fontSize:13,fontWeight:600,color:TEXT}}>{a.cat}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:a.pct>=100?'#FF3B30':'#CC7700'}}>{a.pct}%</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:TEXTMU,marginBottom:4}}>
                  <span>{v(a.gasto)} de {v(a.lim)}</span>
                  <span style={{color:a.pct>=100?'#FF3B30':'#CC7700'}}>{a.pct>=100?'Estourou!':'Atenção'}</span>
                </div>
                <div style={{height:4,background:'#FF3B30',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:99,width:`${Math.min(a.pct,100)}%`,background:a.pct>=100?'#FF3B30':'#FF9500',transition:'width 0.5s'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metas ativas */}
      {goals.length>0&&(
        <div style={{...card({marginBottom:12})}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>🎯 Metas</p>
            <Link href="/metas" style={{fontSize:11,color:TERRA,fontWeight:600,textDecoration:'none'}}>Ver todas →</Link>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {goals.slice(0,3).map((g:any)=>{
              const pct=g.target_amount>0?Math.min(100,g.current_amount/g.target_amount*100):0
              return (
                <div key={g.id} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:18}}>{g.icon==='diamond'?'💍':g.icon==='plane'?'✈️':g.icon==='home'?'🏠':g.icon==='car'?'🚗':g.icon==='ring'?'💍':'🎯'}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:600,color:TEXT}}>{g.name}</span>
                      <span style={{fontSize:11,fontWeight:700,color:g.color||TERRA}}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{height:4,background:'#FF3B30',borderRadius:99,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:g.color||TERRA,transition:'width 0.5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                      <span style={{fontSize:10,color:TEXTMU}}>{v(g.current_amount)}</span>
                      <span style={{fontSize:10,color:TEXTMU}}>{v(g.target_amount)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Maiores gastos */}
      {topCats.length>0&&(
        <div style={{background:'#fff',borderRadius:20,marginBottom:12,border:'1px solid rgba(0,0,0,0.04)',overflow:'hidden'}}>
          <button onClick={()=>togSec('gastos')} style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,fontWeight:700,color:TEXT}}>📊 Maiores gastos</span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Link href="/relatorios" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:TERRA,fontWeight:600,textDecoration:'none'}}>Relatório</Link>
              {dashSecs.gastos?<ChevronUp size={16} color={TEXTMU}/>:<ChevronDown size={16} color={TEXTMU}/>}
            </div>
          </button>
          {dashSecs.gastos&&(<div style={{padding:'0 16px 12px'}}>
          {topCats.map(([cat,val],i)=>{
            const pct=totalGastou>0?(val/totalGastou)*100:0
            const cores=['#C4622D','#007AFF','#34C759','#FF9500']
            return(
              <div key={cat} style={{marginBottom:i<topCats.length-1?12:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontSize:13,color:TEXT}}>{CAT_ICONS[cat]||'📦'} {cat}</span>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:13,color:TEXTLT,fontVariantNumeric:'tabular-nums'}}>{v(val)}</span>
                    <span style={{fontSize:11,color:TEXTMU,width:28,textAlign:'right'}}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{height:5,background:'#FF3B30',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:cores[i]||TERRA}}/>
                </div>
              </div>
            )
          })}
          </div>)}
        </div>
      )}

      {/* Modal confirmar pagamento */}
      {payModal&&(()=>{
        const valorOriginal=payModal.amount
        const valorPago=unmaskCurrency(payValue)||0
        const desconto=valorOriginal-valorPago
        const temDesconto=valorPago>0&&desconto>0&&desconto<valorOriginal
        return (
        <ModalPortal>
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setPayModal(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}}/>
          <div style={{position:'relative',width:'88%',maxWidth:340,background:'#fff',borderRadius:20,padding:'24px 16px',boxShadow:'0 8px 40px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#1C1C1E',margin:'0 0 4px'}}>Confirmar pagamento</h3>
            <p style={{fontSize:13,color:'#8E8E93',margin:'0 0 4px'}}>{payModal.desc}</p>
            <p style={{fontSize:12,color:'#48484A',margin:'0 0 16px'}}>Valor original: <strong>{v(valorOriginal)}</strong></p>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:'#8E8E93',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Data do pagamento</label>
              <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 12px',fontSize:14,color:'#1C1C1E',outline:'none',boxSizing:'border-box',WebkitAppearance:'none' as any,maxWidth:'100%'}}/>
            </div>
            <div style={{marginBottom:temDesconto?10:20}}>
              <label style={{fontSize:11,fontWeight:600,color:'#8E8E93',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor pago</label>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#8E8E93',fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" value={payValue}
                  onChange={e=>setPayValue(maskCurrency(e.target.value))}
                  style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 14px 0 40px',fontSize:16,fontWeight:700,color:'#1C1C1E',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
            {temDesconto&&(
              <div style={{background:'rgba(34,199,89,0.06)',borderRadius:10,padding:'8px 12px',marginBottom:16,border:'1px solid rgba(34,199,89,0.12)'}}>
                <p style={{fontSize:12,color:'#34C759',fontWeight:600,margin:0}}>
                  💰 Desconto: {v(desconto)} ({(desconto/valorOriginal*100).toFixed(1)}%)
                </p>
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPayModal(null)} style={{flex:1,height:46,background:'#F5F5F7',color:'#48484A',borderRadius:12,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={confirmPay} style={{flex:1,height:46,background:'#34C759',color:'#fff',borderRadius:12,border:'none',fontSize:14,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>
            </div>
          </div>
        </div>
        </ModalPortal>
        )})()}

      {/* Modal confirmar fechamento de fatura */}
      {confirmandoFatura&&(()=>{
        const valorCalculado=confirmandoFatura.total
        const valorReal=unmaskCurrency(confirmValorRaw)||0
        const diff=valorReal-valorCalculado
        const temDiferenca=Math.abs(diff)>0.01
        return (
        <ModalPortal>
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setConfirmandoFatura(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}}/>
          <div style={{position:'relative',width:'88%',maxWidth:340,background:'#fff',borderRadius:20,padding:'24px 16px',boxShadow:'0 8px 40px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#1C1C1E',margin:'0 0 4px'}}>Fatura fechou 🔒</h3>
            <p style={{fontSize:13,color:'#8E8E93',margin:'0 0 4px'}}>{confirmandoFatura.cardName}</p>
            <p style={{fontSize:12,color:'#48484A',margin:'0 0 16px'}}>Valor calculado pelo app: <strong>{v(valorCalculado)}</strong></p>
            <div style={{marginBottom:temDiferenca?10:20}}>
              <label style={{fontSize:11,fontWeight:600,color:'#8E8E93',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Valor real da fatura</label>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#8E8E93',fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" value={confirmValorRaw}
                  onChange={e=>setConfirmValorRaw(maskCurrency(e.target.value))}
                  style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 14px 0 40px',fontSize:16,fontWeight:700,color:'#1C1C1E',outline:'none',boxSizing:'border-box'}}/>
              </div>
              <p style={{fontSize:11,color:'#8E8E93',margin:'6px 0 0'}}>Se você esqueceu de lançar alguma compra, ajuste aqui o valor real que veio na fatura do banco.</p>
            </div>
            {temDiferenca&&(
              <div style={{background:'rgba(255,149,0,0.08)',borderRadius:10,padding:'8px 12px',marginBottom:16,border:'1px solid rgba(255,149,0,0.15)'}}>
                <p style={{fontSize:12,color:'#B37700',fontWeight:600,margin:0}}>
                  ⚠️ {diff>0?'A mais':'A menos'} que o calculado: {v(Math.abs(diff))}
                </p>
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setConfirmandoFatura(null)} style={{flex:1,height:46,background:'#F5F5F7',color:'#48484A',borderRadius:12,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={confirmFatura} style={{flex:1,height:46,background:BLUE,color:'#fff',borderRadius:12,border:'none',fontSize:14,fontWeight:700,cursor:'pointer'}}>✓ Confirmar</button>
            </div>
          </div>
        </div>
        </ModalPortal>
        )})()}

      {/* Últimas transações */}
      {txs.length>0&&(
        <div style={{background:'#fff',borderRadius:20,marginBottom:12,border:'1px solid rgba(0,0,0,0.04)',overflow:'hidden'}}>
          <button onClick={()=>togSec('ultimas')} style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,fontWeight:700,color:TEXT}}>🕐 Últimas transações</span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Link href="/lancamentos" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:TERRA,fontWeight:600,textDecoration:'none'}}>Ver todas</Link>
              {dashSecs.ultimas?<ChevronUp size={16} color={TEXTMU}/>:<ChevronDown size={16} color={TEXTMU}/>}
            </div>
          </button>
          {dashSecs.ultimas&&(<div style={{padding:'0 16px 12px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {txs.slice(0,6).map((tx,i)=>(
              <div key={tx.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderTop:i>0?'0.5px solid rgba(0,0,0,0.04)':undefined}}>
                <div style={{width:34,height:34,borderRadius:11,background:isReceita(tx)?'rgba(52,199,89,0.08)':'rgba(255,59,48,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
                  {CAT_ICONS[tx.category]||'📦'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:500,color:TEXT,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                  <p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>{tx.holder} · {tx.category} · {format(dataParaExibir(tx.description,tx.purchase_date),'dd/MM/yyyy')}</p>
                </div>
                <p style={{fontSize:13,fontWeight:700,color:isReceita(tx)?GREEN:RED,margin:0,fontVariantNumeric:'tabular-nums',flexShrink:0}}>
                  {isReceita(tx)?'+':'-'}{v(tx.installment_value||tx.amount)}
                </p>
              </div>
            ))}
          </div>
          </div>)}
        </div>
      )}



      {txs.length===0&&(
        <div style={{...card(),textAlign:'center',padding:'40px 20px'}}>
          <p style={{fontSize:36,margin:'0 0 10px'}}>📊</p>
          <p style={{fontSize:16,fontWeight:600,color:TEXT,margin:'0 0 6px'}}>Nenhum lançamento</p>
          <Link href="/lancamentos/novo" style={{background:'#1C1C1E',color:'#fff',borderRadius:12,padding:'12px 28px',fontSize:14,fontWeight:600,textDecoration:'none',display:'inline-block'}}>+ Novo lançamento</Link>
        </div>
      )}
    </div>
  )
}
