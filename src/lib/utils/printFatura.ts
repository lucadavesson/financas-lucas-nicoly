/**
 * LEITURA DE PRINTS DA FATURA EM ABERTO (Santander) — OCR no próprio navegador.
 *
 * Os prints mostram a lista "Últimas transações" do cartão. O texto chega do OCR
 * linha a linha; cada compra vira um bloco de 2 ou 3 linhas:
 *   NOME .......... R$ 42,68        (nome + valor, às vezes em linhas separadas)
 *   16 out. 2026   Autorizado        (data + status)
 *   CANCELADA                        (opcional: compra cancelada, ignorada)
 *
 * Funções puras (sem React, sem OCR), para serem testadas com o texto real.
 */

import type { FaturaLida, LancFatura } from './faturaPdf'

export type CompraPrint = {
  data: string                          // 'dd/mm', como na fatura
  desc: string                          // nome sem o "(x/y)"
  parcela: { x: number; y: number } | null
  valor: number
  status: string                        // 'Autorizado' | 'Em processamento' | ''
  suspeita: boolean                     // sem status lido: pode ser cancelada (o OCR perdeu o rótulo)
}

const MESES: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
}

const DATA = /^(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})\b/i
const VALOR = /(?:R\$|RS|R5|R\s?\$)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*$/i
const PARCELA = /\((\d{1,2})\s*\/\s*(\d{1,2})\)/

const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

/** Limpa o nome lido: tira símbolos de seta/linha do começo e espaços sobrando. */
function nomeLimpo(s: string): string {
  return s.replace(/^[^A-Za-zÀ-ú0-9]+/, '').replace(/\s+/g, ' ').trim()
}

/** Linhas de ruído da tela (cabeçalho, barra de filtros, rodapé). */
const RUIDO = /^(\d{1,2}:\d{2}|Meus cart|SANTANDER UNIQUE|ESTE M|Filtros|Voltar ao topo|Últimas transa|Cart[aã]o |Titular|Adicional|\*+\s|[kK]+ )/i

export type ResultadoPrint = { compras: CompraPrint[]; linhasIgnoradas: string[] }

/** Transforma o texto de UM print em compras. Ignora canceladas e reporta o que não entendeu. */
export function lerComprasDoPrint(texto: string): ResultadoPrint {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const compras: CompraPrint[] = []
  const linhasIgnoradas: string[] = []
  const usadas = new Set<number>()

  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(DATA)
    if (!m) continue
    const mes = MESES[m[2].toLowerCase().slice(0, 3)]
    if (!mes) { linhasIgnoradas.push(linhas[i]); continue }

    // Valor e nome: na linha de cima (mesma linha ou linha anterior).
    let idxValor = -1
    for (const j of [i - 1, i - 2]) {
      if (j >= 0 && !usadas.has(j) && VALOR.test(linhas[j])) { idxValor = j; break }
    }
    if (idxValor < 0) { linhasIgnoradas.push(linhas[i]); continue }

    const valorM = linhas[idxValor].match(VALOR)!
    const nomeBruto = linhas[idxValor].replace(VALOR, '').trim()
    // Nome em linha própria (quando o OCR separou nome e valor): usa a linha acima do valor.
    const nomeAcima = nomeBruto === '' && idxValor - 1 >= 0 && !usadas.has(idxValor - 1) && !VALOR.test(linhas[idxValor - 1]) && !DATA.test(linhas[idxValor - 1])
      ? linhas[idxValor - 1] : ''
    const nomeSrc = nomeBruto || nomeAcima

    // Status e cancelamento: linhas logo depois da data.
    const proxima = linhas[i + 1] || ''
    const depois = linhas[i + 2] || ''
    const cancelada = /CANCELAD/i.test(proxima) || /CANCELAD/i.test(depois)
    const statusM = linhas.slice(idxValor, i + 2).join(' ').match(/(Autorizado|Em processamento)/i)
    const status = statusM ? statusM[1] : ''

    usadas.add(i); usadas.add(idxValor)
    if (nomeAcima) usadas.add(idxValor - 1)
    if (RUIDO.test(nomeSrc) || nomeSrc.length < 2) { linhasIgnoradas.push(linhas[i]); continue }

    if (cancelada) continue

    const parc = nomeSrc.match(PARCELA)
    const desc = nomeLimpo(nomeSrc.replace(PARCELA, '').replace(/\s+/g, ' '))
    const valor = num(valorM[1])
    if (!desc || !Number.isFinite(valor)) { linhasIgnoradas.push(linhas[i]); continue }
    compras.push({
      data: `${m[1].padStart(2, '0')}/${mes}`,
      desc,
      parcela: parc ? { x: parseInt(parc[1], 10), y: parseInt(parc[2], 10) } : null,
      valor,
      status,
      suspeita: status === '',
    })
  }
  return { compras, linhasIgnoradas }
}

/** Chave para reconhecer a mesma linha em dois prints. */
const chaveCompra = (c: CompraPrint) => `${c.data}|${c.desc}|${c.valor}|${c.parcela ? `${c.parcela.x}/${c.parcela.y}` : ''}`

/**
 * Junta a lista de vários prints, na ordem em que foram escolhidos. A tela de um
 * print começa onde a anterior termina, então o começo de um print pode repetir o
 * fim do anterior. Remove só essa sobreposição (maior trecho igual), para não
 * apagar compras legítimas parecidas (ex.: duas corridas de Uber no mesmo dia).
 */
export function juntarPrints(listas: CompraPrint[][]): CompraPrint[] {
  const acc: CompraPrint[] = []
  for (const lista of listas) {
    let corte = 0
    const maxK = Math.min(acc.length, lista.length)
    for (let k = maxK; k >= 1; k--) {
      const fim = acc.slice(acc.length - k).map(chaveCompra)
      const ini = lista.slice(0, k).map(chaveCompra)
      if (fim.every((c, idx) => c === ini[idx])) { corte = k; break }
    }
    acc.push(...lista.slice(corte))
  }
  return acc
}

/** Cartões físicos que aparecem nas faturas (principal e adicionais). */
export const CARTOES_PRINT = [
  { label: 'Lucas ···4690', titular: 'LUCAS D S SANTOS', primeiroNome: 'Lucas', final: '4690' },
  { label: 'Lucas ···0749', titular: 'LUCAS D S SANTOS', primeiroNome: 'Lucas', final: '0749' },
  { label: 'Lucas ···7282', titular: 'LUCAS D S SANTOS', primeiroNome: 'Lucas', final: '7282' },
  { label: 'Lucas ···0272', titular: 'LUCAS D S SANTOS', primeiroNome: 'Lucas', final: '0272' },
  { label: 'Nicoly ···1233', titular: 'NICOLY A S PRATA', primeiroNome: 'Nicoly', final: '1233' },
  { label: 'Nicoly ···2672', titular: 'NICOLY A S PRATA', primeiroNome: 'Nicoly', final: '2672' },
]

/**
 * Monta a mesma estrutura que a leitura do PDF devolve, para que a tela de revisão,
 * o reconhecimento de existentes, a memória e a importação funcionem igual.
 * Sem o PDF não há "total da fatura" impresso: a conferência fica só com a soma lida.
 */
export function lidaDeImpressoes(compras: CompraPrint[], cartao: { titular: string; primeiroNome: string; final: string }): FaturaLida {
  const toLanc = (c: CompraPrint): LancFatura => ({ data: c.data, desc: c.desc, parcela: c.parcela, valor: c.valor })
  const parcelas = compras.filter(c => c.parcela).map(toLanc)
  const despesas = compras.filter(c => !c.parcela).map(toLanc)
  const soma = Math.round(compras.reduce((t, c) => t + c.valor, 0) * 100) / 100
  return {
    cartoes: [{ titular: cartao.titular, primeiroNome: cartao.primeiroNome, final: cartao.final, parcelas, despesas, creditos: [], total: null, soma, confere: true }],
    totalFatura: null,
    soma,
    confere: true,
  }
}
