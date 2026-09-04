'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CreditCard, Target, PiggyBank, Tag, ChevronRight, ChevronLeft, Plus, Pencil, X, Loader2, Shield, LogOut, Calendar, RefreshCw, Download, Trash2, Users, DollarSign, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, CATS_DESPESA, SUBCATS, CAT_ICONS, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { loadCustomCategorias, mesclarCategorias, criarCategoria, renomearCategoria, excluirCategoria, contarUsoCategoria, ehCategoriaFixa, type CustomCategoria } from '@/lib/utils/categorias'
import { useBackGuard } from '@/lib/hooks/useBackGuard'

const BG='#F5F5F7', CARD='#FFFFFF', TEXT='#1C1C1E', TEXTLT='#48484A', TEXTMU='#8E8E93'
const TERRA='#C4622D', GREEN='#34C759', RED='#FF3B30', ACCENT='#007AFF'

const CARD_COLORS = [
  {name:'Nubank',hex:'#6B3FA0'},{name:'Roxo',hex:'#8B5CF6'},{name:'Santander',hex:'#CC0000'},
  {name:'Vermelho',hex:'#E24B4A'},{name:'BB',hex:'#1B4E9B'},{name:'Azul',hex:'#3B82F6'},
  {name:'Caixa',hex:'#006B3F'},{name:'Verde',hex:'#10B981'},{name:'Preto',hex:'#1C1C1E'},
  {name:'Grafite',hex:'#374151'},{name:'Dourado',hex:'#B8860B'},{name:'Bronze',hex:'#8B5E3C'},
  {name:'Laranja',hex:'#EA580C'},{name:'Rosa',hex:'#DB2777'},
]

function fmtM(raw:string):string{const n=raw.replace(/\D/g,'');if(!n)return '';return (parseInt(n)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function parsM(s:string):number{return parseFloat(s.replace(/[R$\s.]/g,'').replace(',','.'))||0}

type Section = 'main'|'cartoes'|'limites'|'salario'|'recorrentes'|'seguranca'|'categorias'|'dados'|'titulares'

export default function Parametros() {
  const router = useRouter()
  const [sec,setSec]=useState<Section>('main')
  // Cartões
  const [cards,setCards]=useState<any[]>([])
  const [showC,setShowC]=useState(false)
  const [editC,setEditC]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [prevColor,setPrevColor]=useState('#6B3FA0')
  const [form,setForm]=useState({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'})
  // Limites
  const [limits, setLimits] = useState<Record<string,number>>({})
  const [limitInputs, setLimitInputs] = useState<Record<string,string>>({})
  const [limitsLoading, setLimitsLoading] = useState(false)
  // Salário
  const [salaryDay, setSalaryDay] = useState('1')
  const [salaryAmountL, setSalaryAmountL] = useState('')
  const [salaryAmountN, setSalaryAmountN] = useState('')
  // O salário é um lançamento recorrente como qualquer outro — a tela mostra
  // como card e a edição acontece num modal, igual às contas recorrentes.
  const [editandoDia, setEditandoDia] = useState(false)
  const [diaRaw, setDiaRaw] = useState('')
  const [editSal, setEditSal] = useState<'Lucas'|'Nicoly'|null>(null)
  const [editSalValor, setEditSalValor] = useState('')
  const [erroSal, setErroSal] = useState('')
  const [savingSal, setSavingSal] = useState(false)
  // Recorrentes
  const [recurrents, setRecurrents] = useState<any[]>([])
  const [editingDueDay, setEditingDueDay] = useState<string|null>(null)
  const [dueDayRaw, setDueDayRaw] = useState('')
  // Conta recorrente também é lançamento: dá pra editar tudo, não só o dia
  const [editRec, setEditRec] = useState<any|null>(null)
  const [editRecForm, setEditRecForm] = useState<any>({})
  const [editRecValor, setEditRecValor] = useState('')
  const [savingRec, setSavingRec] = useState(false)
  const [erroRec, setErroRec] = useState<Record<string,string>>({})
  // Segurança
  const [faceIdEnabled, setFaceIdEnabled] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  // Categorias/Subcategorias
  const [customSubsDB, setCustomSubsDB] = useState<{id:string;category:string;subcategory:string}[]>([])
  const [customCats, setCustomCats] = useState<CustomCategoria[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatKind, setNewCatKind] = useState<'despesa'|'receita'>('despesa')
  const [editingCatId, setEditingCatId] = useState<string|null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [catsLoading, setCatsLoading] = useState(false)
  const [newSubCat, setNewSubCat] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [editingSubId, setEditingSubId] = useState<string|null>(null)
  const [editingSubName, setEditingSubName] = useState('')

  useEffect(()=>{
    if(sec==='cartoes') loadCards()
    if(sec==='limites') loadLimits()
    if(sec==='salario') loadSalary()
    // O editor de conta recorrente tem um seletor de cartão. Sem carregar os
    // cartões aqui, o select abria vazio quando a cobrança era no crédito.
    if(sec==='recorrentes'){ loadRecurrents(); loadCards(); loadCustomSubs() }
    if(sec==='seguranca') loadSecurity()
    if(sec==='categorias') loadCustomSubs()
  },[sec])

  // Arrastar para voltar fecha a camada aberta (seção interna, modal) em vez
  // de sair de Configurações inteira — que é o que acontecia antes, já que as
  // seções são estado e não entravam no histórico do navegador.
  useBackGuard(sec!=='main', ()=>setSec('main'))
  useBackGuard(!!editRec,   ()=>setEditRec(null))
  useBackGuard(!!editSal,   ()=>setEditSal(null))
  useBackGuard(showC,       ()=>setShowC(false))

  // ── Categorias/Subcategorias ──
  async function loadCustomSubs(){
    setCatsLoading(true)
    try{
      const {data,error}=await createClient().from('custom_subcategories').select('*').order('category').order('subcategory')
      if(!error&&data)setCustomSubsDB(data)
    }catch{ /* tabela pode não existir ainda */ }
    setCustomCats(await loadCustomCategorias())
    setCatsLoading(false)
  }

  // ── Categorias (CRUD) ──
  async function addCategory(){
    const r=await criarCategoria(newCatName,newCatKind)
    if(!r.ok){toast.error(r.erro||'Erro ao criar');return}
    toast.success('Categoria criada!')
    setNewCatName('')
    loadCustomSubs()
  }
  async function saveCategoryName(cat:CustomCategoria){
    const r=await renomearCategoria(cat.id,cat.name,editingCatName)
    if(!r.ok){toast.error(r.erro||'Erro ao renomear');return}
    toast.success('Categoria renomeada — os lançamentos foram atualizados')
    setEditingCatId(null); setEditingCatName('')
    loadCustomSubs()
  }
  async function removeCategory(cat:CustomCategoria){
    const emUso=await contarUsoCategoria(cat.name)
    const aviso=emUso>0
      ? `"${cat.name}" está em ${emUso} lançamento${emUso>1?'s':''}. Se excluir, esses lançamentos ficam sem categoria válida. Excluir mesmo assim?`
      : `Excluir a categoria "${cat.name}"?`
    if(!confirm(aviso))return
    const r=await excluirCategoria(cat.id,cat.name)
    if(!r.ok){toast.error(r.erro||'Erro ao excluir');return}
    toast.success('Categoria excluída')
    loadCustomSubs()
  }
  async function addSubcategory(){
    if(!newSubCat||!newSubName.trim()){toast.error('Selecione a categoria e informe o nome');return}
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    const {error}=await s.from('custom_subcategories').insert({owner_id:user.id,category:newSubCat,subcategory:newSubName.trim()})
    if(error){toast.error(error.message.includes('duplicate')?'Essa subcategoria já existe':`Erro: ${error.message}`);return}
    toast.success('Subcategoria criada!')
    setNewSubName('')
    loadCustomSubs()
  }
  async function deleteSubcategory(id:string){
    if(!confirm('Excluir esta subcategoria?'))return
    await createClient().from('custom_subcategories').delete().eq('id',id)
    toast.success('Excluída')
    loadCustomSubs()
  }
  async function renameSubcategory(id:string){
    if(!editingSubName.trim())return
    await createClient().from('custom_subcategories').update({subcategory:editingSubName.trim()}).eq('id',id)
    toast.success('Renomeada')
    setEditingSubId(null)
    loadCustomSubs()
  }

  // ── Cartões ──
  async function loadCards(){const {data}=await createClient().from('cards').select('*').order('holder').order('name');setCards(data||[])}
  function sf(k:string,v:string){setForm(f=>({...f,[k]:v}))}
  function openNew(){setForm({name:'',bank:'',holder:'Lucas',card_type:'credito',closing_day:'',due_day:'',limitRaw:'',alertRaw:'80%',color:'#6B3FA0'});setPrevColor('#6B3FA0');setEditC(null);setShowC(true)}
  function openEdit(c:any){setForm({name:c.name,bank:c.bank,holder:c.holder,card_type:c.card_type,closing_day:c.closing_day?.toString()||'',due_day:c.due_day?.toString()||'',limitRaw:c.credit_limit?c.credit_limit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'',alertRaw:c.alert_pct?c.alert_pct+'%':'80%',color:c.color||'#6B3FA0'});setPrevColor(c.color||'#6B3FA0');setEditC(c);setShowC(true)}
  async function saveCard(e:React.FormEvent){
    e.preventDefault()
    if(!form.name||!form.bank){toast.error('Preencha nome e banco');return}
    setSaving(true)
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    const p={name:form.name,bank:form.bank,holder:form.holder,card_type:form.card_type,closing_day:parseInt(form.closing_day)||1,due_day:parseInt(form.due_day)||1,credit_limit:parsM(form.limitRaw),alert_pct:parseInt(form.alertRaw.replace('%',''))||80,color:form.color,is_active:true}
    const {error}=editC?await s.from('cards').update(p).eq('id',editC.id):await s.from('cards').insert({...p,owner_id:user.id,owner_name:form.holder||'Lucas'})
    if(error){toast.error(`Erro: ${error.message}`);setSaving(false);return}
    toast.success(editC?'Cartão atualizado!':'Cartão adicionado!');setShowC(false);loadCards();setSaving(false)
  }

  // ── Limites ──
  async function loadLimits(){
    setLimitsLoading(true)
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(!user){setLimitsLoading(false);return}
    const {data}=await s.from('category_limits').select('*').eq('owner_id',user.id)
    const map:Record<string,number>={}
    const inputsMap:Record<string,string>={}
    data?.forEach((r:any)=>{map[r.category]=r.limit_amount;inputsMap[r.category]=maskCurrency(Math.round(r.limit_amount*100).toString())})
    setLimits(map);setLimitInputs(inputsMap);setLimitsLoading(false)
  }
  async function saveLimit(cat:string, val:string){
    const amount=unmaskCurrency(val)
    const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
    if(amount<=0){
      await s.from('category_limits').delete().eq('owner_id',user.id).eq('category',cat)
      setLimits(p=>{const n={...p};delete n[cat];return n})
      setLimitInputs(p=>({...p,[cat]:''}))
      return
    }
    const {data:existing}=await s.from('category_limits').select('id').eq('owner_id',user.id).eq('category',cat).single()
    if(existing){
      await s.from('category_limits').update({limit_amount:amount}).eq('id',existing.id)
    }else{
      await s.from('category_limits').insert({owner_id:user.id,category:cat,limit_amount:amount})
    }
    setLimits(p=>({...p,[cat]:amount}))
    toast.success(`Limite de ${cat} salvo!`)
  }

  // ── Salário ──
  async function loadSalary(){
    const s=createClient()
    // App do casal: a configuração é COMPARTILHADA. Antes filtrava por owner_id,
    // então o que a Nicoly salvasse o Lucas não via (e vice-versa), e .single()
    // ainda dava erro quando não existia linha nenhuma.
    const {data}=await s.from('app_settings').select('*').limit(1).maybeSingle()
    if(data){
      setSalaryDay(data.salary_day?.toString()||'1')
      setSalaryAmountL(data.salary_lucas?maskCurrency(Math.round(data.salary_lucas*100).toString()):'')
      setSalaryAmountN(data.salary_nicoly?maskCurrency(Math.round(data.salary_nicoly*100).toString()):'')
    }
  }
  /**
   * Grava a configuração e reflete nos lançamentos. O salário é uma receita
   * recorrente: mudar o valor aqui precisa valer para os meses que ainda não
   * caíram, senão a tela de Início continuaria projetando o valor antigo.
   */
  async function persistirSalario(day:number,valL:number,valN:number):Promise<{ok:boolean;erro?:string}>{
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(!user)return {ok:false,erro:'Sessão expirada'}
    const payload={salary_day:day,salary_lucas:valL,salary_nicoly:valN}
    const {data:existing}=await s.from('app_settings').select('id').limit(1).maybeSingle()
    // Antes o erro era engolido: a tabela não tinha as colunas de salário, o
    // insert falhava calado e a tela abria vazia toda vez.
    const {error:saveErr}=existing
      ? await s.from('app_settings').update(payload).eq('id',existing.id)
      : await s.from('app_settings').insert({...payload,owner_id:user.id})
    if(saveErr)return {ok:false,erro:saveErr.message}

    const now=new Date()
    const mesKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()
    const actualDay=Math.min(day,lastDay)
    const salaryDate=`${mesKey}-${String(actualDay).padStart(2,'0')}`
    const hojeStr=`${mesKey}-${String(now.getDate()).padStart(2,'0')}`

    const aplicar=async(nome:string,holder:string,valor:number)=>{
      // Valor novo só no que ainda não foi recebido. Reescrever um mês já pago
      // falsearia o histórico — o que entrou na conta foi o valor de então.
      if(valor>0){
        await s.from('transactions')
          .update({amount:valor,expected_amount:valor,recurring_day:day})
          .eq('is_recurring',true).eq('holder',holder).eq('description',nome).neq('status','Pago')
      }
      await s.from('transactions').update({recurring_day:day})
        .eq('is_recurring',true).eq('holder',holder).eq('description',nome).eq('status','Pago')
      if(valor<=0)return
      const {data:doMes}=await s.from('transactions').select('id')
        .eq('is_recurring',true).eq('holder',holder).eq('description',nome)
        .gte('purchase_date',`${mesKey}-01`)
        .lte('purchase_date',`${mesKey}-${String(lastDay).padStart(2,'0')}`)
      if(doMes&&doMes.length>0)return
      await s.from('transactions').insert({
        owner_id:user.id,owner_name:holder,holder,
        type:'Receita',transaction_type:'receita',nature:'Fixo',
        description:nome,amount:valor,category:'Salário',
        purchase_date:salaryDate,
        status:salaryDate<=hojeStr?'Pago':'Previsto',
        is_recurring:true,recurring_day:day,expected_amount:valor,
      })
    }
    await aplicar('Salário Lucas','Lucas',valL)
    await aplicar('Salário Nicoly','Nicoly',valN)
    return {ok:true}
  }

  function abrirEditorSal(titular:'Lucas'|'Nicoly'){
    setEditSalValor(titular==='Lucas'?salaryAmountL:salaryAmountN)
    setErroSal(''); setEditSal(titular)
  }

  async function salvarSalarioDe(titular:'Lucas'|'Nicoly'){
    const valor=unmaskCurrency(editSalValor)
    if(valor<=0){setErroSal('Informe o valor do salário');return}
    setErroSal(''); setSavingSal(true)
    const valL=titular==='Lucas'?valor:unmaskCurrency(salaryAmountL)
    const valN=titular==='Nicoly'?valor:unmaskCurrency(salaryAmountN)
    const r=await persistirSalario(parseInt(salaryDay)||1,valL,valN)
    setSavingSal(false)
    if(!r.ok){toast.error(`Não foi possível salvar: ${r.erro}`);return}
    toast.success(`Salário ${titular==='Lucas'?'do Lucas':'da Nicoly'} atualizado`)
    setEditSal(null); loadSalary()
  }

  async function salvarDiaSalario(){
    const dia=parseInt(diaRaw)
    if(!dia||dia<1||dia>31){toast.error('Informe um dia válido (1 a 31)');return}
    const r=await persistirSalario(dia,unmaskCurrency(salaryAmountL),unmaskCurrency(salaryAmountN))
    if(!r.ok){toast.error(`Não foi possível salvar: ${r.erro}`);return}
    toast.success('Dia do recebimento salvo')
    setEditandoDia(false); setDiaRaw(''); loadSalary()
  }

  // ── Recorrentes ──
  async function loadRecurrents(){
    // Só DESPESAS recorrentes. Receita (salário) é configurada em Ciclo Salarial
    // e não tem "dia de vencimento" — aparecer aqui pedindo vencimento confundia.
    const {data}=await createClient().from('transactions').select('*')
      .eq('is_recurring',true).neq('type','Receita').order('purchase_date',{ascending:false})
    const despesas=(data||[]).filter((t:any)=>t.transaction_type!=='receita')

    // Cada mês gera uma nova linha da mesma conta recorrente. A lista mostrava
    // todas, então "Aluguel da Garagem" aparecia repetido uma vez por mês.
    // Aqui mostramos UM card por conta (o mais recente), guardando quantas
    // ocorrências existem para poder apagar todas de uma vez.
    const porConta=new Map<string,any>()
    for(const t of despesas){
      const chave=`${(t.description||'').trim().toLowerCase()}|${t.holder}`
      if(porConta.has(chave)){porConta.get(chave)._ocorrencias++; continue}
      porConta.set(chave,{...t,_ocorrencias:1,_encerrada:t.recurring_active===false})
    }
    setRecurrents(Array.from(porConta.values()).sort((a,b)=>
      (a.description||'').localeCompare(b.description||'')))
  }

  async function removeRecurrent(tx:any){
    const s=createClient()
    const n=tx._ocorrencias||1
    const escolha=confirm(
      `Apagar a conta recorrente "${tx.description}"?\n\n` +
      `Existem ${n} lançamento${n>1?'s':''} desta conta.\n\n` +
      `ATENÇÃO: isso apaga TAMBÉM o histórico dos meses anteriores — os valores somem dos relatórios passados.\n\n` +
      `Se a conta apenas deixou de existir de agora em diante, use "Encerrar": para de gerar e mantém o histórico.\n\n` +
      `OK = apagar tudo   ·   Cancelar = não apagar`
    )
    if(!escolha)return
    const {error}=await s.from('transactions').delete()
      .eq('is_recurring',true).eq('holder',tx.holder).eq('description',tx.description)
    if(error){toast.error(`Não foi possível apagar: ${error.message}`);return}
    toast.success(`"${tx.description}" apagada (${n} lançamento${n>1?'s':''})`)
    loadRecurrents()
  }

  function abrirEditorRec(tx:any){
    setEditRecForm({
      description:tx.description||'', category:tx.category||'', subcategory:tx.subcategory||'',
      holder:tx.holder||'Lucas', payment_method:tx.payment_method||'pix',
      card_name:tx.card_name||'', recurring_day:tx.recurring_day||'',
    })
    setEditRecValor(maskCurrency(Math.round(((tx.expected_amount||tx.amount)||0)*100).toString()))
    setErroRec({})
    setEditRec(tx)
  }

  async function salvarEditorRec(){
    if(!editRec)return
    const f=editRecForm
    const nome=(f.description||'').trim()
    const valor=unmaskCurrency(editRecValor)
    const noCartao=f.payment_method==='cartao_credito'
    const dia=parseInt(f.recurring_day)||null

    // Erro no próprio campo: só o toast passava batido, e o usuário achava que
    // o botão de salvar não estava funcionando.
    const erros:Record<string,string>={}
    if(!nome)erros.description='Informe o nome da conta'
    if(valor<=0)erros.valor='Informe o valor mensal'
    if(!(f.category||'').trim())erros.category='Escolha a categoria'
    if(noCartao&&!(f.card_name||'').trim())erros.card_name='Escolha o cartão'
    if(!noCartao&&(!dia||dia<1||dia>31))erros.recurring_day='Informe o dia do vencimento (1 a 31)'
    setErroRec(erros)
    if(Object.keys(erros).length>0){
      toast.error('Faltam campos obrigatórios')
      return
    }

    setSavingRec(true)
    const s=createClient()
    // Alterar a conta recorrente vale para TODAS as ocorrências dela — é a
    // mesma conta repetida mês a mês, não lançamentos independentes. Só o valor
    // já pago fica preservado: mexer nele reescreveria histórico de pagamento.
    // Campos de cadastro valem para TODAS as ocorrências, pagas ou não.
    const cadastro:any={
      description:nome, category:f.category||editRec.category, subcategory:f.subcategory||null,
      holder:f.holder, payment_method:f.payment_method,
      card_name:noCartao?(f.card_name||null):null,
      recurring_day:noCartao?null:dia,
    }
    // O valor só muda no que ainda não foi pago — reescrever o valor de uma
    // parcela paga seria falsear histórico de pagamento.
    const comValor:any={...cadastro, amount:valor, expected_amount:valor}

    // Antes o update era um só, com .neq('status','Pago'): se todas as
    // ocorrências estivessem pagas, ele não atingia linha nenhuma e a edição
    // simplesmente não salvava, sem erro e sem aviso.
    const r1=await s.from('transactions').update(comValor)
      .eq('is_recurring',true).eq('holder',editRec.holder).eq('description',editRec.description)
      .neq('status','Pago')
    const r2=await s.from('transactions').update(cadastro)
      .eq('is_recurring',true).eq('holder',editRec.holder).eq('description',editRec.description)
      .eq('status','Pago')
    const erro=r1.error||r2.error
    if(erro){toast.error(`Não foi possível salvar: ${erro.message}`);setSavingRec(false);return}

    toast.success('Conta recorrente atualizada')
    setEditRec(null); setSavingRec(false)
    loadRecurrents()
  }

  async function encerrarRecorrencia(tx:any,encerrar:boolean){
    // Encerrar não apaga nada e não desmarca is_recurring: os meses passados
    // continuam existindo e continuam contando como conta recorrente nos
    // relatórios. Só para de gerar os próximos.
    if(encerrar&&!confirm(
      `Encerrar "${tx.description}"?\n\n` +
      `Ela não será mais gerada nos próximos meses.\n` +
      `Todo o histórico dos meses anteriores é mantido intacto.`
    ))return
    const {error}=await createClient().from('transactions')
      .update({recurring_active:encerrar?false:true})
      .eq('is_recurring',true).eq('holder',tx.holder).eq('description',tx.description)
    if(error){toast.error(`Erro: ${error.message}`);return}
    toast.success(encerrar?'Conta encerrada — histórico preservado':'Conta reativada')
    loadRecurrents()
  }
  async function saveDueDay(tx:any){
    const dia=parseInt(dueDayRaw)
    if(!dia||dia<1||dia>31){toast.error('Informe um dia válido (1-31)');return}
    // Atualiza todas as ocorrências dessa recorrente (mesma descrição+titular), não só o template mais recente
    const {error}=await createClient().from('transactions').update({recurring_day:dia}).eq('description',tx.description).eq('holder',tx.holder).eq('is_recurring',true)
    if(error){toast.error(`Erro ao salvar: ${error.message}`);return}
    toast.success('Dia de vencimento salvo!')
    setEditingDueDay(null); setDueDayRaw('')
    loadRecurrents()
  }

  // ── Segurança ──
  async function loadSecurity(){
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(user){
      setUserId(user.id);setUserEmail(user.email||'')
      setFaceIdEnabled(localStorage.getItem(`ln_faceid_${user.id}`)==='1')
    }
  }
  async function toggleFaceId(){
    if(faceIdEnabled){
      localStorage.removeItem(`ln_faceid_${userId}`)
      localStorage.removeItem('ln_saved_pw')
      setFaceIdEnabled(false)
      toast.success('Face ID desativado')
    }else{
      try{
        const challenge=crypto.getRandomValues(new Uint8Array(32))
        const uid8=new TextEncoder().encode(userId.slice(0,16))
        await navigator.credentials.create({
          publicKey:{
            challenge,rp:{name:'Finanças L&N',id:window.location.hostname},
            user:{id:uid8,name:userEmail,displayName:userEmail.split('@')[0]},
            pubKeyCredParams:[{alg:-7,type:'public-key'},{alg:-257,type:'public-key'}],
            authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',requireResidentKey:true},
            timeout:30000,
          }
        })
        localStorage.setItem(`ln_faceid_${userId}`,'1')
        setFaceIdEnabled(true)
        toast.success('Face ID ativado! 🔒')
      }catch{toast.error('Não foi possível configurar o Face ID')}
    }
  }
  async function handleLogout(){
    await createClient().auth.signOut()
    localStorage.removeItem('ln_last_email')
    sessionStorage.clear()
    router.push('/login')
  }

  // Mensagem de erro logo abaixo do campo
  const ErroCampo=({campo}:{campo:string})=> erroRec[campo]
    ? <p style={{fontSize:11,color:RED,fontWeight:600,margin:'5px 0 0'}}>{erroRec[campo]}</p>
    : null
  const bordaErro=(campo:string)=> erroRec[campo] ? {border:`1px solid ${RED}`} : {}

  // ── Styles ──
  const sCard={background:CARD,borderRadius:20,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}
  const sLbl={fontSize:11,fontWeight:600 as const,color:TEXTMU,display:'block',marginBottom:6,textTransform:'uppercase' as const,letterSpacing:'0.05em'}
  const sInp={width:'100%',height:44,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'0 14px',fontSize:14,color:TEXT,outline:'none',boxSizing:'border-box' as const}
  const sBtn=(bg:string,color:string)=>({width:'100%',height:48,background:bg,color,borderRadius:14,border:'none',fontSize:15,fontWeight:600 as const,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8})
  const seg=(on:boolean)=>({flex:1,height:38,borderRadius:12,border:'none',background:on?TERRA:'rgba(0,0,0,0.03)',color:on?'#fff':TEXT,fontSize:13,fontWeight:on?600:400 as any,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'})
  const backBtn=()=><button onClick={()=>setSec('main')} style={{background:'rgba(0,0,0,0.03)',border:'none',borderRadius:12,padding:'8px 14px',cursor:'pointer',fontSize:13,color:TEXT,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><ChevronLeft size={16}/>Voltar</button>

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CARTÕES
  // ────────────────────────────────────────────────────────────
  if(sec==='cartoes') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Cartões e Contas</h2>
        <button onClick={openNew} style={{width:34,height:34,background:TERRA,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}><Plus size={18} color="#fff"/></button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {cards.map(c=>(
          <div key={c.id} style={{...sCard,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,opacity:c.is_active?1:0.5}}>
            <div style={{width:38,height:38,borderRadius:12,background:c.color,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:13,fontWeight:700,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{c.name} — {c.holder}</p>
              <p style={{fontSize:10,color:TEXTMU,margin:'2px 0 0'}}>Fecha {c.closing_day} · Vence {c.due_day} · {formatCurrency(c.credit_limit)}</p>
            </div>
            <button onClick={()=>openEdit(c)} style={{padding:'6px 8px',background:'rgba(0,0,0,0.03)',borderRadius:10,border:'none',cursor:'pointer'}}><Pencil size={13} color={TEXTMU}/></button>
            <button onClick={async()=>{await createClient().from('cards').update({is_active:!c.is_active}).eq('id',c.id);toast.success(c.is_active?'Arquivado':'Ativado');loadCards()}}
              style={{padding:'4px 10px',background:c.is_active?'rgba(196,98,45,0.1)':'rgba(52,199,89,0.1)',borderRadius:10,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,color:c.is_active?TERRA:GREEN}}>
              {c.is_active?'Arquivar':'Ativar'}
            </button>
            <button onClick={async()=>{if(!confirm(`Excluir o cartão "${c.name}"? Essa ação não pode ser desfeita.`))return;await createClient().from('cards').delete().eq('id',c.id);toast.success('Cartão excluído');loadCards()}}
              style={{padding:'4px 8px',background:'rgba(255,59,48,0.08)',borderRadius:10,border:'none',cursor:'pointer'}}><Trash2 size={13} color="#FF3B30"/></button>
          </div>
        ))}
        {cards.length===0&&<p style={{fontSize:13,color:TEXTMU,textAlign:'center',padding:20}}>Nenhum cartão cadastrado</p>}
      </div>
      {showC&&(
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end'}} onClick={()=>setShowC(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)'}}/>
          <div style={{position:'relative',width:'100%',maxWidth:480,margin:'0 auto',background:CARD,borderRadius:'28px 28px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'18px 20px 12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:0}}>{editC?'Editar cartão':'Novo cartão'}</h3>
              <button onClick={()=>setShowC(false)} style={{background:'none',border:'none',cursor:'pointer'}}><X size={20} color={TEXTMU}/></button>
            </div>
            <div style={{overflowY:'auto',WebkitOverflowScrolling:'touch',overscrollBehavior:'none',flex:1,paddingBottom:'env(safe-area-inset-bottom, 20px)'}}>
              <form onSubmit={saveCard} style={{padding:'16px 20px 100px',display:'flex',flexDirection:'column',gap:14}}>
                <div style={{borderRadius:20,padding:16,background:prevColor,position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',right:-10,top:-10,width:70,height:70,borderRadius:'50%',background:'rgba(255,255,255,0.1)'}}/>
                  <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',margin:'0 0 3px'}}>{form.bank||'Banco'}</p>
                  <p style={{fontSize:15,fontWeight:600,color:'#fff',margin:0}}>{form.holder}</p>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginTop:14}}>
                    <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{form.name||'Nome do cartão'}</p>
                    <p style={{fontSize:11,color:'rgba(255,255,255,0.7)',margin:0}}>Fecha {form.closing_day||'?'}</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={sLbl}>Nome *</label><input value={form.name} onChange={e=>sf('name',e.target.value)} placeholder="Ex: Nubank" required style={sInp}/></div>
                  <div><label style={sLbl}>Banco *</label><input value={form.bank} onChange={e=>sf('bank',e.target.value)} placeholder="Ex: Nubank" required style={sInp}/></div>
                </div>
                <div><label style={sLbl}>Titular</label><div style={{display:'flex',gap:8}}>{['Lucas','Nicoly'].map(p=><button key={p} type="button" onClick={()=>sf('holder',p)} style={seg(form.holder===p)}>{p}</button>)}</div></div>
                <div><label style={sLbl}>Tipo</label><div style={{display:'flex',gap:8}}>{[{v:'credito',l:'Crédito'},{v:'debito',l:'Débito'},{v:'conta',l:'Conta'}].map(t=><button key={t.v} type="button" onClick={()=>sf('card_type',t.v)} style={seg(form.card_type===t.v)}>{t.l}</button>)}</div></div>
                {form.card_type==='credito'&&<>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={sLbl}>Dia fechamento</label><input type="number" value={form.closing_day} onChange={e=>sf('closing_day',e.target.value)} placeholder="Ex: 2" style={sInp} min="1" max="31"/></div>
                    <div><label style={sLbl}>Dia vencimento</label><input type="number" value={form.due_day} onChange={e=>sf('due_day',e.target.value)} placeholder="Ex: 9" style={sInp} min="1" max="31"/></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div><label style={sLbl}>Limite (R$)</label><input type="text" inputMode="numeric" value={form.limitRaw} onChange={e=>sf('limitRaw',fmtM(e.target.value))} placeholder="R$ 0,00" style={sInp}/></div>
                    <div><label style={sLbl}>Alerta em</label><input type="text" inputMode="numeric" value={form.alertRaw} onChange={e=>{const n=e.target.value.replace(/\D/g,'');sf('alertRaw',n?n+'%':'')}} placeholder="80%" style={sInp}/></div>
                  </div>
                </>}
                <div>
                  <label style={sLbl}>Cor do cartão</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
                    {CARD_COLORS.map(c=>(<button key={c.hex} type="button" onClick={()=>{sf('color',c.hex);setPrevColor(c.hex)}} title={c.name}
                      style={{width:32,height:32,borderRadius:'50%',background:c.hex,border:form.color===c.hex?`3px solid ${TEXT}`:'2px solid transparent',cursor:'pointer',flexShrink:0}}/>))}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="color" value={form.color} onChange={e=>{sf('color',e.target.value);setPrevColor(e.target.value)}} style={{width:36,height:36,borderRadius:12,border:'1px solid rgba(0,0,0,0.08)',cursor:'pointer',padding:2}}/>
                    <span style={{fontSize:11,color:TEXTMU}}>Cor personalizada</span>
                  </div>
                </div>
                <button type="submit" disabled={saving} style={sBtn(TERRA,'#fff')}>
                  {saving?<><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/>Salvando...</>:editC?'Salvar alterações':'Adicionar cartão'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: LIMITES POR CATEGORIA
  // ────────────────────────────────────────────────────────────
  if(sec==='limites') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Limites por Categoria</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Defina quanto quer gastar no máximo em cada categoria. Deixe vazio para sem limite.</p>
      {limitsLoading?<div style={{textAlign:'center',padding:40}}><Loader2 size={24} color={TERRA} style={{animation:'spin 0.8s linear infinite'}}/></div>:
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {CATS_DESPESA.map(cat=>{
          const icon=CAT_ICONS[cat]||'📦'
          const val=limits[cat]
          return (
            <div key={cat} style={{...sCard,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:20}}>{icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{cat}</p>
              </div>
              <div style={{position:'relative',width:120}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:TEXTMU,fontWeight:600}}>R$</span>
                <input type="text" inputMode="numeric" placeholder="Sem limite"
                  value={limitInputs[cat]??''}
                  onChange={e=>setLimitInputs(p=>({...p,[cat]:maskCurrency(e.target.value)}))}
                  onBlur={e=>saveLimit(cat,e.target.value)}
                  style={{width:'100%',height:36,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.06)',borderRadius:10,padding:'0 10px 0 32px',fontSize:13,fontWeight:600,color:TEXT,outline:'none',boxSizing:'border-box',textAlign:'right'}}/>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CICLO SALARIAL
  // ────────────────────────────────────────────────────────────
  if(sec==='salario') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Ciclo Salarial</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>
        O salário é uma <strong>receita recorrente</strong>: entra como lançamento todo mês, igual às contas.
        Alterar o valor aqui vale para os meses que ainda não caíram — os já recebidos mantêm o valor que entrou.
      </p>

      {/* Dia do recebimento — vale para os dois, então fica fora dos cards */}
      <div style={{...sCard,padding:'14px 16px',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:18}}>📅</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>Dia do recebimento</p>
            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Vale para os dois salários</p>
          </div>
          <p style={{fontSize:14,fontWeight:700,color:TEXT,margin:0}}>Dia {salaryDay}</p>
        </div>
        {editandoDia?(
          <div style={{display:'flex',gap:8,alignItems:'center',paddingLeft:30,marginTop:10}}>
            <input type="number" min={1} max={31} value={diaRaw} onChange={e=>setDiaRaw(e.target.value)} autoFocus
              placeholder="Dia"
              style={{width:70,height:34,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:8,padding:'0 10px',fontSize:13,color:TEXT,outline:'none'}}/>
            <button onClick={salvarDiaSalario} style={{height:34,padding:'0 12px',background:TERRA,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>Salvar</button>
            <button onClick={()=>{setEditandoDia(false);setDiaRaw('')}} style={{height:34,padding:'0 12px',background:'rgba(0,0,0,0.04)',color:TEXTMU,border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
          </div>
        ):(
          <div style={{paddingLeft:30,marginTop:8}}>
            <button onClick={()=>{setEditandoDia(true);setDiaRaw(salaryDay)}}
              style={{fontSize:11,fontWeight:700,color:TERRA,background:'rgba(196,98,45,0.08)',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
              ✏️ Editar dia do recebimento
            </button>
          </div>
        )}
      </div>

      {/* Um card por titular, no mesmo formato das contas recorrentes */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {([
          {titular:'Lucas'  as const, raw:salaryAmountL},
          {titular:'Nicoly' as const, raw:salaryAmountN},
        ]).map(({titular,raw})=>{
          const valor=unmaskCurrency(raw)
          const semValor=valor<=0
          return (
            <div key={titular} style={{...sCard,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8,
              border:semValor?'1px solid rgba(255,149,0,0.35)':undefined}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:18}}>💰</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>Salário {titular}</p>
                  <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                    {titular} · Recebe dia {salaryDay} · Receita mensal
                  </p>
                </div>
                <p style={{fontSize:14,fontWeight:700,color:semValor?TEXTMU:GREEN,margin:0}}>
                  {semValor?'—':formatCurrency(valor)}
                </p>
              </div>
              <div style={{paddingLeft:30}}>
                <button onClick={()=>abrirEditorSal(titular)}
                  style={{fontSize:11,fontWeight:700,color:semValor?'#B37700':TERRA,
                    background:semValor?'rgba(255,149,0,0.1)':'rgba(196,98,45,0.1)',
                    border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
                  {semValor?'⚠️ Definir salário':'✏️ Editar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor do salário */}
      {editSal&&(
        <div style={{position:'fixed',inset:0,zIndex:80,display:'flex',alignItems:'flex-end'}} onClick={()=>setEditSal(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:390,margin:'0 auto',
            background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'20px 18px 0'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 4px'}}>Salário {editSal}</h3>
              <p style={{fontSize:12,color:TEXTMU,margin:'0 0 16px'}}>
                Recebido todo dia {salaryDay}. O novo valor vale para os meses que ainda não caíram.
              </p>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'0 18px 8px',WebkitOverflowScrolling:'touch' as any}}>
              <div style={{marginBottom:12}}>
                <label style={sLbl}>Valor mensal (R$)</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:TEXTMU,fontWeight:600}}>R$</span>
                  <input type="text" inputMode="numeric" value={editSalValor} autoFocus
                    onChange={e=>setEditSalValor(maskCurrency(e.target.value))}
                    placeholder="0,00"
                    style={{...sInp,paddingLeft:40,...(erroSal?{border:`1px solid ${RED}`}:{})}}/>
                </div>
                {erroSal&&<p style={{fontSize:11,color:RED,fontWeight:600,margin:'5px 0 0'}}>{erroSal}</p>}
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 18px calc(16px + env(safe-area-inset-bottom, 12px))',
              borderTop:'1px solid rgba(0,0,0,0.07)',background:'#fff',flexShrink:0}}>
              <button onClick={()=>setEditSal(null)}
                style={{flex:1,height:48,background:'#F5F5F7',color:TEXTLT,borderRadius:14,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={()=>salvarSalarioDe(editSal)} disabled={savingSal}
                style={{flex:1,height:48,background:TERRA,color:'#fff',borderRadius:14,border:'none',fontSize:14,fontWeight:700,cursor:savingSal?'default':'pointer',opacity:savingSal?0.6:1}}>
                {savingSal?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CONTAS RECORRENTES
  // ────────────────────────────────────────────────────────────
  if(sec==='recorrentes') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Contas Recorrentes</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Lançamentos marcados como recorrentes. Eles serão gerados automaticamente todo mês. Contas no cartão de crédito não precisam de dia de vencimento próprio — elas entram na fatura e o alerta é feito por lá. Quando uma conta deixar de existir, use <strong>Encerrar</strong>: ela para de ser gerada e o histórico dos meses anteriores continua intacto. <strong>Apagar</strong> remove também esse histórico.</p>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {recurrents.map(tx=>{
          const isCartaoRec = tx.payment_method==='cartao_credito'
          const semVencimento = !isCartaoRec && !tx.recurring_day
          const isEditing = editingDueDay===tx.id
          return (
          <div key={tx.id} style={{...sCard,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8,border:semVencimento?'1px solid rgba(255,149,0,0.35)':undefined}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:18}}>{CAT_ICONS[tx.category]||'📦'}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{tx.description}</p>
                <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                  {tx.holder} · {isCartaoRec?'Fatura do cartão':`Vence dia ${tx.recurring_day||'?'}`} · {tx.payment_method}
                </p>
                {tx._encerrada&&(
                  <span style={{display:'inline-block',marginTop:4,fontSize:10,fontWeight:700,color:TEXTMU,background:'rgba(0,0,0,0.05)',borderRadius:6,padding:'2px 7px'}}>
                    Encerrada · histórico mantido
                  </span>
                )}
              </div>
              <p style={{fontSize:14,fontWeight:700,color:RED,margin:0}}>{formatCurrency(tx.expected_amount||tx.amount)}</p>
            </div>
            <div style={{display:'flex',gap:8,paddingLeft:30,flexWrap:'wrap'}}>
              <button onClick={()=>abrirEditorRec(tx)}
                style={{fontSize:11,fontWeight:700,color:TERRA,background:'rgba(196,98,45,0.1)',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
                ✏️ Editar
              </button>
              <button onClick={()=>encerrarRecorrencia(tx,!tx._encerrada)}
                style={{fontSize:11,fontWeight:600,color:tx._encerrada?GREEN:TEXTLT,background:tx._encerrada?'rgba(52,199,89,0.1)':'rgba(0,0,0,0.04)',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
                {tx._encerrada?'▶ Reativar':'⏹ Encerrar'}
              </button>
              <button onClick={()=>removeRecurrent(tx)}
                style={{fontSize:11,fontWeight:600,color:RED,background:'rgba(255,59,48,0.08)',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
                🗑 Apagar
              </button>
              {tx._ocorrencias>1&&(
                <span style={{fontSize:10,color:TEXTMU,alignSelf:'center'}}>{tx._ocorrencias} lançamentos</span>
              )}
            </div>
            {!isCartaoRec&&(isEditing?(
              <div style={{display:'flex',gap:8,alignItems:'center',paddingLeft:30}}>
                <input type="number" min={1} max={31} value={dueDayRaw} onChange={e=>setDueDayRaw(e.target.value)}
                  placeholder="Dia" autoFocus
                  style={{width:70,height:34,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:8,padding:'0 10px',fontSize:13,color:TEXT,outline:'none'}}/>
                <button onClick={()=>saveDueDay(tx)} style={{height:34,padding:'0 12px',background:TERRA,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>Salvar</button>
                <button onClick={()=>{setEditingDueDay(null);setDueDayRaw('')}} style={{height:34,padding:'0 12px',background:'rgba(0,0,0,0.04)',color:TEXTMU,border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              </div>
            ):(
              <div style={{paddingLeft:30}}>
                <button onClick={()=>{setEditingDueDay(tx.id);setDueDayRaw(tx.recurring_day?String(tx.recurring_day):'')}}
                  style={{fontSize:11,fontWeight:700,color:semVencimento?'#B37700':TERRA,background:semVencimento?'rgba(255,149,0,0.1)':'rgba(196,98,45,0.08)',border:'none',borderRadius:8,padding:'4px 10px',cursor:'pointer'}}>
                  {semVencimento?'⚠️ Definir dia de vencimento':'✏️ Editar dia de vencimento'}
                </button>
              </div>
            ))}
          </div>
        )})}
        {recurrents.length===0&&<p style={{fontSize:13,color:TEXTMU,textAlign:'center',padding:20}}>Nenhuma conta recorrente cadastrada. Crie um lançamento do tipo "Recorrente".</p>}
      </div>

      {/* Editor completo da conta recorrente */}
      {editRec&&(
        <div style={{position:'fixed',inset:0,zIndex:80,display:'flex',alignItems:'flex-end'}} onClick={()=>setEditRec(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}/>
          {/* Rodapé fixo: com tudo num único bloco rolável, os botões ficavam
              fora da área visível e pareciam "cortados" — dava a impressão de
              que salvar não funcionava, quando o toque nem chegava no botão. */}
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:390,margin:'0 auto',
            background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'20px 18px 0'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 4px'}}>Editar conta recorrente</h3>
              <p style={{fontSize:12,color:TEXTMU,margin:'0 0 16px'}}>
                A mudança vale para todos os meses desta conta. As parcelas já pagas mantêm o valor que foi pago.
              </p>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'0 18px 8px',WebkitOverflowScrolling:'touch' as any}}>

            <div style={{marginBottom:12}}>
              <label style={sLbl}>Nome da conta</label>
              <input type="text" value={editRecForm.description||''}
                onChange={e=>setEditRecForm((f:any)=>({...f,description:e.target.value}))} style={{...sInp,...bordaErro('description')}}/>
              <ErroCampo campo="description"/>
            </div>

            <div style={{marginBottom:12}}>
              <label style={sLbl}>Valor mensal (R$)</label>
              <input type="text" inputMode="numeric" value={editRecValor}
                onChange={e=>setEditRecValor(maskCurrency(e.target.value))} placeholder="0,00" style={{...sInp,...bordaErro('valor')}}/>
              <ErroCampo campo="valor"/>
            </div>

            <div style={{marginBottom:12}}>
              <label style={sLbl}>Responsável</label>
              <div style={{display:'flex',gap:8}}>
                {['Lucas','Nicoly'].map(h=>(
                  <button key={h} onClick={()=>setEditRecForm((f:any)=>({...f,holder:h}))}
                    style={seg(editRecForm.holder===h)}>{h}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={sLbl}>Categoria</label>
              <select value={editRecForm.category||''} onChange={e=>setEditRecForm((f:any)=>({...f,category:e.target.value,subcategory:''}))}
                style={{...sInp,appearance:'none' as const,...bordaErro('category')}}>
                <option value="">Selecione...</option>
                {mesclarCategorias('despesa',customCats).map(c=><option key={c} value={c}>{CAT_ICONS[c]||'📦'} {c}</option>)}
              </select>
              <ErroCampo campo="category"/>
            </div>

            {(SUBCATS[editRecForm.category]||customSubsDB.filter(x=>x.category===editRecForm.category).length>0)&&(
              <div style={{marginBottom:12}}>
                <label style={sLbl}>Subcategoria</label>
                <select value={editRecForm.subcategory||''} onChange={e=>setEditRecForm((f:any)=>({...f,subcategory:e.target.value}))}
                  style={{...sInp,appearance:'none' as const}}>
                  <option value="">Nenhuma</option>
                  {[...(SUBCATS[editRecForm.category]||[]),...customSubsDB.filter(x=>x.category===editRecForm.category).map(x=>x.subcategory)]
                    .map(sc=><option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
            )}

            <div style={{marginBottom:12}}>
              <label style={sLbl}>Como é cobrada</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{v:'debito_automatico',l:'Débito automático'},{v:'boleto',l:'Boleto'},
                  {v:'cartao_credito',l:'Cartão de crédito'},{v:'pix',l:'PIX'}].map(m=>(
                  <button key={m.v} onClick={()=>setEditRecForm((f:any)=>({...f,payment_method:m.v}))}
                    style={seg(editRecForm.payment_method===m.v)}>{m.l}</button>
                ))}
              </div>
            </div>

            {editRecForm.payment_method==='cartao_credito'?(
              <>
                <div style={{marginBottom:12}}>
                  <label style={sLbl}>Cartão</label>
                  <select value={editRecForm.card_name||''} onChange={e=>setEditRecForm((f:any)=>({...f,card_name:e.target.value}))}
                    style={{...sInp,appearance:'none' as const,...bordaErro('card_name')}}>
                    <option value="">Selecione...</option>
                    {cards.filter(c=>!c.card_type||c.card_type==='credito').map(c=>(
                      <option key={c.id} value={`${c.name} — ${c.holder}`}>{c.name} — {c.holder}</option>
                    ))}
                  </select>
                  <ErroCampo campo="card_name"/>
                  {cards.filter(c=>!c.card_type||c.card_type==='credito').length===0&&(
                    <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>Nenhum cartão de crédito cadastrado ainda — cadastre em Configurações &gt; Cartões.</p>
                  )}
                </div>
                <p style={{fontSize:11,color:TERRA,margin:'0 0 16px',background:'rgba(196,98,45,0.06)',padding:'8px 12px',borderRadius:10}}>
                  💳 Entra na fatura do cartão — o vencimento é o da fatura, não precisa de dia próprio.
                </p>
              </>
            ):(
              <div style={{marginBottom:16}}>
                <label style={sLbl}>Dia do vencimento</label>
                <input type="number" min={1} max={31} value={editRecForm.recurring_day||''}
                  onChange={e=>setEditRecForm((f:any)=>({...f,recurring_day:e.target.value}))}
                  placeholder="Ex: 10" style={{...sInp,...bordaErro('recurring_day')}}/>
                <ErroCampo campo="recurring_day"/>
                <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>É esse dia que o app usa para avisar no Início.</p>
              </div>
            )}

            </div>

            <div style={{display:'flex',gap:8,padding:'12px 18px calc(16px + env(safe-area-inset-bottom, 12px))',
              borderTop:'1px solid rgba(0,0,0,0.07)',background:'#fff',flexShrink:0}}>
              <button onClick={()=>setEditRec(null)}
                style={{flex:1,height:48,background:'#F5F5F7',color:TEXTLT,borderRadius:14,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={salvarEditorRec} disabled={savingRec}
                style={{flex:1,height:48,background:TERRA,color:'#fff',borderRadius:14,border:'none',fontSize:14,fontWeight:700,cursor:savingRec?'default':'pointer',opacity:savingRec?0.6:1}}>
                {savingRec?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: CATEGORIAS E SUBCATEGORIAS
  // ────────────────────────────────────────────────────────────
  if(sec==='categorias') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Categorias e Subcategorias</h2>
      </div>
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Crie suas próprias categorias e subcategorias. Elas ficam disponíveis em todos os lançamentos, para você e para a Nicoly.</p>

      {/* Nova categoria */}
      <div style={{...sCard,padding:'16px',marginBottom:14}}>
        <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 12px'}}>+ Nova categoria</p>
        <div style={{marginBottom:10}}>
          <label style={sLbl}>Tipo</label>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setNewCatKind('despesa')} style={seg(newCatKind==='despesa')}>Despesa</button>
            <button onClick={()=>setNewCatKind('receita')} style={seg(newCatKind==='receita')}>Receita</button>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={sLbl}>Nome da categoria</label>
          <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Ex: Pets" style={sInp}/>
        </div>
        <button onClick={addCategory} style={sBtn(TERRA,'#fff')}>Adicionar categoria</button>
      </div>

      {/* Categorias criadas por você */}
      {customCats.length>0&&(
        <div style={{...sCard,padding:'14px 16px',marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 10px'}}>Suas categorias</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {customCats.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:8}}>
                {editingCatId===c.id?(<>
                  <input autoFocus value={editingCatName} onChange={e=>setEditingCatName(e.target.value)}
                    style={{...sInp,height:36,fontSize:13,flex:1}}/>
                  <button onClick={()=>saveCategoryName(c)} style={{height:36,padding:'0 12px',background:TERRA,color:'#fff',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>Salvar</button>
                  <button onClick={()=>setEditingCatId(null)} style={{height:36,padding:'0 10px',background:'rgba(0,0,0,0.04)',color:TEXTMU,border:'none',borderRadius:10,fontSize:12,cursor:'pointer'}}>Cancelar</button>
                </>):(<>
                  <span style={{flex:1,fontSize:13,fontWeight:600,color:TEXT}}>
                    {CAT_ICONS[c.name]||'📦'} {c.name}
                    <span style={{fontSize:10,color:TEXTMU,fontWeight:500,marginLeft:6}}>{c.kind==='receita'?'receita':'despesa'}</span>
                  </span>
                  <button onClick={()=>{setEditingCatId(c.id);setEditingCatName(c.name)}}
                    style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}><Pencil size={14} color={TERRA}/></button>
                  <button onClick={()=>removeCategory(c)}
                    style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}><Trash2 size={14} color={RED}/></button>
                </>)}
              </div>
            ))}
          </div>
          <p style={{fontSize:10,color:TEXTMU,margin:'10px 0 0'}}>As categorias que já vêm no app não podem ser removidas, só as criadas por vocês.</p>
        </div>
      )}

      {/* Formulário de nova subcategoria */}
      <div style={{...sCard,padding:'16px',marginBottom:20}}>
        <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 12px'}}>+ Nova subcategoria</p>
        <div style={{marginBottom:10}}>
          <label style={sLbl}>Categoria</label>
          <select value={newSubCat} onChange={e=>setNewSubCat(e.target.value)} style={{...sInp,appearance:'none' as const}}>
            <option value="">Selecione...</option>
            {mesclarCategorias('despesa',customCats).map(c=><option key={c} value={c}>{CAT_ICONS[c]||'📦'} {c}</option>)}
            {mesclarCategorias('receita',customCats).map(c=><option key={'r_'+c} value={c}>{CAT_ICONS[c]||'📦'} {c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={sLbl}>Nome da subcategoria</label>
          <input type="text" value={newSubName} onChange={e=>setNewSubName(e.target.value)} placeholder="Ex: Padaria" style={sInp}/>
        </div>
        <button onClick={addSubcategory} style={sBtn(TERRA,'#fff')}>Adicionar</button>
      </div>

      {/* Lista de categorias com subcategorias */}
      {catsLoading?(
        <div style={{textAlign:'center',padding:30}}><Loader2 size={22} color={TERRA} style={{animation:'spin 0.8s linear infinite'}}/></div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[...mesclarCategorias('despesa',customCats),...mesclarCategorias('receita',customCats)].map(cat=>{
            const baseSubs=SUBCATS[cat]||[]
            const customs=customSubsDB.filter(s=>s.category===cat)
            if(baseSubs.length===0&&customs.length===0)return null
            return (
              <div key={cat} style={{...sCard,padding:'14px 16px'}}>
                <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:'0 0 8px'}}>{CAT_ICONS[cat]||'📦'} {cat}</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {baseSubs.map(s=>(
                    <span key={s} style={{fontSize:11,padding:'4px 10px',borderRadius:10,background:'rgba(0,0,0,0.04)',color:TEXTMU}}>{s}</span>
                  ))}
                  {customs.map(s=>(
                    editingSubId===s.id?(
                      <div key={s.id} style={{display:'flex',gap:4,alignItems:'center'}}>
                        <input autoFocus value={editingSubName} onChange={e=>setEditingSubName(e.target.value)}
                          style={{fontSize:11,padding:'4px 8px',borderRadius:10,border:`1px solid ${TERRA}`,width:100}}/>
                        <button onClick={()=>renameSubcategory(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:GREEN,fontSize:11,fontWeight:700}}>✓</button>
                        <button onClick={()=>setEditingSubId(null)} style={{background:'none',border:'none',cursor:'pointer',color:TEXTMU,fontSize:11}}>✕</button>
                      </div>
                    ):(
                      <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,padding:'4px 6px 4px 10px',borderRadius:10,background:'rgba(196,98,45,0.1)',color:TERRA,fontWeight:600}}>
                        {s.subcategory}
                        <button onClick={()=>{setEditingSubId(s.id);setEditingSubName(s.subcategory)}} style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex'}}><Pencil size={10} color={TERRA}/></button>
                        <button onClick={()=>deleteSubcategory(s.id)} style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex'}}><X size={11} color={TERRA}/></button>
                      </span>
                    )
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: SEGURANÇA
  // ────────────────────────────────────────────────────────────
  if(sec==='seguranca') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Segurança</h2>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* Face ID */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:22}}>🔒</span>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Face ID / Biometria</p>
                <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Desbloqueio rápido ao abrir o app</p>
              </div>
            </div>
            <button onClick={toggleFaceId} style={{width:52,height:30,borderRadius:15,background:faceIdEnabled?GREEN:'#D1D1D6',border:'none',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
              <div style={{width:26,height:26,borderRadius:13,background:'#fff',position:'absolute',top:2,left:faceIdEnabled?24:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
            </button>
          </div>
        </div>

        {/* Info da conta */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 10px'}}>Conta</p>
          <p style={{fontSize:14,color:TEXT,margin:0}}>{userEmail}</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'4px 0 0'}}>ID: {userId.slice(0,8)}...</p>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{...sCard,padding:'16px 18px',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left'}}>
          <LogOut size={20} color={RED}/>
          <p style={{fontSize:14,fontWeight:600,color:RED,margin:0}}>Sair da conta</p>
        </button>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // SEÇÃO: DADOS
  // ────────────────────────────────────────────────────────────
  if(sec==='dados') return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        {backBtn()}
        <h2 style={{fontSize:17,fontWeight:700,color:TEXT,flex:1}}>Dados do App</h2>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <button onClick={()=>{localStorage.clear();sessionStorage.clear();toast.success('Cache limpo! Recarregue o app.');setTimeout(()=>window.location.reload(),1000)}}
          style={{...sCard,padding:'16px 18px',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left'}}>
          <RefreshCw size={20} color={ACCENT}/>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Limpar cache local</p>
            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Remove dados salvos no navegador (não apaga seus lançamentos)</p>
          </div>
        </button>
        <button onClick={async()=>{
          const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user)return
          const {data}=await s.from('transactions').select('*').eq('owner_id',user.id).order('purchase_date',{ascending:false})
          if(!data||data.length===0){toast.error('Nenhum lançamento encontrado');return}
          const headers=['Data','Descrição','Categoria','Subcategoria','Valor','Parcela','Status','Método','Cartão','Titular','Tipo','Observações']
          const rows=data.map((t:any)=>[
            t.purchase_date,t.description,t.category,t.subcategory||'',
            (t.installment_value||t.amount)?.toString().replace('.',','),
            t.installment_total?`${t.installment_num||''}/${t.installment_total}`:'',
            t.status,t.payment_method||'',t.card_name||'',t.holder,t.transaction_type,t.notes||''
          ])
          const csv='\uFEFF'+[headers,...rows].map(r=>r.map((c:string)=>`"${(c||'').replace(/"/g,'""')}"`).join(';')).join('\n')
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'})
          const url=URL.createObjectURL(blob)
          const a=document.createElement('a');a.href=url;a.download=`financas-ln-${new Date().toISOString().slice(0,10)}.csv`;a.click()
          URL.revokeObjectURL(url)
          toast.success(`Exportado! ${data.length} lançamentos`)
        }} style={{...sCard,padding:'16px 18px',display:'flex',alignItems:'center',gap:12,border:'none',cursor:'pointer',width:'100%',textAlign:'left'}}>
          <Download size={20} color={ACCENT}/>
          <div>
            <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Exportar dados (CSV)</p>
            <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Baixar todos os lançamentos em formato CSV (Excel)</p>
          </div>
        </button>
        <div style={{...sCard,padding:'16px 18px'}}>
          <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 8px'}}>Versão</p>
          <p style={{fontSize:14,color:TEXT,margin:0}}>Finanças L&N v1.0</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Desenvolvido por Lucas & Claude</p>
        </div>
      </div>
    </div>
  )

  // ────────────────────────────────────────────────────────────
  // TELA PRINCIPAL: MENU DE CONFIGURAÇÕES
  // ────────────────────────────────────────────────────────────
  const MenuItem = ({icon,label,desc,section,color}:{icon:React.ReactNode,label:string,desc:string,section:Section,color?:string}) => (
    <button onClick={()=>setSec(section)}
      style={{...sCard,padding:'16px 18px',display:'flex',alignItems:'center',gap:14,textAlign:'left',cursor:'pointer',border:'none',width:'100%'}}>
      <div style={{width:42,height:42,background:'rgba(0,0,0,0.03)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>{label}</p>
        <p style={{fontSize:11,color:TEXTMU,margin:'3px 0 0'}}>{desc}</p>
      </div>
      <ChevronRight size={18} color={TEXTMU}/>
    </button>
  )

  return (
    <div style={{background:BG,minHeight:'100%',padding:'14px 14px 160px'}}>
      <h1 style={{fontSize:20,fontWeight:800,color:TEXT,marginBottom:2}}>Configurações</h1>
      <p style={{fontSize:13,color:TEXTMU,marginBottom:20}}>Personalize o app do seu jeito</p>

      {/* Financeiro */}
      <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,paddingLeft:4}}>Financeiro</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
        <MenuItem icon={<CreditCard size={20} color={TERRA}/>} label="Cartões e Contas" desc="Gerenciar cartões, limites e vencimentos" section="cartoes"/>
        <MenuItem icon={<Target size={20} color={TERRA}/>} label="Limites por Categoria" desc="Definir teto de gastos por categoria" section="limites"/>
        <MenuItem icon={<Calendar size={20} color={TERRA}/>} label="Ciclo Salarial" desc="Dia do pagamento e valores de cada titular" section="salario"/>
        <MenuItem icon={<RefreshCw size={20} color={TERRA}/>} label="Contas Recorrentes" desc="Ver e gerenciar contas que repetem todo mês" section="recorrentes"/>
        <MenuItem icon={<Tag size={20} color={TERRA}/>} label="Categorias e Subcategorias" desc="Ver, criar e organizar categorias de gastos" section="categorias"/>
      </div>

      {/* Segurança e Conta */}
      <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,paddingLeft:4}}>Segurança e Conta</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
        <MenuItem icon={<Shield size={20} color={ACCENT}/>} label="Segurança" desc="Face ID, biometria e logout" section="seguranca"/>
        <MenuItem icon={<Download size={20} color={ACCENT}/>} label="Dados do App" desc="Cache, exportar dados e versão" section="dados"/>
      </div>

      <div style={{textAlign:'center',paddingTop:8}}>
        <p style={{fontSize:11,color:TEXTMU}}>Finanças L&N · Agosto 2026</p>
      </div>
    </div>
  )
}
