import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { FaturaLida, LancFatura } from '@/lib/utils/faturaPdf'
import type { LinhaOk } from '@/lib/utils/importacao'
import { semAcento } from '@/lib/utils/importacao'

/**
 * IMPORTAÇÃO DE FATURA — a parte que decide o que fazer com cada linha do PDF.
 *
 * Para cada linha da fatura o app responde três perguntas:
 *   1. É uma compra PARCELADA? Se a série já existe no app, não lança de novo.
 *   2. É uma compra que EU JÁ lancei à mão? Mesmo valor e mesma data → já existe;
 *      mesmo valor e data parecida → pergunta; senão → é nova.
 *   3. Que NOME e CATEGORIA usar? O que você já escolheu da última vez para esse
 *      estabelecimento; se for a primeira vez, uma sugestão.
 *
 * Tudo puro (sem Supabase, sem React) para ser testado com as faturas reais.
 */

/* ── Tipos ──────────────────────────────────────────────────────── */

export type CartaoApp = { nome: string; banco: string; holder: string; fechamento: number; credito: boolean }

export type ExistenteFull = {
  id?: string
  description: string
  purchase_date: string
  amount: number
  card_name?: string | null
  installment_total?: number | null
  installment_num?: number | null
  billing_month?: string | null
  holder?: string | null
}

export type Alias = { chave: string; nome: string; categoria: string; subcategoria: string | null; responsavel: string | null }

export type Situacao = 'nova' | 'ja_existe' | 'talvez'

export type LinhaFatura = {
  id: string
  tipo: 'parcelada' | 'avista'
  cartao: string | null          // nome do cartão no app (null = não achei)
  titularLido: string
  final: string                  // últimos 4 dígitos do cartão físico no PDF
  descBanco: string
  descricoesBanco: string[]       // nomes originais no banco (vários, quando agrupou)
  chave: string
  data: string                   // 'yyyy-MM-dd' (parcelada: compra original; à vista: última data do grupo)
  valor: number                  // parcelada: valor da parcela; à vista: soma do grupo
  qtd: number                    // quantas compras do banco viraram esta linha
  periodo: string | null         // 'dd/mm–dd/mm' quando agrupou
  parcela: { x: number; y: number } | null
  faturaPrimeira: string | null  // parcelada: mês da fatura da parcela 1
  situacao: Situacao
  achado: { desc: string; data: string; valor: number; motivo: string; id?: string; serie?: { cartao: string; y: number; base: string; valor: number } } | null
  nome: string
  categoria: string
  subcategoria: string
  responsavel: string
  incluir: boolean
  origem: 'aprendida' | 'sugerida' | 'padrao'
}

/* ── Normalização do estabelecimento ────────────────────────────── */

/** Agrupa variações do mesmo estabelecimento (99, Uber, Apple...). */
export function nomeAgrupado(desc: string): string {
  const d = desc.replace(/\s+/g, ' ').trim()
  const u = d.toUpperCase()
  if (u.startsWith('99FOOD')) return '99Food'
  if (/^99\s?\*/.test(u) || u === '99*') return '99 (corridas)'
  if (u.includes('UBERRIDES') || u.startsWith('UBER * PENDING')) return 'Uber'
  if (u.includes('UBER *ONE')) return 'Uber One (assinatura)'
  if (u.startsWith('APPLE COM/BILL')) return 'APPLE COM/BILL'
  if (u.startsWith('CONTA VIVO')) return 'Conta Vivo'
  return d
}

export const chaveEstabelecimento = (desc: string) =>
  semAcento(nomeAgrupado(desc)).replace(/[^a-z0-9]+/g, ' ').trim()

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o'])
/** SUPERMERCADOS JOANIN → Supermercados Joanin (códigos como LJ12 e siglas curtas ficam como estão). */
export function nomeBonito(desc: string): string {
  const base = nomeAgrupado(desc)
  if (base !== desc.replace(/\s+/g, ' ').trim()) return base // já veio com nome amigável (99Food, Uber...)
  return base.split(' ').map((p, i) => {
    if (/\d/.test(p) || p.length <= 2 || /[*/]/.test(p)) return p
    const l = p.toLowerCase()
    if (i > 0 && MINUSCULAS.has(l)) return l
    return l.charAt(0).toUpperCase() + l.slice(1)
  }).join(' ')
}

/** Categoria quando o estabelecimento nunca foi visto: regras simples por palavra. */
const REGRAS: [RegExp, string, string][] = [
  [/99food|ifd\*ifood|ifood/, 'Alimentação', 'Delivery'],
  [/^99 \(corridas\)|^uber$/, 'Transporte', 'Uber / 99'],
  [/uber one|apple com|spotify|netflix|disney|hbo|prime video/, 'Lazer e Entretenimento', 'Assinaturas'],
  [/tokio marine|porto seguro|seguro auto/, 'Transporte', 'Seguro Veículo'],
  [/posto|ethanol|shell|ipiranga/, 'Transporte', 'Combustível'],
  [/wellhub|gympass|smartfit|academia/, 'Cuidados Pessoais', 'Academia'],
  [/drogaria|farmacia|drogasil|pacheco|raia/, 'Saúde', 'Farmácia'],
  [/podologia|estetica|clinica/, 'Cuidados Pessoais', 'Procedimentos'],
  [/zig\*|zigpay|bar do|boteco|bares/, 'Lazer e Entretenimento', 'Eventos'],
  [/estacion|park e vem|consor estac/, 'Transporte', 'Estacionamento'],
  [/uniso|faculdade|universidade|curso/, 'Educação', ''],
  [/assai|supermercado|mercearia|mini extra|tenda atacado|rede campeao|grteixeira|naudirfrutas|queiroz|garapa|carrefour|atacadao/, 'Alimentação', 'Mercado'],
  [/camarao|majestosa|casalmoco|gastronomi|burger|burguer|razza|pedacos|restaurante|padoka|panificadora|padaria|gran coffee|cafe|acai|sorvet|pizza|lanches?/, 'Alimentação', 'Restaurante'],
]
export function categoriaPadrao(desc: string): { categoria: string; subcategoria: string } | null {
  const k = semAcento(nomeAgrupado(desc))
  for (const [rx, c, s] of REGRAS) if (rx.test(k)) return { categoria: c, subcategoria: s }
  return null
}

/* ── Mês da fatura e datas ──────────────────────────────────────── */

const dd = (s: string) => parseInt(s.slice(0, 2), 10)
const mm = (s: string) => parseInt(s.slice(3, 5), 10)
const pad = (n: number) => String(n).padStart(2, '0')

/** O PDF só traz dia/mês. O ano é o mais recente que não cai no futuro. */
function dataRecente(dm: string, hoje: Date): Date {
  const y = hoje.getFullYear()
  const d = new Date(y, mm(dm) - 1, dd(dm), 12)
  return d.getTime() > hoje.getTime() + 86400000 ? new Date(y - 1, mm(dm) - 1, dd(dm), 12) : d
}

/**
 * Mês da fatura = mês da compra mais recente (a fatura fecha logo depois dela).
 * É só a sugestão: a tela deixa mudar.
 */
export function sugerirMesFatura(lida: FaturaLida, hoje = new Date()): string {
  let melhor: Date | null = null
  for (const c of lida.cartoes) for (const x of c.despesas) {
    const d = dataRecente(x.data, hoje)
    if (!melhor || d > melhor) melhor = d
  }
  if (!melhor) for (const c of lida.cartoes) for (const x of c.parcelas) {
    const d = dataRecente(x.data, hoje); if (!melhor || d > melhor) melhor = d
  }
  return format(melhor || hoje, 'yyyy-MM')
}

/** Data de uma compra à vista, dado o mês da fatura (dezembro numa fatura de janeiro é do ano anterior). */
function dataDaCompra(dm: string, faturaYM: string): string {
  const [fy, fm] = faturaYM.split('-').map(Number)
  const y = mm(dm) > fm ? fy - 1 : fy
  return `${y}-${pad(mm(dm))}-${pad(dd(dm))}`
}

/** Compra original de uma parcela: a data cujo mês fica mais perto da fatura da parcela 1. */
function dataOriginalDaParcela(dm: string, faturaPrimeira: string): string {
  const [fy, fm] = faturaPrimeira.split('-').map(Number)
  const meio = new Date(fy, fm - 1, 15, 12)
  const cand = [fy - 1, fy, fy + 1].map(y => new Date(y, mm(dm) - 1, dd(dm), 12))
  cand.sort((a, b) => Math.abs(a.getTime() - meio.getTime()) - Math.abs(b.getTime() - meio.getTime()))
  return format(cand[0], 'yyyy-MM-dd')
}

const somaMesesYM = (ym: string, n: number) => format(addMonths(parseISO(`${ym}-01`), n), 'yyyy-MM')

/* ── O que já existe no app ─────────────────────────────────────── */

function serieDe(e: ExistenteFull): { num: number; total: number } | null {
  const m = (e.description || '').match(/\((\d+)\/(\d+)\)\s*$/)
  const total = e.installment_total ?? (m ? +m[2] : null)
  const num = e.installment_num ?? (m ? +m[1] : null)
  return total && total > 1 && num ? { num, total } : null
}

function acharSerie(ex: ExistenteFull[], cartao: string, y: number, valor: number, dataOriginal: string): { exato: boolean; desc: string } | null {
  let provavel: ExistenteFull | null = null
  for (const e of ex) {
    if (e.card_name !== cartao) continue
    const s = serieDe(e)
    if (!s || s.total !== y || Math.abs(Number(e.amount) - valor) > 0.05) continue
    const base = format(addMonths(parseISO(e.purchase_date), -(s.num - 1)), 'yyyy-MM-dd')
    // mesmo dia e mês da compra original → é a mesma série (o ano nem precisa bater)
    if (base.slice(5) === dataOriginal.slice(5)) return { exato: true, desc: (e.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '') }
    provavel = provavel || e
  }
  return provavel ? { exato: false, desc: (provavel.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '') } : null
}

/* ── Montagem das linhas ────────────────────────────────────────── */

export type OpcoesFatura = {
  banco: string
  faturaYM: string            // 'yyyy-MM' — mês da fatura no app
  cartoes: CartaoApp[]
  existentes: ExistenteFull[]
  aliases: Alias[]
  agrupar: boolean
  hoje?: Date
}

export function prepararLinhas(lida: FaturaLida, op: OpcoesFatura): LinhaFatura[] {
  const out: LinhaFatura[] = []
  const aliasPorChave = new Map(op.aliases.map(a => [a.chave, a]))
  const usados = new Set<string>() // linhas existentes já casadas (uma por compra)
  let seq = 0

  const sugestao = (descBanco: string, holderPadrao: string) => {
    const chave = chaveEstabelecimento(descBanco)
    const al = aliasPorChave.get(chave)
    if (al) return { chave, nome: al.nome, categoria: al.categoria, subcategoria: al.subcategoria || '', responsavel: al.responsavel || holderPadrao, origem: 'aprendida' as const }
    const pad_ = categoriaPadrao(descBanco)
    return {
      chave, nome: nomeBonito(descBanco), responsavel: holderPadrao,
      categoria: pad_?.categoria || 'Outros', subcategoria: pad_?.subcategoria || '',
      origem: pad_ ? ('sugerida' as const) : ('padrao' as const),
    }
  }

  for (const c of lida.cartoes) {
    const app = op.cartoes.find(a => semAcento(a.banco) === semAcento(op.banco) && semAcento(a.holder) === semAcento(c.primeiroNome)) || null
    const cartao = app?.nome || null
    const exCartao = app ? op.existentes.filter(e => e.card_name === app.nome) : []
    const holder = app?.holder || c.primeiroNome

    // ── parceladas
    for (const p of c.parcelas) {
      if (!p.parcela) continue
      const { x, y } = p.parcela
      const faturaPrimeira = somaMesesYM(op.faturaYM, -(x - 1))
      const data = dataOriginalDaParcela(p.data, faturaPrimeira)
      const s = sugestao(p.desc, holder)
      const achada = app ? acharSerie(exCartao, app.nome, y, p.valor, data) : null
      out.push({
        id: `p${seq++}`, tipo: 'parcelada', cartao, titularLido: c.titular, final: c.final, descBanco: p.desc, descricoesBanco: [p.desc], chave: s.chave,
        data, valor: p.valor, qtd: 1, periodo: null, parcela: p.parcela, faturaPrimeira,
        situacao: achada ? (achada.exato ? 'ja_existe' : 'talvez') : 'nova',
        achado: achada ? { desc: achada.desc, data, valor: p.valor, serie: { cartao: app!.nome, y, base: achada.desc, valor: p.valor }, motivo: achada.exato ? 'mesma compra parcelada (valor, nº de parcelas e data)' : 'mesmo valor e nº de parcelas, mas com outra data' } : null,
        nome: s.nome, categoria: s.categoria, subcategoria: s.subcategoria, responsavel: s.responsavel,
        incluir: !achada && !!cartao, origem: s.origem,
      })
    }

    // ── à vista (agrupando o mesmo estabelecimento, se pedido)
    const grupos = new Map<string, LancFatura[]>()
    for (const d of c.despesas) {
      const k = op.agrupar ? nomeAgrupado(d.desc) : `${d.desc}#${grupos.size}`
      grupos.set(k, [...(grupos.get(k) || []), d])
    }
    for (const [, itens] of Array.from(grupos.entries())) {
      const datas = itens.map(i => dataDaCompra(i.data, op.faturaYM)).sort()
      const ultima = datas[datas.length - 1]
      const valor = Math.round(itens.reduce((sm, i) => sm + i.valor, 0) * 100) / 100
      const descBanco = itens[0].desc
      const s = sugestao(descBanco, holder)
      const periodo = itens.length > 1 ? `${datas[0].slice(8)}/${datas[0].slice(5, 7)}–${ultima.slice(8)}/${ultima.slice(5, 7)}` : null

      // procura uma compra igual já lançada à mão: mesmo valor; melhor a de data mais próxima
      let melhor: { e: ExistenteFull; dif: number } | null = null
      for (const e of exCartao) {
        if (serieDe(e) || (e.id && usados.has(e.id))) continue
        if (Math.abs(Number(e.amount) - valor) > 0.005) continue
        const dif = Math.abs(differenceInCalendarDays(parseISO(e.purchase_date), parseISO(ultima)))
        if (!melhor || dif < melhor.dif) melhor = { e, dif }
      }
      let situacao: Situacao = 'nova'
      let achado: LinhaFatura['achado'] = null
      if (melhor && melhor.dif <= 4) {
        situacao = melhor.dif === 0 ? 'ja_existe' : 'talvez'
        if (melhor.e.id) usados.add(melhor.e.id)
        achado = {
          id: melhor.e.id, desc: melhor.e.description, data: melhor.e.purchase_date, valor: Number(melhor.e.amount),
          motivo: melhor.dif === 0 ? 'mesmo valor e mesma data' : `mesmo valor, data ${melhor.dif} dia${melhor.dif > 1 ? 's' : ''} diferente`,
        }
      }
      out.push({
        id: `a${seq++}`, tipo: 'avista', cartao, titularLido: c.titular, final: c.final, descBanco, descricoesBanco: Array.from(new Set(itens.map(i => i.desc))), chave: s.chave,
        data: ultima, valor, qtd: itens.length, periodo, parcela: null, faturaPrimeira: null,
        situacao, achado, nome: s.nome, categoria: s.categoria, subcategoria: s.subcategoria, responsavel: s.responsavel,
        incluir: situacao === 'nova' && !!cartao, origem: s.origem,
      })
    }
  }
  return out
}

/* ── Conferência com o total do PDF ─────────────────────────────── */

export type ConferenciaCartao = { cartao: string; final: string; totalPdf: number; jaNoApp: number; aLancar: number; fora: number }

/** Total do PDF = o que já está no app + o que vai entrar + o que você deixou de fora. */
export function conferencia(lida: FaturaLida, linhas: LinhaFatura[]): ConferenciaCartao[] {
  return lida.cartoes.map(c => {
    const minhas = linhas.filter(l => l.final === c.final)
    const soma = (f: (l: LinhaFatura) => boolean) => Math.round(minhas.filter(f).reduce((s, l) => s + l.valor, 0) * 100) / 100
    return {
      cartao: c.primeiroNome, final: c.final, totalPdf: c.soma,
      aLancar: soma(l => l.incluir),
      jaNoApp: soma(l => !l.incluir && l.situacao !== 'nova'), // casou com algo que já existe e você aceitou pular
      fora: soma(l => !l.incluir && l.situacao === 'nova'),    // linha nova que você tirou da lista
    }
  })
}

/* ── De linhas da fatura para lançamentos ───────────────────────── */

/**
 * Anotação do lançamento: o nome ORIGINAL do banco fica guardado, mesmo que você
 * renomeie a compra na tela (ex.: "SUPERMERCADOS JOANIN" → "Mercado do bairro").
 * Quando juntou várias compras, entram os nomes de cada uma.
 */
export function anotacaoDaLinha(l: LinhaFatura): string {
  const nomes = (l.descricoesBanco && l.descricoesBanco.length ? l.descricoesBanco : [l.descBanco]).join(' · ')
  const extra = l.qtd > 1 ? ` (${l.qtd} compras, ${l.periodo})` : ''
  const txt = `Nome na fatura: ${nomes}${extra}`
  return txt.length > 300 ? txt.slice(0, 299) + '…' : txt
}

/** Linhas escolhidas → o mesmo formato que a importação por planilha já grava. */
export function paraLinhasOk(linhas: LinhaFatura[], faturaYM: string): LinhaOk[] {
  const ok: LinhaOk[] = []
  linhas.filter(l => l.incluir && l.cartao).forEach((l, i) => {
    const comum = {
      n: i + 1, descricao: l.nome.trim() || l.descBanco, valor: l.valor, data: l.data,
      holder: l.responsavel, categoria: l.categoria, subcategoria: l.subcategoria || null, cartaoFinal: l.final,
      forma: 'cartao_credito' as const, conta: l.cartao, status: null, novaCategoria: false, novaSub: false, duplicada: false,
      obs: anotacaoDaLinha(l),
    }
    if (l.tipo === 'parcelada') {
      ok.push({ ...comum, tipo: 'parcelada', parcelas: l.parcela!.y, pagas: null, fatura: l.faturaPrimeira })
    } else {
      ok.push({ ...comum, tipo: 'avista', parcelas: null, pagas: null, fatura: faturaYM })
    }
  })
  return ok
}

/* ── Cartão físico das compras que já existiam ──────────────────── */

export type AtualizacaoFisico =
  | { kind: 'id'; id: string; final: string }
  | { kind: 'serie'; cartao: string; y: number; base: string; valor: number; final: string }

/**
 * Compras do PDF que casaram com algo que você já tinha lançado (e foram puladas)
 * ganham o cartão físico — assim o resumo por cartão fica completo, não só nas novas.
 */
export function atualizacoesCartaoFisico(linhas: LinhaFatura[], respostas: Record<string, 'mesma' | 'outra'>): AtualizacaoFisico[] {
  const ups: AtualizacaoFisico[] = []
  for (const l of linhas) {
    if (l.incluir || !l.achado || !l.cartao) continue
    const mesma = l.situacao === 'ja_existe' || (l.situacao === 'talvez' && respostas[l.id] === 'mesma')
    if (!mesma) continue
    if (l.tipo === 'avista' && l.achado.id) ups.push({ kind: 'id', id: l.achado.id, final: l.final })
    else if (l.tipo === 'parcelada' && l.achado.serie) ups.push({ kind: 'serie', ...l.achado.serie, final: l.final })
  }
  return ups
}
