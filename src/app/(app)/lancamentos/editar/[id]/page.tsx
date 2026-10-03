'use client'
import { format, parseISO, addMonths } from 'date-fns'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATS_DESPESA, CATS_RECEITA, SUBCATS, maskCurrency, unmaskCurrency, formatCurrency, calcBillingMonth } from '@/lib/utils'
import { ChevronLeft, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { buscarIrmas, apagarParcelamento, sufixoDaParcela } from '@/lib/utils/parcelamentoGrupo'
import { baseConsenso, statusPorMes, pagamentoFoiAutomatico } from '@/lib/utils/parcelasCore'

const BG='#F5F5F7',TEXT='#1C1C1E',TEXTMU='#8E8E93',TERRA='#C4622D',GREEN='#34C759'

const inp:React.CSSProperties={width:'100%',height:48,background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:14,padding:'0 16px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box'}
const lbl:React.CSSProperties={fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:6}
const seg=(on:boolean):React.CSSProperties=>({flex:1,height:40,borderRadius:12,border:'none',background:on?TERRA:'rgba(0,0,0,0.03)',color:on?'#fff':TEXT,fontSize:13,fontWeight:on?600:400,cursor:'pointer'})

const METHODS=[{v:'cartao_credito',l:'Crédito (fatura)'},{v:'debito',l:'Débito'},{v:'pix',l:'PIX'},{v:'dinheiro',l:'Dinheiro'},{v:'boleto',l:'Boleto'}]

export default function EditarLancamento(){
  const router=useRouter()
  const {id}=useParams() as {id:string}
  const [tx,setTx]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState<any>({})
  const [cards,setCards]=useState<any[]>([])
  const [valRaw,setValRaw]=useState('')
  const [instValRaw,setInstValRaw]=useState('')
  const [paidAmountRaw,setPaidAmountRaw]=useState('')
  // Em parcela de um parcelamento: até onde a mudança de valor se aplica
  const [irmas,setIrmas]=useState<any[]>([])
  // Parcelamento: a data que se edita é a da COMPRA (parcela 1); as datas de cada parcela derivam dela
  const [dataCompra,setDataCompra]=useState('')
  const [dataCompraInicial,setDataCompraInicial]=useState('')
  const [totalProdRaw,setTotalProdRaw]=useState('')
  const [escopo,setEscopo]=useState<'esta'|'daqui'|'todas'>('daqui')

  useEffect(()=>{
    load()
    // Scroll to top - funciona dentro do main com overflow
    setTimeout(()=>{
      const main=document.querySelector('main')
      if(main)main.scrollTop=0
      window.scrollTo(0,0)
    },100)
  },[id])

  async function load(){
    const s=createClient()
    const [{data},{data:cardsData}]=await Promise.all([
      s.from('transactions').select('*').eq('id',id).single(),
      s.from('cards').select('*').eq('is_active',true).order('holder').order('name'),
    ])
    if(data){
      setTx(data)
      // O nome que vai pro campo "Descrição" não pode incluir o "(7/12)" —
      // isso é a referência da parcela, não o nome da compra. Ela some do
      // campo editável e volta a aparecer como selo ao lado, só leitura.
      const mDesc=(data.description||'').match(/\((\d+)\/(\d+)\)$/)
      const nomeBase=mDesc?data.description.slice(0,mDesc.index).trim():data.description
      // Antes isso só valia para transaction_type==='parcelada' — mas há
      // lançamentos antigos com "(N/T)" na descrição salvos como 'avista'
      // por engano (já vimos isso acontecer neste app). Se o nome TEM essa
      // referência, ela sai do campo de qualquer forma; o tipo não importa.
      setForm({...data,description:mDesc?nomeBase:data.description})
      // Parcelamento: carrega as irmãs (para o resumo de juros) e herda a
      // observação do grupo quando esta parcela não tem — senão salvar aqui
      // apagaria a nota das outras.
      if(mDesc){
        const ir=await buscarIrmas(s,data)
        setIrmas(ir)
        const numAqui=parseInt(mDesc[1])
        const consenso=baseConsenso(ir as any)
        const dc=consenso||format(addMonths(parseISO(data.purchase_date),-(numAqui-1)),'yyyy-MM-dd')
        setDataCompra(dc); setDataCompraInicial(dc)
        if(!(data.notes||'').trim()){
          const n=ir.find((l:any)=>(l.notes||'').trim())?.notes
          if(n)setForm((f:any)=>({...f,notes:n}))
        }
      }
      const ehParcelado=!!mDesc||data.transaction_type==='parcelada'
      const valorExibido=ehParcelado?(data.installment_value||data.amount||0):(data.amount||0)
      setValRaw(maskCurrency(Math.round(valorExibido*100).toString()))
      if(data.installment_value){setInstValRaw(maskCurrency(Math.round(data.installment_value*100).toString()))}
      if(data.paid_amount){setPaidAmountRaw(maskCurrency(Math.round(data.paid_amount*100).toString()))}
    }
    setCards(cardsData||[])
    setLoading(false)
  }

  function sf(k:string,v:any){setForm((f:any)=>({...f,[k]:v}))}

  // Dia de fechamento do cartão (o card_name pode ser "Nome" ou "Nome — Titular")
  function fechamentoDe(nome?:string|null):number{
    if(!nome)return 1
    const c=cards.find((x:any)=>x.name===nome||`${x.name} — ${x.holder}`===nome)
    return c?.closing_day||1
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    // A edição não validava nada: dava pra apagar a descrição, zerar o valor ou
    // tirar a categoria e salvar, deixando o lançamento inconsistente.
    if(!(form.description||'').trim()){toast.error('Informe a descrição');return}
    const valorEditado=unmaskCurrency(valRaw)||parseFloat(form.amount)||0
    if(valorEditado<=0){toast.error('Informe o valor');return}
    if(!(form.category||'').trim()){toast.error('Escolha a categoria');return}
    if(!(ehParcelaDeGrupo?(dataCompra||form.purchase_date):form.purchase_date)){toast.error('Informe a data');return}
    if(form.payment_method==='cartao_credito'&&!(form.card_name||'').trim()){
      toast.error('Escolha o cartão de crédito')
      return
    }
    if(form.transaction_type==='recorrente'&&form.payment_method!=='cartao_credito'&&!form.recurring_day){
      toast.error('Informe o dia de vencimento')
      return
    }
    setSaving(true)
    const amount=unmaskCurrency(valRaw)||parseFloat(form.amount)||0
    const ehParcelado=!!(tx?.description||'').match(/\((\d+)\/(\d+)\)$/)||form.transaction_type==='parcelada'
    // O campo só guarda o nome base ("Moto"); o "(7/12)" volta a ser
    // costurado aqui na hora de salvar, com o número FIXO desta parcela e o
    // total ATUAL do campo "Nº de parcelas" (que pode ter sido corrigido).
    // Sem isso o resto do app perde a referência: é esse sufixo que agrupa
    // as parcelas em Parcelamentos, Cartões e Relatórios.
    const descricaoFinal=ehParcelaDeGrupo
      ? `${(form.description||'').trim()} (${numParcela}/${totalParcelasAtual})`
      : (form.description||'').trim()
    // ── Datas ────────────────────────────────────────────────────────────
    // Parcelamento: o campo é a data da COMPRA. Mudou → todas as parcelas
    // andam junto (parcela n = compra + (n-1) meses) e a fatura de cada uma é
    // recalculada. Lançamento comum: a data é a própria, e se for no crédito a
    // fatura acompanha a data e o cartão.
    const mesHoje=format(new Date(),'yyyy-MM')
    const mudouData=ehParcelaDeGrupo
      ? !!dataCompra&&dataCompra!==dataCompraInicial
      : form.purchase_date!==tx?.purchase_date
    const mudouCartao=(form.card_name||null)!==(tx?.card_name||null)
    const noCredito=form.payment_method==='cartao_credito'
    const dataDestaLinha=(ehParcelaDeGrupo&&mudouData)
      ? format(addMonths(parseISO(dataCompra),(numParcela||1)-1),'yyyy-MM-dd')
      : form.purchase_date
    const patchFatura:any={}
    if(noCredito&&(mudouData||mudouCartao)){
      patchFatura.billing_month=format(calcBillingMonth(parseISO(dataDestaLinha),fechamentoDe(form.card_name)),'yyyy-MM-dd')
    }
    // Se o status não foi mexido na tela e a data mudou, ele segue a regra do mês
    let statusEdit=(form.payment_method==='cartao_credito'&&form.transaction_type!=='parcelada')?'Pendente':form.status
    const patchPagto:any={}
    if(ehParcelaDeGrupo&&mudouData&&form.status===tx?.status&&form.status!=='Cancelado'&&(form.status!=='Pago'||pagamentoFoiAutomatico(tx))){
      statusEdit=statusPorMes(dataDestaLinha.slice(0,7),mesHoje)
      if(statusEdit!=='Pago'){patchPagto.paid_date=null;patchPagto.paid_amount=null}
      else{patchPagto.paid_date=dataDestaLinha}
    }

    const {error}=await createClient().from('transactions').update({
      holder:form.holder,
      owner_name:(form.holder==='Prata'?'Lucas':form.holder)||'Lucas',
      transaction_type:form.transaction_type,
      type:form.type||(form.transaction_type==='receita'?'Receita':'Despesa'),
      description:descricaoFinal,
      amount,
      category:form.category,
      subcategory:form.subcategory||null,
      purchase_date:dataDestaLinha,
      payment_method:form.payment_method||null,
      card_name:form.card_name||null,
      status:statusEdit,
      notes:form.notes||null,
      paid_amount:paidAmountRaw?unmaskCurrency(paidAmountRaw):null,
      paid_date:form.paid_date||null,
      installment_value:ehParcelado?amount:(instValRaw?unmaskCurrency(instValRaw):null),
      installment_total:form.installment_total?parseInt(form.installment_total):null,
      is_recurring:form.transaction_type==='recorrente',
      recurring_day:form.transaction_type==='recorrente'?(form.recurring_day||null):null,
      ...patchFatura,
      ...patchPagto,
    }).eq('id',id)
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}

    // Compra parcelada é UMA compra: nome, categoria, titular, cartão e valor
    // valem para todas as parcelas. Cada irmã mantém o próprio número, data e
    // status; o valor só muda nas que ainda não foram pagas.
    let nIrmas=0
    if(ehParcelaDeGrupo&&tx){
      const s=createClient()
      const irmas=(await buscarIrmas(s,tx)).filter(l=>l.id!==id)
      const nomeBase=(form.description||'').trim()
      for(const l of irmas){
        const suf=sufixoDaParcela(l.description||'')
        if(!suf)continue
        const campos:any={
          description:`${nomeBase} (${suf.num}/${totalParcelasAtual})`,
          holder:form.holder,
          owner_name:(form.holder==='Prata'?'Lucas':form.holder)||'Lucas',
          category:form.category,
          subcategory:form.subcategory||null,
          notes:form.notes||null,
          card_name:form.card_name||null,
          payment_method:form.payment_method||null,
          installment_total:form.installment_total?parseInt(form.installment_total):null,
        }
        // Valor: só nas parcelas dentro do escopo escolhido. Parcela já paga
        // com valor real (paid_amount) mantém o que foi de fato pago.
        const dentro=escopo==='todas'||(escopo==='daqui'&&suf.num>(numParcela||0))
        if(dentro){campos.amount=amount;campos.installment_value=amount}

        // Data da compra mudou: cada parcela vai para compra + (n-1) meses.
        // Parcela paga de verdade (pagamento registrado por você) mantém o
        // status e a fatura em que foi paga; só a data acompanha.
        if(mudouData){
          const dataN=addMonths(parseISO(dataCompra),suf.num-1)
          const dataNStr=format(dataN,'yyyy-MM-dd')
          campos.purchase_date=dataNStr
          const pagoDeVerdade=l.status==='Pago'&&!pagamentoFoiAutomatico(l as any)
          if(noCredito&&!pagoDeVerdade){
            campos.billing_month=format(calcBillingMonth(dataN,fechamentoDe(form.card_name)),'yyyy-MM-dd')
          }
          if(!pagoDeVerdade&&l.status!=='Cancelado'){
            const novoSt=statusPorMes(dataNStr.slice(0,7),mesHoje)
            campos.status=novoSt
            campos.paid_date=novoSt==='Pago'?dataNStr:null
            campos.paid_amount=novoSt==='Pago'?(l.installment_value||l.amount||amount):null
          }
        } else if(mudouCartao&&noCredito&&!(l.status==='Pago'&&!pagamentoFoiAutomatico(l as any))){
          campos.billing_month=format(calcBillingMonth(parseISO(l.purchase_date),fechamentoDe(form.card_name)),'yyyy-MM-dd')
        }
        const {error:e2}=await s.from('transactions').update(campos).eq('id',l.id)
        if(e2){toast.error(`Parcela ${suf.num} não atualizou: ${e2.message}`);setSaving(false);return}
        nIrmas++
      }
    }
    toast.success(nIrmas>0?`Salvo! Nome e dados aplicados às ${nIrmas} outras parcelas${escopo==='esta'?'; o valor só nesta.':escopo==='daqui'?'; o valor daqui para frente.':'; o valor em todas.'}`:'Salvo!')
    router.push('/lancamentos')
  }

  async function del(){
    const s=createClient()
    // Qualquer linha com "(n/total)" faz parte de um parcelamento — mesmo as
    // antigas salvas com transaction_type errado. Apagar uma só deixaria as
    // outras soltas (e seriam recriadas pela correção de legados).
    const suf=sufixoDaParcela(tx?.description||'')
    if(tx&&suf&&suf.total>1){
      const base=(tx.description||'').replace(/\s*\(\d+\/\d+\)\s*$/,'').trim()
      const n=(await buscarIrmas(s,tx)).length
      if(!confirm(`"${base}" é uma compra parcelada com ${n} parcela${n>1?'s':''}.\n\nApagar o parcelamento INTEIRO (todas as ${n} parcelas)?`))return
      const r=await apagarParcelamento(s,tx)
      if(!r.ok){toast.error(`Não foi possível apagar: ${r.erro}`);return}
      toast.success(`Parcelamento apagado (${r.n} parcelas)`)
      router.push('/lancamentos')
      return
    }

    if(!confirm('Apagar este lançamento?'))return
    const {error}=await s.from('transactions').delete().eq('id',id)
    if(error){toast.error(`Não foi possível apagar: ${error.message}`);return}
    // Recorrente volta a ser gerado todo mês se o template continuar marcado
    if(tx?.is_recurring){
      toast.success('Apagado. Como é uma conta recorrente, ela pode ser gerada de novo — apague em Configurações > Contas Recorrentes para parar de vez.')
    }else{
      toast.success('Apagado!')
    }
    router.push('/lancamentos')
  }

  if(loading)return(
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center'}}>
      <div style={{width:24,height:24,border:`2px solid ${TERRA}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if(!tx)return(
    <div style={{background:BG,minHeight:'100%',display:'flex',justifyContent:'center',alignItems:'center'}}>
      <p style={{color:TEXTMU,fontSize:14}}>Lançamento não encontrado</p>
    </div>
  )

  const isReceita=form.transaction_type==='receita'||form.type==='Receita'
  const cats=isReceita?CATS_RECEITA:CATS_DESPESA
  const subs=SUBCATS[form.category]||[]
  const isCredito=form.payment_method==='cartao_credito'&&form.transaction_type!=='parcelada'
  // Qualquer coisa no crédito (à vista OU parcelada) entra na fatura e não tem
  // status próprio: quem paga é a fatura inteira, no vencimento do cartão.
  const naFatura=form.payment_method==='cartao_credito'

  // Qual parcela esta linha é, do grupo original — sempre a partir do
  // description ORIGINAL (tx), não do form, porque essa posição é estrutural
  // e não muda por edição. Sem isso "(7/12)" ficava preso dentro do campo de
  // nome, como se fizesse parte dele.
  const mDescOriginal=(tx?.description||'').match(/\((\d+)\/(\d+)\)$/)
  const numParcela=mDescOriginal?parseInt(mDescOriginal[1]):(tx?.installment_num||tx?.installment_number||null)
  const totalParcelasOriginal=mDescOriginal?parseInt(mDescOriginal[2]):(tx?.installment_total||tx?.total_installments||null)
  // Não trava mais em transaction_type==='parcelada': o que importa é a
  // descrição TER a referência "(N/T)" — inclusive em linhas antigas
  // salvas com o tipo errado, que também mostravam a data de um jeito
  // enganoso.
  const ehParcelaDeGrupo=!!numParcela&&!!totalParcelasOriginal&&totalParcelasOriginal>1
  // "Nº de parcelas" é editável no formulário — o selo acompanha o valor atual
  const totalParcelasAtual=parseInt(form.installment_total)||totalParcelasOriginal||numParcela||1

  // A cada linha de uma compra parcelada, "purchase_date" é a data DESSA
  // parcela (mês a mês), não a data em que a compra foi feita — foi essa
  // confusão que fazia a "Moto" parecer comprada em agosto ao editar a
  // parcela 7 e em setembro ao editar a 8. Aqui a gente reconstrói a data
  // real da compra (parcela 1) subtraindo os meses correspondentes, só para
  // mostrar como referência — não altera o que fica salvo.
  const dataCompraOriginal=(ehParcelaDeGrupo&&numParcela&&form.purchase_date)
    ? addMonths(parseISO(form.purchase_date),-(numParcela-1))
    : null

  return(
    <div style={{background:BG,minHeight:'100%'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{position:'sticky',top:0,background:BG,borderBottom:'1px solid rgba(0,0,0,0.04)',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,zIndex:10}}>
        <button onClick={()=>router.back()} style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}>
          <ChevronLeft size={22} color={TEXTMU}/>
        </button>
        <h1 style={{fontSize:16,fontWeight:700,color:TEXT,flex:1,margin:0}}>Editar lançamento</h1>
        <button onClick={async()=>{
          const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
          const {id:_,...copy}=tx;delete (copy as any).created_at;delete (copy as any).updated_at
          const {error}=await s.from('transactions').insert({...copy,description:`${copy.description} (cópia)`,purchase_date:format(new Date(),'yyyy-MM-dd')})
          if(error){toast.error(`Erro: ${error.message}`);return}
          toast.success('Lançamento duplicado!')
          router.push('/lancamentos')
        }} style={{width:36,height:36,background:'rgba(0,122,255,0.08)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}} title="Duplicar">
          📋
        </button>
        <button onClick={del} style={{width:36,height:36,background:'rgba(255,59,48,0.08)',borderRadius:12,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Trash2 size={17} color="#FF3B30"/>
        </button>
      </div>

      <div style={{padding:'18px 16px 160px',display:'flex',flexDirection:'column',gap:16}}>

        {/* Tipo do lançamento - editável */}
        <div>
          <label style={lbl}>Tipo do lançamento</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {[{v:'avista',l:'À vista',t:'Despesa'},{v:'parcelada',l:'Parcelada',t:'Despesa'},{v:'recorrente',l:'Recorrente',t:'Despesa'},{v:'receita',l:'Receita',t:'Receita'}].map(tp=>{
              const on=form.transaction_type===tp.v
              return(
                <button key={tp.v} type="button" onClick={()=>{sf('transaction_type',tp.v);sf('type',tp.t)}}
                  style={{height:34,padding:'0 14px',borderRadius:10,border:on?`1px solid ${tp.t==='Receita'?GREEN:TERRA}40`:'1px solid rgba(0,0,0,0.06)',cursor:'pointer',fontSize:12,fontWeight:on?600:400,
                    background:on?`${tp.t==='Receita'?GREEN:TERRA}15`:'#fff',color:on?(tp.t==='Receita'?GREEN:TERRA):TEXTMU}}>
                  {tp.l}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dia de vencimento - só para recorrente */}
        {form.transaction_type==='recorrente'&&(
          <div>
            <label style={lbl}>Dia do vencimento</label>
            <input type="number" value={form.recurring_day||''} onChange={e=>sf('recurring_day',e.target.value?parseInt(e.target.value):null)}
              placeholder="Ex: 6 (todo dia 6)" style={inp} min="1" max="31"/>
            <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
              Usado para gerar alertas de vencimento próximo e da conta do mês.
            </p>
          </div>
        )}

        {/* Responsável */}
        <div>
          <label style={lbl}>Responsável</label>
          <div style={{display:'flex',gap:8}}>
            {['Lucas','Nicoly','Prata'].map(p=>(
              <button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <label style={{...lbl,marginBottom:0}}>Descrição</label>
            {ehParcelaDeGrupo&&(
              <span style={{fontSize:11,fontWeight:700,color:TERRA,background:'rgba(196,98,45,0.1)',borderRadius:8,padding:'2px 8px'}}>
                Parcela {numParcela} de {totalParcelasAtual}
              </span>
            )}
          </div>
          <input type="text" value={form.description||''} onChange={e=>sf('description',e.target.value)} required style={inp}/>
          {ehParcelaDeGrupo&&(
            <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
              O "{numParcela}/{totalParcelasAtual}" é adicionado automaticamente ao salvar — não precisa digitar aqui.
            </p>
          )}
        </div>

        {/* Valor */}
        <div>
          <label style={lbl}>{(ehParcelaDeGrupo||form.transaction_type==='parcelada')?'Valor da parcela (R$)':'Valor (R$)'}</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,color:TEXTMU,fontWeight:600}}>R$</span>
            <input type="text" inputMode="numeric" value={valRaw}
              onChange={e=>setValRaw(maskCurrency(e.target.value))}
              required style={{...inp,paddingLeft:40,fontSize:18,fontWeight:700,color:isReceita?GREEN:'#FF3B30'}}/>
          </div>
          {ehParcelaDeGrupo&&(
            <div style={{marginTop:10}}>
              <p style={{fontSize:11,color:TEXTMU,margin:'0 0 6px'}}>Aplicar a mudança de valor em:</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6}}>
                {([
                  ['esta',`Só esta parcela (${numParcela}/${totalParcelasAtual})`],
                  ['daqui',`Esta e as próximas (${numParcela} a ${totalParcelasAtual})`],
                  ['todas','Todas as parcelas (inclui as já pagas)'],
                ] as const).map(([k,txt])=>(
                  <button key={k} type="button" onClick={()=>setEscopo(k)}
                    style={{textAlign:'left',padding:'10px 12px',borderRadius:12,fontSize:13,cursor:'pointer',
                      border:`1.5px solid ${escopo===k?TERRA:'rgba(0,0,0,0.1)'}`,
                      background:escopo===k?'rgba(196,98,45,0.08)':'#fff',color:'#1C1C1E',fontWeight:escopo===k?700:500}}>
                    {escopo===k?'● ':'○ '}{txt}
                  </button>
                ))}
              </div>
              {(()=>{
                const novo=unmaskCurrency(valRaw)
                const n=totalParcelasAtual
                // Total a pagar = soma das parcelas já considerando o escopo escolhido
                let total=0
                irmas.forEach((l:any)=>{
                  const suf=sufixoDaParcela(l.description||'')
                  const num=suf?.num||0
                  const dentro=l.id===id||escopo==='todas'||(escopo==='daqui'&&num>(numParcela||0))
                  total+=(dentro&&novo>0)?novo:(l.installment_value||l.amount||0)
                })
                if(irmas.length<n)total+=(n-irmas.length)*novo
                const produto=unmaskCurrency(totalProdRaw)
                const juros=produto>0?Math.max(0,total-produto):0
                const R=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
                return(
                  <div style={{marginTop:12,background:'rgba(0,0,0,0.03)',borderRadius:12,padding:'10px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#48484A'}}>
                      <span>Total a pagar ({n}x)</span><strong>{R(total)}</strong>
                    </div>
                    <label style={{...lbl,marginTop:10}}>Total do produto (opcional)</label>
                    <input type="text" inputMode="numeric" value={totalProdRaw}
                      onChange={e=>setTotalProdRaw(maskCurrency(e.target.value))}
                      placeholder="Para ver os juros" style={inp}/>
                    {produto>0&&(juros>0
                      ?<p style={{fontSize:12,color:'#7B3020',margin:'8px 0 0',fontWeight:600}}>Juros: {R(juros)} ({(juros/produto*100).toFixed(1)}%)</p>
                      :<p style={{fontSize:12,color:TEXTMU,margin:'8px 0 0'}}>{total<produto-0.01?'As parcelas somam menos que o produto. Confira os valores.':'Sem juros.'}</p>)}
                    <p style={{fontSize:10,color:TEXTMU,margin:'6px 0 0'}}>Só para conferir: este valor não é salvo.</p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Data */}
        <div>
          <label style={lbl}>Data da compra</label>
          <input type="date"
            value={ehParcelaDeGrupo?(dataCompra||(dataCompraOriginal?format(dataCompraOriginal,'yyyy-MM-dd'):'')):(form.purchase_date||'')}
            onChange={e=>ehParcelaDeGrupo?setDataCompra(e.target.value):sf('purchase_date',e.target.value)}
            required style={{...inp,WebkitAppearance:'none' as any,maxWidth:'100%'}}/>
          {ehParcelaDeGrupo&&(
            <p style={{fontSize:11,color:TEXTMU,margin:'6px 0 0'}}>
              Mudando a data, todas as {totalParcelasAtual} parcelas e as faturas acompanham.
              {dataCompra&&numParcela&&<> A parcela {numParcela} cai em <strong>{format(addMonths(parseISO(dataCompra),numParcela-1),'dd/MM/yyyy')}</strong>.</>}
            </p>
          )}
        </div>

        {/* Campos de parcelamento (quando tipo=parcelada) */}
        {form.transaction_type==='parcelada'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10}}>
            <div>
              <label style={lbl}>Nº de parcelas</label>
              <input type="number" value={form.installment_total||form.total_installments||''} onChange={e=>sf('installment_total',parseInt(e.target.value)||null)} style={inp} min="2" max="600"/>
            </div>
          </div>
        )}

        {/* Categoria */}
        <div>
          <label style={lbl}>Categoria</label>
          <div style={{position:'relative'}}>
            <select value={form.category||''} onChange={e=>{sf('category',e.target.value);sf('subcategory','')}}
              style={{...inp,appearance:'none' as const}}>
              <option value="">Selecione...</option>
              {cats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
          </div>
        </div>

        {/* Subcategoria */}
        {form.category&&subs.length>0&&(
          <div>
            <label style={lbl}>Subcategoria</label>
            <div style={{position:'relative'}}>
              <select value={form.subcategory||''} onChange={e=>sf('subcategory',e.target.value)}
                style={{...inp,appearance:'none' as const}}>
                <option value="">Selecione...</option>
                {subs.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
          </div>
        )}

        {/* Como pagou */}
        {!isReceita&&(
          <div>
            <label style={lbl}>Como pagou</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {METHODS.map(m=>(
                <button key={m.v} type="button" onClick={()=>sf('payment_method',m.v)}
                  style={{height:36,padding:'0 14px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:form.payment_method===m.v?600:400,
                    background:form.payment_method===m.v?TERRA:'rgba(0,0,0,0.03)',
                    color:form.payment_method===m.v?'#fff':TEXT}}>
                  {m.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cartão de crédito */}
        {naFatura&&cards.length>0&&(
          <div>
            <label style={lbl}>Cartão de crédito</label>
            <div style={{position:'relative'}}>
              <select value={form.card_name||''} onChange={e=>sf('card_name',e.target.value)}
                style={{...inp,appearance:'none' as const}}>
                <option value="">Selecione...</option>
                {cards.filter(c=>!c.card_type||c.card_type==='credito').map(c=>(
                  <option key={c.id} value={`${c.name} — ${c.holder}`}>{c.name} — {c.holder}</option>
                ))}
              </select>
              <ChevronDown size={14} color={TEXTMU} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
            </div>
          </div>
        )}

        {/* Status — some para qualquer compra no crédito, à vista ou parcelada */}
        {!naFatura&&(
          <div>
            <label style={lbl}>Status</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {['Previsto','Pendente','Pago','Atrasado','Cancelado'].map(s=>{
                const colors:Record<string,string>={Pago:GREEN,Pendente:TERRA,Previsto:'#B37700',Atrasado:'#FF3B30',Cancelado:TEXTMU}
                const on=form.status===s
                return(
                  <button key={s} type="button" onClick={()=>{
                    sf('status',s)
                    if(s==='Pago'&&!form.paid_date){sf('paid_date',format(new Date(),'yyyy-MM-dd'))}
                  }}
                    style={{height:36,padding:'0 14px',borderRadius:10,border:on?`1px solid ${colors[s]}40`:'1px solid transparent',cursor:'pointer',fontSize:12,fontWeight:on?600:400,
                      background:on?`${colors[s]}18`:'rgba(0,0,0,0.03)',color:on?colors[s]:TEXTMU}}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {naFatura&&(
          <div style={{background:'rgba(196,98,45,0.06)',borderRadius:12,padding:'10px 14px',border:'1px solid rgba(196,98,45,0.12)'}}>
            <p style={{fontSize:12,color:TERRA,margin:0,fontWeight:600}}>
              {form.transaction_type==='parcelada'
                ? '💳 Parcelas no crédito — cada uma entra na fatura do seu mês e é quitada junto com ela'
                : '💳 Compra no crédito — entra na fatura automaticamente'}
            </p>
          </div>
        )}

        {/* Pagamento confirmação */}
        {form.status==='Pago'&&!naFatura&&(
          <div style={{background:'rgba(34,199,89,0.06)',borderRadius:16,padding:'14px 16px',border:'1px solid rgba(34,199,89,0.15)'}}>
            <p style={{fontSize:12,fontWeight:700,color:GREEN,margin:'0 0 12px'}}>Confirmação de pagamento</p>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1}}>
                <label style={{...lbl,color:'#48484A'}}>Valor pago (R$)</label>
                <input type="text" inputMode="numeric" value={paidAmountRaw}
                  onChange={e=>setPaidAmountRaw(maskCurrency(e.target.value))}
                  placeholder="Valor real" style={{...inp,height:42}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{...lbl,color:'#48484A'}}>Data</label>
                <input type="date" value={form.paid_date||''} onChange={e=>sf('paid_date',e.target.value)} style={{...inp,height:42}}/>
              </div>
            </div>
            {(()=>{
              const valorOriginal = unmaskCurrency(valRaw) || (instValRaw ? unmaskCurrency(instValRaw) : 0)
              const valorPago = unmaskCurrency(paidAmountRaw)
              const desconto = valorOriginal - valorPago
              if (valorPago > 0 && desconto > 0.01 && desconto < valorOriginal) {
                return (
                  <div style={{marginTop:10,background:'rgba(52,199,89,0.08)',borderRadius:10,padding:'8px 12px'}}>
                    <p style={{fontSize:12,color:GREEN,fontWeight:600,margin:0}}>
                      💰 Desconto obtido: {formatCurrency(desconto)} ({((desconto/valorOriginal)*100).toFixed(1)}%)
                    </p>
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}

        {/* Observações */}
        <div>
          <label style={lbl}>Observações</label>
          <textarea value={form.notes||''} onChange={e=>sf('notes',e.target.value)} rows={2}
            style={{...inp,height:'auto',padding:'12px 16px',resize:'none',lineHeight:1.5}} placeholder="Opcional..."/>
        </div>

        {/* Salvar */}
        <button onClick={save} disabled={saving}
          style={{width:'100%',height:52,background:TERRA,color:'#fff',fontWeight:700,fontSize:15,borderRadius:14,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(196,98,45,0.3)',marginTop:4}}>
          {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:'✓ Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
