'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CAT_ICONS, calcBillingMonth, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { autoCorrigirStatusVencido } from '@/lib/utils/statusEngine'
import { format, parseISO, subMonths, addMonths } from 'date-fns'
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
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [antecipando, setAntecipando] = useState<any|null>(null)
  const [recalculando, setRecalculando] = useState<string|null>(null)

  useEffect(()=>{load()},[])

  async function recalcularStatus(grupo:any) {
    setRecalculando(grupo.base+grupo.holder)
    const mesHoje = format(new Date(), 'yyyy-MM')
    const s = createClient()
    let corrigidas = 0
    for (const p of grupo.parcelas) {
      const mesParcela = p.purchase_date.slice(0, 7)
      let novoStatus: string
      if (mesParcela < mesHoje) novoStatus = 'Pago'
      else if (mesParcela === mesHoje) novoStatus = 'Pendente'
      else novoStatus = 'Previsto'

      // Só atualiza se estiver errado, sem sobrescrever pagamentos/cancelamentos reais
      if (p.status === novoStatus) continue
      if (p.status === 'Cancelado') continue
      if (novoStatus === 'Pago' && p.status !== 'Pago') {
        await s.from('transactions').update({
          status: 'Pago',
          paid_date: p.purchase_date,
          paid_amount: p.installment_value || p.amount,
        }).eq('id', p.id)
        corrigidas++
      } else if (novoStatus !== 'Pago' && p.status === 'Pago') {
        // Não desfaz pagamento real - só corrige se faltar paid_date (dado inconsistente)
        if (!p.paid_date) {
          await s.from('transactions').update({ status: novoStatus }).eq('id', p.id)
          corrigidas++
        }
      } else {
        await s.from('transactions').update({ status: novoStatus }).eq('id', p.id)
        corrigidas++
      }
    }
    toast.success(corrigidas > 0 ? `${corrigidas} parcela${corrigidas>1?'s':''} corrigida${corrigidas>1?'s':''}!` : 'Já está tudo certo')
    setRecalculando(null)
    load()
  }

  async function load() {
    setLoading(true)
    await autoCorrigirStatusVencido()
    const from = format(subMonths(new Date(), 36), 'yyyy-MM-dd')
    const s = createClient()
    const [{ data }, { data: cardsData }] = await Promise.all([
      s.from('transactions').select('*')
        .gte('purchase_date', from)
        .order('purchase_date', { ascending: false }),
      s.from('cards').select('name,holder,closing_day'),
    ])
    setTxs(data || [])
    setCards(cardsData || [])
    setLoading(false)
  }

  const [filtro, setFiltro] = useState<'todos'|'abertos'|'quitados'>('todos')
  const [ordenacao, setOrdenacao] = useState<'menos_faltam'|'mais_faltam'|'az'|'recentes'>('menos_faltam')

  const gruposBase = useMemo(() => {
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

    return Array.from(map.values())
  }, [txs])

  const grupos = useMemo(() => {
    let arr = gruposBase.filter(g=>{
      const restam = g.parcelas.filter(p=>p.status!=='Pago').length
      const finalizada = restam<=0
      if (filtro==='abertos') return !finalizada
      if (filtro==='quitados') return finalizada
      return true
    })

    arr = arr.sort((a,b)=>{
      const aRestam=a.parcelas.filter(p=>p.status!=='Pago').length
      const bRestam=b.parcelas.filter(p=>p.status!=='Pago').length
      const aFinal=aRestam<=0
      const bFinal=bRestam<=0
      // Quitados sempre vão pro final, exceto quando o filtro é só "Quitados"
      if (filtro!=='quitados' && aFinal!==bFinal) return aFinal?1:-1

      if (ordenacao==='az') return a.base.localeCompare(b.base)
      if (ordenacao==='recentes') return b.parcelas[0].purchase_date.localeCompare(a.parcelas[0].purchase_date)
      if (ordenacao==='mais_faltam') {
        if (aRestam!==bRestam) return bRestam-aRestam
        return a.base.localeCompare(b.base)
      }
      // menos_faltam (padrão)
      if (aRestam!==bRestam) return aRestam-bRestam
      return a.base.localeCompare(b.base)
    })
    return arr
  }, [gruposBase, filtro, ordenacao])

  if (loading) return (
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center',paddingTop:80}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const totalPendente=gruposBase.reduce((s,g)=>s+g.parcelas.filter(p=>p.status!=='Pago').reduce((ss,p)=>ss+(p.installment_value||p.amount),0),0)
  const totalGeral=gruposBase.reduce((s,g)=>s+g.valorTotal,0)

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

      {/* Filtro e ordenação */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <div style={{flex:1,position:'relative'}}>
          <select value={filtro} onChange={e=>setFiltro(e.target.value as any)}
            style={{width:'100%',height:38,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 12px',fontSize:12,fontWeight:600,color:TEXT,outline:'none',appearance:'none' as const}}>
            <option value="todos">Todos</option>
            <option value="abertos">Em aberto</option>
            <option value="quitados">Quitados</option>
          </select>
        </div>
        <div style={{flex:1.4,position:'relative'}}>
          <select value={ordenacao} onChange={e=>setOrdenacao(e.target.value as any)}
            style={{width:'100%',height:38,background:'#fff',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 12px',fontSize:12,fontWeight:600,color:TEXT,outline:'none',appearance:'none' as const}}>
            <option value="menos_faltam">Menos parcelas faltando</option>
            <option value="mais_faltam">Mais parcelas faltando</option>
            <option value="recentes">Compra mais recente</option>
            <option value="az">Ordem alfabética</option>
          </select>
        </div>
      </div>

      {grupos.length===0?(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <p style={{fontSize:32,margin:'0 0 12px'}}>{gruposBase.length===0?'🎉':'🔎'}</p>
          <p style={{fontSize:14,fontWeight:600,color:gruposBase.length===0?GREEN:TEXTMU}}>
            {gruposBase.length===0?'Nenhuma compra parcelada!':'Nenhum resultado para esse filtro'}
          </p>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {grupos.map((g,gi)=>{
            // Conta como paga também a parcela de mês já passado cuja linha ainda
            // não existe no banco (dado legado) — senão o contador X/Y fica errado
            const mesAgora=format(new Date(),'yyyy-MM')
            const numsPagos=new Set<number>()
            g.parcelas.forEach(p=>{
              const m=p.description?.match(/\((\d+)\/(\d+)\)/)
              const n=m?parseInt(m[1]):(p.installment_num||p.installment_number||0)
              if(n>0&&p.status==='Pago')numsPagos.add(n)
            })
            const numsExistentes=new Set(g.parcelas.map(p=>{
              const m=p.description?.match(/\((\d+)\/(\d+)\)/)
              return m?parseInt(m[1]):(p.installment_num||p.installment_number||0)
            }).filter(n=>n>0))
            const menorExistente=numsExistentes.size>0?Math.min(...Array.from(numsExistentes)):1
            const refParcela=g.parcelas.find(p=>{
              const m=p.description?.match(/\((\d+)\/(\d+)\)/)
              const n=m?parseInt(m[1]):(p.installment_num||p.installment_number||0)
              return n===menorExistente
            })||g.parcelas[0]
            const base1=addMonths(parseISO(refParcela.purchase_date),-(menorExistente-1))
            for(let n=1;n<=g.totalParcelas;n++){
              if(numsExistentes.has(n))continue
              if(format(addMonths(base1,n-1),'yyyy-MM')<mesAgora)numsPagos.add(n)
            }
            const pagas=numsPagos.size
            const total=g.totalParcelas
            const pct=total>0?Math.round((pagas/total)*100):0
            const isOpen=expanded===g.base+g.holder
            const finalizada=pagas>=total
            const mesHoje=format(new Date(),'yyyy-MM')
            const precisaRecalcular=g.parcelas.some(p=>{
              const mesP=p.purchase_date.slice(0,7)
              return mesP<mesHoje && p.status!=='Pago' && p.status!=='Cancelado'
            })

            return (
              <div key={gi} style={{background:'#fff',borderRadius:20,overflow:'hidden',border:'1px solid rgba(0,0,0,0.05)',opacity:finalizada?0.55:1}}>
                {precisaRecalcular&&(
                  <div style={{background:'rgba(255,170,0,0.08)',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <p style={{fontSize:11,color:'#B37700',margin:0,fontWeight:600}}>⚠️ Datas antigas com status desatualizado</p>
                    <button onClick={(e)=>{e.stopPropagation();recalcularStatus(g)}} disabled={recalculando===g.base+g.holder}
                      style={{fontSize:11,fontWeight:700,color:'#fff',background:'#FF9500',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer',flexShrink:0}}>
                      {recalculando===g.base+g.holder?'Corrigindo...':'🔄 Corrigir'}
                    </button>
                  </div>
                )}
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
                      <p style={{fontSize:10,color:TEXTMU,margin:'2px 0 0',opacity:0.8}}>
                        {format(parseISO(g.parcelas[0].purchase_date),'MM/yyyy')} → {format(addMonths(parseISO(g.parcelas[0].purchase_date),g.totalParcelas-1),'MM/yyyy')}
                      </p>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                        <div style={{flex:1,height:4,background:'rgba(0,0,0,0.04)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:finalizada?GREEN:RED,transition:'width 0.5s'}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:finalizada?GREEN:RED,flexShrink:0}}>{pagas}/{total}</span>
                      </div>
                    </div>
                  </div>
                </button>
                {isOpen&&(
                  <div style={{padding:'0 18px 16px'}}>
                    <div style={{borderTop:'1px solid rgba(0,0,0,0.04)',paddingTop:12}}>
                      {(()=>{
                        // Data da parcela 1 do grupo — se ela não existir no banco,
                        // retrocalcula a partir da parcela mais antiga que existir.
                        // Isso garante que TODA parcela tenha data para exibir, mesmo
                        // que a linha ainda não tenha sido criada no banco.
                        const numDe=(p:Tx)=>{
                          const m=p.description?.match(/\((\d+)\/(\d+)\)/)
                          if(m)return parseInt(m[1])
                          return p.installment_num||p.installment_number||0
                        }
                        const comNum=g.parcelas.map(p=>({p,n:numDe(p)})).filter(x=>x.n>0)
                        const menor=comNum.length>0?comNum.reduce((a,b)=>a.n<=b.n?a:b):null
                        const dataParcela1=menor
                          ? addMonths(parseISO(menor.p.purchase_date),-(menor.n-1))
                          : parseISO(g.parcelas[0].purchase_date)
                        const mesHojeStr=format(new Date(),'yyyy-MM')

                        return Array.from({length:total},(_,i)=>{
                        const num=i+1
                        const parcela=comNum.find(x=>x.n===num)?.p
                        // Data real (se a linha existe) ou projetada mês a mês
                        const dataParcela=parcela?parseISO(parcela.purchase_date):addMonths(dataParcela1,num-1)
                        const mesParcela=format(dataParcela,'yyyy-MM')

                        // Status: o do banco quando a linha existe; senão, a regra de mês
                        const isPago=parcela?parcela.status==='Pago':mesParcela<mesHojeStr
                        // Só é "futura" de verdade se o MÊS ainda não chegou. Uma parcela de
                        // mês passado nunca pode aparecer como Futuro (bug do Vestido Noiva).
                        const isFutura=mesParcela>mesHojeStr&&!(isPago&&parcela?.paid_date)
                        const statusFinal=isFutura?false:isPago
                        const semLinha=!parcela
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<total-1?'0.5px solid rgba(0,0,0,0.04)':undefined}}>
                            <div style={{width:24,height:24,borderRadius:12,background:statusFinal?'rgba(34,199,89,0.12)':isFutura?'rgba(0,0,0,0.03)':'rgba(255,59,48,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              <span style={{fontSize:10,fontWeight:700,color:statusFinal?GREEN:isFutura?TEXTMU:RED}}>{statusFinal?'✓':num}</span>
                            </div>
                            <div style={{flex:1}}>
                              <p style={{fontSize:12,fontWeight:500,color:TEXT,margin:0}}>Parcela {num}/{total}</p>
                              <p style={{fontSize:10,color:TEXTMU,margin:'1px 0 0'}}>
                                {format(dataParcela,'dd/MM/yyyy')}
                                {statusFinal&&parcela?.paid_date?` · Pago ${format(parseISO(parcela.paid_date),'dd/MM')}`:''}
                                {isFutura?' · Futuro':''}
                                {semLinha?' · prevista':''}
                              </p>
                            </div>
                            <div style={{textAlign:'right'}}>
                              <p style={{fontSize:12,fontWeight:600,color:statusFinal?GREEN:isFutura?TEXTMU:RED,margin:0,fontVariantNumeric:'tabular-nums'}}>{formatCurrency(g.valorParcela)}</p>
                            </div>
                          </div>
                        )
                      })})()}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',marginTop:4}}>
                      <p style={{fontSize:12,fontWeight:600,color:TEXTMU,margin:0}}>Restam {total-pagas} parcela{total-pagas!==1?'s':''}</p>
                      <p style={{fontSize:13,fontWeight:700,color:RED,margin:0}}>{formatCurrency((total-pagas)*g.valorParcela)}</p>
                    </div>
                    {!finalizada&&(
                      <button onClick={(e)=>{e.stopPropagation();setAntecipando(g)}}
                        style={{width:'100%',height:38,marginTop:10,background:'rgba(196,98,45,0.08)',color:TERRA,border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        💰 Antecipar ou quitar parcelas
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {antecipando&&(
        <ModalAntecipar
          grupo={antecipando}
          cards={cards}
          onClose={()=>setAntecipando(null)}
          onConfirm={async(nParcelas:number,valorPago:number)=>{
            const pendentes=antecipando.parcelas.filter((p:Tx)=>p.status!=='Pago').sort((a:Tx,b:Tx)=>a.purchase_date.localeCompare(b.purchase_date))
            const alvo=pendentes.slice(0,nParcelas)
            const valorOriginalTotal=alvo.reduce((s:number,p:Tx)=>s+(p.installment_value||p.amount),0)
            const hoje=format(new Date(),'yyyy-MM-dd')
            const s=createClient()
            // Se for cartão de crédito, recalcula a fatura atual (a conta antecipada entra na fatura corrente)
            let novoBillingMonth:string|null=null
            if(antecipando.card&&alvo[0]?.payment_method==='cartao_credito'){
              const cardInfo=cards.find(c=>`${c.name} — ${c.holder}`===antecipando.card)
              if(cardInfo){
                novoBillingMonth=format(calcBillingMonth(new Date(),cardInfo.closing_day||1),'yyyy-MM-dd')
              }
            }
            for(const p of alvo){
              const proporcao=valorOriginalTotal>0?(p.installment_value||p.amount)/valorOriginalTotal:1/alvo.length
              const paidAmount=valorPago*proporcao
              const updatePayload:any={status:'Pago',paid_date:hoje,paid_amount:paidAmount}
              if(novoBillingMonth)updatePayload.billing_month=novoBillingMonth
              await s.from('transactions').update(updatePayload).eq('id',p.id)
            }
            const delta=valorOriginalTotal-valorPago
            toast.success(delta>0.01?`Quitado! Desconto de ${formatCurrency(delta)}`:'Parcelas antecipadas com sucesso!')
            setAntecipando(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// ── Modal de antecipação/quitação ──────────────────────────
function ModalAntecipar({grupo,cards,onClose,onConfirm}:{grupo:any;cards:any[];onClose:()=>void;onConfirm:(n:number,valor:number)=>Promise<void>|void}) {
  const [salvando,setSalvando]=useState(false)
  const pendentes=grupo.parcelas.filter((p:Tx)=>p.status!=='Pago').sort((a:Tx,b:Tx)=>a.purchase_date.localeCompare(b.purchase_date))
  const [n,setN]=useState(pendentes.length) // default: quitar tudo
  const [valorPagoRaw,setValorPagoRaw]=useState('')

  const alvo=pendentes.slice(0,n)
  const valorOriginal=alvo.reduce((s:number,p:Tx)=>s+(p.installment_value||p.amount),0)
  const valorPago=unmaskCurrency(valorPagoRaw)
  const delta=valorOriginal-valorPago
  const temDesconto=valorPago>0&&delta>0.01&&delta<valorOriginal

  return (
    <div style={{position:'fixed',inset:0,zIndex:70,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}/>
      <div style={{position:'relative',width:'100%',maxWidth:390,margin:'0 auto',background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'85vh',overflowY:'auto',WebkitOverflowScrolling:'touch' as any,padding:'20px 18px calc(24px + env(safe-area-inset-bottom, 20px))'}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 4px'}}>Antecipar ou quitar</h3>
        <p style={{fontSize:13,color:TEXTMU,margin:'0 0 16px'}}>{grupo.base}</p>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}}>Quantas parcelas quer antecipar?</label>
          <input type="number" value={n} min={1} max={pendentes.length}
            onChange={e=>setN(Math.max(1,Math.min(pendentes.length,parseInt(e.target.value)||1)))}
            style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 14px',fontSize:15,fontWeight:700,color:TEXT,outline:'none',boxSizing:'border-box'}}/>
          <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
            {n===pendentes.length?'Quitação total do saldo devedor':`Parcelas ${alvo[0]?.description?.match(/\((\d+)/)?.[1]||''} a ${alvo[alvo.length-1]?.description?.match(/\((\d+)/)?.[1]||''}`}
          </p>
        </div>

        <div style={{background:'#F5F5F7',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:12,color:TEXTMU}}>Valor original ({n}x)</span>
            <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{formatCurrency(valorOriginal)}</span>
          </div>
        </div>

        <div style={{marginBottom:temDesconto?10:20}}>
          <label style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}}>Valor real que vai pagar</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:TEXTMU,fontWeight:600}}>R$</span>
            <input type="text" inputMode="numeric" value={valorPagoRaw}
              onChange={e=>setValorPagoRaw(maskCurrency(e.target.value))}
              placeholder={formatCurrency(valorOriginal).replace('R$','').trim()}
              style={{width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'0 14px 0 40px',fontSize:16,fontWeight:700,color:TEXT,outline:'none',boxSizing:'border-box'}}/>
          </div>
        </div>

        {temDesconto&&(
          <div style={{background:'rgba(34,199,89,0.08)',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
            <p style={{fontSize:12,color:GREEN,fontWeight:600,margin:0}}>
              💰 Desconto obtido: {formatCurrency(delta)} ({((delta/valorOriginal)*100).toFixed(1)}%)
            </p>
          </div>
        )}

        {alvo[0]?.payment_method==='cartao_credito'&&(
          <p style={{fontSize:11,color:TERRA,margin:'0 0 16px',background:'rgba(196,98,45,0.06)',padding:'8px 12px',borderRadius:10}}>
            💳 Essas parcelas serão somadas à fatura atual do cartão
          </p>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,height:46,background:'#F5F5F7',color:'#48484A',borderRadius:12,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
          <button onClick={async()=>{if(salvando)return;setSalvando(true);await onConfirm(n,valorPago||valorOriginal)}} disabled={n<1||salvando}
            style={{flex:1,height:46,background:TERRA,color:'#fff',borderRadius:12,border:'none',fontSize:14,fontWeight:700,cursor:salvando?'default':'pointer',opacity:salvando?0.6:1}}>
            {salvando?'Salvando...':'✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
