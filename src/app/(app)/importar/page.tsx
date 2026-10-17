'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, Download, Loader2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { useCatalogo, categoriasDoTipo, subcategoriasDe, criarCategoria, criarSubcategoria } from '@/lib/utils/catalogo'
import { mesAtual, rotuloMes } from '@/lib/utils/mesUtils'
import {
  COLUNAS, lerCSV, validarPlanilha, montarLancamentos, resumoPorFatura,
  linhasDoModelo, linhasDeAjuda, linhasDasListas,
  type CartaoInfo, type Contexto, type ExistenteTx,
} from '@/lib/utils/importacao'

const BG = '#F5F5F7', TEXT = '#1C1C1E', TEXTLT = '#48484A', TEXTMU = '#8E8E93', TERRA = '#C4622D', GREEN = '#34C759', RED = '#FF3B30', AMBER = '#B37700'
const caixa: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.05)' }
const titulo: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: TEXT, margin: '0 0 4px' }
const sub: React.CSSProperties = { fontSize: 12, color: TEXTMU, margin: 0, lineHeight: 1.45 }
const botao = (cor: string, cheio = true): React.CSSProperties => ({
  height: 46, borderRadius: 13, border: cheio ? 'none' : `1px solid ${cor}`, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 14px',
})

type Lote = { lote: string; qtd: number; de: string; ate: string }

function rotuloLote(lote: string) {
  const m = lote.match(/^imp-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}` : lote
}

function baixar(blob: Blob, nome: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

export default function Importar() {
  const router = useRouter()
  const { catalogo } = useCatalogo()
  const [cartoes, setCartoes] = useState<CartaoInfo[]>([])
  const [existentes, setExistentes] = useState<ExistenteTx[]>([])
  const [linhas, setLinhas] = useState<any[][] | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [criarFaltantes, setCriarFaltantes] = useState(false)
  const [pularDup, setPularDup] = useState(true)
  const [ignorarErros, setIgnorarErros] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState<{ lote: string; qtd: number; parcial?: string } | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [semColuna, setSemColuna] = useState(false)
  const [verAvisos, setVerAvisos] = useState(false)
  const [verColunas, setVerColunas] = useState(false)
  const [verTodasFaturas, setVerTodasFaturas] = useState(false)

  async function carregarBase() {
    const s = createClient()
    const { data: cs } = await s.from('cards').select('name,holder,card_type,closing_day').eq('is_active', true)
    setCartoes((cs || []).map((c: any) => ({ nome: `${c.name} — ${c.holder}`, fechamento: c.closing_day || 1, credito: !c.card_type || c.card_type === 'credito' })))
    // Para achar lançamento repetido: todo o histórico, em páginas (o Supabase devolve no máximo 1000 por vez)
    const todas: ExistenteTx[] = []
    for (let de = 0; de < 30000; de += 1000) {
      const { data } = await s.from('transactions')
        .select('description,purchase_date,amount,card_name,installment_total,holder').order('id').range(de, de + 999)
      if (!data || data.length === 0) break
      todas.push(...(data as any))
      if (data.length < 1000) break
    }
    setExistentes(todas)
  }

  async function carregarLotes() {
    const s = createClient()
    const mapa = new Map<string, Lote>()
    for (let de = 0; de < 30000; de += 1000) {
      const { data, error } = await s.from('transactions').select('import_batch,purchase_date').not('import_batch', 'is', null).order('id').range(de, de + 999)
      if (error) { setSemColuna(true); setLotes([]); return }
      if (!data || data.length === 0) break
      for (const r of data as any[]) {
        const a = mapa.get(r.import_batch) || { lote: r.import_batch, qtd: 0, de: r.purchase_date, ate: r.purchase_date }
        a.qtd++; if (r.purchase_date < a.de) a.de = r.purchase_date; if (r.purchase_date > a.ate) a.ate = r.purchase_date
        mapa.set(r.import_batch, a)
      }
      if (data.length < 1000) break
    }
    setSemColuna(false)
    setLotes(Array.from(mapa.values()).sort((a, b) => b.lote.localeCompare(a.lote)))
  }

  useEffect(() => { carregarBase(); carregarLotes() }, [])

  const ctx = useMemo<Contexto | null>(() => {
    if (!catalogo) return null
    const despesa = categoriasDoTipo(catalogo, 'despesa').map(c => c.name)
    const receita = categoriasDoTipo(catalogo, 'receita').map(c => c.name)
    const subs: Record<string, string[]> = {}
    ;[...despesa, ...receita].forEach(c => { subs[c] = subcategoriasDe(catalogo, c).map(x => x.name) })
    return { cartoes, categorias: { despesa, receita }, subcategorias: subs, existentes, hojeMes: mesAtual(), criarFaltantes }
  }, [catalogo, cartoes, existentes, criarFaltantes])

  const val = useMemo(() => (linhas && ctx ? validarPlanilha(linhas, ctx) : null), [linhas, ctx])
  const aImportar = useMemo(() => (val ? val.ok.filter(l => !(pularDup && l.duplicada)) : []), [val, pularDup])
  const montados = useMemo(
    () => (ctx ? aImportar.flatMap(l => montarLancamentos(l, { cartoes: ctx.cartoes, hojeMes: ctx.hojeMes }, { owner_id: 'x', import_batch: 'x' })) : []),
    [aImportar, ctx],
  )
  const resumo = useMemo(() => resumoPorFatura(montados), [montados])
  const totalGeral = useMemo(() => montados.filter(m => m.type !== 'Receita').reduce((s, m) => s + Number(m.amount), 0), [montados])

  async function lerArquivo(f: File) {
    setLendo(true); setResultado(null); setIgnorarErros(false); setVerTodasFaturas(false)
    try {
      let rows: any[][]
      if (f.name.toLowerCase().endsWith('.xlsx')) {
        const { default: readXlsxFile } = await import('read-excel-file/browser')
        const abas: any = await readXlsxFile(f)
        const aba = abas.find((x: any) => /lan[cç]amentos/i.test(x.sheet)) || abas[0]
        rows = aba.data
      } else {
        rows = lerCSV(await f.text())
      }
      setLinhas(rows); setNomeArquivo(f.name)
    } catch (e: any) {
      toast.error('Não consegui ler o arquivo: ' + (e?.message || 'formato inválido'))
      setLinhas(null); setNomeArquivo('')
    } finally { setLendo(false) }
  }

  async function baixarXlsx() {
    if (!ctx) return
    const { default: writeExcelFile } = await import('write-excel-file/universal')
    const m = linhasDoModelo()
    const negrito = (t: string) => ({ value: t, fontWeight: 'bold' as const })
    const limpa = (rs: string[][]) => rs.map(r => r.map(c => (c === '' ? null : c)))
    const listas = linhasDasListas({ categorias: ctx.categorias, subcategorias: ctx.subcategorias, cartoes: ctx.cartoes })
    const blob = await writeExcelFile([
      { data: [m.cabecalho.map(negrito), ...limpa(m.exemplos)], sheet: 'Lançamentos', columns: COLUNAS.map(c => ({ width: Math.max(15, c.titulo.length + 4) })) },
      { data: limpa(linhasDeAjuda()), sheet: 'Como preencher', columns: [{ width: 24 }, { width: 36 }, { width: 100 }] },
      { data: [listas[0].map(negrito), ...limpa(listas.slice(1))], sheet: 'Listas', columns: listas[0].map(() => ({ width: 26 })) },
    ]).toBlob()
    baixar(blob, 'modelo-importacao-lancamentos.xlsx')
  }

  function baixarCsv() {
    const m = linhasDoModelo()
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const txt = '\uFEFF' + [m.cabecalho, ...m.exemplos].map(r => r.map(esc).join(';')).join('\r\n')
    baixar(new Blob([txt], { type: 'text/csv;charset=utf-8' }), 'modelo-importacao-lancamentos.csv')
  }

  async function importar() {
    if (!ctx || !val || importando) return
    const s = createClient()
    const { data: { user } } = await s.auth.getUser()
    if (!user) { toast.error('Sessão expirada. Entre de novo.'); return }
    setImportando(true); setProgresso(0); setResultado(null)

    // categorias e subcategorias novas: criar antes, uma vez cada
    if (criarFaltantes) {
      const vistas = new Set<string>()
      for (const l of aImportar) {
        const kind = l.tipo === 'receita' ? 'receita' : 'despesa'
        if (l.novaCategoria && !vistas.has(`c|${kind}|${l.categoria}`)) {
          vistas.add(`c|${kind}|${l.categoria}`)
          const r = await criarCategoria(l.categoria, kind)
          if (!r.ok) { toast.error(`Categoria "${l.categoria}": ${r.erro}`); setImportando(false); return }
        }
        if (l.novaSub && l.subcategoria && !vistas.has(`s|${l.categoria}|${l.subcategoria}`)) {
          vistas.add(`s|${l.categoria}|${l.subcategoria}`)
          const r = await criarSubcategoria(l.categoria, l.subcategoria)
          if (!r.ok) { toast.error(`Subcategoria "${l.subcategoria}": ${r.erro}`); setImportando(false); return }
        }
      }
    }

    const lote = `imp-${format(new Date(), 'yyyyMMdd-HHmmss')}`
    const registros = aImportar.flatMap(l => montarLancamentos(l, { cartoes: ctx.cartoes, hojeMes: ctx.hojeMes }, { owner_id: user.id, import_batch: lote }))
    let gravados = 0
    for (let i = 0; i < registros.length; i += 100) {
      const lote100 = registros.slice(i, i + 100)
      const { error } = await s.from('transactions').insert(lote100)
      if (error) {
        const faltaColuna = /import_batch/i.test(error.message)
        if (faltaColuna) setSemColuna(true)
        toast.error(faltaColuna ? 'Falta uma etapa no banco (coluna import_batch). Nada foi gravado.' : `Erro ao gravar: ${error.message}`)
        setResultado(gravados > 0 ? { lote, qtd: gravados, parcial: `A importação parou no meio: ${gravados} de ${registros.length} lançamentos entraram. Desfaça e tente de novo.` } : null)
        setImportando(false); carregarLotes(); return
      }
      gravados += lote100.length
      setProgresso(Math.round((gravados / registros.length) * 100))
    }
    setImportando(false)
    setResultado({ lote, qtd: gravados })
    setLinhas(null); setNomeArquivo('')
    toast.success(`${gravados} lançamento${gravados > 1 ? 's' : ''} importado${gravados > 1 ? 's' : ''}!`)
    carregarLotes(); carregarBase()
  }

  async function desfazer(lote: string, qtd: number) {
    if (!confirm(`Desfazer a importação de ${rotuloLote(lote)}?\n\nIsso APAGA os ${qtd} lançamentos que entraram nela. O resto do app não é tocado.`)) return
    const { error } = await createClient().from('transactions').delete().eq('import_batch', lote)
    if (error) { toast.error(`Não foi possível desfazer: ${error.message}`); return }
    toast.success('Importação desfeita')
    setResultado(r => (r?.lote === lote ? null : r))
    carregarLotes(); carregarBase()
  }

  const nOk = val?.ok.length ?? 0
  const nDup = val ? val.ok.filter(l => l.duplicada).length : 0
  const nErro = val?.erros.length ?? 0
  const podeImportar = !!val && aImportar.length > 0 && (nErro === 0 || ignorarErros) && !importando && !semColuna

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '14px 14px 160px' }}>
      <button onClick={() => router.back()} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: TEXT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <ChevronLeft size={16} />Voltar
      </button>
      <Link href="/importar/fatura" style={{ display: 'block', background: 'rgba(196,98,45,0.08)', border: '1px solid rgba(196,98,45,0.25)', borderRadius: 14, padding: '12px 14px', marginBottom: 14, textDecoration: 'none' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: TERRA, margin: 0 }}>📄 Tem o PDF da fatura? Importe direto →</p>
        <p style={{ fontSize: 11.5, color: TEXTLT, margin: '3px 0 0', lineHeight: 1.4 }}>Sem planilha: o app lê o PDF no celular, reconhece o que já está lançado e você só ajusta nome e categoria.</p>
      </Link>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Importar lançamentos por planilha</h2>
      <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 16px' }}>Vários lançamentos de uma vez, por planilha. Nada é gravado antes de você conferir.</p>

      {semColuna && (
        <div style={{ ...caixa, background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)' }}>
          <p style={{ fontSize: 12, color: '#8A6D00', margin: 0, lineHeight: 1.45 }}>
            ⚠️ Falta uma etapa no banco (a coluna <b>import_batch</b>, que permite desfazer uma importação). Rode o arquivo <b>supabase-import-batch.sql</b> no Supabase e recarregue esta tela.
          </p>
        </div>
      )}

      {/* 1. Modelo */}
      <div style={caixa}>
        <p style={titulo}>1. Baixe o modelo</p>
        <p style={sub}>Uma linha por lançamento. Tipos: à vista, parcelada e receita. A aba <b>Listas</b> traz as categorias e os cartões de hoje.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={baixarXlsx} disabled={!ctx} style={{ ...botao(TERRA), flex: 1 }}><Download size={16} />Excel (.xlsx)</button>
          <button onClick={baixarCsv} style={{ ...botao(TERRA, false), flex: 1 }}><Download size={16} />CSV</button>
        </div>
        <button onClick={() => setVerColunas(v => !v)} style={{ background: 'none', border: 'none', color: TERRA, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '10px 0 0' }}>
          {verColunas ? 'Esconder' : 'Ver'} as colunas do modelo
        </button>
        {verColunas && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COLUNAS.map(c => (
              <div key={c.chave} style={{ background: '#F5F5F7', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, margin: 0 }}>{c.titulo} <span style={{ fontWeight: 500, color: TEXTMU }}>· obrigatória em: {c.obrigatoria}</span></p>
                <p style={{ fontSize: 11, color: TEXTLT, margin: '2px 0 0', lineHeight: 1.4 }}>{c.ajuda}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Envio */}
      <div style={caixa}>
        <p style={titulo}>2. Envie a planilha preenchida</p>
        <p style={sub}>Aceita .xlsx e .csv.</p>
        <label style={{ ...botao(TERRA), marginTop: 12, cursor: lendo ? 'default' : 'pointer', opacity: lendo ? 0.6 : 1 }}>
          {lendo ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Upload size={16} />}
          {nomeArquivo ? 'Trocar arquivo' : 'Escolher arquivo'}
          <input type="file" accept=".xlsx,.csv,.txt,text/csv" style={{ display: 'none' }} disabled={lendo}
            onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); e.target.value = '' }} />
        </label>
        {nomeArquivo && <p style={{ ...sub, marginTop: 8 }}>📄 {nomeArquivo}</p>}
      </div>

      {/* 3. Conferência */}
      {val && (
        <div style={caixa}>
          <p style={titulo}>3. Confira antes de importar</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: GREEN, background: 'rgba(52,199,89,0.1)', borderRadius: 8, padding: '4px 10px' }}>✓ {nOk} prontas</span>
            {nErro > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: RED, background: 'rgba(255,59,48,0.08)', borderRadius: 8, padding: '4px 10px' }}>✕ {nErro} com erro</span>}
            {nDup > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: AMBER, background: 'rgba(255,170,0,0.12)', borderRadius: 8, padding: '4px 10px' }}>⧉ {nDup} repetida{nDup > 1 ? 's' : ''}</span>}
            {val.ignoradas > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: TEXTMU, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '4px 10px' }}>{val.ignoradas} de exemplo</span>}
          </div>

          {nErro > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: RED, margin: '0 0 6px' }}>Corrija na planilha e envie de novo:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {val.erros.slice(0, 40).map((e, i) => (
                  <div key={i} style={{ background: 'rgba(255,59,48,0.05)', borderRadius: 10, padding: '7px 10px' }}>
                    <p style={{ fontSize: 11.5, color: TEXT, margin: 0, lineHeight: 1.4 }}><b>{e.n > 0 ? `Linha ${e.n}` : 'Arquivo'}:</b> {e.msg}</p>
                  </div>
                ))}
                {val.erros.length > 40 && <p style={sub}>… e mais {val.erros.length - 40} erros.</p>}
              </div>
            </div>
          )}

          {val.avisos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setVerAvisos(v => !v)} style={{ background: 'none', border: 'none', color: AMBER, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                {verAvisos ? 'Esconder' : 'Ver'} {val.avisos.length} aviso{val.avisos.length > 1 ? 's' : ''}
              </button>
              {verAvisos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {val.avisos.map((a, i) => (
                    <div key={i} style={{ background: 'rgba(255,170,0,0.08)', borderRadius: 10, padding: '7px 10px' }}>
                      <p style={{ fontSize: 11.5, color: TEXT, margin: 0, lineHeight: 1.4 }}><b>Linha {a.n}:</b> {a.msg}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            {nDup > 0 && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: TEXT, lineHeight: 1.4 }}>
                <input type="checkbox" checked={pularDup} onChange={e => setPularDup(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Pular as {nDup} repetidas (já existem no app ou estão duas vezes na planilha)</span>
              </label>
            )}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: TEXT, lineHeight: 1.4 }}>
              <input type="checkbox" checked={criarFaltantes} onChange={e => setCriarFaltantes(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Criar categorias e subcategorias que ainda não existem (em vez de dar erro)</span>
            </label>
            {nErro > 0 && nOk > 0 && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: TEXT, lineHeight: 1.4 }}>
                <input type="checkbox" checked={ignorarErros} onChange={e => setIgnorarErros(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Importar só as {nOk} linhas prontas e deixar as {nErro} com erro de fora</span>
              </label>
            )}
          </div>

          {aImportar.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, margin: '0 0 2px' }}>O que vai entrar em cada fatura</p>
              <p style={{ ...sub, marginBottom: 8 }}>Compare com o total da fatura do banco. Receitas não entram nesta conta.</p>
              {(verTodasFaturas ? resumo : resumo.slice(0, 8)).map(r => (
                <div key={r.mes + r.onde} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, margin: 0 }}>{rotuloMes(r.mes)} · {r.onde}</p>
                    <p style={{ fontSize: 10.5, color: TEXTMU, margin: '1px 0 0' }}>{r.qtd} lançamento{r.qtd > 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatCurrency(r.total)}</p>
                </div>
              ))}
              {resumo.length > 8 && (
                <button onClick={() => setVerTodasFaturas(v => !v)} style={{ background: 'none', border: 'none', color: TERRA, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 0 0' }}>
                  {verTodasFaturas ? 'Ver menos' : `Ver todas (${resumo.length})`}
                </button>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEXTMU, margin: 0 }}>{montados.length} lançamentos no total</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: TEXT, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalGeral)}</p>
              </div>
            </div>
          )}

          <button onClick={importar} disabled={!podeImportar}
            style={{ ...botao(GREEN), width: '100%', marginTop: 14, opacity: podeImportar ? 1 : 0.4, cursor: podeImportar ? 'pointer' : 'not-allowed' }}>
            {importando ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />Importando… {progresso}%</> : `Importar ${montados.length} lançamento${montados.length === 1 ? '' : 's'}`}
          </button>
          {nErro > 0 && !ignorarErros && <p style={{ ...sub, marginTop: 8, textAlign: 'center' }}>Corrija os erros — ou marque a opção de importar só as linhas prontas.</p>}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={{ ...caixa, background: resultado.parcial ? 'rgba(255,170,0,0.1)' : 'rgba(52,199,89,0.08)', border: `1px solid ${resultado.parcial ? 'rgba(255,170,0,0.3)' : 'rgba(52,199,89,0.3)'}` }}>
          <p style={{ ...titulo, color: resultado.parcial ? AMBER : GREEN }}>{resultado.parcial ? '⚠️ Importação incompleta' : `✓ ${resultado.qtd} lançamentos importados`}</p>
          <p style={sub}>{resultado.parcial || 'Já aparecem em Lançamentos, Cartões e Relatórios.'}</p>
          <button onClick={() => desfazer(resultado.lote, resultado.qtd)} style={{ ...botao(RED, false), height: 40, marginTop: 10, fontSize: 13 }}>Desfazer esta importação</button>
        </div>
      )}

      {/* Importações anteriores */}
      {lotes.length > 0 && (
        <div style={caixa}>
          <p style={titulo}>Importações anteriores</p>
          <p style={{ ...sub, marginBottom: 8 }}>Se algo entrou errado, desfaça a importação inteira e envie de novo.</p>
          {lotes.map(l => (
            <div key={l.lote} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, margin: 0 }}>{rotuloLote(l.lote)}</p>
                <p style={{ fontSize: 10.5, color: TEXTMU, margin: '1px 0 0' }}>{l.qtd} lançamentos · datas de {format(new Date(l.de + 'T12:00:00'), 'dd/MM/yy')} a {format(new Date(l.ate + 'T12:00:00'), 'dd/MM/yy')}</p>
              </div>
              <button onClick={() => desfazer(l.lote, l.qtd)} style={{ background: 'rgba(255,59,48,0.08)', color: RED, border: 'none', borderRadius: 9, height: 32, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Desfazer</button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
