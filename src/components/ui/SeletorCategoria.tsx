'use client'
import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCatalogo, categoriasAtivas, subcategoriasAtivas, criarCategoria, criarSubcategoria, type Kind,
} from '@/lib/utils/catalogo'

type Estilos = {
  lbl: React.CSSProperties
  sel: React.CSSProperties      // estilo de um <select> (já com appearance:none)
  inp: React.CSSProperties      // estilo de um <input> de texto
  selCat?: React.CSSProperties  // extra só para o select de categoria (ex.: borda de erro)
}

const TERRA = '#C4622D'
const TEXTMU = '#8E8E93'

/**
 * Seletor ÚNICO de categoria + subcategoria. É o mesmo em Novo lançamento, Editar
 * e no editor de conta recorrente, então tudo que você cria aqui fica salvo e
 * aparece em todos os outros lugares (e para a Nicoly), sem criar de novo.
 * Mostra só as ativas; a que o lançamento já tem aparece mesmo se foi escondida.
 */
export default function SeletorCategoria({
  kind, categoria, subcategoria, onChange, estilos, obrigatorio = true, rotulos = true, required = false,
}: {
  kind: Kind
  categoria: string
  subcategoria: string
  onChange: (categoria: string, subcategoria: string) => void
  estilos: Estilos
  obrigatorio?: boolean
  rotulos?: boolean
  required?: boolean
}) {
  const { catalogo } = useCatalogo()
  const [criandoCat, setCriandoCat] = useState(false)
  const [nomeCat, setNomeCat] = useState('')
  const [criandoSub, setCriandoSub] = useState(false)
  const [nomeSub, setNomeSub] = useState('')
  const [salvando, setSalvando] = useState(false)

  const cats = categoriasAtivas(catalogo, kind, [categoria])
  const subs = categoria ? subcategoriasAtivas(catalogo, categoria, subcategoria) : []

  async function salvarCat() {
    if (salvando || !nomeCat.trim()) return
    setSalvando(true)
    const r = await criarCategoria(nomeCat, kind)
    setSalvando(false)
    if (!r.ok) { toast.error(r.erro || 'Não foi possível criar a categoria'); return }
    toast.success(r.reativada ? 'Essa categoria já existia e voltou para a lista' : r.jaExistia ? 'Essa categoria já existia — selecionei para você' : 'Categoria criada e salva!')
    onChange(r.nome!, '')
    setNomeCat(''); setCriandoCat(false)
  }

  async function salvarSub() {
    if (salvando || !nomeSub.trim() || !categoria) return
    setSalvando(true)
    const r = await criarSubcategoria(categoria, nomeSub)
    setSalvando(false)
    if (!r.ok) { toast.error(r.erro || 'Não foi possível criar a subcategoria'); return }
    toast.success(r.reativada ? 'Essa subcategoria já existia e voltou para a lista' : r.jaExistia ? 'Essa subcategoria já existia — selecionei para você' : 'Subcategoria criada e salva!')
    onChange(categoria, r.nome!)
    setNomeSub(''); setCriandoSub(false)
  }

  const chevron = <ChevronDown size={14} color={TEXTMU} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
  const campoNovo = (valor: string, setValor: (v: string) => void, placeholder: string, salvar: () => void, cancelar: () => void) => (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} autoFocus
        // Enter dentro de um formulário enviaria o lançamento — aqui só cria o item
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvar() } }}
        style={{ ...estilos.inp, flex: 1, height: 40, fontSize: 13 }} />
      <button type="button" onClick={salvar} disabled={salvando}
        style={{ height: 40, padding: '0 14px', background: TERRA, color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        {salvando ? '...' : 'OK'}
      </button>
      <button type="button" onClick={cancelar}
        style={{ height: 40, padding: '0 10px', background: 'rgba(0,0,0,0.04)', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
        <X size={14} color={TERRA} />
      </button>
    </div>
  )

  return (
    <>
      <div>
        {rotulos && <label style={estilos.lbl}>Categoria{obrigatorio && <span style={{ color: TERRA, fontWeight: 700 }}> *</span>}</label>}
        <div style={{ position: 'relative' }}>
          <select value={categoria} required={required}
            onChange={e => {
              if (e.target.value === '__nova_cat__') { setCriandoCat(true); return }
              onChange(e.target.value, '')
            }}
            style={{ ...estilos.sel, ...estilos.selCat }}>
            <option value="">Selecione...</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__nova_cat__">+ Criar nova categoria...</option>
          </select>
          {chevron}
        </div>
        {criandoCat && campoNovo(nomeCat, setNomeCat, 'Nome da nova categoria', salvarCat, () => { setCriandoCat(false); setNomeCat('') })}
      </div>

      {categoria && (
        <div>
          {rotulos && <label style={estilos.lbl}>Subcategoria</label>}
          <div style={{ position: 'relative' }}>
            <select value={subcategoria}
              onChange={e => {
                if (e.target.value === '__nova_sub__') { setCriandoSub(true); return }
                onChange(categoria, e.target.value)
              }}
              style={estilos.sel}>
              <option value="">Sem subcategoria</option>
              {subs.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__nova_sub__">+ Criar nova subcategoria...</option>
            </select>
            {chevron}
          </div>
          {criandoSub && campoNovo(nomeSub, setNomeSub, 'Nome da nova subcategoria', salvarSub, () => { setCriandoSub(false); setNomeSub('') })}
        </div>
      )}
    </>
  )
}
