'use client'
import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CAT_ICONS } from '@/lib/utils'
import {
  useCatalogo, categoriasDoTipo, subcategoriasDe, criarCategoria, criarSubcategoria,
  alterarStatusCategoria, alterarStatusSub, renomearCategoria, renomearSubcategoria,
  reordenarCategorias, reordenarSubs, contarUsoCategoria, contarUsoSub, MSG_SQL,
  type CatItem, type SubItem, type Kind, type Res,
} from '@/lib/utils/catalogo'

const TEXT = '#1C1C1E', TEXTMU = '#8E8E93', TERRA = '#C4622D', RED = '#FF3B30'

const btnIcone: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.04)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0,
}

type LinhaProps = {
  titulo: string; icone?: string; detalhe?: string; escondida: boolean; sua: boolean
  podeSubir: boolean; podeDescer: boolean
  onSubir: () => void; onDescer: () => void; onOlho: () => void; onEditar?: () => void; onExcluir: () => void
  editando: boolean; texto: string; onTexto: (v: string) => void; onSalvar: () => void; onCancelar: () => void
  onClick?: () => void; aberta?: boolean
}

// Fora do componente principal de propósito: definida lá dentro, a linha seria recriada a cada
// letra digitada na edição e o campo perderia o foco.
function Linha(p: LinhaProps) {
  if (p.editando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px' }}>
        <input autoFocus value={p.texto} onChange={e => p.onTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') p.onSalvar(); if (e.key === 'Escape') p.onCancelar() }}
          style={{ flex: 1, minWidth: 0, height: 36, borderRadius: 10, border: `1px solid ${TERRA}`, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={p.onSalvar} style={{ height: 36, padding: '0 12px', background: TERRA, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
        <button onClick={p.onCancelar} style={{ height: 36, padding: '0 10px', background: 'rgba(0,0,0,0.04)', color: TEXTMU, border: 'none', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
    )
  }
  const meta = [p.sua && 'criada por vocês', p.escondida && 'escondida', p.detalhe].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px' }}>
      <button onClick={p.onClick} disabled={!p.onClick}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: p.onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8, opacity: p.escondida ? 0.5 : 1 }}>
        {p.icone && <span style={{ fontSize: 17, flexShrink: 0 }}>{p.icone}</span>}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
          {meta && <span style={{ fontSize: 10, color: p.escondida ? TEXTMU : TERRA, display: 'block' }}>{meta}</span>}
        </span>
        {p.onClick && (p.aberta ? <ChevronUp size={14} color={TEXTMU} /> : <ChevronDown size={14} color={TEXTMU} />)}
      </button>
      <button title="Subir" onClick={p.onSubir} disabled={!p.podeSubir} style={{ ...btnIcone, opacity: p.podeSubir ? 1 : 0.3 }}><ArrowUp size={14} color={TEXT} /></button>
      <button title="Descer" onClick={p.onDescer} disabled={!p.podeDescer} style={{ ...btnIcone, opacity: p.podeDescer ? 1 : 0.3 }}><ArrowDown size={14} color={TEXT} /></button>
      <button title={p.escondida ? 'Mostrar nas listas' : 'Esconder das listas'} onClick={p.onOlho} style={btnIcone}>
        {p.escondida ? <EyeOff size={14} color={TEXTMU} /> : <Eye size={14} color={TEXT} />}
      </button>
      {p.onEditar && <button title="Renomear" onClick={p.onEditar} style={btnIcone}><Pencil size={13} color={TERRA} /></button>}
      <button title="Excluir" onClick={p.onExcluir} style={{ ...btnIcone, background: 'rgba(255,59,48,0.08)' }}><Trash2 size={13} color={RED} /></button>
    </div>
  )
}

export default function GerenciarCategorias() {
  const { catalogo } = useCatalogo()
  const [kind, setKind] = useState<Kind>('despesa')
  const [aberta, setAberta] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [nomeNova, setNomeNova] = useState('')
  const [novaSubEm, setNovaSubEm] = useState<string | null>(null)
  const [nomeSub, setNomeSub] = useState('')
  const [editando, setEditando] = useState<string | null>(null) // 'c|Cat' ou 's|Cat|Sub'
  const [textoEd, setTextoEd] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verRemovidas, setVerRemovidas] = useState(false)

  if (!catalogo) {
    return <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={22} color={TERRA} style={{ animation: 'spin 0.8s linear infinite' }} /></div>
  }

  const prefsOk = catalogo.prefsOk
  const cats = categoriasDoTipo(catalogo, kind)
  const removidasCats = catalogo.cats.filter(c => c.kind === kind && c.status === 'excluida')
  const removidasSubs = catalogo.subs.filter(s => s.status === 'excluida' && cats.some(c => c.name === s.category))
  const totalRemovidas = removidasCats.length + removidasSubs.length

  async function exec(fn: () => Promise<Res>, ok?: string) {
    if (ocupado) return
    setOcupado(true)
    try {
      const r = await fn()
      if (!r.ok) toast.error(r.erro || 'Não foi possível salvar')
      else if (ok) toast.success(ok)
    } finally { setOcupado(false) }
  }
  const semPrefs = () => { if (!prefsOk) { toast.error(MSG_SQL); return true } return false }

  // ── Categorias ──
  function moverCat(idx: number, dir: -1 | 1) {
    if (semPrefs()) return
    const j = idx + dir
    if (j < 0 || j >= cats.length) return
    const nova = [...cats]; [nova[idx], nova[j]] = [nova[j], nova[idx]]
    exec(() => reordenarCategorias(nova))
  }
  function olhoCat(c: CatItem) {
    if (semPrefs()) return
    const volta = c.status === 'escondida'
    exec(() => alterarStatusCategoria(c, volta ? 'ativa' : 'escondida'),
      volta ? 'Categoria voltou para as listas' : 'Categoria escondida — não aparece mais nos novos lançamentos')
  }
  async function excluirCat(c: CatItem) {
    if (c.builtin && semPrefs()) return
    const uso = await contarUsoCategoria(c.name)
    const aviso = uso > 0
      ? `"${c.name}" está em ${uso} lançamento${uso > 1 ? 's' : ''}. Eles continuam com esse nome, mas a categoria sai das listas.`
      : `Excluir a categoria "${c.name}"?`
    const fim = c.builtin
      ? '\n\nÉ uma categoria de fábrica: vai para "Removidas" e dá para restaurar.'
      : '\n\nDepois de excluída não dá para recuperar. Se só quer tirar das listas, use o olho (esconder).'
    if (!confirm(aviso + fim)) return
    exec(() => alterarStatusCategoria(c, 'excluida'), 'Categoria excluída')
  }
  async function criarNovaCat() {
    if (ocupado || !nomeNova.trim()) return
    setOcupado(true)
    const r = await criarCategoria(nomeNova, kind)
    setOcupado(false)
    if (!r.ok) { toast.error(r.erro || 'Não foi possível criar'); return }
    toast.success(r.reativada ? 'Essa categoria já existia e voltou para a lista' : r.jaExistia ? 'Essa categoria já existe' : 'Categoria criada e salva!')
    setNomeNova(''); setCriando(false)
    if (r.nome) setAberta(r.nome)
  }

  // ── Subcategorias ──
  function moverSub(lista: SubItem[], idx: number, dir: -1 | 1) {
    if (semPrefs()) return
    const j = idx + dir
    if (j < 0 || j >= lista.length) return
    const nova = [...lista]; [nova[idx], nova[j]] = [nova[j], nova[idx]]
    exec(() => reordenarSubs(nova))
  }
  function olhoSub(s: SubItem) {
    if (semPrefs()) return
    const volta = s.status === 'escondida'
    exec(() => alterarStatusSub(s, volta ? 'ativa' : 'escondida'),
      volta ? 'Subcategoria voltou para as listas' : 'Subcategoria escondida')
  }
  async function excluirSub(s: SubItem) {
    if (s.builtin && semPrefs()) return
    const uso = await contarUsoSub(s.category, s.name)
    const aviso = uso > 0
      ? `"${s.name}" está em ${uso} lançamento${uso > 1 ? 's' : ''}. Eles continuam com esse nome, mas a subcategoria sai das listas.`
      : `Excluir a subcategoria "${s.name}"?`
    const fim = s.builtin ? '\n\nÉ de fábrica: vai para "Removidas" e dá para restaurar.' : '\n\nDepois de excluída não dá para recuperar. Para só tirar das listas, use o olho.'
    if (!confirm(aviso + fim)) return
    exec(() => alterarStatusSub(s, 'excluida'), 'Subcategoria excluída')
  }
  async function criarNovaSub(categoria: string) {
    if (ocupado || !nomeSub.trim()) return
    setOcupado(true)
    const r = await criarSubcategoria(categoria, nomeSub)
    setOcupado(false)
    if (!r.ok) { toast.error(r.erro || 'Não foi possível criar'); return }
    toast.success(r.reativada ? 'Essa subcategoria já existia e voltou para a lista' : r.jaExistia ? 'Essa subcategoria já existe' : 'Subcategoria criada e salva!')
    setNomeSub(''); setNovaSubEm(null)
  }

  const chaveCat = (c: CatItem) => `c|${c.name}`
  const chaveSub = (s: SubItem) => `s|${s.category}|${s.name}`

  return (
    <div>
      {!prefsOk && (
        <div style={{ background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', borderRadius: 14, padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#8A6D00', margin: 0, lineHeight: 1.4 }}>
            ⚠️ Para esconder, reordenar e restaurar falta rodar um SQL no Supabase (arquivo <b>supabase-categoria-prefs.sql</b>).
            Criar, renomear e excluir o que vocês criaram já funciona.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['despesa', 'receita'] as Kind[]).map(k => (
          <button key={k} onClick={() => { setKind(k); setAberta(null); setCriando(false); setEditando(null) }}
            style={{ flex: 1, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: kind === k ? 700 : 500,
              background: kind === k ? TERRA : 'rgba(0,0,0,0.04)', color: kind === k ? '#fff' : TEXT }}>
            {k === 'despesa' ? 'Despesas' : 'Receitas'}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11, color: TEXTMU, margin: '0 4px 12px', lineHeight: 1.45 }}>
        <b>Esconder</b> tira da lista dos novos lançamentos sem apagar nada — os lançamentos antigos continuam iguais.
        <b> Excluir</b> de vez vale para o que vocês criaram; as de fábrica vão para “Removidas” e podem voltar.
        O que você faz aqui vale em todas as telas, para você e para a Nicoly.
      </p>

      {/* Nova categoria */}
      {criando ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input autoFocus value={nomeNova} onChange={e => setNomeNova(e.target.value)} placeholder={`Nome da nova categoria de ${kind}`}
            onKeyDown={e => { if (e.key === 'Enter') criarNovaCat() }}
            style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: `1px solid ${TERRA}`, padding: '0 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={criarNovaCat} disabled={ocupado} style={{ height: 44, padding: '0 16px', background: TERRA, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Criar</button>
          <button onClick={() => { setCriando(false); setNomeNova('') }} style={{ height: 44, padding: '0 12px', background: 'rgba(0,0,0,0.04)', color: TEXTMU, border: 'none', borderRadius: 12, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setCriando(true)}
          style={{ width: '100%', height: 44, marginBottom: 12, background: 'rgba(196,98,45,0.08)', color: TERRA, border: '1px dashed rgba(196,98,45,0.4)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={15} /> Nova categoria
        </button>
      )}

      {/* Lista */}
      {cats.map((c, i) => {
        const subs = subcategoriasDe(catalogo, c.name)
        const aberto = aberta === c.name
        return (
          <div key={c.kind + c.name} style={{ background: '#fff', borderRadius: 16, marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Linha
              titulo={c.name} icone={CAT_ICONS[c.name] || '📦'} sua={!c.builtin} escondida={c.status === 'escondida'}
              detalhe={`${subs.length} sub${subs.length === 1 ? '' : 's'}`}
              podeSubir={i > 0} podeDescer={i < cats.length - 1}
              onSubir={() => moverCat(i, -1)} onDescer={() => moverCat(i, 1)} onOlho={() => olhoCat(c)}
              onEditar={c.builtin ? undefined : () => { setEditando(chaveCat(c)); setTextoEd(c.name) }}
              onExcluir={() => excluirCat(c)}
              editando={editando === chaveCat(c)} texto={textoEd} onTexto={setTextoEd}
              onSalvar={() => exec(async () => { const r = await renomearCategoria(c, textoEd); if (r.ok) { setEditando(null); if (aberta === c.name) setAberta(textoEd.trim()) } return r }, 'Renomeada — lançamentos e limites atualizados')}
              onCancelar={() => setEditando(null)}
              onClick={() => { setAberta(aberto ? null : c.name); setNovaSubEm(null) }} aberta={aberto}
            />
            {aberto && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: '#FAFAFB', padding: '4px 0 8px 14px' }}>
                {subs.length === 0 && <p style={{ fontSize: 11, color: TEXTMU, margin: '8px 10px' }}>Nenhuma subcategoria ainda.</p>}
                {subs.map((s, j) => (
                  <Linha key={s.name}
                    titulo={s.name} sua={!s.builtin} escondida={s.status === 'escondida'}
                    podeSubir={j > 0} podeDescer={j < subs.length - 1}
                    onSubir={() => moverSub(subs, j, -1)} onDescer={() => moverSub(subs, j, 1)} onOlho={() => olhoSub(s)}
                    onEditar={s.builtin ? undefined : () => { setEditando(chaveSub(s)); setTextoEd(s.name) }}
                    onExcluir={() => excluirSub(s)}
                    editando={editando === chaveSub(s)} texto={textoEd} onTexto={setTextoEd}
                    onSalvar={() => exec(async () => { const r = await renomearSubcategoria(s, textoEd); if (r.ok) setEditando(null); return r }, 'Renomeada — lançamentos atualizados')}
                    onCancelar={() => setEditando(null)}
                  />
                ))}
                {novaSubEm === c.name ? (
                  <div style={{ display: 'flex', gap: 8, padding: '6px 10px 0 0' }}>
                    <input autoFocus value={nomeSub} onChange={e => setNomeSub(e.target.value)} placeholder="Nome da subcategoria"
                      onKeyDown={e => { if (e.key === 'Enter') criarNovaSub(c.name) }}
                      style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 10, border: `1px solid ${TERRA}`, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={() => criarNovaSub(c.name)} disabled={ocupado} style={{ height: 38, padding: '0 14px', background: TERRA, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Criar</button>
                    <button onClick={() => { setNovaSubEm(null); setNomeSub('') }} style={{ height: 38, padding: '0 10px', background: 'rgba(0,0,0,0.04)', color: TEXTMU, border: 'none', borderRadius: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setNovaSubEm(c.name); setNomeSub('') }}
                    style={{ margin: '6px 10px 0 0', background: 'none', border: 'none', color: TERRA, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0' }}>
                    <Plus size={13} /> Nova subcategoria
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Removidas (itens de fábrica) */}
      {totalRemovidas > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, marginTop: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <button onClick={() => setVerRemovidas(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Removidas ({totalRemovidas})</span>
            {verRemovidas ? <ChevronUp size={15} color={TEXTMU} /> : <ChevronDown size={15} color={TEXTMU} />}
          </button>
          {verRemovidas && (
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '4px 0' }}>
              {removidasCats.map(c => (
                <div key={'rc' + c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: TEXTMU }}>{CAT_ICONS[c.name] || '📦'} {c.name}</span>
                  <button onClick={() => exec(() => alterarStatusCategoria(c, 'ativa'), 'Categoria restaurada')}
                    style={{ height: 30, padding: '0 12px', background: 'rgba(196,98,45,0.1)', color: TERRA, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={12} /> Restaurar
                  </button>
                </div>
              ))}
              {removidasSubs.map(s => (
                <div key={'rs' + s.category + s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: TEXTMU }}>{s.name} <span style={{ fontSize: 10 }}>em {s.category}</span></span>
                  <button onClick={() => exec(() => alterarStatusSub(s, 'ativa'), 'Subcategoria restaurada')}
                    style={{ height: 30, padding: '0 12px', background: 'rgba(196,98,45,0.1)', color: TERRA, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RotateCcw size={12} /> Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
