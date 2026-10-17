import { addMonths, format, parseISO } from 'date-fns'
import { calcBillingMonth } from '@/lib/utils'
import { statusPorMes } from '@/lib/utils/parcelasCore'

/**
 * IMPORTAÇÃO EM MASSA DE LANÇAMENTOS
 *
 * Planilha (Excel ou CSV) → validação linha a linha → lançamentos no app.
 * Tudo aqui é lógica pura (sem Supabase, sem React) para ser testada sozinha.
 *
 * As regras de gravação espelham as da tela "Novo lançamento" — o mesmo cálculo
 * de fatura pelo fechamento do cartão, o mesmo status por mês, uma linha por
 * parcela — para um lançamento importado ser idêntico a um digitado à mão.
 *
 * Tipos aceitos: à vista, parcelada e receita. Conta recorrente fica de fora de
 * propósito: ela tem prazo, vigência e geração mensal, e isso vive em
 * Configurações → Contas recorrentes.
 */

/* ── Colunas do modelo ──────────────────────────────────────────── */

export type ChaveColuna =
  | 'tipo' | 'descricao' | 'valor' | 'data' | 'responsavel' | 'categoria' | 'subcategoria'
  | 'forma_pagamento' | 'conta_cartao' | 'parcelas' | 'parcelas_pagas' | 'fatura' | 'status' | 'observacao'

export type Coluna = {
  chave: ChaveColuna
  titulo: string
  obrigatoria: string // quando é obrigatória
  ajuda: string
  exemplo: [string, string, string] // à vista, parcelada, receita
  apelidos: string[]
}

export const COLUNAS: Coluna[] = [
  { chave: 'tipo', titulo: 'tipo', obrigatoria: 'sempre',
    ajuda: 'à vista, parcelada ou receita',
    exemplo: ['à vista', 'parcelada', 'receita'], apelidos: ['tipo_lancamento', 'tipo_de_lancamento'] },
  { chave: 'descricao', titulo: 'descricao', obrigatoria: 'sempre',
    ajuda: 'Nome do lançamento (loja, conta, quem pagou).',
    exemplo: ['EXEMPLO Mercado', 'EXEMPLO Sofá', 'EXEMPLO Salário'], apelidos: ['descrição', 'nome', 'estabelecimento', 'loja'] },
  { chave: 'valor', titulo: 'valor', obrigatoria: 'sempre',
    ajuda: 'Valor em R$. Na parcelada é o valor DE CADA PARCELA. Aceita 1234,56 ou 1.234,56.',
    exemplo: ['150,90', '300,00', '5000,00'], apelidos: ['valor_da_parcela', 'valor_parcela', 'preco', 'preço'] },
  { chave: 'data', titulo: 'data', obrigatoria: 'sempre',
    ajuda: 'dd/mm/aaaa. À vista: dia da compra. Parcelada: dia da compra original (parcela 1). Receita: dia do recebimento.',
    exemplo: ['13/07/2026', '20/06/2026', '05/07/2026'], apelidos: ['data_compra', 'data_da_compra', 'data_de_compra'] },
  { chave: 'responsavel', titulo: 'responsavel', obrigatoria: 'sempre',
    ajuda: 'Lucas, Nicoly ou Prata — de quem é o gasto (não é necessariamente o dono do cartão).',
    exemplo: ['Lucas', 'Nicoly', 'Lucas'], apelidos: ['responsável', 'titular', 'quem'] },
  { chave: 'categoria', titulo: 'categoria', obrigatoria: 'sempre',
    ajuda: 'Uma das categorias da aba Listas (despesa para à vista/parcelada, receita para receita).',
    exemplo: ['Alimentação', 'Roupas e Compras', 'Salário'], apelidos: [] },
  { chave: 'subcategoria', titulo: 'subcategoria', obrigatoria: 'nunca (opcional)',
    ajuda: 'Subcategoria da categoria escolhida (aba Listas). Pode ficar vazia.',
    exemplo: ['Mercado', '', ''], apelidos: ['sub_categoria', 'sub'] },
  { chave: 'forma_pagamento', titulo: 'forma_pagamento', obrigatoria: 'à vista',
    ajuda: 'cartão de crédito, débito, pix, boleto, dinheiro ou débito automático. Parcelada é sempre cartão de crédito. Receita ignora.',
    exemplo: ['cartão de crédito', 'cartão de crédito', ''], apelidos: ['forma', 'pagamento', 'meio_de_pagamento', 'como_pagou'] },
  { chave: 'conta_cartao', titulo: 'conta_cartao', obrigatoria: 'cartão, débito, pix e débito automático',
    ajuda: 'Igual a Configurações → Cartões e Contas, ex.: Santander — Lucas. Na receita é a conta onde caiu (opcional).',
    exemplo: ['Santander — Lucas', 'Santander — Nicoly', 'Santander — Lucas'], apelidos: ['cartao', 'cartão', 'conta', 'cartao_conta', 'cartão_conta'] },
  { chave: 'parcelas', titulo: 'parcelas', obrigatoria: 'parcelada',
    ajuda: 'Número TOTAL de parcelas (2 ou mais).',
    exemplo: ['', '6', ''], apelidos: ['n_parcelas', 'numero_de_parcelas', 'qtd_parcelas'] },
  { chave: 'parcelas_pagas', titulo: 'parcelas_pagas', obrigatoria: 'nunca (opcional)',
    ajuda: 'Parcelada antiga: quantas parcelas JÁ foram pagas. Vazio = o app decide pelo mês de cada parcela.',
    exemplo: ['', '2', ''], apelidos: ['ja_pagas', 'já_pagas', 'pagas'] },
  { chave: 'fatura', titulo: 'fatura', obrigatoria: 'nunca (opcional)',
    ajuda: 'Mês da fatura no app, no formato aaaa-mm (ex.: 2026-07). Vazio = calculado pela data e pelo dia de fechamento do cartão. Na parcelada vale para a parcela 1.',
    exemplo: ['', '', ''], apelidos: ['mes_fatura', 'mês_da_fatura', 'fatura_mes'] },
  { chave: 'status', titulo: 'status', obrigatoria: 'nunca (opcional)',
    ajuda: 'Pago, Pendente ou Previsto. Vazio = o app decide (fatura de mês passado = Pago).',
    exemplo: ['', '', ''], apelidos: ['situacao', 'situação'] },
  { chave: 'observacao', titulo: 'observacao', obrigatoria: 'nunca (opcional)',
    ajuda: 'Anotação livre.',
    exemplo: ['', '', ''], apelidos: ['observação', 'obs', 'notas'] },
]

/* ── Normalização ───────────────────────────────────────────────── */

export const semAcento = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/** "Santander - Lucas", "santander — lucas" e "Santander Lucas" viram a mesma chave. */
const chaveNome = (s: string) => semAcento(s).replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim()
const chaveCabecalho = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const vazio = (v: any) => v === null || v === undefined || String(v).trim() === ''

/** Aceita 150, "150,90", "1.234,56", "1234.56", "R$ 1.234,56". */
export function lerValor(v: any): number | null {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null
  if (vazio(v)) return null
  let s = String(v).replace(/R\$/gi, '').replace(/\s/g, '')
  if (!/^-?[\d.,]+$/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '') // 1.234.567
  const n = parseFloat(s)
  return isFinite(n) ? Math.round(n * 100) / 100 : null
}

function dataValida(a: number, m: number, d: number): string | null {
  if (!(a >= 2000 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(a, m - 1, d)
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd, data ISO do Excel ou Date → 'yyyy-MM-dd'. */
export function lerData(v: any): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : dataValida(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
  if (vazio(v)) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/)
  if (m) return dataValida(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/)
  if (m) return dataValida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  return null
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** 2026-07, 07/2026, jul/26, jul/2026 → '2026-07'. */
export function lerFatura(v: any): string | null {
  if (vazio(v)) return null
  const s = semAcento(String(v))
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${String(+m[2]).padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${String(+m[1]).padStart(2, '0')}`
  m = s.match(/^([a-z]{3})[a-z]*\/(\d{2}|\d{4})$/)
  if (m && MESES.includes(m[1])) return `${m[2].length === 2 ? 2000 + +m[2] : m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, '0')}`
  return null
}

export type TipoLinha = 'avista' | 'parcelada' | 'receita'
function lerTipo(v: any): TipoLinha | 'recorrente' | null {
  const s = semAcento(String(v ?? '')).replace(/\s+/g, '')
  if (['avista', 'vista', 'compra', 'despesa', 'gasto'].includes(s)) return 'avista'
  if (['parcelada', 'parcelado', 'parcelamento', 'financiamento'].includes(s)) return 'parcelada'
  if (['receita', 'entrada', 'recebimento'].includes(s)) return 'receita'
  if (['recorrente', 'fixa', 'fixo', 'assinatura'].includes(s)) return 'recorrente'
  return null
}

export type Forma = 'cartao_credito' | 'debito' | 'pix' | 'boleto' | 'dinheiro' | 'debito_automatico'
function lerForma(v: any): Forma | null {
  const s = semAcento(String(v ?? '')).replace(/\s+/g, ' ')
  if (['cartao de credito', 'cartao credito', 'credito', 'cartao', 'cc'].includes(s)) return 'cartao_credito'
  if (['debito', 'cartao de debito'].includes(s)) return 'debito'
  if (s === 'pix') return 'pix'
  if (s === 'boleto') return 'boleto'
  if (['dinheiro', 'especie'].includes(s)) return 'dinheiro'
  if (['debito automatico', 'debito em conta', 'debito auto'].includes(s)) return 'debito_automatico'
  return null
}

const PRECISA_CONTA: Forma[] = ['cartao_credito', 'debito', 'pix', 'debito_automatico']

/* ── Leitura de arquivo (CSV) ───────────────────────────────────── */

/** CSV tolerante: ; , ou tab, aspas, BOM, CRLF. */
export function lerCSV(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, '')
  const primeira = t.split(/\r?\n/, 1)[0] || ''
  const cont = (c: string) => (primeira.match(new RegExp(`\\${c}`, 'g')) || []).length
  const sep = cont(';') >= cont(',') && cont(';') >= cont('\t') ? ';' : cont('\t') > cont(',') ? '\t' : ','
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else aspas = false } else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some(x => x.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some(x => x.trim() !== '')) linhas.push(linha)
  return linhas
}

/* ── Contexto e tipos ───────────────────────────────────────────── */

export type CartaoInfo = { nome: string; fechamento: number; credito: boolean }
export type ExistenteTx = { description: string; purchase_date: string; amount: number; card_name?: string | null; installment_total?: number | null; holder?: string | null }

export type Contexto = {
  cartoes: CartaoInfo[]
  categorias: { despesa: string[]; receita: string[] }
  subcategorias: Record<string, string[]>
  existentes: ExistenteTx[]
  hojeMes: string // 'yyyy-MM'
  criarFaltantes: boolean
}

export type LinhaOk = {
  n: number
  tipo: TipoLinha
  descricao: string
  valor: number
  data: string
  holder: string
  categoria: string
  subcategoria: string | null
  forma: Forma | null
  conta: string | null
  parcelas: number | null
  pagas: number | null
  fatura: string | null
  status: 'Pago' | 'Pendente' | 'Previsto' | null
  obs: string | null
  cartaoFinal?: string | null // 4 últimos dígitos do cartão físico (importação de fatura)
  novaCategoria: boolean
  novaSub: boolean
  duplicada: boolean
}

export type Problema = { n: number; msg: string }
export type Validacao = {
  ok: LinhaOk[]
  erros: Problema[]
  avisos: Problema[]
  ignoradas: number
  colunasFaltando: string[]
}

const baseDaDescricao = (d: string) => (d || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()

/* ── Cabeçalho ──────────────────────────────────────────────────── */

export function mapearCabecalho(cab: any[]): { idx: Partial<Record<ChaveColuna, number>>; faltando: string[] } {
  const tabela = new Map<string, ChaveColuna>()
  for (const c of COLUNAS) {
    tabela.set(chaveCabecalho(c.titulo), c.chave)
    c.apelidos.forEach(a => tabela.set(chaveCabecalho(a), c.chave))
  }
  const idx: Partial<Record<ChaveColuna, number>> = {}
  cab.forEach((h, i) => { const k = tabela.get(chaveCabecalho(String(h ?? ''))); if (k && idx[k] === undefined) idx[k] = i })
  const obrigatorias: ChaveColuna[] = ['tipo', 'descricao', 'valor', 'data', 'responsavel', 'categoria']
  return { idx, faltando: obrigatorias.filter(k => idx[k] === undefined).map(k => COLUNAS.find(c => c.chave === k)!.titulo) }
}

/* ── Validação ──────────────────────────────────────────────────── */

function acharCartao(ctx: Contexto, v: string): CartaoInfo | null {
  const k = chaveNome(v)
  return ctx.cartoes.find(c => chaveNome(c.nome) === k) || null
}

function acharNaLista(lista: string[], v: string): string | null {
  const k = semAcento(v)
  return lista.find(x => semAcento(x) === k) || null
}

function sugestao(lista: string[], v: string): string {
  const k = semAcento(v)
  const parecidas = lista.filter(x => semAcento(x).includes(k) || k.includes(semAcento(x))).slice(0, 3)
  return parecidas.length ? ` Quis dizer: ${parecidas.join(', ')}?` : ''
}

const HOLDERS = ['Lucas', 'Nicoly', 'Prata']

/**
 * Valida todas as linhas. Não grava nada: devolve o que está pronto, o que tem
 * erro (com o número da linha na planilha) e o que merece atenção.
 */
export function validarPlanilha(linhas: any[][], ctx: Contexto): Validacao {
  const res: Validacao = { ok: [], erros: [], avisos: [], ignoradas: 0, colunasFaltando: [] }
  if (linhas.length === 0) { res.erros.push({ n: 0, msg: 'A planilha está vazia.' }); return res }

  const { idx, faltando } = mapearCabecalho(linhas[0])
  if (faltando.length) {
    res.colunasFaltando = faltando
    res.erros.push({ n: 1, msg: `Faltam colunas obrigatórias no cabeçalho: ${faltando.join(', ')}. Baixe o modelo para ver o formato.` })
    return res
  }
  const cel = (l: any[], k: ChaveColuna) => (idx[k] === undefined ? undefined : l[idx[k]!])

  // chaves já vistas (no app e no próprio arquivo) para achar lançamento repetido
  const chaveAvista = (d: string, data: string, v: number, conta: string | null) => `${semAcento(d)}|${data}|${v.toFixed(2)}|${chaveNome(conta || '')}`
  const chaveSerie = (d: string, v: number, n: number, conta: string | null) => `${semAcento(baseDaDescricao(d))}|${v.toFixed(2)}|${n}|${chaveNome(conta || '')}`
  const noApp = new Set<string>()
  for (const e of ctx.existentes) {
    if ((e.installment_total || 0) > 1) noApp.add('S|' + chaveSerie(e.description, Number(e.amount), e.installment_total!, e.card_name || null))
    else noApp.add('A|' + chaveAvista(e.description, e.purchase_date, Number(e.amount), e.card_name || null))
  }
  const noArquivo = new Set<string>()

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i]
    const n = i + 1 // número da linha na planilha (cabeçalho = 1)
    if (!l || l.every(c => vazio(c))) continue
    const desc = String(cel(l, 'descricao') ?? '').trim()
    if (/^exemplo\b/i.test(semAcento(desc))) { res.ignoradas++; continue } // linhas do modelo
    const erro = (msg: string) => res.erros.push({ n, msg })
    const aviso = (msg: string) => res.avisos.push({ n, msg })
    let temErro = false
    const falha = (msg: string) => { erro(msg); temErro = true }

    const tipo = lerTipo(cel(l, 'tipo'))
    if (tipo === 'recorrente') { falha('Conta recorrente não entra por planilha. Cadastre em Configurações → Contas recorrentes (dá para começar em mês passado).'); continue }
    if (!tipo) { falha(`Tipo "${cel(l, 'tipo') ?? ''}" não reconhecido. Use: à vista, parcelada ou receita.`); continue }

    if (!desc) falha('Descrição vazia.')
    const valor = lerValor(cel(l, 'valor'))
    if (valor === null || valor <= 0) falha(`Valor inválido ("${cel(l, 'valor') ?? ''}"). Use um número maior que zero, ex.: 150,90.`)
    const data = lerData(cel(l, 'data'))
    if (!data) falha(`Data inválida ("${cel(l, 'data') ?? ''}"). Use dd/mm/aaaa.`)

    const respBruto = String(cel(l, 'responsavel') ?? '').trim()
    const holder = HOLDERS.find(h => semAcento(h) === semAcento(respBruto)) || null
    if (!holder) falha(`Responsável "${respBruto}" não reconhecido. Use: Lucas, Nicoly ou Prata.`)

    // categoria / subcategoria
    const kind = tipo === 'receita' ? 'receita' : 'despesa'
    const catBruta = String(cel(l, 'categoria') ?? '').trim()
    let categoria = catBruta ? acharNaLista(ctx.categorias[kind], catBruta) : null
    let novaCategoria = false
    if (!catBruta) falha('Categoria vazia.')
    else if (!categoria) {
      if (ctx.criarFaltantes) { categoria = catBruta; novaCategoria = true; aviso(`Categoria nova "${catBruta}" será criada.`) }
      else falha(`Categoria "${catBruta}" não existe.${sugestao(ctx.categorias[kind], catBruta)}`)
    }
    const subBruta = String(cel(l, 'subcategoria') ?? '').trim()
    let subcategoria: string | null = null
    let novaSub = false
    if (subBruta && categoria) {
      const doApp = novaCategoria ? [] : (ctx.subcategorias[categoria] || [])
      const achada = acharNaLista(doApp, subBruta)
      if (achada) subcategoria = achada
      else if (ctx.criarFaltantes) { subcategoria = subBruta; novaSub = true; aviso(`Subcategoria nova "${subBruta}" em ${categoria} será criada.`) }
      else falha(`Subcategoria "${subBruta}" não existe em ${categoria}.${sugestao(doApp, subBruta)}`)
    }

    // forma e conta/cartão
    const formaBruta = cel(l, 'forma_pagamento')
    let forma: Forma | null = null
    const contaBruta = String(cel(l, 'conta_cartao') ?? '').trim()
    let conta: string | null = null
    if (tipo === 'parcelada') {
      forma = 'cartao_credito'
      if (!vazio(formaBruta) && lerForma(formaBruta) !== 'cartao_credito') falha('Compra parcelada é sempre no cartão de crédito.')
    } else if (tipo === 'avista') {
      if (vazio(formaBruta)) falha('Informe a forma de pagamento (cartão de crédito, débito, pix, boleto, dinheiro ou débito automático).')
      else { forma = lerForma(formaBruta); if (!forma) falha(`Forma de pagamento "${formaBruta}" não reconhecida.`) }
    }
    const precisaConta = tipo === 'parcelada' || (tipo === 'avista' && forma !== null && PRECISA_CONTA.includes(forma))
    if (precisaConta || (tipo === 'receita' && contaBruta)) {
      if (!contaBruta) falha('Informe a conta ou o cartão (igual a Configurações → Cartões e Contas).')
      else {
        const c = acharCartao(ctx, contaBruta)
        if (!c) falha(`Conta/cartão "${contaBruta}" não existe. Cadastrados: ${ctx.cartoes.map(x => x.nome).join('; ')}.`)
        else {
          conta = c.nome
          if (forma === 'cartao_credito' && !c.credito) falha(`"${c.nome}" não é cartão de crédito.`)
        }
      }
    }

    // parcelas / fatura / status
    let parcelas: number | null = null, pagas: number | null = null
    if (tipo === 'parcelada') {
      const p = lerValor(cel(l, 'parcelas'))
      if (p === null || !Number.isInteger(p) || p < 2 || p > 600) falha(`Parcelas inválidas ("${cel(l, 'parcelas') ?? ''}"). Informe o total de parcelas (2 ou mais).`)
      else parcelas = p
      if (!vazio(cel(l, 'parcelas_pagas'))) {
        const pg = lerValor(cel(l, 'parcelas_pagas'))
        if (pg === null || !Number.isInteger(pg) || pg < 0) falha(`parcelas_pagas inválido ("${cel(l, 'parcelas_pagas')}").`)
        else if (parcelas !== null && pg > parcelas) falha(`parcelas_pagas (${pg}) maior que o total de parcelas (${parcelas}).`)
        else pagas = pg
      }
    }
    let fatura: string | null = null
    if (!vazio(cel(l, 'fatura'))) {
      fatura = lerFatura(cel(l, 'fatura'))
      if (!fatura) falha(`Fatura "${cel(l, 'fatura')}" inválida. Use aaaa-mm, ex.: 2026-07.`)
      else if (forma !== 'cartao_credito') { aviso('Coluna "fatura" só vale para cartão de crédito — ignorada.'); fatura = null }
    }
    let status: LinhaOk['status'] = null
    if (!vazio(cel(l, 'status'))) {
      const s = semAcento(String(cel(l, 'status')))
      status = s === 'pago' ? 'Pago' : s === 'pendente' ? 'Pendente' : s === 'previsto' ? 'Previsto' : null
      if (!status) falha(`Status "${cel(l, 'status')}" inválido. Use Pago, Pendente ou Previsto.`)
    }

    if (temErro || valor === null || !data || !holder || !categoria) continue

    // repetidos (já no app ou duas vezes no arquivo)
    const chave = tipo === 'parcelada'
      ? 'S|' + chaveSerie(desc, valor, parcelas!, conta)
      : 'A|' + chaveAvista(desc, data, valor, conta)
    let duplicada = false
    if (noApp.has(chave)) { duplicada = true; aviso(`Parece que "${desc}" já existe no app (mesma descrição, valor${tipo === 'parcelada' ? ' e nº de parcelas' : ' e data'}). Será pulada.`) }
    else if (noArquivo.has(chave)) { duplicada = true; aviso(`"${desc}" aparece repetida na planilha (mesma linha idêntica). A segunda será pulada.`) }
    noArquivo.add(chave)

    res.ok.push({
      n, tipo, descricao: desc, valor, data, holder, categoria, subcategoria,
      forma, conta, parcelas, pagas, fatura, status,
      obs: String(cel(l, 'observacao') ?? '').trim() || null,
      novaCategoria, novaSub, duplicada,
    })
  }
  return res
}

/* ── Montagem dos lançamentos ───────────────────────────────────── */

const primeiroDiaDoMes = (ym: string) => `${ym}-01`
const mesDeData = (d: string) => d.slice(0, 7)
const somaMesesYM = (ym: string, n: number) => format(addMonths(parseISO(`${ym}-01`), n), 'yyyy-MM')

/**
 * Transforma uma linha validada em lançamentos (1 para à vista/receita,
 * N para parcelada), com os mesmos campos que a tela "Novo lançamento" grava.
 */
export function montarLancamentos(
  l: LinhaOk,
  ctx: { cartoes: CartaoInfo[]; hojeMes: string },
  base: { owner_id: string; import_batch: string },
): Record<string, any>[] {
  const ownerName = l.holder === 'Prata' ? 'Lucas' : l.holder
  const fechamentoDe = (nome: string | null) => ctx.cartoes.find(c => c.nome === nome)?.fechamento || 1
  const comum = {
    owner_id: base.owner_id, owner_name: ownerName, holder: l.holder,
    category: l.categoria, subcategory: l.subcategoria, notes: l.obs,
    import_batch: base.import_batch,
    // só entra quando informado: planilhas não mandam e não dependem da coluna card_final
    ...(l.cartaoFinal ? { card_final: l.cartaoFinal } : {}),
  }
  // Pago sempre carrega data e valor pagos — sem isso o app não sabe quando saiu
  const comPagamento = (linha: Record<string, any>) =>
    linha.status === 'Pago' ? { ...linha, paid_date: linha.paid_date ?? linha.purchase_date, paid_amount: linha.paid_amount ?? linha.amount } : linha

  if (l.tipo === 'receita') {
    return [comPagamento({
      ...comum, transaction_type: 'receita', type: 'Receita',
      description: l.descricao, amount: l.valor, expected_amount: null,
      purchase_date: l.data, received_account: l.conta, is_recurring: false,
      status: l.status || 'Pago',
    })]
  }

  if (l.tipo === 'avista') {
    const credito = l.forma === 'cartao_credito'
    const billingYM = credito
      ? (l.fatura || format(calcBillingMonth(parseISO(l.data), fechamentoDe(l.conta)), 'yyyy-MM'))
      : null
    // Mesma regra da tela: pix/débito/dinheiro já saíram da conta; crédito só quando
    // a fatura de um mês passado foi paga; boleto e débito automático ficam a pagar.
    const padrao = ['pix', 'dinheiro', 'debito'].includes(l.forma!) ? 'Pago'
      : credito ? statusPorMes(billingYM!, ctx.hojeMes)
      : 'Pendente'
    return [comPagamento({
      ...comum, transaction_type: 'avista', type: 'Despesa',
      description: l.descricao, amount: l.valor, purchase_date: l.data,
      payment_method: l.forma, card_name: PRECISA_CONTA.includes(l.forma!) ? l.conta : null,
      billing_month: billingYM ? primeiroDiaDoMes(billingYM) : null,
      status: l.status || padrao,
    })]
  }

  // parcelada: uma linha por parcela, como a tela de novo lançamento
  const n = l.parcelas!
  const linhas: Record<string, any>[] = []
  for (let p = 1; p <= n; p++) {
    const dataP = format(addMonths(parseISO(l.data), p - 1), 'yyyy-MM-dd')
    const billingYM = l.fatura ? somaMesesYM(l.fatura, p - 1) : format(calcBillingMonth(parseISO(dataP), fechamentoDe(l.conta)), 'yyyy-MM')
    // com "fatura" informada, o mês que manda é o da fatura; sem ela, o da data da parcela
    let status: string = statusPorMes(l.fatura ? billingYM : mesDeData(dataP), ctx.hojeMes)
    if (l.pagas !== null) {
      if (p <= l.pagas) status = 'Pago'
      else if (status === 'Pago') status = 'Pendente'
    }
    if (l.status && l.pagas === null) status = l.status
    linhas.push(comPagamento({
      ...comum, transaction_type: 'parcelada', type: 'Despesa',
      description: `${l.descricao} (${p}/${n})`, amount: l.valor, purchase_date: dataP,
      payment_method: 'cartao_credito', card_name: l.conta, billing_month: primeiroDiaDoMes(billingYM), status,
      installment_total: n, installment_value: l.valor, installment_num: p, has_entry: false,
    }))
  }
  return linhas
}

/** Quanto vai entrar em cada fatura/mês — para conferir com o total da fatura do banco. */
export function resumoPorFatura(lancamentos: Record<string, any>[]) {
  const mapa = new Map<string, { onde: string; mes: string; total: number; qtd: number }>()
  for (const x of lancamentos) {
    if (x.type === 'Receita') continue
    const mes = (x.billing_month || x.purchase_date || '').slice(0, 7)
    const onde = x.card_name || (x.payment_method ? String(x.payment_method).replace('_', ' ') : 'sem conta')
    const k = `${mes}|${onde}`
    const a = mapa.get(k) || { onde, mes, total: 0, qtd: 0 }
    a.total += Number(x.amount) || 0
    a.qtd++
    mapa.set(k, a)
  }
  return Array.from(mapa.values()).map(a => ({ ...a, total: Math.round(a.total * 100) / 100 }))
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.onde.localeCompare(b.onde))
}

/* ── Modelo para baixar ─────────────────────────────────────────── */

export function linhasDoModelo(): { cabecalho: string[]; exemplos: string[][] } {
  return {
    cabecalho: COLUNAS.map(c => c.titulo),
    exemplos: [0, 1, 2].map(i => COLUNAS.map(c => c.exemplo[i])),
  }
}

/** Aba "Como preencher": uma linha por coluna. */
export function linhasDeAjuda(): string[][] {
  return [
    ['Como preencher', '', ''],
    ['• Uma linha por lançamento. Apague as 3 linhas de exemplo (as que começam com EXEMPLO são ignoradas, mas apague mesmo assim).', '', ''],
    ['• Tipos: à vista, parcelada e receita. Conta recorrente fica em Configurações → Contas recorrentes.', '', ''],
    ['• Antes de importar, o app confere tudo e mostra o que está errado — nada é gravado até você confirmar.', '', ''],
    ['', '', ''],
    ['coluna', 'obrigatória em', 'o que colocar'],
    ...COLUNAS.map(c => [c.titulo, c.obrigatoria, c.ajuda]),
  ]
}

/** Aba "Listas": categorias, subcategorias, cartões — sempre as de hoje. */
export function linhasDasListas(ctx: { categorias: { despesa: string[]; receita: string[] }; subcategorias: Record<string, string[]>; cartoes: CartaoInfo[] }): string[][] {
  const subs: [string, string][] = []
  Object.entries(ctx.subcategorias).forEach(([c, ss]) => ss.forEach(s => subs.push([c, s])))
  const alturas = Math.max(ctx.categorias.despesa.length, ctx.categorias.receita.length, subs.length, ctx.cartoes.length, 6)
  const linhas: string[][] = [['categoria (despesa)', 'categoria (receita)', 'categoria da subcategoria', 'subcategoria', 'conta_cartao', 'tipo da conta', 'responsavel', 'forma_pagamento', 'tipo']]
  const resp = HOLDERS, formas = ['cartão de crédito', 'débito', 'pix', 'boleto', 'dinheiro', 'débito automático'], tipos = ['à vista', 'parcelada', 'receita']
  for (let i = 0; i < alturas; i++) {
    linhas.push([
      ctx.categorias.despesa[i] || '', ctx.categorias.receita[i] || '',
      subs[i]?.[0] || '', subs[i]?.[1] || '',
      ctx.cartoes[i]?.nome || '', ctx.cartoes[i] ? (ctx.cartoes[i].credito ? 'crédito' : 'débito/conta') : '',
      resp[i] || '', formas[i] || '', tipos[i] || '',
    ])
  }
  return linhas
}
