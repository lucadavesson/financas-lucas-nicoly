/**
 * Quanto foi em cada CARTÃO FÍSICO dentro de um cartão do app.
 * "Santander — Lucas" agrupa o principal e os adicionais do Lucas; esta soma
 * separa pelos 4 últimos dígitos (···4690, ···0749…). Compras lançadas antes de
 * guardarmos o cartão físico (ou à mão) ficam em "sem cartão informado" (final = null).
 */
export type GrupoFisico = { final: string | null; total: number; qtd: number }

export function porCartaoFisico(itens: { card_final?: string | null; amount: number; installment_value?: number | null }[]): GrupoFisico[] {
  const mapa = new Map<string, GrupoFisico>()
  for (const it of itens) {
    const k = it.card_final || ''
    const g = mapa.get(k) || { final: it.card_final || null, total: 0, qtd: 0 }
    g.total += Number(it.installment_value || it.amount) || 0
    g.qtd++
    mapa.set(k, g)
  }
  return Array.from(mapa.values())
    .map(g => ({ ...g, total: Math.round(g.total * 100) / 100 }))
    .sort((a, b) => (a.final === null ? 1 : 0) - (b.final === null ? 1 : 0) || b.total - a.total)
}
