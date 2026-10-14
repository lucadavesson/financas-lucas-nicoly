import { mesDe, somaMeses, mesParaData, type ContaRec } from '@/lib/utils/mesUtils'

/**
 * COMPROMISSOS COM FIM — parcelas de compra + contas recorrentes com prazo.
 *
 * Uma conta recorrente com data para acabar (vestido da noiva, fotógrafo,
 * financiamento, consórcio) é, para o bolso, a mesma coisa que uma compra
 * parcelada: tem quantos meses faltam, quanto ainda sai e quando acaba. Este
 * módulo põe as duas na mesma forma (um "cronograma" de meses), para a tela de
 * Parcelamentos mostrar tudo junto e dar a noção do todo.
 *
 * Lógica pura — sem Supabase, sem React — para poder ser testada sozinha.
 */

export type MesDoCronograma = {
  num: number
  data: Date
  mes: string
  pago: boolean
  valor: number
  temLinha: boolean
}

/** O mínimo que um item precisa ter para entrar na agenda e nos marcos. */
export type ItemCompromisso = {
  base: string
  tipo: 'parcela' | 'conta'
  cronograma: { mes: string; pago: boolean; valor: number }[]
  valorParcela: number
  totalParcelas: number
  pagas: number
  mesQuitacao: Date
}

const METODO: Record<string, string> = { boleto: 'Boleto', debito_automatico: 'Débito automático', pix: 'PIX' }

/**
 * Conta recorrente COM PRAZO → grupo no mesmo formato de uma compra parcelada.
 * Devolve null para conta sem prazo (não acaba nunca) ou que já terminou.
 *
 * Regras:
 *  - mês "pulado" (status Cancelado) não existe no cronograma: não custa nada
 *  - mês passado sem linha (buraco antigo) fica de fora: não há dado para afirmar
 *  - mês futuro sem linha entra projetado, com o valor da última ocorrência
 */
export function grupoDeConta(c: ContaRec, mesAgora: string) {
  if (c.ativa || c.ultimoMes < mesAgora) return null

  const validas = c.linhas.filter(l => l.status !== 'Cancelado')
    .sort((a, b) => (a.purchase_date || '').localeCompare(b.purchase_date || ''))
  if (validas.length === 0) return null

  const porMes = new Map<string, any>()
  validas.forEach(l => porMes.set(mesDe(l.purchase_date), l))
  const puladas = new Set(c.linhas.filter(l => l.status === 'Cancelado').map(l => mesDe(l.purchase_date)))
  const ultima = validas[validas.length - 1]
  const valorRef = Number(ultima.amount) || 0

  const cronograma: MesDoCronograma[] = []
  for (let m = c.primeiroMes; m <= c.ultimoMes; m = somaMeses(m, 1)) {
    const linha = porMes.get(m)
    if (!linha) {
      if (puladas.has(m)) continue      // pulado de propósito
      if (m < mesAgora) continue        // buraco antigo: sem dado, não conta
    }
    const pago = linha ? linha.status === 'Pago' : false
    const valor = linha
      ? (pago ? Number(linha.paid_amount || linha.amount) : Number(linha.amount))
      : valorRef
    const dia = linha ? Number((linha.purchase_date || '').slice(8, 10)) || 1 : Number((ultima.purchase_date || '').slice(8, 10)) || 1
    const [a, mm] = m.split('-').map(Number)
    cronograma.push({ num: cronograma.length + 1, data: new Date(a, mm - 1, dia, 12), mes: m, pago, valor, temLinha: !!linha })
  }
  if (cronograma.length === 0) return null

  const tpl = c.template
  const noCartao = tpl.payment_method === 'cartao_credito'
  const dia = tpl.recurring_day || Number((tpl.purchase_date || '').slice(8, 10)) || null
  const forma = noCartao
    ? `💳 ${(tpl.card_name || 'Cartão').replace(' — ', ' ')}${dia ? ` · dia ${dia}` : ''}`
    : `${METODO[tpl.payment_method] || 'Conta'} · ${dia ? `vence dia ${dia}` : 'sem vencimento'}`

  const pagos = cronograma.filter(x => x.pago)
  const abertos = cronograma.filter(x => !x.pago)
  const proxima = abertos[0] || null
  const valorParcela = (proxima || cronograma[cronograma.length - 1]).valor
  const ult = cronograma[cronograma.length - 1]

  return {
    tipo: 'conta' as const,
    base: (c.descricao || '').trim(),
    parcelas: validas,
    holder: c.holder,
    card: noCartao ? (tpl.card_name || '') : '',
    forma,
    category: tpl.category,
    totalParcelas: cronograma.length,
    valorParcela,
    valorTotal: cronograma.reduce((s, x) => s + x.valor, 0),
    base1: mesParaData(cronograma[0].mes),
    cronograma,
    pagas: pagos.length,
    valorPago: pagos.reduce((s, x) => s + x.valor, 0),
    valorFalta: abertos.reduce((s, x) => s + x.valor, 0),
    mesQuitacao: mesParaData(ult.mes),
    proxima,
    valorCompra: null as number | null,
    juros: 0,
    pctJuros: 0,
  }
}

/** Quanto está programado para sair em cada um dos próximos `n` meses (pago ou não). */
export function agendaPorMes(itens: ItemCompromisso[], desde: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const mes = somaMeses(desde, i)
    let parcelas = 0, contas = 0
    for (const it of itens) {
      const v = it.cronograma.filter(c => c.mes === mes).reduce((s, c) => s + c.valor, 0)
      if (it.tipo === 'conta') contas += v; else parcelas += v
    }
    return { mes, total: parcelas + contas, parcelas, contas }
  })
}

export type Marco = { mes: string; nomes: string[]; libera: number }

/**
 * Em que mês cada compromisso acaba e quanto isso libera por mês.
 * Agrupa o que acaba no mesmo mês. Só olha o que ainda não terminou.
 */
export function marcosDeQuitacao(itens: ItemCompromisso[], desde: string, max = 6): Marco[] {
  const porMes = new Map<string, Marco>()
  for (const it of itens) {
    if (it.pagas >= it.totalParcelas || it.cronograma.length === 0) continue
    const mes = it.cronograma[it.cronograma.length - 1].mes
    if (mes < desde) continue
    const m = porMes.get(mes) || { mes, nomes: [], libera: 0 }
    m.nomes.push(it.base)
    m.libera += it.valorParcela
    porMes.set(mes, m)
  }
  return Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(0, max)
}

/** Valor que a conta recorrente custa num mês (a linha do mês; senão, o valor-base dela). */
export function valorDaContaNoMes(c: ContaRec, mes: string): number {
  const linha = c.linhas.find(l => mesDe(l.purchase_date) === mes && l.status !== 'Cancelado')
  return Number(linha?.amount ?? c.template?.expected_amount ?? c.template?.amount) || 0
}
