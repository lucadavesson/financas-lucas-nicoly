/**
 * LEITURA DE FATURA EM PDF (Santander)
 *
 * O PDF da fatura é texto, não imagem — então dá para ler exatamente, sem OCR e
 * sem enviar nada para fora do celular. Duas camadas, ambas puras (sem React,
 * sem pdf.js) para serem testadas com os PDFs reais:
 *
 *   1. linhasDasPaginas: o PDF é impresso em DUAS COLUNAS; as palavras chegam com
 *      posição (x, y). Aqui elas viram linhas de texto, coluna da esquerda
 *      primeiro, depois a da direita — a ordem em que a fatura realmente lê.
 *   2. interpretarFatura: percorre as linhas e separa, por cartão, as compras
 *      parceladas, as demais despesas e os créditos, conferindo a soma com o
 *      "VALOR TOTAL" de cada cartão e com o "Saldo desta fatura".
 */

export type ItemPdf = { str: string; x: number; y: number; w: number }
export type PaginaPdf = { width: number; items: ItemPdf[] }

/** Junta as palavras de uma coluna em linhas, de cima para baixo. */
function linhasDaColuna(items: ItemPdf[]): string[] {
  const uteis = items.filter(i => i.str && i.str.trim() !== '')
  uteis.sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: ItemPdf[][] = []
  for (const it of uteis) {
    const ultima = linhas[linhas.length - 1]
    // mesma linha = mesma altura (tolerância de 2 pt)
    if (ultima && Math.abs(ultima[0].y - it.y) <= 2) ultima.push(it)
    else linhas.push([it])
  }
  return linhas.map(l => {
    l.sort((a, b) => a.x - b.x)
    let txt = ''
    let fimAnterior = -Infinity
    for (const it of l) {
      // palavras coladas (lacuna pequena) não ganham espaço no meio
      txt += (txt && it.x - fimAnterior > 1.2 ? ' ' : '') + it.str.trim()
      fimAnterior = it.x + (it.w || 0)
    }
    return txt.replace(/\s+/g, ' ').trim()
  }).filter(Boolean)
}

/** Páginas em duas colunas → linhas na ordem de leitura (esquerda, depois direita). */
export function linhasDasPaginas(paginas: PaginaPdf[]): string[] {
  const todas: string[] = []
  for (const p of paginas) {
    const corte = p.width / 2
    todas.push(...linhasDaColuna(p.items.filter(i => i.x < corte)))
    todas.push(...linhasDaColuna(p.items.filter(i => i.x >= corte)))
  }
  return todas
}

/* ── Interpretação ──────────────────────────────────────────────── */

export type LancFatura = {
  data: string                          // 'dd/mm', como no PDF
  desc: string
  parcela: { x: number; y: number } | null // 'x de y' quando é compra parcelada
  valor: number
}

export type CartaoFatura = {
  titular: string        // nome impresso, ex.: 'LUCAS D S SANTOS'
  primeiroNome: string   // 'Lucas'
  final: string          // últimos 4 dígitos do cartão
  parcelas: LancFatura[]
  despesas: LancFatura[]
  creditos: LancFatura[]
  total: number | null   // "VALOR TOTAL" impresso para este cartão
  soma: number           // parcelas + despesas lidas
  confere: boolean
}

export type FaturaLida = {
  cartoes: CartaoFatura[]
  totalFatura: number | null   // "Saldo desta fatura", quando a página de resumo está no arquivo
  soma: number
  confere: boolean
}

const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'))
const CARTAO = /^@?\s*([A-ZÀ-Ú][A-ZÀ-Ú .']+?) - (\d{4}) XXXX XXXX (\d{4})/
const ITEM = /^(?:\d\s+)?(\d{2}\/\d{2})\s+(.+?)\s+(?:(\d{2}\/\d{2})\s+)?(-?[\d.]+,\d{2})$/

const primeiroNomeDe = (titular: string) => {
  const n = titular.trim().split(/\s+/)[0] || ''
  return n.charAt(0) + n.slice(1).toLowerCase()
}

export function interpretarFatura(linhas: string[]): FaturaLida {
  const cartoes: CartaoFatura[] = []
  let atual: CartaoFatura | null = null
  let secao: 'cred' | 'parc' | 'desp' | null = null
  let noResumo = false
  let totalFatura: number | null = null

  for (const l of linhas) {
    if (/^Resumo da Fatura/i.test(l)) noResumo = true
    const sd = l.match(/Saldo Desta Fatura\D*([\d.]+,\d{2})/i)
    if (sd && totalFatura === null) totalFatura = num(sd[1])
    if (noResumo) continue

    const m = l.match(CARTAO)
    if (m) {
      atual = { titular: m[1].trim(), primeiroNome: primeiroNomeDe(m[1]), final: m[3], parcelas: [], despesas: [], creditos: [], total: null, soma: 0, confere: false }
      cartoes.push(atual); secao = null; continue
    }
    if (!atual) continue
    if (/^Pagamento e Demais/i.test(l)) { secao = 'cred'; continue }
    if (l === 'Parcelamentos') { secao = 'parc'; continue }
    if (l === 'Despesas') { secao = 'desp'; continue }
    if (/^VALOR TOTAL/i.test(l)) {
      const v = l.match(/[\d.]+,\d{2}/)
      if (v) atual.total = num(v[0])
      continue
    }
    if (!secao) continue
    const it = l.match(ITEM)
    if (!it) continue
    const [, data, descBruta, parc, valor] = it
    const lanc: LancFatura = {
      data,
      desc: descBruta.replace(/\s+/g, ' ').trim(),
      parcela: parc ? { x: parseInt(parc.slice(0, 2), 10), y: parseInt(parc.slice(3), 10) } : null,
      valor: num(valor),
    }
    if (secao === 'cred') atual.creditos.push(lanc)
    else if (secao === 'parc') atual.parcelas.push(lanc)
    else atual.despesas.push(lanc)
  }

  for (const c of cartoes) {
    c.soma = Math.round([...c.parcelas, ...c.despesas].reduce((s, x) => s + x.valor, 0) * 100) / 100
    c.confere = c.total !== null && Math.abs(c.soma - c.total) < 0.01
  }
  const soma = Math.round(cartoes.reduce((s, c) => s + c.soma, 0) * 100) / 100
  return {
    cartoes, totalFatura, soma,
    confere: totalFatura !== null ? Math.abs(soma - totalFatura) < 0.01 : cartoes.length > 0 && cartoes.every(c => c.confere),
  }
}
