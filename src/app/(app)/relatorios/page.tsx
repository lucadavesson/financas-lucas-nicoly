'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, X } from 'lucide-react'
import { autoCorrigirStatusVencido } from '@/lib/utils/statusEngine'

// A partir de quantas parcelas conta como financiamento longo (imóvel,
// consórcio) — mesmo corte usado na tela de Parcelamentos
const LIMITE_LONGO = 24

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
    await autoCorrigirStatusVencido()
    const start=format(startOfMonth(subMonths(date,5)),'yyyy-MM-dd')
    // Precisa alcançar os próximos meses para montar o quadro de compromissos
    const end=format(endOfMonth(addMonths(date,6)),'yyyy-MM-dd')
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
  // Quem manda é a marcação do usuário: se ele cadastrou como conta recorrente,
  // é recorrente. O "(2/100)" que aparece em contas como Condomínio é numeração
  // dele, não um parcelamento. Antes isParcelada tinha prioridade, então essas
  // contas eram somadas como parcela e a linha "Contas recorrentes" ficava R$ 0
  // — contradizendo o quadro de compromissos logo acima, na mesma tela.
  const isRecorrente=(t:any)=>!!t.is_recurring&&t.transaction_type!=='parcelada'
  const isParcelada=(t:any)=>{
    if(isRecorrente(t))return false
    const m=t.description?.match(/\((\d+)\/(\d+)\)/)
    return t.transaction_type==='parcelada'||(m&&parseInt(m[2])>1)||(t.installment_total||t.total_installments||0)>1
  }
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

  // ── Compromissos já contratados dos próximos meses ────────
  // Parcelas existem como linha no banco até o fim do parcelamento, mas as
  // contas recorrentes só são geradas no mês corrente. Para os meses à frente
  // elas são projetadas a partir dos templates — é uma conta que se repete por
  // definição, então some do quadro se não projetar.
  // Recalculado a cada troca de titular no filtro do topo
  const compromissos=(()=>{
    const MESES=6
    const recorrentesTpl=new Map<string,number>()
    // !isParcelada é essencial: uma conta como "Condomínio (2/100)" é recorrente
    // E tem número de parcela na descrição. Sem esse filtro ela entrava na barra
    // de parcelas e também na projeção de recorrentes, sendo contada duas vezes.
    const doTitular=(t:any)=>holder==='Todos'||t.holder===holder
    txs.filter((t:any)=>doTitular(t)&&isRecorrente(t)&&t.transaction_type!=='receita'&&t.type!=='Receita')
      .forEach((t:any)=>{
        const chave=`${(t.description||'').trim().toLowerCase()}|${t.holder}`
        if(!recorrentesTpl.has(chave))recorrentesTpl.set(chave,t.expected_amount||t.amount||0)
      })
    const totalRecorrenteProjetado=Array.from(recorrentesTpl.values()).reduce((a,b)=>a+b,0)

    const linhas=Array.from({length:MESES},(_,i)=>{
      const d=addMonths(new Date(),i)
      const mesKey=format(d,'yyyy-MM')
      const doMes=txs.filter((t:any)=>
        doTitular(t) &&
        (t.purchase_date||'').slice(0,7)===mesKey &&
        t.status!=='Cancelado' &&
        t.transaction_type!=='receita' && t.type!=='Receita')

      // Financiamento longo (24+ parcelas) sai numa faixa própria: mantê-lo
      // junto das parcelas normais distorcia a leitura, e escondê-lo mentiria
      // sobre o que sai da conta todo mês.
      const ehLongo=(t:any)=>{
        const m=t.description?.match(/\((\d+)\/(\d+)\)/)
        const total=m?parseInt(m[2]):(t.installment_total||t.total_installments||0)
        return total>=LIMITE_LONGO
      }
      const parceladasDoMes=doMes.filter(isParcelada)
      const parcelas=parceladasDoMes.filter((t:any)=>!ehLongo(t))
        .reduce((sum:number,t:any)=>sum+(t.installment_value||t.amount||0),0)
      const longos=parceladasDoMes.filter(ehLongo)
        .reduce((sum:number,t:any)=>sum+(t.installment_value||t.amount||0),0)

      const linhasRec=doMes.filter(isRecorrente)
      const recorrentes=linhasRec.length>0
        ? linhasRec.reduce((sum:number,t:any)=>sum+(t.installment_value||t.amount||0),0)
        : totalRecorrenteProjetado
      const projetado=linhasRec.length===0

      return { mesKey, label:format(d,"MMM/yy",{locale:ptBR}), parcelas, longos, recorrentes, total:parcelas+longos+recorrentes, projetado }
    })
    const maior=Math.max(...linhas.map(l=>l.total),1)
    return { linhas, maior }
  })()

  const mesLabel=format(date,'MMMM yyyy',{locale:ptBR})
  const isNow=format(date,'yyyy-MM')===format(new Date(),'yyyy-MM')

  // ── Insights ─────────────────────────────────────────────
  // Comparações que exigiriam abrir 3 telas e fazer conta na mão.
  const mesAnt=getMes(subMonths(date,1))
  const despAnt=mesAnt.filter((t:any)=>t.transaction_type!=='receita'&&t.type!=='Receita')
  const totalDAnt=despAnt.reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0)
  const totalRAnt=mesAnt.filter((t:any)=>t.transaction_type==='receita'||t.type==='Receita').reduce((s:number,t:any)=>s+t.amount,0)

  const catAnt:Record<string,number>={}
  despAnt.forEach((t:any)=>{catAnt[t.category]=(catAnt[t.category]||0)+(t.installment_value||t.amount)})

  // Média dos 3 meses anteriores, para dizer se o mês fugiu do padrão
  const tresAnteriores=[1,2,3].map(i=>getMes(subMonths(date,i))
    .filter((t:any)=>t.transaction_type!=='receita'&&t.type!=='Receita')
    .reduce((s:number,t:any)=>s+(t.installment_value||t.amount),0))
  const mediaTres=tresAnteriores.filter(v=>v>0).length>0
    ? tresAnteriores.filter(v=>v>0).reduce((a,b)=>a+b,0)/tresAnteriores.filter(v=>v>0).length
    : 0

  const variacaoD=totalDAnt>0?((totalD-totalDAnt)/totalDAnt)*100:0
  const comprometido=totalR>0?(totalD/totalR)*100:0
  const fixo=totalParc+totalRec
  const pctFixo=totalD>0?(fixo/totalD)*100:0

  // Categoria que mais subiu e que mais caiu em relação ao mês anterior
  const deltas=Object.keys({...catMap,...catAnt}).map(c=>({
    cat:c, agora:catMap[c]?.total||0, antes:catAnt[c]||0, delta:(catMap[c]?.total||0)-(catAnt[c]||0),
  })).filter(d=>Math.abs(d.delta)>0.01).sort((a,b)=>b.delta-a.delta)
  const maiorAlta=deltas[0]
  const maiorQueda=deltas[deltas.length-1]
  const maiorGasto=[...despesasTodas].sort((a:any,b:any)=>(b.installment_value||b.amount)-(a.installment_value||a.amount))[0]

  // Projeção: só faz sentido no mês corrente, e só depois de alguns dias
  const diaHoje=new Date().getDate()
  const diasNoMes=new Date(date.getFullYear(),date.getMonth()+1,0).getDate()
  const projecao=isNow&&diaHoje>=5?(totalD/diaHoje)*diasNoMes:0

  type Insight={icone:string;titulo:string;texto:string;tom:'bom'|'ruim'|'neutro'}
  const insights:Insight[]=[]

  if(totalDAnt>0){
    const subiu=variacaoD>0
    insights.push({
      icone:subiu?'📈':'📉',
      titulo:`Gastos ${subiu?'subiram':'caíram'} ${Math.abs(variacaoD).toFixed(0)}% vs. o mês passado`,
      texto:`${formatCurrency(totalD)} agora contra ${formatCurrency(totalDAnt)} em ${format(subMonths(date,1),"MMMM",{locale:ptBR})}.`,
      tom:subiu?'ruim':'bom',
    })
  }
  if(totalR>0){
    insights.push({
      icone:comprometido>=100?'🚨':comprometido>=80?'⚠️':'✅',
      titulo:`${comprometido.toFixed(0)}% da renda comprometida`,
      texto:comprometido>=100
        ? `Os gastos passaram a receita em ${formatCurrency(totalD-totalR)}.`
        : `Sobra ${formatCurrency(totalR-totalD)} de ${formatCurrency(totalR)} que entraram.`,
      tom:comprometido>=100?'ruim':comprometido>=80?'neutro':'bom',
    })
  }
  if(maiorAlta&&maiorAlta.delta>0){
    insights.push({
      icone:CAT_ICONS[maiorAlta.cat]||'📦',
      titulo:`${maiorAlta.cat} foi o que mais aumentou`,
      texto:`+${formatCurrency(maiorAlta.delta)} em relação ao mês anterior (${formatCurrency(maiorAlta.antes)} → ${formatCurrency(maiorAlta.agora)}).`,
      tom:'ruim',
    })
  }
  if(maiorQueda&&maiorQueda.delta<0){
    insights.push({
      icone:CAT_ICONS[maiorQueda.cat]||'📦',
      titulo:`${maiorQueda.cat} foi o que mais caiu`,
      texto:`${formatCurrency(maiorQueda.delta)} em relação ao mês anterior (${formatCurrency(maiorQueda.antes)} → ${formatCurrency(maiorQueda.agora)}).`,
      tom:'bom',
    })
  }
  if(totalD>0){
    insights.push({
      icone:'🔒',
      titulo:`${pctFixo.toFixed(0)}% dos gastos são compromissos fixos`,
      texto:`${formatCurrency(fixo)} entre parcelas e contas recorrentes. Sobram ${formatCurrency(totalD-fixo)} de gasto que dá pra ajustar mês a mês.`,
      tom:pctFixo>=70?'ruim':'neutro',
    })
  }
  if(mediaTres>0&&totalD>0){
    const difMedia=((totalD-mediaTres)/mediaTres)*100
    if(Math.abs(difMedia)>=10){
      insights.push({
        icone:'📊',
        titulo:`${Math.abs(difMedia).toFixed(0)}% ${difMedia>0?'acima':'abaixo'} da média dos últimos meses`,
        texto:`A média vinha sendo ${formatCurrency(mediaTres)} por mês.`,
        tom:difMedia>0?'ruim':'bom',
      })
    }
  }
  if(projecao>0){
    insights.push({
      icone:'🔮',
      titulo:`No ritmo atual, o mês fecha em ${formatCurrency(projecao)}`,
      texto:`${formatCurrency(totalD)} gastos em ${diaHoje} dias de ${diasNoMes}.`,
      tom:totalR>0&&projecao>totalR?'ruim':'neutro',
    })
  }
  if(maiorGasto){
    insights.push({
      icone:'🏆',
      titulo:`Maior gasto do mês: ${maiorGasto.description}`,
      texto:`${formatCurrency(maiorGasto.installment_value||maiorGasto.amount)} · ${maiorGasto.category} · ${maiorGasto.holder}`,
      tom:'neutro',
    })
  }

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

      {/* Compromissos já contratados dos próximos meses */}
      {compromissos.linhas.some(l=>l.total>0)&&(
        <Section title="O que já está contratado" icon="📅" total={compromissos.linhas[0]?.total}>
          <p style={{fontSize:11,color:TEXTMU,margin:'12px 0 12px',lineHeight:1.45}}>
            Gastos que já existem e vão acontecer nos próximos meses, sem contar compras novas:
            parcelas em andamento e contas que se repetem. Inclui os financiamentos longos —
            eles saem da conta todo mês, então ficam à vista aqui, só separados por cor.
          </p>

          {/* Legenda */}
          <div style={{display:'flex',gap:14,marginBottom:12,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:9,height:9,borderRadius:3,background:TERRA,display:'inline-block'}}/>
              <span style={{fontSize:11,color:TEXTMU}}>Parcelas</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:9,height:9,borderRadius:3,background:'#1D6FA5',display:'inline-block'}}/>
              <span style={{fontSize:11,color:TEXTMU}}>Financiamentos longos</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:9,height:9,borderRadius:3,background:'#9B59B6',display:'inline-block'}}/>
              <span style={{fontSize:11,color:TEXTMU}}>Recorrentes</span>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {compromissos.linhas.map(l=>(
              <div key={l.mesKey}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,color:TEXTMU,width:50,flexShrink:0,textTransform:'capitalize'}}>{l.label}</span>
                  <div style={{flex:1,height:16,background:'rgba(0,0,0,0.03)',borderRadius:5,overflow:'hidden',display:'flex'}}>
                    {l.parcelas>0&&<div style={{width:`${(l.parcelas/compromissos.maior)*100}%`,background:TERRA}}/>}
                    {l.longos>0&&<div style={{width:`${(l.longos/compromissos.maior)*100}%`,background:'#1D6FA5'}}/>}
                    {l.recorrentes>0&&<div style={{width:`${(l.recorrentes/compromissos.maior)*100}%`,background:'#9B59B6'}}/>}
                  </div>
                  <span style={{fontSize:11.5,fontWeight:700,color:TEXT,width:86,textAlign:'right',flexShrink:0,fontVariantNumeric:'tabular-nums'}}>
                    {v(l.total)}
                  </span>
                </div>
                <div style={{display:'flex',gap:10,paddingLeft:58,marginTop:3,flexWrap:'wrap'}}>
                  {l.parcelas>0&&<span style={{fontSize:10,color:TERRA}}>Parcelas {v(l.parcelas)}</span>}
                  {l.longos>0&&<span style={{fontSize:10,color:'#1D6FA5'}}>Financiamentos {v(l.longos)}</span>}
                  {l.recorrentes>0&&<span style={{fontSize:10,color:'#9B59B6'}}>Recorrentes {v(l.recorrentes)}{l.projetado?' (previsto)':''}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Insights — leitura pronta do mês, em vez de só números crus.
          Colapsável como as demais seções, e aberto por padrão. */}
      {insights.length>0&&(
        <Section title="O que os números dizem" icon="💡" count={insights.length}>
          <p style={{fontSize:11,color:TEXTMU,margin:'12px 0 14px'}}>Comparado com {format(subMonths(date,1),"MMMM 'de' yyyy",{locale:ptBR})}</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {insights.map((ins,i)=>{
              const cor=ins.tom==='bom'?GREEN:ins.tom==='ruim'?RED:TEXTLT
              const bg=ins.tom==='bom'?'rgba(52,199,89,0.06)':ins.tom==='ruim'?'rgba(255,59,48,0.05)':'rgba(0,0,0,0.025)'
              return (
                <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',background:bg,borderRadius:12,padding:'10px 12px'}}>
                  <span style={{fontSize:16,lineHeight:1.2,flexShrink:0}}>{ins.icone}</span>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:12.5,fontWeight:700,color:cor,margin:0,lineHeight:1.3}}>{ins.titulo}</p>
                    <p style={{fontSize:11.5,color:TEXTMU,margin:'3px 0 0',lineHeight:1.4}}>{ins.texto}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

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
          </div>
  )
}
