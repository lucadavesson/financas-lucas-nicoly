import { createClient } from '@/lib/supabase/client'
import { CATS_DESPESA, CATS_RECEITA } from '@/lib/utils'

export type CustomCategoria = { id: string; name: string; kind: 'despesa' | 'receita'; icon?: string | null }

/**
 * Categorias criadas pelo usuário, compartilhadas entre Lucas e Nicoly
 * (tabela custom_categories, RLS liberada para qualquer autenticado).
 * Falha silenciosa se a tabela ainda não existir — o app segue com as fixas.
 */
export async function loadCustomCategorias(): Promise<CustomCategoria[]> {
  try {
    const { data, error } = await createClient()
      .from('custom_categories').select('*').order('name')
    if (error || !data) return []
    return data as CustomCategoria[]
  } catch { return [] }
}

/** Junta as categorias fixas do app com as customizadas, sem repetir. */
export function mesclarCategorias(
  kind: 'despesa' | 'receita',
  customs: CustomCategoria[],
): string[] {
  const fixas = kind === 'receita' ? CATS_RECEITA : CATS_DESPESA
  const extras = customs.filter(c => c.kind === kind).map(c => c.name)
  return [...fixas, ...extras.filter(n => !fixas.includes(n))]
}

/** É uma das categorias que vêm de fábrica? Essas não podem ser removidas. */
export function ehCategoriaFixa(nome: string): boolean {
  return CATS_DESPESA.includes(nome) || CATS_RECEITA.includes(nome)
}

export async function criarCategoria(
  nome: string,
  kind: 'despesa' | 'receita',
  icon?: string,
): Promise<{ ok: boolean; erro?: string }> {
  const limpo = nome.trim()
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  if (ehCategoriaFixa(limpo)) return { ok: false, erro: 'Já existe uma categoria com esse nome' }
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { ok: false, erro: 'Sessão expirada' }
  const { error } = await s.from('custom_categories')
    .insert({ owner_id: user.id, name: limpo, kind, icon: icon || null })
  if (error) {
    return { ok: false, erro: error.code === '23505' ? 'Já existe uma categoria com esse nome' : error.message }
  }
  return { ok: true }
}

/**
 * Renomear propaga para os lançamentos que já usam a categoria — senão eles
 * ficariam apontando para um nome que não existe mais.
 */
export async function renomearCategoria(id: string, nomeAntigo: string, nomeNovo: string) {
  const limpo = nomeNovo.trim()
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  const s = createClient()
  const { error } = await s.from('custom_categories').update({ name: limpo }).eq('id', id)
  if (error) return { ok: false, erro: error.message }
  await s.from('transactions').update({ category: limpo }).eq('category', nomeAntigo)
  await s.from('custom_subcategories').update({ category: limpo }).eq('category', nomeAntigo)
  return { ok: true }
}

/** Quantos lançamentos usam essa categoria (para avisar antes de excluir). */
export async function contarUsoCategoria(nome: string): Promise<number> {
  const { count } = await createClient()
    .from('transactions').select('id', { count: 'exact', head: true }).eq('category', nome)
  return count || 0
}

export async function excluirCategoria(id: string, nome: string) {
  const s = createClient()
  const { error } = await s.from('custom_categories').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  // Subcategorias órfãs dessa categoria saem junto
  await s.from('custom_subcategories').delete().eq('category', nome)
  return { ok: true }
}
