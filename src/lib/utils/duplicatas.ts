/**
 * Lançamentos duplicados — o mesmo compromisso lançado duas vezes.
 *
 * Caso que deu origem: "Certificado - Prata" existia duas vezes, mês a mês.
 * Uma série com o valor da parcela (R$ 35,19) e outra com o valor TOTAL da
 * compra repetido como se fosse a parcela (R$ 351,90). Dez meses de uma
 * dívida que não existe — e invisível nas telas de parcelamento, porque a
 * série errada tinha outro transaction_type e nem entrava naquela lista.
 *
 * Achar isso na mão exige abrir mês a mês. Aqui vira uma varredura só.
 */

export type LinhaDup = {
  id: string
  description: string
  holder?: string | null
  purchase_date: string
  amount?: number | null
  installment_value?: number | null
  status?: string | null
  paid_date?: string | null
  card_name?: string | null
  category?: string | null
  transaction_type?: string | null
}

export type GrupoDuplicado = {
  chave: string
  descricao: string
  holder: string
  mes: string
  /** Ordenadas por valor crescente: a primeira é a que fica. */
  linhas: (LinhaDup & { valor: number })[]
  manter: string
  remover: string[]
  /** Ids que a limpeza automática não vai tocar, com o motivo. */
  protegidas: { id: string; motivo: string }[]
}

/** O valor que a tela mostra: a parcela quando existe, senão o valor cheio. */
export function valorExibido(l: LinhaDup): number {
  return l.installment_value ?? l.amount ?? 0
}

function normalizar(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Um pagamento registrado à mão (paid_date diferente da data do lançamento)
 * não é apagado automaticamente: pode ser o registro certo, e o app não tem
 * como saber. Vira aviso, não exclusão.
 */
function temPagamentoManual(l: LinhaDup): boolean {
  return !!l.paid_date && l.paid_date !== l.purchase_date
}

/**
 * Duas linhas são o mesmo compromisso quando têm a mesma descrição, o mesmo
 * titular e caem no mesmo mês.
 *
 * O mês entra na chave (e não a data exata) porque a mesma parcela pode ter
 * sido lançada em dias diferentes do mês. A descrição entra inteira, com o
 * "(4/10)", justamente para não confundir parcelas diferentes da mesma compra.
 */
export function acharDuplicatas(linhas: LinhaDup[]): GrupoDuplicado[] {
  const grupos = new Map<string, LinhaDup[]>()
  for (const l of linhas) {
    if (!l.purchase_date) continue
    if (l.status === 'Cancelado') continue
    const chave = `${normalizar(l.description)}|${normalizar(l.holder || '')}|${l.purchase_date.slice(0, 7)}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(l)
  }

  const saida: GrupoDuplicado[] = []
  for (const [chave, doGrupo] of grupos) {
    if (doGrupo.length < 2) continue

    const comValor = doGrupo
      .map(l => ({ ...l, valor: valorExibido(l) }))
      .sort((a, b) => a.valor - b.valor || a.id.localeCompare(b.id))

    // Fica a de menor valor: entre a parcela e o total lançado por engano, a
    // parcela é a que representa o que realmente sai por mês.
    const manter = comValor[0].id
    const protegidas: { id: string; motivo: string }[] = []
    const remover: string[] = []

    for (const l of comValor.slice(1)) {
      if (temPagamentoManual(l)) {
        protegidas.push({ id: l.id, motivo: `pagamento registrado em ${l.paid_date}` })
        continue
      }
      remover.push(l.id)
    }

    const [descricao, holder, mes] = chave.split('|')
    saida.push({ chave, descricao: comValor[0].description, holder: doGrupo[0].holder || holder, mes, linhas: comValor, manter, remover, protegidas })
  }

  return saida.sort((a, b) =>
    a.descricao.localeCompare(b.descricao) || a.mes.localeCompare(b.mes))
}

/**
 * Agrupa as duplicatas por "compromisso" (descrição sem o número da parcela +
 * titular), para a tela dizer "isso se repete em 10 meses" em vez de listar
 * dez blocos quase iguais.
 */
export function resumirPorCompromisso(grupos: GrupoDuplicado[]) {
  const mapa = new Map<string, { titulo: string; holder: string; meses: string[]; aRemover: number; valores: number[] }>()
  for (const g of grupos) {
    const semParcela = g.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
    const chave = `${normalizar(semParcela)}|${normalizar(g.holder)}`
    if (!mapa.has(chave)) mapa.set(chave, { titulo: semParcela, holder: g.holder, meses: [], aRemover: 0, valores: [] })
    const r = mapa.get(chave)!
    r.meses.push(g.mes)
    r.aRemover += g.remover.length
    for (const l of g.linhas) if (!r.valores.includes(l.valor)) r.valores.push(l.valor)
  }
  return Array.from(mapa.values())
    .map(r => ({ ...r, meses: r.meses.sort(), valores: r.valores.sort((a, b) => a - b) }))
    .sort((a, b) => b.aRemover - a.aRemover)
}
