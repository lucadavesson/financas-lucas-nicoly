'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CreditCard, Target, PiggyBank, Tag, ChevronRight, ChevronLeft, Plus, Pencil, X, Loader2, Shield, LogOut, Calendar, RefreshCw, Download, Trash2, Users, DollarSign, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, CATS_DESPESA, SUBCATS, CAT_ICONS, maskCurrency, unmaskCurrency } from '@/lib/utils'
import { loadCustomCategorias, mesclarCategorias, criarCategoria, renomearCategoria, excluirCategoria, contarUsoCategoria, ehCategoriaFixa, type CustomCategoria } from '@/lib/utils/categorias'
import { useBackGuard } from '@/lib/hooks/useBackGuard'
import ModalPortal from '@/components/ui/ModalPortal'
import { registrarFaceId, esquecerFaceId, faceIdAtivo, biometriaDisponivel } from '@/lib/utils/passkey'
import { auditarParcelas, corrigirDatas, descreverProblema, auditarDuplicatas, removerDuplicatas, type Auditoria, type AuditoriaDup } from '@/lib/utils/auditoriaParcelas'
import { receitasPorTitular, trocarTitular, type GrupoReceita } from '@/lib/utils/titularReceitas'
import {
  carregarRecorrentes, prazoDaConta, aplicarAjusteRecorrente, aplicarAjusteSalario,
  definirPrazo, mesAtual, somaMeses, rotuloMes, chaveConta, MESES_FUTURO_MAX,
  type ContaRec,
} from '@/lib/utils/recurrents'

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
  // Prazo da conta: sem prazo (gera para sempre), por N meses, ou até um mês.
  const [editRecPrazo, setEditRecPrazo] = useState<'sem'|'meses'|'ate'>('sem')
  const [editRecMeses, setEditRecMeses] = useState('')
  const [editRecAte, setEditRecAte] = useState('')
  // A partir de que mês o novo valor/dia passa a valer. Sem isso, reajustar
  // hoje reescrevia meses passados em aberto — o erro que queríamos matar.
  const [editRecVigencia, setEditRecVigencia] = useState('')
  const [editSalVigencia, setEditSalVigencia] = useState('')
  const [diaVigencia, setDiaVigencia] = useState('')
  // Confirmação em modal do app. O confirm() nativo do navegador trava a
  // página, destoa do resto e, no iPhone instalado como app, ainda mostra a
  // URL no topo do alerta — parece que o site "vazou" para fora do app.
  const [confirmar, setConfirmar] = useState<{
    titulo:string; linhas:string[]; rotuloOk:string; perigo?:boolean; onOk:()=>void|Promise<void>
  }|null>(null)
  const [confirmando, setConfirmando] = useState(false)
  // Conferência de parcelamentos
  const [auditoria, setAuditoria] = useState<Auditoria|null>(null)
  const [conferindo, setConferindo] = useState(false)
  const [corrigindoParc, setCorrigindoParc] = useState(false)
  const [dups, setDups] = useState<AuditoriaDup|null>(null)
  const [buscandoDups, setBuscandoDups] = useState(false)
  const [removendoDups, setRemovendoDups] = useState(false)
  // Nada vem marcado: apagar lançamento não pode ser o caminho de menor esforço.
  const [dupsEscolhidas, setDupsEscolhidas] = useState<string[]>([])
  const [recTitular, setRecTitular] = useState<GrupoReceita[]|null>(null)
  const [carregandoTit, setCarregandoTit] = useState(false)
  const [trocandoTit, setTrocandoTit] = useState<string|null>(null)
  const [titEscolhidos, setTitEscolhidos] = useState<string[]>([])
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
  useBackGuard(!!confirmar, ()=>setConfirmar(null))
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
   * Grava a configuração do salário e reflete nos lançamentos, respeitando a
   * vigência escolhida.
   *
   * O que mudou: antes o novo valor era escrito em TODA ocorrência não paga —
   * inclusive meses passados que ainda estavam em aberto — e o dia novo era
   * gravado até nas linhas já pagas, sem mover data nenhuma. Resultado: um
   * reajuste de hoje reescrevia o passado e a data mostrada continuava a antiga.
   * Agora vale de um mês em diante, e a data das ocorrências afetadas acompanha
   * o dia novo.
   */
  async function persistirSalario(day:number,valL:number,valN:number,aPartirDe:string):Promise<{ok:boolean;erro?:string;atualizadas:number}>{
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(!user)return {ok:false,erro:'Sessão expirada',atualizadas:0}
    const payload={salary_day:day,salary_lucas:valL,salary_nicoly:valN}
    const {data:existing}=await s.from('app_settings').select('id').limit(1).maybeSingle()
    const {error:saveErr}=existing
      ? await s.from('app_settings').update(payload).eq('id',existing.id)
      : await s.from('app_settings').insert({...payload,owner_id:user.id})
    if(saveErr)return {ok:false,erro:saveErr.message,atualizadas:0}

    let atualizadas=0
    for(const [titular,valor] of [['Lucas',valL],['Nicoly',valN]] as ['Lucas'|'Nicoly',number][]){
      if(valor<=0)continue
      const r=await aplicarAjusteSalario({titular,valor,dia:day,aPartirDe})
      if(!r.ok)return {ok:false,erro:r.erro,atualizadas}
      atualizadas+=r.atualizadas
    }
    return {ok:true,atualizadas}
  }

  function abrirEditorSal(titular:'Lucas'|'Nicoly'){
    setEditSalValor(titular==='Lucas'?salaryAmountL:salaryAmountN)
    setEditSalVigencia(mesAtual())
    setErroSal(''); setEditSal(titular)
  }

  async function salvarSalarioDe(titular:'Lucas'|'Nicoly'){
    const valor=unmaskCurrency(editSalValor)
    if(valor<=0){setErroSal('Informe o valor do salário');return}
    const vigencia=editSalVigencia||mesAtual()
    setErroSal(''); setSavingSal(true)
    const valL=titular==='Lucas'?valor:unmaskCurrency(salaryAmountL)
    const valN=titular==='Nicoly'?valor:unmaskCurrency(salaryAmountN)
    const r=await persistirSalario(parseInt(salaryDay)||1,valL,valN,vigencia)
    setSavingSal(false)
    if(!r.ok){toast.error(`Não foi possível salvar: ${r.erro}`);return}
    toast.success(`Salário ${titular==='Lucas'?'do Lucas':'da Nicoly'} vale a partir de ${rotuloMes(vigencia)}`)
    setEditSal(null); loadSalary()
  }

  async function salvarDiaSalario(){
    const dia=parseInt(diaRaw)
    if(!dia||dia<1||dia>31){toast.error('Informe um dia válido (1 a 31)');return}
    const vigencia=diaVigencia||mesAtual()
    const r=await persistirSalario(dia,unmaskCurrency(salaryAmountL),unmaskCurrency(salaryAmountN),vigencia)
    if(!r.ok){toast.error(`Não foi possível salvar: ${r.erro}`);return}
    toast.success(`Recebimento no dia ${dia} a partir de ${rotuloMes(vigencia)}`)
    setEditandoDia(false); setDiaRaw(''); loadSalary()
  }

  // ── Recorrentes ──
  async function loadRecurrents(){
    // Agrupamento e leitura de prazo vêm do motor (mesUtils), para esta tela e
    // a geração automática usarem exatamente a mesma noção de "conta".
    const contas = await carregarRecorrentes()
    const hoje = mesAtual()
    const cards = contas.map(conta => {
      const prazo = prazoDaConta(conta, hoje)
      return {
        ...conta.template,
        _conta: conta,
        _prazo: prazo,
        _ocorrencias: conta.ocorrencias,
        _encerrada: prazo.tipo === 'encerrada',
      }
    })
    setRecurrents(cards.sort((a,b)=>(a.description||'').localeCompare(b.description||'')))
  }

  function removeRecurrent(tx:any){
    const n=tx._ocorrencias||1
    setConfirmar({
      titulo:`Apagar "${tx.description}"?`,
      linhas:[
        `Existem ${n} lançamento${n>1?'s':''} desta conta.`,
        'Isso apaga TAMBÉM o histórico dos meses anteriores — os valores somem dos relatórios passados.',
        'Se a conta apenas deixou de existir de agora em diante, use "Encerrar": para de gerar e mantém o histórico.',
      ],
      rotuloOk:'Apagar tudo', perigo:true,
      onOk:async()=>{
        const {error}=await createClient().from('transactions').delete()
          .eq('is_recurring',true).eq('holder',tx.holder).eq('description',tx.description)
        if(error){toast.error(`Não foi possível apagar: ${error.message}`);return}
        toast.success(`"${tx.description}" apagada (${n} lançamento${n>1?'s':''})`)
        loadRecurrents()
      },
    })
  }

  function abrirEditorRec(tx:any){
    setEditRecForm({
      description:tx.description||'', category:tx.category||'', subcategory:tx.subcategory||'',
      holder:tx.holder||'Lucas', payment_method:tx.payment_method||'pix',
      card_name:tx.card_name||'', recurring_day:tx.recurring_day||'',
    })
    setEditRecValor(maskCurrency(Math.round(((tx.expected_amount||tx.amount)||0)*100).toString()))
    const prazo = tx._prazo
    if(prazo && prazo.tipo!=='sem_prazo'){ setEditRecPrazo('ate'); setEditRecAte(prazo.ultimoMes) }
    else { setEditRecPrazo('sem'); setEditRecAte('') }
    setEditRecMeses('')
    setEditRecVigencia(mesAtual())
    setErroRec({})
    setEditRec(tx)
  }

  /** Mês final que o prazo escolhido representa. null = sem prazo. */
  function mesFinalEscolhido():string|null{
    if(editRecPrazo==='sem') return null
    if(editRecPrazo==='meses'){
      const n=parseInt(editRecMeses)
      if(!n||n<1) return null
      return somaMeses(mesAtual(), n-1)
    }
    return editRecAte||null
  }

  async function salvarEditorRec(){
    if(!editRec)return
    const conta:ContaRec=editRec._conta
    const f=editRecForm
    const nome=(f.description||'').trim()
    const valor=unmaskCurrency(editRecValor)
    const noCartao=f.payment_method==='cartao_credito'
    const dia=parseInt(f.recurring_day)||null
    const vigencia=editRecVigencia||mesAtual()

    const erros:Record<string,string>={}
    if(!nome)erros.description='Informe o nome da conta'
    if(valor<=0)erros.valor='Informe o valor mensal'
    if(!(f.category||'').trim())erros.category='Escolha a categoria'
    if(noCartao&&!(f.card_name||'').trim())erros.card_name='Escolha o cartão'
    if(!noCartao&&(!dia||dia<1||dia>31))erros.recurring_day='Informe o dia do vencimento (1 a 31)'
    if(editRecPrazo==='meses'&&(!parseInt(editRecMeses)||parseInt(editRecMeses)<1))erros.prazo='Informe quantos meses'
    if(editRecPrazo==='ate'&&!editRecAte)erros.prazo='Escolha o mês final'
    const fim=mesFinalEscolhido()
    if(fim&&fim<mesAtual())erros.prazo='O mês final já passou'
    if(fim&&fim<vigencia)erros.prazo='O prazo termina antes do início da vigência'
    setErroRec(erros)
    if(Object.keys(erros).length>0){ toast.error('Faltam campos obrigatórios'); return }

    setSavingRec(true)

    // Cadastro (nome, categoria, forma de cobrança) vale para TODAS as
    // ocorrências: é a identidade da conta, e dividir isso partiria a conta em
    // duas. Só valor e dia respeitam a vigência.
    const cadastro:any={
      description:nome, category:f.category||editRec.category, subcategory:f.subcategory||null,
      holder:f.holder, payment_method:f.payment_method,
      card_name:noCartao?(f.card_name||null):null,
    }

    const r=await aplicarAjusteRecorrente({
      conta, aPartirDe:vigencia, cadastro,
      valor, dia:noCartao?null:dia,
    })
    if(!r.ok){ toast.error(`Não foi possível salvar: ${r.erro}`); setSavingRec(false); return }

    // Recarrega a conta antes de mexer no prazo: o nome pode ter mudado e
    // ocorrências podem ter acabado de ser criadas pela vigência futura.
    const frescas=await carregarRecorrentes()
    const atual=frescas.find(x=>x.chave===chaveConta(nome,f.holder))
    let extra=''
    if(atual){
      const prazoAtual=prazoDaConta(atual)
      const jaEra=prazoAtual.tipo==='sem_prazo'?null:prazoAtual.ultimoMes
      if(fim!==jaEra){
        const rp=await definirPrazo(atual,fim)
        if(!rp.ok){ toast.error(`Valor salvo, mas o prazo falhou: ${rp.erro}`); setSavingRec(false); loadRecurrents(); return }
        if(rp.criadas>0) extra=` · ${rp.criadas} ${rp.criadas>1?'meses criados':'mês criado'}`
        else if(rp.removidas>0) extra=` · ${rp.removidas} ${rp.removidas>1?'meses futuros removidos':'mês futuro removido'}`
      }
    }

    toast.success(
      r.atualizadas>0
        ? `Atualizada a partir de ${rotuloMes(vigencia)}${extra}`
        : `Conta atualizada${extra}`
    )
    setEditRec(null); setSavingRec(false)
    loadRecurrents()
  }

  // Encerrar = definir o prazo como "até este mês": para de gerar, apaga os
  // meses futuros ainda não pagos que já tinham sido criados, e mantém todo
  // o histórico. Reativar volta a conta para "sem prazo".
  async function aplicarEncerramento(tx:any,encerrar:boolean){
    const r=await definirPrazo(tx._conta as ContaRec, encerrar?mesAtual():null)
    if(!r.ok){ toast.error(`Erro: ${r.erro}`); return }
    toast.success(encerrar
      ? `Encerrada em ${rotuloMes(mesAtual())} — histórico preservado`
      : 'Conta reativada — volta a ser gerada todo mês')
    loadRecurrents()
  }

  function encerrarRecorrencia(tx:any,encerrar:boolean){
    if(!encerrar){ aplicarEncerramento(tx,false); return }
    setConfirmar({
      titulo:`Encerrar "${tx.description}"?`,
      linhas:[
        'Ela deixa de ser gerada a partir do mês que vem, e os meses futuros já criados que ainda não foram pagos são removidos.',
        `Todo o histórico até ${rotuloMes(mesAtual())} é mantido intacto.`,
      ],
      rotuloOk:'Encerrar',
      onOk:()=>aplicarEncerramento(tx,true),
    })
  }

  async function saveDueDay(tx:any){
    const dia=parseInt(dueDayRaw)
    if(!dia||dia<1||dia>31){toast.error('Informe um dia válido (1-31)');return}
    // Atalho do card: vale deste mês em diante, igual ao editor completo. Antes
    // só gravava recurring_day e não movia a data das ocorrências, então a
    // Configuração dizia "vence dia 2" e o Lançamento continuava em 31/08.
    const r=await aplicarAjusteRecorrente({
      conta:tx._conta, aPartirDe:mesAtual(), cadastro:{}, dia,
    })
    if(!r.ok){toast.error(`Erro ao salvar: ${r.erro}`);return}
    toast.success(`Vencimento no dia ${dia} a partir de ${rotuloMes(mesAtual())}`)
    setEditingDueDay(null); setDueDayRaw('')
    loadRecurrents()
  }

  // ── Conferência de parcelamentos ──
  async function conferirParcelamentos(){
    setConferindo(true)
    try{
      const r=await auditarParcelas()
      setAuditoria(r)
      if(r.comProblema.length===0)toast.success(`${r.gruposConferidos} parcelamentos conferidos — nenhum furo`)
      else toast.error(`${r.comProblema.length} parcelamento${r.comProblema.length>1?'s':''} com problema`)
    }catch(e:any){ toast.error(`Não foi possível conferir: ${e?.message||e}`) }
    finally{ setConferindo(false) }
  }

  async function corrigirParcelamentos(){
    if(!auditoria)return
    setCorrigindoParc(true)
    try{
      const r=await corrigirDatas(auditoria.comProblema)
      if(r.erros.length>0)toast.error(`Corrigidas ${r.corrigidas}, mas ${r.erros.length} falharam`)
      else if(r.corrigidas>0)toast.success(`${r.corrigidas} parcela${r.corrigidas>1?'s':''} colocada${r.corrigidas>1?'s':''} no mês certo`)
      else toast.success('Nada para corrigir automaticamente')
      await conferirParcelamentos()
    }catch(e:any){ toast.error(`Falha ao corrigir: ${e?.message||e}`) }
    finally{ setCorrigindoParc(false) }
  }

  // ── Duplicatas ──
  async function procurarDuplicatas(){
    setBuscandoDups(true)
    try{
      const r=await auditarDuplicatas()
      setDups(r); setDupsEscolhidas([])
      if(r.totalARemover===0)toast.success(`${r.linhasConferidas} lançamentos conferidos — nenhuma duplicata`)
      else toast.error(`${r.totalARemover} lançamento${r.totalARemover>1?'s':''} duplicado${r.totalARemover>1?'s':''}`)
    }catch(e:any){ toast.error(`Não foi possível conferir: ${e?.message||e}`) }
    finally{ setBuscandoDups(false) }
  }

  const totalEscolhido=(dups?.resumo||[]).filter(r=>dupsEscolhidas.includes(r.chave)).reduce((s,r)=>s+r.aRemover,0)

  function confirmarRemocaoDuplicatas(){
    if(!dups||totalEscolhido===0)return
    const escolhidos=dups.resumo.filter(r=>dupsEscolhidas.includes(r.chave))
    setConfirmar({
      titulo:`Apagar ${totalEscolhido} lançamento${totalEscolhido>1?'s':''}?`,
      linhas:[
        ...escolhidos.map(r=>`${r.titulo} (${r.holder}): ${r.aRemover} ${r.aRemover>1?'linhas':'linha'} — fica a de ${formatCurrency(r.valores[0])}${r.valores.length>1?`, sai a de ${formatCurrency(r.valores[r.valores.length-1])}`:''}`),
        'Em cada mês fica a linha de menor valor. Isso não tem desfazer.',
      ],
      rotuloOk:'Apagar', perigo:true,
      onOk:async()=>{
        setRemovendoDups(true)
        try{
          const r=await removerDuplicatas(dups.grupos, dupsEscolhidas)
          if(r.erro)toast.error(`Removidas ${r.removidas}, mas deu erro: ${r.erro}`)
          else toast.success(`${r.removidas} lançamento${r.removidas>1?'s':''} apagado${r.removidas>1?'s':''}`)
          await procurarDuplicatas()
        }finally{ setRemovendoDups(false) }
      },
    })
  }

  // ── Titular das receitas ──
  async function carregarTitularReceitas(){
    setCarregandoTit(true)
    try{ setRecTitular(await receitasPorTitular()); setTitEscolhidos([]) }
    catch(e:any){ toast.error(`Não foi possível carregar: ${e?.message||e}`) }
    finally{ setCarregandoTit(false) }
  }

  function confirmarTrocaEmLote(){
    if(!recTitular)return
    const grupos=recTitular.filter(g=>titEscolhidos.includes(g.chave)&&!g.travado)
    if(grupos.length===0)return
    const qtd=grupos.reduce((s,g)=>s+g.qtd,0)
    setConfirmar({
      titulo:`Trocar o titular de ${grupos.length} ${grupos.length>1?'receitas':'receita'}?`,
      linhas:[
        ...grupos.map(g=>`${g.base}: ${g.holder} → ${g.holder==='Lucas'?'Nicoly':'Lucas'} (${g.qtd} ${g.qtd>1?'lançamentos':'lançamento'}, ${formatCurrency(g.total)})`),
        `Ao todo ${qtd} lançamentos. Muda só de quem é a receita — valores, datas e status ficam iguais.`,
      ],
      rotuloOk:'Trocar titular',
      onOk:async()=>{
        setTrocandoTit('lote')
        try{
          let total=0
          for(const g of grupos){
            const r=await trocarTitular(g.ids, g.holder==='Lucas'?'Nicoly':'Lucas')
            if(r.erro){ toast.error(`Erro em "${g.base}": ${r.erro}`); break }
            total+=r.alteradas
          }
          toast.success(`${total} lançamentos com o titular corrigido`)
          await carregarTitularReceitas()
        }finally{ setTrocandoTit(null) }
      },
    })
  }

  function confirmarTrocaTitular(g:GrupoReceita){
    const novo=g.holder==='Lucas'?'Nicoly':'Lucas'
    setConfirmar({
      titulo:`"${g.base}" passa a ser da ${novo}?`,
      linhas:[
        `${g.qtd} lançamento${g.qtd>1?'s':''} (${g.periodo}), somando ${formatCurrency(g.total)}.`,
        'Muda só de quem é a receita — valores, datas e status ficam iguais.',
      ],
      rotuloOk:`Passar para ${novo}`,
      onOk:async()=>{
        setTrocandoTit(g.chave)
        try{
          const r=await trocarTitular(g.ids,novo)
          if(r.erro)toast.error(`Erro: ${r.erro}`)
          else toast.success(`"${g.base}" agora é ${novo==='Nicoly'?'da Nicoly':'do Lucas'} (${r.alteradas} lançamentos)`)
          await carregarTitularReceitas()
        }finally{ setTrocandoTit(null) }
      },
    })
  }

  // ── Segurança ──
  async function loadSecurity(){
    const s=createClient();const {data:{user}}=await s.auth.getUser()
    if(user){
      setUserId(user.id);setUserEmail(user.email||'')
      setFaceIdEnabled(faceIdAtivo(user.id))
    }
  }
  async function toggleFaceId(){
    if(faceIdEnabled){
      esquecerFaceId(userId)
      setFaceIdEnabled(false)
      toast.success('Face ID desativado')
      return
    }
    if(!(await biometriaDisponivel())){
      toast.error('Este aparelho não tem biometria disponível para o navegador')
      return
    }
    // O registro guarda o ID da passkey. É ele que faz o desbloqueio chamar o
    // Face ID direto, sem o menu de "qual dispositivo usar".
    const r=await registrarFaceId(userId,userEmail)
    if(!r.ok){
      if(r.erro!=='Cancelado.')toast.error(`Não foi possível configurar o Face ID: ${r.erro}`)
      return
    }
    setFaceIdEnabled(true)
    toast.success('Face ID ativado! 🔒')
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
  // Overlay compartilhado: o componente tem um return por seção, entao um
  // modal declarado dentro de uma delas nao existe nas outras — foi por isso
  // que a confirmacao nao aparecia em Dados do App.
  const modalConfirmar = confirmar ? (
        <ModalPortal>
        <div style={{position:'fixed',inset:0,zIndex:90,display:'flex',alignItems:'flex-end'}} onClick={()=>!confirmando&&setConfirmar(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:390,margin:'0 auto',
            background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'22px 18px 0'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:confirmar.perigo?RED:TEXT,margin:'0 0 10px'}}>{confirmar.titulo}</h3>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'0 18px 12px',WebkitOverflowScrolling:'touch' as any}}>
              {confirmar.linhas.map((linha,i)=>(
                <p key={i} style={{fontSize:13,color:TEXTLT,margin:'0 0 10px',lineHeight:1.5}}>{linha}</p>
              ))}
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 18px calc(16px + env(safe-area-inset-bottom, 12px))',
              borderTop:'1px solid rgba(0,0,0,0.07)',background:'#fff',flexShrink:0}}>
              <button onClick={()=>setConfirmar(null)} disabled={confirmando}
                style={{flex:1,height:48,background:'#F5F5F7',color:TEXTLT,borderRadius:14,border:'none',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Cancelar
              </button>
              <button disabled={confirmando}
                onClick={async()=>{
                  setConfirmando(true)
                  try{ await confirmar.onOk() } finally { setConfirmando(false); setConfirmar(null) }
                }}
                style={{flex:1,height:48,background:confirmar.perigo?RED:TERRA,color:'#fff',borderRadius:14,border:'none',
                  fontSize:14,fontWeight:700,cursor:confirmando?'default':'pointer',opacity:confirmando?0.6:1}}>
                {confirmando?'Aguarde...':confirmar.rotuloOk}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
  ) : null

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
        <ModalPortal>
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
        </ModalPortal>
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
        Teve aumento? Mudou a data de pagamento? Você escolhe <strong>a partir de qual mês</strong> o ajuste
        vale — os meses anteriores ficam com o valor e a data reais de quando o dinheiro entrou.
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
          <div style={{paddingLeft:30,marginTop:10}}>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <input type="number" min={1} max={31} value={diaRaw} onChange={e=>setDiaRaw(e.target.value)} autoFocus
                placeholder="Dia"
                style={{width:70,height:34,background:'#F5F5F7',border:'1px solid rgba(0,0,0,0.08)',borderRadius:8,padding:'0 10px',fontSize:13,color:TEXT,outline:'none'}}/>
              <button onClick={salvarDiaSalario} style={{height:34,padding:'0 12px',background:TERRA,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>Salvar</button>
              <button onClick={()=>{setEditandoDia(false);setDiaRaw('')}} style={{height:34,padding:'0 12px',background:'rgba(0,0,0,0.04)',color:TEXTMU,border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>Cancelar</button>
            </div>
            <label style={{...sLbl,marginBottom:4}}>Vale a partir de</label>
            <input type="month" value={diaVigencia||mesAtual()} onChange={e=>setDiaVigencia(e.target.value)}
              style={{...sInp,height:38,fontSize:13}}/>
            <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
              Mudou a data de pagamento? Os meses anteriores a {rotuloMes(diaVigencia||mesAtual())} continuam
              com a data em que o dinheiro caiu de verdade.
            </p>
          </div>
        ):(
          <div style={{paddingLeft:30,marginTop:8}}>
            <button onClick={()=>{setEditandoDia(true);setDiaRaw(salaryDay);setDiaVigencia(mesAtual())}}
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
        <ModalPortal>
        <div style={{position:'fixed',inset:0,zIndex:80,display:'flex',alignItems:'flex-end'}} onClick={()=>setEditSal(null)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',width:'100%',maxWidth:390,margin:'0 auto',
            background:'#fff',borderRadius:'24px 24px 0 0',maxHeight:'90vh',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'20px 18px 0'}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 4px'}}>Salário {editSal}</h3>
              <p style={{fontSize:12,color:TEXTMU,margin:'0 0 16px'}}>
                Recebido todo dia {salaryDay}. Escolha a partir de que mês o novo valor vale —
                o que já entrou não é reescrito.
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

              <div style={{marginBottom:16,background:'rgba(196,98,45,0.06)',borderRadius:12,padding:'12px 14px'}}>
                <label style={{...sLbl,marginBottom:6}}>Esse valor vale a partir de</label>
                <input type="month" value={editSalVigencia||mesAtual()}
                  onChange={e=>setEditSalVigencia(e.target.value)}
                  style={{...sInp,background:'#fff'}}/>
                <p style={{fontSize:11,color:TEXTLT,margin:'7px 0 0',lineHeight:1.45}}>
                  Antes de <strong>{rotuloMes(editSalVigencia||mesAtual())}</strong> nada muda: cada mês
                  guarda o salário que realmente entrou. Aumento a partir de um mês futuro? É só escolher
                  o mês e o app já projeta certo.
                </p>
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
        </ModalPortal>
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
      <p style={{fontSize:12,color:TEXTMU,marginBottom:16,paddingLeft:4}}>Lançamentos marcados como recorrentes. Eles serão gerados automaticamente todo mês. Contas no cartão de crédito não precisam de dia de vencimento próprio — elas entram na fatura e o alerta é feito por lá. Cada conta pode ser <strong>sem prazo</strong> (repete para sempre) ou <strong>com prazo</strong> (por X meses, ou até um mês específico) — e só aparece nos meses da janela dela. Ao mudar valor ou dia você escolhe <strong>a partir de qual mês</strong> vale, e os meses anteriores ficam intocados. <strong>Encerrar</strong> para de gerar e mantém o histórico; <strong>Apagar</strong> remove o histórico também.</p>
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
                {(()=>{
                  // O prazo é a informação que faltava: dá para ver de bate-pronto
                  // se a conta é para sempre, se tem data para acabar, ou se já acabou.
                  const pz=tx._prazo
                  if(!pz) return null
                  const estilo=(cor:string,fundo:string)=>({display:'inline-block',marginTop:4,fontSize:10,fontWeight:700,color:cor,background:fundo,borderRadius:6,padding:'2px 7px'})
                  if(pz.tipo==='sem_prazo') return <span style={estilo(TEXTMU,'rgba(0,0,0,0.05)')}>Todo mês · sem prazo</span>
                  if(pz.tipo==='com_prazo') return <span style={estilo('#B37700','rgba(255,170,0,0.12)')}>Até {rotuloMes(pz.ultimoMes)} · {pz.restantes} {pz.restantes===1?'mês restante':'meses restantes'}</span>
                  return <span style={estilo(TEXTMU,'rgba(0,0,0,0.05)')}>Encerrada em {rotuloMes(pz.ultimoMes)} · histórico mantido</span>
                })()}
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
        <ModalPortal>
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
                Nome, categoria e forma de cobrança valem para todos os meses. Valor e dia valem
                a partir do mês que você escolher lá embaixo — o passado não é reescrito.
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

            {/* ── Prazo da conta ───────────────────────────────── */}
            <div style={{marginBottom:12,borderTop:'1px solid rgba(0,0,0,0.07)',paddingTop:14}}>
              <label style={sLbl}>Por quanto tempo essa conta existe</label>
              <div style={{display:'flex',gap:6,marginBottom:8}}>
                {[{v:'sem',l:'Sem prazo'},{v:'meses',l:'Por X meses'},{v:'ate',l:'Até mês'}].map(o=>(
                  <button key={o.v} onClick={()=>setEditRecPrazo(o.v as any)}
                    style={{...seg(editRecPrazo===o.v),flex:1,fontSize:12}}>{o.l}</button>
                ))}
              </div>

              {editRecPrazo==='sem'&&(
                <p style={{fontSize:11,color:TEXTMU,margin:0}}>
                  Repete todo mês, sem data para acabar. Aparece em qualquer mês que você abrir.
                </p>
              )}

              {editRecPrazo==='meses'&&(
                <>
                  <input type="number" min={1} max={MESES_FUTURO_MAX*5} value={editRecMeses}
                    onChange={e=>setEditRecMeses(e.target.value)}
                    placeholder="Ex: 12" style={{...sInp,...bordaErro('prazo')}}/>
                  <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
                    Contando a partir de {rotuloMes(mesAtual())}.
                    {mesFinalEscolhido()&&<> Termina em <strong>{rotuloMes(mesFinalEscolhido()!)}</strong>.</>}
                  </p>
                </>
              )}

              {editRecPrazo==='ate'&&(
                <>
                  <input type="month" value={editRecAte} min={mesAtual()}
                    onChange={e=>setEditRecAte(e.target.value)}
                    style={{...sInp,...bordaErro('prazo')}}/>
                  <p style={{fontSize:11,color:TEXTMU,margin:'5px 0 0'}}>
                    Último mês em que ela aparece. Depois disso, some das telas — sem apagar o histórico.
                  </p>
                </>
              )}
              <ErroCampo campo="prazo"/>
            </div>

            {/* ── Vigência do ajuste ───────────────────────────── */}
            <div style={{marginBottom:16,background:'rgba(196,98,45,0.06)',borderRadius:12,padding:'12px 14px'}}>
              <label style={{...sLbl,marginBottom:6}}>O novo valor e dia valem a partir de</label>
              <input type="month" value={editRecVigencia}
                onChange={e=>setEditRecVigencia(e.target.value)}
                style={{...sInp,background:'#fff'}}/>
              <p style={{fontSize:11,color:TEXTLT,margin:'7px 0 0',lineHeight:1.45}}>
                Os meses anteriores a <strong>{rotuloMes(editRecVigencia||mesAtual())}</strong> ficam
                exatamente como estão — inclusive os que ainda não foram pagos. Para agendar um reajuste
                (ex.: sobe em janeiro), é só escolher o mês futuro.
              </p>
            </div>

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
        </ModalPortal>
      )}

      {modalConfirmar}
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
          // Sem filtro de owner_id: o app e do casal e o export precisa sair
          // completo. Filtrando por quem esta logado, metade sumia do arquivo.
          const {data}=await s.from('transactions').select('*').order('purchase_date',{ascending:false})
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
        {/* Conferência de parcelamentos */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontSize:20}}>🧾</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Conferir parcelamentos</p>
              <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                Procura parcela em mês errado, mês pulado, parcela repetida ou faltando
              </p>
            </div>
          </div>

          <button onClick={conferirParcelamentos} disabled={conferindo}
            style={{width:'100%',height:42,background:conferindo?'#F5F5F7':'rgba(0,122,255,0.1)',color:ACCENT,
              border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:conferindo?'default':'pointer'}}>
            {conferindo?'Conferindo...':'Conferir agora'}
          </button>

          {auditoria&&(
            <div style={{marginTop:12}}>
              <p style={{fontSize:11,color:TEXTMU,margin:'0 0 8px'}}>
                {auditoria.gruposConferidos} parcelamentos · {auditoria.linhasConferidas} lançamentos conferidos
              </p>

              {auditoria.comProblema.length===0?(
                <p style={{fontSize:13,color:GREEN,fontWeight:600,margin:0}}>✓ Está tudo na sequência certa</p>
              ):(
                <>
                  {auditoria.comProblema.map(g=>(
                    <div key={g.chave} style={{background:'rgba(255,59,48,0.05)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                      <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:0}}>{g.base}</p>
                      <p style={{fontSize:10.5,color:TEXTMU,margin:'1px 0 6px'}}>{g.holder} · {g.card||'sem cartão'} · {g.total}x</p>
                      {g.problemas.map((pb,i)=>(
                        <p key={i} style={{fontSize:11.5,color:TEXTLT,margin:'0 0 3px',lineHeight:1.4}}>• {descreverProblema(pb)}</p>
                      ))}
                    </div>
                  ))}

                  <button onClick={corrigirParcelamentos} disabled={corrigindoParc}
                    style={{width:'100%',height:44,background:TERRA,color:'#fff',border:'none',borderRadius:12,
                      fontSize:13,fontWeight:700,cursor:corrigindoParc?'default':'pointer',opacity:corrigindoParc?0.6:1,marginTop:4}}>
                    {corrigindoParc?'Corrigindo...':'Colocar as parcelas no mês certo'}
                  </button>
                  <p style={{fontSize:10.5,color:TEXTMU,margin:'7px 0 0',lineHeight:1.45}}>
                    Corrige a data da parcela e o mês da fatura. Um pagamento que você registrou com data
                    própria não é apagado — só o &quot;pago&quot; que o app tinha carimbado sozinho em cima
                    da data errada. Parcela faltando é recriada sozinha ao abrir Parcelamentos.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lançamentos duplicados */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontSize:20}}>👯</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>Procurar lançamentos duplicados</p>
              <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                O mesmo compromisso lançado duas vezes no mesmo mês
              </p>
            </div>
          </div>

          <button onClick={procurarDuplicatas} disabled={buscandoDups}
            style={{width:'100%',height:42,background:buscandoDups?'#F5F5F7':'rgba(0,122,255,0.1)',color:ACCENT,
              border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:buscandoDups?'default':'pointer'}}>
            {buscandoDups?'Procurando...':'Procurar agora'}
          </button>

          {dups&&(
            <div style={{marginTop:12}}>
              <p style={{fontSize:11,color:TEXTMU,margin:'0 0 8px'}}>{dups.linhasConferidas} lançamentos conferidos</p>

              {dups.totalARemover===0&&dups.resumoConferir.length===0?(
                <p style={{fontSize:13,color:GREEN,fontWeight:600,margin:0}}>✓ Nenhuma duplicata</p>
              ):(
                <>
                  <p style={{fontSize:11,color:TEXTLT,margin:'0 0 8px',lineHeight:1.45}}>
                    Marque o que você quer apagar. Nada vem marcado — confira cada um antes.
                  </p>
                  {dups.resumo.map((r,i)=>{
                    const marcado=dupsEscolhidas.includes(r.chave)
                    return (
                    <button key={i} onClick={()=>setDupsEscolhidas(p=>marcado?p.filter(x=>x!==r.chave):[...p,r.chave])}
                      style={{display:'block',width:'100%',textAlign:'left',cursor:'pointer',
                        background:marcado?'rgba(255,59,48,0.09)':'rgba(0,0,0,0.03)',
                        border:`1.5px solid ${marcado?RED:'transparent'}`,
                        borderRadius:10,padding:'10px 12px',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:18,height:18,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${marcado?RED:'rgba(0,0,0,0.2)'}`,background:marcado?RED:'transparent',
                          color:'#fff',fontSize:12,fontWeight:900,lineHeight:'16px',textAlign:'center'}}>{marcado?'✓':''}</span>
                        <p style={{fontSize:13,fontWeight:700,color:TEXT,margin:0}}>{r.titulo}</p>
                      </div>
                      <p style={{fontSize:10.5,color:TEXTMU,margin:'3px 0 5px',paddingLeft:26}}>
                        {r.holder} · aparece em {r.meses.length} {r.meses.length>1?'meses':'mês'} ({rotuloMes(r.meses[0])} → {rotuloMes(r.meses[r.meses.length-1])})
                      </p>
                      <p style={{fontSize:11.5,color:TEXTLT,margin:0,paddingLeft:26,lineHeight:1.5}}>
                        {r.valores.length>1
                          ? <>Valores lançados: {r.valores.map(v=>formatCurrency(v)).join(' e ')}. Fica a de <strong>{formatCurrency(r.valores[0])}</strong>, saem {r.aRemover} {r.aRemover>1?'linhas':'linha'}.</>
                          : <>Duas linhas idênticas de <strong>{formatCurrency(r.valores[0])}</strong> por mês. Fica uma, saem {r.aRemover}.</>}
                      </p>
                    </button>
                  )})}

                  {dups.grupos.some(g=>g.certeza==='duplicata'&&g.protegidas.length>0)&&(
                    <p style={{fontSize:11,color:'#B37700',background:'rgba(255,170,0,0.1)',borderRadius:8,padding:'8px 10px',margin:'0 0 8px',lineHeight:1.45}}>
                      Algumas linhas não serão apagadas porque têm pagamento registrado por você, com data própria.
                      Essas ficam para você conferir na mão.
                    </p>
                  )}

                  {dups.resumoConferir.length>0&&(
                    <div style={{marginTop:dups.totalARemover>0?14:0}}>
                      <p style={{fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.04em',margin:'0 0 6px'}}>
                        Só para você conferir
                      </p>
                      <p style={{fontSize:11,color:TEXTLT,margin:'0 0 8px',lineHeight:1.45}}>
                        Mesma descrição e mesma data, mas valores diferentes. Provavelmente são compras separadas
                        (duas idas ao mercado, dois Ubers) — por isso o app <strong>não</strong> apaga nada aqui.
                      </p>
                      {dups.resumoConferir.map((r,i)=>(
                        <div key={i} style={{background:'rgba(255,170,0,0.07)',borderRadius:10,padding:'9px 12px',marginBottom:6}}>
                          <p style={{fontSize:12.5,fontWeight:600,color:TEXT,margin:0}}>{r.titulo}</p>
                          <p style={{fontSize:11,color:TEXTLT,margin:'2px 0 0',lineHeight:1.45}}>
                            {r.holder} · {rotuloMes(r.meses[0])} · {r.valores.map(v=>formatCurrency(v)).join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {dups.totalARemover>0&&(
                    <button onClick={confirmarRemocaoDuplicatas} disabled={removendoDups||totalEscolhido===0}
                      style={{width:'100%',height:44,background:totalEscolhido===0?'#F5F5F7':RED,
                        color:totalEscolhido===0?TEXTMU:'#fff',border:'none',borderRadius:12,
                        fontSize:13,fontWeight:700,cursor:(removendoDups||totalEscolhido===0)?'default':'pointer',
                        opacity:removendoDups?0.6:1,marginTop:4}}>
                      {removendoDups?'Apagando...':totalEscolhido===0?'Marque o que apagar':`Apagar ${totalEscolhido} linha${totalEscolhido>1?'s':''} (fica a de menor valor)`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Titular das receitas */}
        <div style={{...sCard,padding:'16px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontSize:20}}>🙋</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,fontWeight:600,color:TEXT,margin:0}}>De quem é cada receita</p>
              <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>
                É o titular que decide a divisão por pessoa no Início
              </p>
            </div>
          </div>

          <button onClick={carregarTitularReceitas} disabled={carregandoTit}
            style={{width:'100%',height:42,background:carregandoTit?'#F5F5F7':'rgba(0,122,255,0.1)',color:ACCENT,
              border:'none',borderRadius:12,fontSize:13,fontWeight:700,cursor:carregandoTit?'default':'pointer'}}>
            {carregandoTit?'Carregando...':recTitular?'Recarregar':'Ver receitas por titular'}
          </button>

          {recTitular&&(
            <div style={{marginTop:12}}>
              {(['Lucas','Nicoly'] as const).map(quem=>{
                const doTitular=recTitular.filter(g=>g.holder===quem)
                if(doTitular.length===0)return null
                const soma=doTitular.reduce((s,g)=>s+g.total,0)
                return (
                  <div key={quem} style={{marginBottom:12}}>
                    <p style={{fontSize:11,fontWeight:700,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.04em',margin:'0 0 6px'}}>
                      {quem} · {formatCurrency(soma)}
                    </p>
                    {doTitular.some(g=>!g.travado)&&(
                      <button onClick={()=>{
                        const livres=doTitular.filter(g=>!g.travado).map(g=>g.chave)
                        const todas=livres.every(k=>titEscolhidos.includes(k))
                        setTitEscolhidos(p=>todas?p.filter(k=>!livres.includes(k)):[...p.filter(k=>!livres.includes(k)),...livres])
                      }} style={{fontSize:11,fontWeight:700,color:ACCENT,background:'none',border:'none',padding:'0 0 6px',cursor:'pointer'}}>
                        Marcar/desmarcar todas de {quem}
                      </button>
                    )}
                    {doTitular.map(g=>{
                      const marcado=titEscolhidos.includes(g.chave)
                      return (
                      <div key={g.chave} onClick={()=>!g.travado&&setTitEscolhidos(p=>marcado?p.filter(k=>k!==g.chave):[...p,g.chave])}
                        style={{background:marcado?'rgba(196,98,45,0.09)':'rgba(0,0,0,0.03)',
                          border:`1.5px solid ${marcado?TERRA:'transparent'}`,
                          borderRadius:10,padding:'10px 12px',marginBottom:6,cursor:g.travado?'default':'pointer'}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                          {!g.travado&&(
                            <span style={{width:18,height:18,borderRadius:5,flexShrink:0,marginTop:1,
                              border:`1.5px solid ${marcado?TERRA:'rgba(0,0,0,0.2)'}`,background:marcado?TERRA:'transparent',
                              color:'#fff',fontSize:12,fontWeight:900,lineHeight:'16px',textAlign:'center'}}>{marcado?'✓':''}</span>
                          )}
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:13,fontWeight:600,color:TEXT,margin:0}}>{g.base}</p>
                            <p style={{fontSize:10.5,color:TEXTMU,margin:'2px 0 0',lineHeight:1.4}}>
                              {g.qtd} {g.qtd>1?'lançamentos':'lançamento'} · {g.periodo} · {formatCurrency(g.total)}
                              {g.contas.length>0&&<> · cai em {g.contas.join(', ')}</>}
                            </p>
                          </div>
                          {g.travado?(
                            <span style={{fontSize:10,color:TEXTMU,background:'rgba(0,0,0,0.05)',borderRadius:6,padding:'3px 7px',flexShrink:0,whiteSpace:'nowrap'}}>
                              Ciclo Salarial
                            </span>
                          ):(
                            <button onClick={e=>{e.stopPropagation();confirmarTrocaTitular(g)}} disabled={trocandoTit===g.chave}
                              style={{fontSize:11,fontWeight:700,color:TERRA,background:'rgba(196,98,45,0.1)',border:'none',
                                borderRadius:8,padding:'5px 10px',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                              {trocandoTit===g.chave?'...':`→ ${g.holder==='Lucas'?'Nicoly':'Lucas'}`}
                            </button>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )
              })}
              {titEscolhidos.length>0&&(
                <button onClick={confirmarTrocaEmLote} disabled={trocandoTit==='lote'}
                  style={{width:'100%',height:44,background:TERRA,color:'#fff',border:'none',borderRadius:12,
                    fontSize:13,fontWeight:700,cursor:trocandoTit==='lote'?'default':'pointer',
                    opacity:trocandoTit==='lote'?0.6:1,margin:'4px 0 10px'}}>
                  {trocandoTit==='lote'?'Trocando...':`Trocar o titular ${titEscolhidos.length>1?`dos ${titEscolhidos.length} marcados`:'do marcado'}`}
                </button>
              )}
              <p style={{fontSize:10.5,color:TEXTMU,margin:0,lineHeight:1.45}}>
                O salário fica travado aqui porque quem o gera é o Ciclo Salarial — mudar o titular por fora
                faria o app recriar o antigo no mês seguinte.
              </p>
            </div>
          )}
        </div>

        <div style={{...sCard,padding:'16px 18px'}}>
          <p style={{fontSize:11,fontWeight:600,color:TEXTMU,textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 8px'}}>Versão</p>
          <p style={{fontSize:14,color:TEXT,margin:0}}>Finanças L&N v1.0</p>
          <p style={{fontSize:11,color:TEXTMU,margin:'2px 0 0'}}>Desenvolvido por Lucas & Claude</p>
        </div>
      </div>
      {modalConfirmar}
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
      {modalConfirmar}
    </div>
  )
}
