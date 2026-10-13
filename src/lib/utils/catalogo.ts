import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATS_DESPESA, CATS_RECEITA, SUBCATS } from '@/lib/utils'

/**
 * CATÁLOGO ÚNICO de categorias e subcategorias.
 *
 * Toda tela que mostra, escolhe ou gerencia categoria lê daqui — assim o que é
 * feito numa tela (criar, esconder, ordenar, excluir) vale em todas as outras.
 *
 * Três fontes são juntadas:
 *  1. as de fábrica (CATS_DESPESA / CATS_RECEITA / SUBCATS, no código)
 *  2. as criadas por vocês (custom_categories / custom_subcategories)
 *  3. as preferências (categoria_prefs): esconder, excluir e ordem — valem para
 *     itens de fábrica e criados
 */

export type Kind = 'despesa' | 'receita'
export type Status = 'ativa' | 'escondida' | 'excluida'

export type CatItem = {
  name: string; kind: Kind; builtin: boolean; status: Status
  ordem: number; ordemPref: number | null; id?: string
}
export type SubItem = {
  name: string; category: string; builtin: boolean; status: Status
  ordem: number; ordemPref: number | null; id?: string
}
export type Catalogo = { cats: CatItem[]; subs: SubItem[]; prefsOk: boolean }
export type Res = { ok: boolean; erro?: string }
export type ResNome = Res & { nome?: string; jaExistia?: boolean; reativada?: boolean }

export const MSG_SQL =
  'Falta criar a tabela de preferências no Supabase (rode o arquivo supabase-categoria-prefs.sql).'

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function ehCategoriaFixa(nome: string): boolean {
  return CATS_DESPESA.includes(nome) || CATS_RECEITA.includes(nome)
}

// ── Carregar ─────────────────────────────────────────────────
export async function loadCatalogo(): Promise<Catalogo> {
  const s = createClient()
  const [rc, rs, rp] = await Promise.all([
    s.from('custom_categories').select('*').order('created_at'),
    s.from('custom_subcategories').select('*').order('created_at'),
    s.from('categoria_prefs').select('*'),
  ])
  const customCats: any[] = rc.error || !rc.data ? [] : rc.data
  const customSubs: any[] = rs.error || !rs.data ? [] : rs.data
  const prefsOk = !rp.error && !!rp.data
  const prefs = new Map<string, any>()
  if (prefsOk) for (const p of rp.data as any[]) prefs.set(`${p.kind}|${p.category}|${p.subcategory || ''}`, p)
  const pref = (k: string, c: string, sc = '') => prefs.get(`${k}|${c}|${sc}`)

  const cats: CatItem[] = []
  for (const kind of ['despesa', 'receita'] as Kind[]) {
    const fixas = kind === 'receita' ? CATS_RECEITA : CATS_DESPESA
    const lista: { name: string; builtin: boolean; id?: string }[] = fixas.map(n => ({ name: n, builtin: true }))
    customCats
      .filter(c => (c.kind || 'despesa') === kind && !fixas.includes(c.name))
      .forEach(c => lista.push({ name: c.name, builtin: false, id: c.id }))
    lista.forEach((n, i) => {
      const p = pref(kind, n.name)
      cats.push({
        name: n.name, kind, builtin: n.builtin, id: n.id,
        status: (p?.status as Status) || 'ativa',
        ordemPref: p?.ordem ?? null,
        ordem: p?.ordem ?? 1000 + i, // sem ordem escolhida: mantém a original, depois das ordenadas
      })
    })
  }

  const subs: SubItem[] = []
  const nomesCats = Array.from(new Set([...CATS_DESPESA, ...CATS_RECEITA, ...customCats.map(c => c.name)]))
  for (const category of nomesCats) {
    const fixas = SUBCATS[category] || []
    const lista: { name: string; builtin: boolean; id?: string }[] = fixas.map(n => ({ name: n, builtin: true }))
    customSubs
      .filter(x => x.category === category && !fixas.some(f => semAcento(f) === semAcento(x.subcategory)))
      .forEach(x => lista.push({ name: x.subcategory, builtin: false, id: x.id }))
    lista.forEach((n, i) => {
      const p = pref('sub', category, n.name)
      subs.push({
        name: n.name, category, builtin: n.builtin, id: n.id,
        status: (p?.status as Status) || 'ativa',
        ordemPref: p?.ordem ?? null,
        ordem: p?.ordem ?? 1000 + i,
      })
    })
  }
  return { cats, subs, prefsOk }
}

// ── Consultas (o que cada tela usa) ──────────────────────────
const porOrdem = <T extends { ordem: number }>(a: T[]) => [...a].sort((x, y) => x.ordem - y.ordem)

/** Todas as categorias do tipo, na ordem escolhida, sem as removidas (inclui as escondidas). */
export function categoriasDoTipo(c: Catalogo | null, kind: Kind): CatItem[] {
  if (!c) return []
  return porOrdem(c.cats.filter(x => x.kind === kind && x.status !== 'excluida'))
}

/** Subcategorias da categoria na ordem escolhida, sem as removidas (inclui as escondidas). */
export function subcategoriasDe(c: Catalogo | null, category: string): SubItem[] {
  if (!c) return []
  return porOrdem(c.subs.filter(x => x.category === category && x.status !== 'excluida'))
}

/**
 * Nomes para os seletores de lançamento: só as ativas. `incluir` mantém visível
 * o valor que o lançamento já tem, mesmo se a categoria foi escondida depois —
 * senão o campo apareceria vazio ao editar um lançamento antigo.
 */
export function categoriasAtivas(c: Catalogo | null, kind: Kind, incluir: (string | null | undefined)[] = []): string[] {
  const base = c
    ? porOrdem(c.cats.filter(x => x.kind === kind && x.status === 'ativa')).map(x => x.name)
    : [...(kind === 'receita' ? CATS_RECEITA : CATS_DESPESA)]
  const extras = incluir.filter((n): n is string => !!n && !base.includes(n))
  return [...base, ...extras]
}

export function subcategoriasAtivas(c: Catalogo | null, category: string, incluir?: string | null): string[] {
  const base = c
    ? porOrdem(c.subs.filter(x => x.category === category && x.status === 'ativa')).map(x => x.name)
    : [...(SUBCATS[category] || [])]
  return incluir && !base.includes(incluir) ? [...base, incluir] : base
}

// ── Atualização entre telas ──────────────────────────────────
const ouvintes = new Set<() => void>()
/** Avisa todas as telas montadas que o catálogo mudou. */
export function notificarCatalogo() { ouvintes.forEach(f => f()) }

/** Carrega o catálogo e o mantém em dia: recarrega após qualquer mudança e ao voltar ao app. */
export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const recarregar = useCallback(async () => { setCatalogo(await loadCatalogo()) }, [])
  useEffect(() => {
    recarregar()
    ouvintes.add(recarregar)
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { ouvintes.delete(recarregar); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [recarregar])
  return { catalogo, recarregar }
}

// ── Gravar preferências ──────────────────────────────────────
type LinhaPref = { kind: string; category: string; subcategory?: string; status: Status; ordem: number | null }

async function gravarPrefs(linhas: LinhaPref[]): Promise<Res> {
  if (linhas.length === 0) return { ok: true }
  const agora = new Date().toISOString()
  // linhas sempre completas (status + ordem): upsert em lote exige as mesmas colunas em todas
  const payload = linhas.map(l => ({
    kind: l.kind, category: l.category, subcategory: l.subcategory ?? '',
    status: l.status, ordem: l.ordem, updated_at: agora,
  }))
  const { error } = await createClient().from('categoria_prefs')
    .upsert(payload, { onConflict: 'kind,category,subcategory' })
  if (error) return { ok: false, erro: /categoria_prefs|relation|schema cache/i.test(error.message) ? MSG_SQL : error.message }
  return { ok: true }
}

// ── Categorias ───────────────────────────────────────────────
/**
 * Criar é idempotente: se já existe (ativa, escondida ou removida) devolve a
 * existente e, se estava fora das listas, traz de volta. Assim nunca duplica.
 */
export async function criarCategoria(nome: string, kind: Kind): Promise<ResNome> {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  const cat = await loadCatalogo()
  const igual = cat.cats.find(c => c.kind === kind && semAcento(c.name) === semAcento(limpo))
  if (igual) {
    if (igual.status === 'ativa') return { ok: true, nome: igual.name, jaExistia: true }
    const r = await alterarStatusCategoria(igual, 'ativa')
    return r.ok ? { ok: true, nome: igual.name, jaExistia: true, reativada: true } : r
  }
  if (ehCategoriaFixa(limpo)) return { ok: false, erro: 'Já existe uma categoria com esse nome' }
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { ok: false, erro: 'Sessão expirada' }
  const { error } = await s.from('custom_categories').insert({ owner_id: user.id, name: limpo, kind })
  if (error) return { ok: false, erro: error.code === '23505' ? 'Já existe uma categoria com esse nome' : error.message }
  notificarCatalogo()
  return { ok: true, nome: limpo }
}

export async function alterarStatusCategoria(cat: CatItem, status: Status): Promise<Res> {
  if (status === 'excluida' && !cat.builtin) return excluirCategoriaCriada(cat)
  const ordem = cat.status === 'excluida' ? null : cat.ordemPref // restaurada volta para o fim
  const r = await gravarPrefs([{ kind: cat.kind, category: cat.name, status, ordem }])
  if (r.ok) notificarCatalogo()
  return r
}

async function excluirCategoriaCriada(cat: CatItem): Promise<Res> {
  const s = createClient()
  const { error } = await s.from('custom_categories').delete().eq('id', cat.id!)
  if (error) return { ok: false, erro: error.message }
  await s.from('custom_subcategories').delete().eq('category', cat.name)
  await s.from('categoria_prefs').delete().eq('category', cat.name) // some se a tabela ainda não existir
  notificarCatalogo()
  return { ok: true }
}

/** Renomear propaga para tudo que aponta pelo nome: lançamentos, subcategorias, limites e preferências. */
export async function renomearCategoria(cat: CatItem, novo: string): Promise<Res> {
  if (cat.builtin) return { ok: false, erro: 'Categorias de fábrica não podem ser renomeadas — dá para esconder.' }
  const limpo = novo.trim().replace(/\s+/g, ' ')
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  if (limpo === cat.name) return { ok: true }
  const atual = await loadCatalogo()
  if (atual.cats.some(c => c.name !== cat.name && semAcento(c.name) === semAcento(limpo)))
    return { ok: false, erro: 'Já existe uma categoria com esse nome' }
  const s = createClient()
  const { error } = await s.from('custom_categories').update({ name: limpo }).eq('id', cat.id!)
  if (error) return { ok: false, erro: error.code === '23505' ? 'Já existe uma categoria com esse nome' : error.message }
  await s.from('transactions').update({ category: limpo }).eq('category', cat.name)
  await s.from('custom_subcategories').update({ category: limpo }).eq('category', cat.name)
  await s.from('category_limits').update({ category: limpo }).eq('category', cat.name)
  await s.from('categoria_prefs').update({ category: limpo }).eq('category', cat.name)
  notificarCatalogo()
  return { ok: true }
}

export async function reordenarCategorias(lista: CatItem[]): Promise<Res> {
  const r = await gravarPrefs(lista.map((c, i) => ({ kind: c.kind, category: c.name, status: c.status, ordem: i })))
  if (r.ok) notificarCatalogo()
  return r
}

export async function contarUsoCategoria(nome: string): Promise<number> {
  const { count } = await createClient().from('transactions')
    .select('id', { count: 'exact', head: true }).eq('category', nome)
  return count || 0
}

// ── Subcategorias ────────────────────────────────────────────
export async function criarSubcategoria(category: string, nome: string): Promise<ResNome> {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  if (!category) return { ok: false, erro: 'Escolha a categoria primeiro' }
  const cat = await loadCatalogo()
  const igual = cat.subs.find(x => x.category === category && semAcento(x.name) === semAcento(limpo))
  if (igual) {
    if (igual.status === 'ativa') return { ok: true, nome: igual.name, jaExistia: true }
    const r = await alterarStatusSub(igual, 'ativa')
    return r.ok ? { ok: true, nome: igual.name, jaExistia: true, reativada: true } : r
  }
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { ok: false, erro: 'Sessão expirada' }
  const { error } = await s.from('custom_subcategories').insert({ owner_id: user.id, category, subcategory: limpo })
  if (error) {
    if (error.code === '23505') { notificarCatalogo(); return { ok: true, nome: limpo, jaExistia: true } }
    return { ok: false, erro: error.message }
  }
  notificarCatalogo()
  return { ok: true, nome: limpo }
}

export async function alterarStatusSub(sub: SubItem, status: Status): Promise<Res> {
  if (status === 'excluida' && !sub.builtin) {
    const s = createClient()
    const { error } = await s.from('custom_subcategories').delete().eq('id', sub.id!)
    if (error) return { ok: false, erro: error.message }
    await s.from('categoria_prefs').delete().eq('kind', 'sub').eq('category', sub.category).eq('subcategory', sub.name)
    notificarCatalogo()
    return { ok: true }
  }
  const ordem = sub.status === 'excluida' ? null : sub.ordemPref
  const r = await gravarPrefs([{ kind: 'sub', category: sub.category, subcategory: sub.name, status, ordem }])
  if (r.ok) notificarCatalogo()
  return r
}

export async function renomearSubcategoria(sub: SubItem, novo: string): Promise<Res> {
  if (sub.builtin) return { ok: false, erro: 'Subcategorias de fábrica não podem ser renomeadas — dá para esconder.' }
  const limpo = novo.trim().replace(/\s+/g, ' ')
  if (!limpo) return { ok: false, erro: 'Informe um nome' }
  if (limpo === sub.name) return { ok: true }
  const atual = await loadCatalogo()
  if (atual.subs.some(x => x.category === sub.category && x.name !== sub.name && semAcento(x.name) === semAcento(limpo)))
    return { ok: false, erro: 'Já existe uma subcategoria com esse nome' }
  const s = createClient()
  const { error } = await s.from('custom_subcategories').update({ subcategory: limpo }).eq('id', sub.id!)
  if (error) return { ok: false, erro: error.message }
  await s.from('transactions').update({ subcategory: limpo }).eq('category', sub.category).eq('subcategory', sub.name)
  await s.from('categoria_prefs').update({ subcategory: limpo }).eq('kind', 'sub').eq('category', sub.category).eq('subcategory', sub.name)
  notificarCatalogo()
  return { ok: true }
}

export async function reordenarSubs(lista: SubItem[]): Promise<Res> {
  const r = await gravarPrefs(lista.map((x, i) => ({ kind: 'sub', category: x.category, subcategory: x.name, status: x.status, ordem: i })))
  if (r.ok) notificarCatalogo()
  return r
}

export async function contarUsoSub(category: string, sub: string): Promise<number> {
  const { count } = await createClient().from('transactions')
    .select('id', { count: 'exact', head: true }).eq('category', category).eq('subcategory', sub)
  return count || 0
}
