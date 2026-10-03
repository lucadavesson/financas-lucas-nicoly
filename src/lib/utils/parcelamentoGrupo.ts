/**
 * Parcelas irmãs: todas as linhas de UMA mesma compra parcelada.
 *
 * Não existe um id de grupo no banco — cada parcela é uma linha com a
 * descrição "Nome (n/total)". O grupo é, portanto, identificado por:
 * mesmo nome base + mesmo total + mesmo titular + mesmo cartão.
 *
 * Antes, apagar/editar buscava com ilike `${base}%`, o que também pegaria
 * outra compra cujo nome COMEÇA igual (apagar "Moto" levaria "Motorola (1/3)").
 * Aqui o filtro final é exato, em JS.
 */
import { baseDaDescricao } from './parcelasCore'

type Cliente = any // SupabaseClient — evita acoplar tipos aqui

export type LinhaIrma = {
  id: string
  description: string
  holder?: string | null
  card_name?: string | null
  status?: string | null
  amount?: number | null
  [k: string]: any
}

function escaparLike(txt: string): string {
  return txt.replace(/[\\%_]/g, m => '\\' + m)
}

export function sufixoDaParcela(desc: string): { num: number; total: number } | null {
  const m = (desc || '').match(/\((\d+)\/(\d+)\)\s*$/)
  return m ? { num: parseInt(m[1]), total: parseInt(m[2]) } : null
}

/** Todas as parcelas do mesmo parcelamento de `tx` (inclui a própria). */
export async function buscarIrmas(s: Cliente, tx: LinhaIrma): Promise<LinhaIrma[]> {
  const suf = sufixoDaParcela(tx.description)
  if (!suf || suf.total <= 1) return [tx]
  const base = baseDaDescricao(tx.description)

  let q = s.from('transactions').select('*').ilike('description', `${escaparLike(base)} (%/%)`)
  if (tx.holder) q = q.eq('holder', tx.holder)
  const { data, error } = await q
  if (error || !data) return [tx]

  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\/${suf.total}\\)$`)
  const irmas = (data as LinhaIrma[]).filter(l =>
    re.test((l.description || '').trim()) &&
    (l.card_name || null) === (tx.card_name || null)
  )
  return irmas.some(l => l.id === tx.id) ? irmas : [tx, ...irmas]
}

/** Apaga o parcelamento inteiro. Devolve quantas linhas foram apagadas. */
export async function apagarParcelamento(
  s: Cliente, tx: LinhaIrma
): Promise<{ ok: boolean; n: number; erro?: string }> {
  const irmas = await buscarIrmas(s, tx)
  const ids = irmas.map(l => l.id)
  const { error } = await s.from('transactions').delete().in('id', ids)
  if (error) return { ok: false, n: 0, erro: error.message }
  return { ok: true, n: ids.length }
}
