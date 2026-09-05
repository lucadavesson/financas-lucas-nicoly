import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { calcBillingMonth } from '@/lib/utils'
import {
  mesKey, mesDe, mesAtual, somaMeses, distanciaMeses, dataNoMes,
  chaveConta, resumirRecorrentes, prazoDaConta,
  type ContaRec, type Prazo,
} from '@/lib/utils/mesUtils'

export {
  mesKey, mesDe, mesAtual, mesParaData, somaMeses, distanciaMeses,
  ultimoDiaDoMes, dataNoMes, rotuloMes, chaveConta, resumirRecorrentes, prazoDaConta,
} from '@/lib/utils/mesUtils'
export type { ContaRec, Prazo } from '@/lib/utils/mesUtils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MOTOR DE RECORRÊNCIA — prazo e vigência
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Não existe tabela de "modelo" de conta recorrente: cada mês é uma linha em
 * `transactions` com is_recurring = true. Então a própria coleção de linhas
 * descreve a conta, e dá para derivar tudo sem coluna nova:
 *
 *   • quando começou  → mês da ocorrência mais ANTIGA
 *   • até quando vai  → mês da ocorrência mais NOVA
 *   • sem prazo?      → recurring_active = true  (gera todo mês, para sempre)
 *   • com prazo?      → recurring_active = false + ocorrências já criadas até
 *                       o mês final. Ela aparece exatamente na janela dela e
 *                       em nenhum mês fora dela.
 *   • encerrada?      → recurring_active = false e a última ocorrência já passou
 *
 * Ou seja: "prazo determinado" e "encerrada" são o mesmo mecanismo — parar de
 * gerar — e o que os diferencia é só onde está a última ocorrência. A tela
 * mostra as linhas que existem, então nenhuma tela pode discordar da outra.
 *
 * REGRAS DE OURO
 *  1. Nunca inventar passado. Só geramos do mês corrente para frente; um mês
 *     que já fechou fica exatamente como está.
 *  2. Nunca reescrever o que já foi pago. Valor de mês pago é histórico.
 *  3. Toda mudança de valor ou de dia tem um mês de vigência: vale daquele mês
 *     em diante e não encosta nos anteriores, pagos ou não.
 *  4. Mudou o dia? A data das ocorrências afetadas anda junto — senão a tela de
 *     Configurações diz "vence dia 2" e a de Lançamentos mostra 31/08.
 */

/** Até quantos meses à frente o app materializa sozinho ao navegar. */
export const MESES_FUTURO_MAX = 24
/** Teto de segurança para materialização de prazo longo (financiamento de 10 anos). */
const MAX_MESES_MATERIALIZA = 130

/** Carrega todas as despesas recorrentes do casal, já agrupadas por conta. */
export async function carregarRecorrentes(): Promise<ContaRec[]> {
  const { data } = await createClient().from('transactions').select('*')
    .eq('is_recurring', true)
    .order('purchase_date', { ascending: false })
  const despesas = (data || []).filter((t: any) => t.transaction_type !== 'receita' && t.type !== 'Receita')
  return resumirRecorrentes(despesas)
}

/* ── Geração ────────────────────────────────────────────────────── */

/** Evita que duas telas gerando o mesmo mês ao mesmo tempo criem linha dobrada. */
const gerando = new Set<string>()

/** Monta a linha de um mês a partir do template da conta. */
function linhaDoMes(tpl: any, mes: string, ownerId: string, fechamentoPorCartao: Record<string, number>) {
  const noCartao = tpl.payment_method === 'cartao_credito'
  const dia = tpl.recurring_day || new Date(tpl.purchase_date + 'T12:00:00').getDate()
  const purchaseDate = dataNoMes(mes, dia)
  const hoje = mesAtual()

  // Mesma convenção de status do motor de parcelas: mês futuro é Previsto,
  // mês corrente é Pendente. Conta recorrente nunca vira "Pago" sozinha —
  // pagamento de conta é confirmação manual.
  const status = tpl.transaction_type === 'receita' || tpl.type === 'Receita'
    ? 'Previsto'
    : (mes > hoje ? 'Previsto' : 'Pendente')

  // Antes o billing_month nascia vazio na linha gerada, então a fatura do mês
  // no Início caía no fallback de purchase_date e não batia com a tela Cartões.
  let billingMonth: string | null = null
  if (noCartao && tpl.card_name) {
    const fechamento = fechamentoPorCartao[tpl.card_name] || 1
    billingMonth = format(calcBillingMonth(parseISO(purchaseDate), fechamento), 'yyyy-MM-dd')
  }

  return {
    owner_id: ownerId,
    owner_name: tpl.owner_name,
    holder: tpl.holder,
    type: tpl.type || 'Despesa',
    nature: tpl.nature || 'Fixo',
    transaction_type: tpl.transaction_type,
    description: tpl.description,
    amount: tpl.expected_amount || tpl.amount,
    category: tpl.category,
    subcategory: tpl.subcategory || null,
    purchase_date: purchaseDate,
    payment_method: tpl.payment_method || null,
    card_name: tpl.card_name || null,
    billing_month: billingMonth,
    status,
    is_recurring: true,
    recurring_active: true,
    recurring_day: tpl.recurring_day,
    expected_amount: tpl.expected_amount || tpl.amount,
    notes: tpl.notes || null,
  }
}

async function fechamentoDosCartoes(): Promise<Record<string, number>> {
  const { data } = await createClient().from('cards').select('name,holder,closing_day')
  const mapa: Record<string, number> = {}
  for (const c of data || []) mapa[`${c.name} — ${c.holder}`] = c.closing_day || 1
  return mapa
}

/**
 * Gera as contas recorrentes de um mês, se ainda não existirem.
 *
 * Roda em qualquer tela que mostre um mês (Início, Lançamentos, Pagar), e não
 * só no mês corrente — é isso que faz uma conta sem prazo aparecer em TODO mês
 * que você navegar, em vez de só no mês atual depois de passar pelo Início.
 */
export async function generateRecurrents(targetMonth: Date): Promise<{ generated: number }> {
  const alvo = mesKey(targetMonth)
  const hoje = mesAtual()

  // Regra 1: não inventamos passado. Mês fechado fica como está.
  if (alvo < hoje) return { generated: 0 }
  if (distanciaMeses(hoje, alvo) > MESES_FUTURO_MAX) return { generated: 0 }
  if (gerando.has(alvo)) return { generated: 0 }
  gerando.add(alvo)

  try {
    const s = createClient()
    const { data: { user } } = await s.auth.getUser()
    if (!user) return { generated: 0 }

    const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd')

    // Sem filtro de owner_id: conta recorrente é do casal. Filtrar por quem
    // está logado fazia a conta cadastrada por um nunca ser gerada quando era
    // o outro que abria o app (mesmo padrão de statusEngine.ts).
    const [{ data: todasRecorrentes }, { data: existentes }, fechamentos] = await Promise.all([
      s.from('transactions').select('*')
        .eq('is_recurring', true)
        .order('purchase_date', { ascending: false }),
      s.from('transactions').select('id,description,holder')
        .gte('purchase_date', monthStart)
        .lte('purchase_date', monthEnd),
      fechamentoDosCartoes(),
    ])

    if (!todasRecorrentes || todasRecorrentes.length === 0) return { generated: 0 }

    const jaNoMes = new Set((existentes || []).map(t => chaveConta(t.description, t.holder)))
    const contas = resumirRecorrentes(
      todasRecorrentes.filter((t: any) => t.transaction_type !== 'receita' && t.type !== 'Receita')
    )

    const novas: any[] = []
    for (const conta of contas) {
      if (!conta.ativa) continue                 // com prazo definido ou encerrada
      if (alvo < conta.primeiroMes) continue     // a conta ainda não existia nesse mês
      if (jaNoMes.has(conta.chave)) continue     // já tem lançamento desse nome no mês
      novas.push(linhaDoMes(conta.template, alvo, user.id, fechamentos))
    }

    let generated = 0
    if (novas.length > 0) {
      const { error } = await s.from('transactions').insert(novas)
      if (!error) generated += novas.length
    }

    generated += await gerarSalarios(alvo, user.id, todasRecorrentes, jaNoMes)
    return { generated }
  } catch (e) {
    console.error('generateRecurrents:', e)
    return { generated: 0 }
  } finally {
    gerando.delete(alvo)
  }
}

/**
 * Salário do casal. Mora em app_settings (não é uma conta recorrente comum),
 * mas segue as mesmas regras: não gera antes do primeiro salário registrado e
 * não gera em mês que já fechou.
 */
async function gerarSalarios(alvo: string, ownerId: string, todasRecorrentes: any[], jaNoMes: Set<string>): Promise<number> {
  const s = createClient()
  const { data: settings } = await s.from('app_settings').select('*').limit(1).maybeSingle()
  if (!settings) return 0

  const hoje = mesAtual()
  const hojeStr = format(new Date(), 'yyyy-MM-dd')
  const dia = settings.salary_day || 1
  const dataSalario = dataNoMes(alvo, dia)

  const linhas: any[] = []
  for (const [nome, titular, valor] of [
    ['Salário Lucas', 'Lucas', settings.salary_lucas],
    ['Salário Nicoly', 'Nicoly', settings.salary_nicoly],
  ] as [string, string, number][]) {
    if (!valor || valor <= 0) continue
    if (jaNoMes.has(chaveConta(nome, titular))) continue

    // Só a partir do mês do primeiro salário lançado — senão navegar para um
    // mês antigo criaria salário em época que nem existia no app.
    const anteriores = (todasRecorrentes || []).filter(
      (t: any) => chaveConta(t.description, t.holder) === chaveConta(nome, titular)
    )
    const inicio = anteriores.length
      ? anteriores.reduce((min: string, t: any) => (mesDe(t.purchase_date) < min ? mesDe(t.purchase_date) : min), mesDe(anteriores[0].purchase_date))
      : hoje
    if (alvo < inicio) continue

    const caiuNoPassado = alvo === hoje && dataSalario <= hojeStr
    linhas.push({
      owner_id: ownerId, owner_name: titular, holder: titular,
      type: 'Receita', transaction_type: 'receita', nature: 'Fixo',
      description: nome, amount: valor, category: 'Salário',
      purchase_date: dataSalario,
      status: caiuNoPassado ? 'Pago' : 'Previsto',
      paid_date: caiuNoPassado ? dataSalario : null,
      paid_amount: caiuNoPassado ? valor : null,
      is_recurring: true, recurring_active: true, recurring_day: dia,
      expected_amount: valor,
    })
  }

  if (linhas.length === 0) return 0
  const { error } = await s.from('transactions').insert(linhas)
  return error ? 0 : linhas.length
}

/* ── Prazo ──────────────────────────────────────────────────────── */

/**
 * Cria as ocorrências que faltam de uma conta até o mês informado (inclusive).
 * Usado quando você define "por 12 meses" / "até dez/2027": em vez de guardar a
 * data-fim numa coluna, as linhas do prazo passam a existir de fato — e aí
 * qualquer tela que leia o mês enxerga a mesma coisa.
 */
export async function materializarRecorrenteAte(conta: ContaRec, ateMes: string): Promise<{ criadas: number }> {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { criadas: 0 }

  const hoje = mesAtual()
  const jaExistem = new Set(conta.linhas.map(l => mesDe(l.purchase_date)))
  const fechamentos = await fechamentoDosCartoes()

  // Nunca antes do mês corrente nem antes do início da conta.
  let mes = conta.primeiroMes > hoje ? conta.primeiroMes : hoje
  const novas: any[] = []
  let guarda = 0
  while (mes <= ateMes && guarda++ < MAX_MESES_MATERIALIZA) {
    if (!jaExistem.has(mes)) novas.push(linhaDoMes(conta.template, mes, user.id, fechamentos))
    mes = somaMeses(mes, 1)
  }

  if (novas.length === 0) return { criadas: 0 }
  const { error } = await s.from('transactions').insert(novas)
  return { criadas: error ? 0 : novas.length }
}

/** Apaga ocorrências futuras ainda não pagas depois de um mês. Histórico e pagos ficam. */
export async function limparOcorrenciasApos(descricao: string, holder: string, ultimoMes: string): Promise<{ removidas: number }> {
  const s = createClient()
  const { data, error } = await s.from('transactions').delete()
    .eq('is_recurring', true)
    .eq('description', descricao)
    .eq('holder', holder)
    .neq('status', 'Pago')
    .gte('purchase_date', `${somaMeses(ultimoMes, 1)}-01`)
    .select('id')
  if (error) return { removidas: 0 }
  return { removidas: (data || []).length }
}

/**
 * Define o prazo da conta.
 *  - ateMes = null → sem prazo: volta a gerar todo mês, para sempre.
 *  - ateMes = 'yyyy-MM' → materializa até lá, apaga o que passar disso e para
 *    de gerar. A conta continua aparecendo normalmente dentro da janela dela.
 */
export async function definirPrazo(conta: ContaRec, ateMes: string | null): Promise<{ ok: boolean; erro?: string; criadas: number; removidas: number }> {
  const s = createClient()
  try {
    if (!ateMes) {
      const { error } = await s.from('transactions').update({ recurring_active: true })
        .eq('is_recurring', true).eq('description', conta.descricao).eq('holder', conta.holder)
      if (error) return { ok: false, erro: error.message, criadas: 0, removidas: 0 }
      return { ok: true, criadas: 0, removidas: 0 }
    }

    const { criadas } = await materializarRecorrenteAte(conta, ateMes)
    const { removidas } = await limparOcorrenciasApos(conta.descricao, conta.holder, ateMes)
    const { error } = await s.from('transactions').update({ recurring_active: false })
      .eq('is_recurring', true).eq('description', conta.descricao).eq('holder', conta.holder)
    if (error) return { ok: false, erro: error.message, criadas, removidas }
    return { ok: true, criadas, removidas }
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Erro inesperado', criadas: 0, removidas: 0 }
  }
}

/* ── Ajuste com vigência ────────────────────────────────────────── */

export type AjusteRecorrente = {
  conta: ContaRec
  /** Mês a partir do qual valor/dia passam a valer ('yyyy-MM'). */
  aPartirDe: string
  /** Campos de cadastro — valem para TODAS as ocorrências, senão a conta se parte em duas. */
  cadastro: Record<string, any>
  /** Novo valor mensal. Só entra em ocorrências >= aPartirDe e não pagas. */
  valor?: number | null
  /** Novo dia de vencimento. Move também a data das ocorrências afetadas. */
  dia?: number | null
}

/**
 * Aplica uma mudança de conta recorrente respeitando a vigência.
 *
 * O que muda de antes: o update de valor pegava TODA ocorrência não paga,
 * inclusive meses passados em atraso — reajustar o aluguel hoje reescrevia,
 * calado, o valor devido de agosto. Agora o passado é intocável e você escolhe
 * de qual mês em diante o novo valor vale.
 *
 * Se a vigência for um mês futuro que ainda não existe, as ocorrências até lá
 * são criadas na hora, para o novo valor ter onde cair e você conseguir ver o
 * reajuste navegando até o mês.
 */
export async function aplicarAjusteRecorrente(a: AjusteRecorrente): Promise<{ ok: boolean; erro?: string; atualizadas: number }> {
  const s = createClient()
  const { conta, aPartirDe } = a

  try {
    // 1. Cadastro vale para todas as ocorrências (identidade da conta).
    if (Object.keys(a.cadastro).length > 0) {
      const { error } = await s.from('transactions').update(a.cadastro)
        .eq('is_recurring', true).eq('description', conta.descricao).eq('holder', conta.holder)
      if (error) return { ok: false, erro: error.message, atualizadas: 0 }
    }

    const nomeAtual = a.cadastro.description || conta.descricao
    const titularAtual = a.cadastro.holder || conta.holder

    // 2. Vigência no futuro sem linha criada? Cria até lá, senão o ajuste
    //    não teria onde ser gravado e sumiria.
    if (conta.ativa && aPartirDe > conta.ultimoMes && distanciaMeses(mesAtual(), aPartirDe) <= MESES_FUTURO_MAX) {
      await materializarRecorrenteAte(
        { ...conta, descricao: nomeAtual, holder: titularAtual, template: { ...conta.template, ...a.cadastro } },
        aPartirDe,
      )
    }

    // 3. Valor e dia só do mês de vigência em diante, e nunca no que já foi pago.
    const mudancas: Record<string, any> = {}
    if (a.valor != null && a.valor > 0) { mudancas.amount = a.valor; mudancas.expected_amount = a.valor }
    if (a.dia !== undefined) mudancas.recurring_day = a.dia
    if (Object.keys(mudancas).length === 0) return { ok: true, atualizadas: 0 }

    const { data: afetadas, error: erroBusca } = await s.from('transactions')
      .select('id,purchase_date,status')
      .eq('is_recurring', true).eq('description', nomeAtual).eq('holder', titularAtual)
      .neq('status', 'Pago')
      .gte('purchase_date', `${aPartirDe}-01`)
    if (erroBusca) return { ok: false, erro: erroBusca.message, atualizadas: 0 }

    let atualizadas = 0
    for (const linha of afetadas || []) {
      const patch: Record<string, any> = { ...mudancas }
      // Regra 4: mudou o dia, a data anda junto — dentro do mês da própria linha.
      if (a.dia) patch.purchase_date = dataNoMes(mesDe(linha.purchase_date), a.dia)
      const { error } = await s.from('transactions').update(patch).eq('id', linha.id)
      if (!error) atualizadas++
    }
    return { ok: true, atualizadas }
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Erro inesperado', atualizadas: 0 }
  }
}

/**
 * Mesma ideia para o salário, que vive em app_settings e tem duas faces: a
 * configuração (o que passa a valer) e as ocorrências já lançadas.
 *
 * Antes, mudar o salário reescrevia todo mês não recebido — inclusive meses
 * passados — e mudar o dia gravava recurring_day até nas linhas já pagas, sem
 * mover data nenhuma. Agora vale a vigência, e a data acompanha o dia novo.
 */
export async function aplicarAjusteSalario(params: {
  titular: 'Lucas' | 'Nicoly'
  valor: number
  dia: number
  aPartirDe: string
}): Promise<{ ok: boolean; erro?: string; atualizadas: number }> {
  const s = createClient()
  const { titular, valor, dia, aPartirDe } = params
  const nome = `Salário ${titular}`

  try {
    const { data: afetadas, error: erroBusca } = await s.from('transactions')
      .select('id,purchase_date')
      .eq('is_recurring', true).eq('description', nome).eq('holder', titular)
      .neq('status', 'Pago')
      .gte('purchase_date', `${aPartirDe}-01`)
    if (erroBusca) return { ok: false, erro: erroBusca.message, atualizadas: 0 }

    let atualizadas = 0
    for (const linha of afetadas || []) {
      const { error } = await s.from('transactions').update({
        amount: valor, expected_amount: valor, recurring_day: dia,
        purchase_date: dataNoMes(mesDe(linha.purchase_date), dia),
      }).eq('id', linha.id)
      if (!error) atualizadas++
    }

    // Se a vigência é o mês corrente e ainda não há lançamento de salário nele,
    // cria — é o que faz o valor novo aparecer no Início na hora.
    if (valor > 0 && (afetadas || []).length === 0 && aPartirDe >= mesAtual()) {
      const { data: { user } } = await s.auth.getUser()
      const { data: existe } = await s.from('transactions').select('id')
        .eq('is_recurring', true).eq('description', nome).eq('holder', titular)
        .gte('purchase_date', `${aPartirDe}-01`).lt('purchase_date', `${somaMeses(aPartirDe, 1)}-01`)
      if (user && (!existe || existe.length === 0)) {
        const dataSalario = dataNoMes(aPartirDe, dia)
        const hojeStr = format(new Date(), 'yyyy-MM-dd')
        const caiu = aPartirDe === mesAtual() && dataSalario <= hojeStr
        const { error } = await s.from('transactions').insert({
          owner_id: user.id, owner_name: titular, holder: titular,
          type: 'Receita', transaction_type: 'receita', nature: 'Fixo',
          description: nome, amount: valor, category: 'Salário',
          purchase_date: dataSalario,
          status: caiu ? 'Pago' : 'Previsto',
          paid_date: caiu ? dataSalario : null,
          paid_amount: caiu ? valor : null,
          is_recurring: true, recurring_active: true, recurring_day: dia,
          expected_amount: valor,
        })
        if (!error) atualizadas++
      }
    }

    return { ok: true, atualizadas }
  } catch (e: any) {
    return { ok: false, erro: e?.message || 'Erro inesperado', atualizadas: 0 }
  }
}
