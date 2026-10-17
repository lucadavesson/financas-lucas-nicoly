'use client'
import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { useCatalogo, categoriasAtivas, subcategoriasAtivas, type Catalogo } from '@/lib/utils/catalogo'
import { mesAtual, rotuloMes, somaMeses } from '@/lib/utils/mesUtils'
import { montarLancamentos } from '@/lib/utils/importacao'
import { interpretarFatura, linhasDasPaginas, type FaturaLida } from '@/lib/utils/faturaPdf'
import { lerPaginasDoPdf } from '@/lib/utils/faturaPdfBrowser'
import {
  prepararLinhas, sugerirMesFatura, conferencia, paraLinhasOk, atualizacoesCartaoFisico,
  type Alias, type CartaoApp, type ExistenteFull, type LinhaFatura,
} from '@/lib/utils/faturaImport'

const BG = '#F5F5F7', TEXT = '#1C1C1E', TEXTLT = '#48484A', TEXTMU = '#8E8E93', TERRA = '#C4622D', GREEN = '#34C759', RED = '#FF3B30', AMBER = '#B37700'
const caixa: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.05)' }
const tit: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: TEXT, margin: '0 0 4px' }
const sub: React.CSSProperties = { fontSize: 12, color: TEXTMU, margin: 0, lineHeight: 1.45 }
const campo: React.CSSProperties = { width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#F5F5F7', padding: '0 10px', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }
const botao = (cor: string, cheio = true): React.CSSProperties => ({
  height: 46, borderRadius: 13, border: cheio ? 'none' : `1px solid ${cor}`, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 14px',
})
const RESPONSAVEIS = ['Lucas', 'Nicoly', 'Prata']
/** 'LUCAS D S SANTOS' + '4690' → 'Lucas ···4690' (qual cartão físico da fatura) */
const rotuloCartao = (l: LinhaFatura) => {
  const n = (l.titularLido.trim().split(/\s+/)[0] || '').toLowerCase()
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ···${l.final}`
}

/* ── Uma compra da fatura, editável ─────────────────────────────── */
// Fora da página de propósito: se fosse definida lá dentro, cada letra digitada recriaria
// a linha e o campo perderia o foco.
const LinhaEditavel = memo(function LinhaEditavel({ l, catalogo, onChange }: {
  l: LinhaFatura; catalogo: Catalogo | null; onChange: (id: string, patch: Partial<LinhaFatura>) => void
}) {
  const cats = categoriasAtivas(catalogo, 'despesa', [l.categoria])
  const subs = l.categoria ? subcategoriasAtivas(catalogo, l.categoria, l.subcategoria) : []
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid rgba(0,0,0,0.06)', opacity: l.incluir ? 1 : 0.5 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input value={l.nome} onChange={e => onChange(l.id, { nome: e.target.value })} aria-label="Nome" style={{ ...campo, fontWeight: 600 }} />
        <p style={{ fontSize: 14, fontWeight: 800, color: TEXT, margin: 0, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(l.valor)}</p>
      </div>
      <p style={{ fontSize: 11, color: TEXTMU, margin: '5px 2px 8px', lineHeight: 1.4 }}>
        <span style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px', fontWeight: 600, color: TEXTLT, marginRight: 6 }}>{rotuloCartao(l)}</span>
        {l.descBanco} · {l.data.slice(8)}/{l.data.slice(5, 7)}
        {l.parcela && <> · <b style={{ color: TERRA }}>parcela {l.parcela.x}/{l.parcela.y}</b> (cria as {l.parcela.y} parcelas)</>}
        {l.qtd > 1 && <> · <b>{l.qtd} compras</b> ({l.periodo})</>}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={l.categoria} onChange={e => onChange(l.id, { categoria: e.target.value, subcategoria: '' })} style={{ ...campo, flex: 1 }} aria-label="Categoria">
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {subs.length > 0 && (
          <select value={l.subcategoria} onChange={e => onChange(l.id, { subcategoria: e.target.value })} style={{ ...campo, flex: 1 }} aria-label="Subcategoria">
            <option value="">Sem subcategoria</option>
            {subs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: TEXTMU, marginRight: 2 }}>De quem:</span>
        {RESPONSAVEIS.map(r => (
          <button key={r} type="button" onClick={() => onChange(l.id, { responsavel: r })}
            style={{ height: 28, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: l.responsavel === r ? 700 : 500, background: l.responsavel === r ? TERRA : 'rgba(0,0,0,0.05)', color: l.responsavel === r ? '#fff' : TEXTLT }}>{r}</button>
        ))}
        <button type="button" onClick={() => onChange(l.id, { incluir: !l.incluir })}
          style={{ marginLeft: 'auto', height: 28, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.05)', color: l.incluir ? RED : GREEN }}>
          {l.incluir ? 'Não lançar' : 'Lançar'}
        </button>
      </div>
    </div>
  )
})

export default function ImportarFatura() {
  const router = useRouter()
  const { catalogo } = useCatalogo()
  const [cartoes, setCartoes] = useState<CartaoApp[]>([])
  const [existentes, setExistentes] = useState<ExistenteFull[]>([])
  const [aliases, setAliases] = useState<Alias[]>([])
  const [semMemoria, setSemMemoria] = useState(false)
  const [semColuna, setSemColuna] = useState(false)
  const [lida, setLida] = useState<FaturaLida | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [banco, setBanco] = useState('')
  const [faturaYM, setFaturaYM] = useState('')
  const [agrupar, setAgrupar] = useState(true)
  const [linhas, setLinhas] = useState<LinhaFatura[]>([])
  const [respostas, setRespostas] = useState<Record<string, 'mesma' | 'outra'>>({})
  const [soOutros, setSoOutros] = useState(false)
  const [verJa, setVerJa] = useState(false)
  const [verCartoes, setVerCartoes] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState<{ lote: string; qtd: number; aprendidos: number; enriquecidos?: number } | null>(null)

  async function carregarBase() {
    const s = createClient()
    const { data: cs } = await s.from('cards').select('name,holder,card_type,closing_day').eq('is_active', true)
    setCartoes((cs || []).map((c: any) => ({
      nome: `${c.name} — ${c.holder}`, banco: c.name, holder: c.holder,
      fechamento: c.closing_day || 1, credito: !c.card_type || c.card_type === 'credito',
    })))
    const todas: ExistenteFull[] = []
    for (let de = 0; de < 30000; de += 1000) {
      const { data } = await s.from('transactions')
        .select('id,description,purchase_date,amount,card_name,installment_total,installment_num,billing_month,holder').order('id').range(de, de + 999)
      if (!data || data.length === 0) break
      todas.push(...(data as any))
      if (data.length < 1000) break
    }
    setExistentes(todas)
    const { data: al, error } = await s.from('estabelecimentos').select('chave,nome,categoria,subcategoria,responsavel')
    if (error) { setSemMemoria(true); setAliases([]) } else { setSemMemoria(false); setAliases((al || []) as Alias[]) }
  }
  useEffect(() => { carregarBase() }, [])

  // Recalcula a lista quando muda o arquivo, o banco, o mês ou o agrupamento (não a cada edição sua)
  useEffect(() => {
    if (!lida || !banco || !faturaYM) { setLinhas([]); return }
    setLinhas(prepararLinhas(lida, { banco, faturaYM, cartoes, existentes, aliases, agrupar }))
    setRespostas({})
  }, [lida, banco, faturaYM, agrupar, cartoes, existentes, aliases])

  async function lerArquivo(f: File) {
    setLendo(true); setResultado(null)
    try {
      const lido = interpretarFatura(linhasDasPaginas(await lerPaginasDoPdf(f)))
      if (lido.cartoes.length === 0) {
        toast.error('Não reconheci essa fatura. Por enquanto leio o PDF da fatura do Santander.')
        setLida(null); setNomeArquivo(''); return
      }
      const bancos = Array.from(new Set(cartoes.filter(c => c.credito).map(c => c.banco)))
      setBanco(bancos.find(b => /santander/i.test(b)) || bancos[0] || '')
      setFaturaYM(sugerirMesFatura(lido))
      setLida(lido); setNomeArquivo(f.name)
    } catch (e: any) {
      toast.error('Não consegui ler o PDF: ' + (e?.message || 'arquivo inválido'))
      setLida(null); setNomeArquivo('')
    } finally { setLendo(false) }
  }

  const atualiza = (id: string, patch: Partial<LinhaFatura>) => setLinhas(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)))
  const responder = (l: LinhaFatura, r: 'mesma' | 'outra') => {
    setRespostas(x => ({ ...x, [l.id]: r }))
    atualiza(l.id, { incluir: r === 'outra' })
  }

  const parceladasNovas = linhas.filter(l => l.situacao === 'nova' && l.tipo === 'parcelada')
  const comprasNovas = linhas.filter(l => l.situacao === 'nova' && l.tipo === 'avista')
  const talvez = linhas.filter(l => l.situacao === 'talvez')
  const jaExiste = linhas.filter(l => l.situacao === 'ja_existe')
  const semResposta = talvez.filter(l => !respostas[l.id]).length
  const semCartao = Array.from(new Set(linhas.filter(l => !l.cartao).map(l => l.titularLido)))
  const aLancar = linhas.filter(l => l.incluir && l.cartao)
  const outros = aLancar.filter(l => l.categoria === 'Outros').length
  const conf = useMemo(() => (lida ? conferencia(lida, linhas) : []), [lida, linhas])
  const soma = (f: (l: LinhaFatura) => boolean) => Math.round(linhas.filter(f).reduce((s, l) => s + l.valor, 0) * 100) / 100
  const totalLancar = soma(l => l.incluir && !!l.cartao)
  const totalJa = soma(l => !l.incluir && l.situacao !== 'nova')
  const totalFora = soma(l => !l.incluir && l.situacao === 'nova')
  const totalPdf = lida ? lida.soma : 0
  const fecha = Math.abs(totalLancar + totalJa + totalFora - totalPdf) < 0.01
  const mostrar = (l: LinhaFatura) => !soOutros || l.categoria === 'Outros'
  const meses = Array.from({ length: 15 }, (_, i) => somaMeses(mesAtual(), i - 13))
  const podeImportar = !!lida && aLancar.length > 0 && semResposta === 0 && !importando && !semColuna

  async function importar() {
    if (!podeImportar) return
    const s = createClient()
    const { data: { user } } = await s.auth.getUser()
    if (!user) { toast.error('Sessão expirada. Entre de novo.'); return }
    setImportando(true); setProgresso(0)
    const lote = `imp-${format(new Date(), 'yyyyMMdd-HHmmss')}`
    const ctx = { cartoes: cartoes.map(c => ({ nome: c.nome, fechamento: c.fechamento, credito: c.credito })), hojeMes: mesAtual() }
    const registros = paraLinhasOk(linhas, faturaYM).flatMap(l => montarLancamentos(l, ctx, { owner_id: user.id, import_batch: lote }))
    let gravados = 0
    for (let i = 0; i < registros.length; i += 100) {
      const parte = registros.slice(i, i + 100)
      const { error } = await s.from('transactions').insert(parte)
      if (error) {
        const falta = /import_batch|card_final/i.test(error.message)
        if (falta) setSemColuna(true)
        toast.error(falta ? `Falta uma etapa no banco (coluna ${/card_final/i.test(error.message) ? 'card_final — rode supabase-card-final.sql' : 'import_batch'}). Nada foi gravado.` : `Erro ao gravar: ${error.message}`)
        if (gravados > 0) setResultado({ lote, qtd: gravados, aprendidos: 0, enriquecidos: 0 })
        setImportando(false); return
      }
      gravados += parte.length
      setProgresso(Math.round((gravados / registros.length) * 100))
    }

    // compras que você já tinha e o PDF reconheceu ganham o cartão físico (só onde ainda está vazio)
    let enriquecidos = 0
    for (const u of atualizacoesCartaoFisico(linhas, respostas)) {
      const q = s.from('transactions').update({ card_final: u.final })
      const { error: e2 } = u.kind === 'id'
        ? await q.eq('id', u.id).is('card_final', null)
        : await q.eq('card_name', u.cartao).eq('installment_total', u.y).like('description', `${u.base.replace(/[%_\\]/g, '\\$&')} (%`)
            .gte('amount', u.valor - 0.05).lte('amount', u.valor + 0.05).is('card_final', null)
      if (!e2) enriquecidos++
    }

    // memória: da próxima vez o nome e a categoria já vêm preenchidos
    let aprendidos = 0
    if (!semMemoria) {
      const usos = new Map(aliases.map(a => [a.chave, 1]))
      const novos = new Map<string, any>()
      for (const l of aLancar) {
        if (l.categoria === 'Outros') continue
        novos.set(l.chave, { chave: l.chave, nome: l.nome.trim() || l.descBanco, categoria: l.categoria, subcategoria: l.subcategoria || null, responsavel: l.responsavel, usos: (usos.get(l.chave) || 0) + 1, updated_at: new Date().toISOString() })
      }
      if (novos.size > 0) {
        const { error } = await s.from('estabelecimentos').upsert(Array.from(novos.values()), { onConflict: 'chave' })
        if (!error) aprendidos = novos.size
      }
    }
    setImportando(false)
    setResultado({ lote, qtd: gravados, aprendidos, enriquecidos })
    setLida(null); setNomeArquivo(''); setLinhas([])
    toast.success(`${gravados} lançamentos importados!`)
    carregarBase()
  }

  async function desfazer() {
    if (!resultado) return
    if (!confirm(`Desfazer esta importação?\n\nIsso APAGA os ${resultado.qtd} lançamentos que entraram nela. O resto do app não é tocado.`)) return
    const { error } = await createClient().from('transactions').delete().eq('import_batch', resultado.lote)
    if (error) { toast.error(`Não foi possível desfazer: ${error.message}`); return }
    toast.success('Importação desfeita'); setResultado(null); carregarBase()
  }

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '14px 14px 170px' }}>
      <button onClick={() => router.back()} style={{ background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: TEXT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <ChevronLeft size={16} />Voltar
      </button>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 4px' }}>Importar fatura</h2>
      <p style={{ fontSize: 12, color: TEXTMU, margin: '0 0 16px', lineHeight: 1.45 }}>Escolha o PDF da fatura. O app lê no seu celular, reconhece o que já está lançado e você só ajusta nome e categoria.</p>

      {semColuna && (
        <div style={{ ...caixa, background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)' }}>
          <p style={{ ...sub, color: '#8A6D00' }}>⚠️ Falta uma etapa no banco (coluna <b>import_batch</b>). Rode <b>supabase-import-batch.sql</b> no Supabase e recarregue.</p>
        </div>
      )}
      {semMemoria && (
        <div style={{ ...caixa, background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)' }}>
          <p style={{ ...sub, color: '#8A6D00' }}>ℹ️ Para o app <b>lembrar</b> o nome e a categoria de cada estabelecimento, rode <b>supabase-estabelecimentos.sql</b> no Supabase. Sem isso a importação funciona, mas não aprende.</p>
        </div>
      )}

      {resultado && (
        <div style={{ ...caixa, background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.3)' }}>
          <p style={{ ...tit, color: GREEN }}>✓ {resultado.qtd} lançamentos importados</p>
          <p style={sub}>
            Já aparecem em Cartões, Lançamentos e Relatórios.
            {!!resultado.enriquecidos && <> Mais <b>{resultado.enriquecidos}</b> compras que você já tinha ganharam o cartão físico, para o resumo “por cartão”.</>}
            {resultado.aprendidos > 0 && <> O app aprendeu o nome e a categoria de <b>{resultado.aprendidos}</b> estabelecimentos — na próxima fatura já vêm preenchidos.</>}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Link href="/cartoes" style={{ ...botao(GREEN), flex: 1, height: 40, fontSize: 13, textDecoration: 'none' }}>Ver em Cartões</Link>
            <button onClick={desfazer} style={{ ...botao(RED, false), flex: 1, height: 40, fontSize: 13 }}>Desfazer</button>
          </div>
        </div>
      )}

      {/* 1. PDF */}
      <div style={caixa}>
        <p style={tit}>1. Escolha o PDF da fatura</p>
        <p style={sub}>Fatura do Santander em PDF. O arquivo é lido aqui no aparelho — não é enviado para lugar nenhum.</p>
        <label style={{ ...botao(TERRA), marginTop: 12, cursor: lendo ? 'default' : 'pointer', opacity: lendo ? 0.6 : 1 }}>
          {lendo ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />Lendo a fatura…</> : nomeArquivo ? '📄 Trocar o PDF' : '📄 Escolher o PDF'}
          <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} disabled={lendo}
            onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); e.target.value = '' }} />
        </label>
        {nomeArquivo && <p style={{ ...sub, marginTop: 8 }}>{nomeArquivo}</p>}
      </div>

      {lida && (
        <>
          {/* 2. O que o app entendeu */}
          <div style={caixa}>
            <p style={tit}>2. Confira o que o app entendeu</p>
            <p style={{ fontSize: 13, color: lida.confere ? GREEN : AMBER, fontWeight: 600, margin: '4px 0 10px', lineHeight: 1.4 }}>
              {lida.confere
                ? `✓ ${lida.cartoes.length} cartões · ${formatCurrency(totalPdf)} — a soma das compras confere com o total do PDF.`
                : `⚠️ Li ${formatCurrency(totalPdf)}, mas não consegui conferir com o total do PDF. Revise com atenção.`}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={{ ...sub, marginBottom: 4, fontWeight: 600 }}>Cartão do app</p>
                <select value={banco} onChange={e => setBanco(e.target.value)} style={campo}>
                  {Array.from(new Set(cartoes.filter(c => c.credito).map(c => c.banco))).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <p style={{ ...sub, marginBottom: 4, fontWeight: 600 }}>Fatura de</p>
                <select value={faturaYM} onChange={e => setFaturaYM(e.target.value)} style={campo}>
                  {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
                </select>
              </div>
            </div>
            <p style={{ ...sub, marginTop: 8 }}>A fatura é do mês em que ela <b>fecha</b> (a de compras até o fechamento de setembro é “set/26”). O PDF sem capa não diz o mês — confira.</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: TEXT, lineHeight: 1.4, marginTop: 12 }}>
              <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Juntar compras do mesmo lugar numa linha só (Uber, 99, iFood, mercado…). O total não muda.</span>
            </label>
            {semCartao.length > 0 && (
              <p style={{ fontSize: 12, color: RED, margin: '10px 0 0', lineHeight: 1.4 }}>
                ✕ Não achei no app o cartão de {semCartao.map(t => t.split(' ')[0]).join(', ')} em “{banco}”. Cadastre em Configurações → Cartões e Contas — essas compras ficam de fora.
              </p>
            )}
          </div>

          {/* 3. Perguntas */}
          {talvez.length > 0 && (
            <div style={{ ...caixa, background: 'rgba(255,170,0,0.07)', border: '1px solid rgba(255,170,0,0.3)' }}>
              <p style={{ ...tit, color: '#8A6D00' }}>❓ Preciso da sua confirmação ({talvez.length})</p>
              <p style={{ ...sub, marginBottom: 10 }}>Estas parecem compras que você já lançou. Diga se é a mesma ou outra.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {talvez.map(l => (
                  <div key={l.id} style={{ background: '#fff', borderRadius: 14, padding: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>{l.descBanco} · {formatCurrency(l.valor)}</p>
                    <p style={{ fontSize: 11, color: TEXTMU, margin: '2px 0 8px' }}>
                      {rotuloCartao(l)} · {l.tipo === 'parcelada' ? `parcela ${l.parcela!.x}/${l.parcela!.y}` : `${l.data.slice(8)}/${l.data.slice(5, 7)}`}
                    </p>
                    <p style={{ fontSize: 12, color: AMBER, margin: '0 0 8px', lineHeight: 1.4 }}>
                      Parece com <b>{l.achado?.desc}</b> ({formatCurrency(l.achado?.valor || 0)}{l.tipo === 'avista' && l.achado ? ` em ${l.achado.data.slice(8)}/${l.achado.data.slice(5, 7)}` : ''}) — {l.achado?.motivo}.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => responder(l, 'mesma')} style={{ ...botao(GREEN, respostas[l.id] === 'mesma'), flex: 1, height: 38, fontSize: 13 }}>É a mesma</button>
                      <button onClick={() => responder(l, 'outra')} style={{ ...botao(TERRA, respostas[l.id] === 'outra'), flex: 1, height: 38, fontSize: 13 }}>É outra</button>
                    </div>
                    {respostas[l.id] === 'outra' && (
                      <div style={{ marginTop: 10 }}><LinhaEditavel l={l} catalogo={catalogo} onChange={atualiza} /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parceladasNovas.length > 0 && (
            <div style={caixa}>
              <p style={tit}>💳 Compras parceladas novas ({parceladasNovas.length})</p>
              <p style={{ ...sub, marginBottom: 10 }}>Ainda não estão no app. Cada uma cria todas as parcelas, as antigas já como pagas.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {parceladasNovas.filter(mostrar).map(l => <LinhaEditavel key={l.id} l={l} catalogo={catalogo} onChange={atualiza} />)}
              </div>
            </div>
          )}

          {comprasNovas.length > 0 && (
            <div style={caixa}>
              <p style={tit}>🛒 Compras novas ({comprasNovas.length})</p>
              <p style={{ ...sub, marginBottom: 10 }}>Ajuste só o nome e a categoria. Na próxima fatura o app lembra.</p>
              {outros > 0 && (
                <button onClick={() => setSoOutros(v => !v)} style={{ background: soOutros ? TERRA : 'rgba(196,98,45,0.1)', color: soOutros ? '#fff' : TERRA, border: 'none', borderRadius: 10, height: 34, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                  {soOutros ? 'Mostrar todas' : `Mostrar só as ${outros} em “Outros” para revisar`}
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comprasNovas.filter(mostrar).map(l => <LinhaEditavel key={l.id} l={l} catalogo={catalogo} onChange={atualiza} />)}
              </div>
            </div>
          )}

          {jaExiste.length > 0 && (
            <div style={caixa}>
              <button onClick={() => setVerJa(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <p style={tit}>✓ Já estão no app ({jaExiste.length}) {verJa ? '▲' : '▼'}</p>
                <p style={sub}>Não serão lançadas de novo. Toque para ver.</p>
              </button>
              {verJa && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jaExiste.map(l => (
                    <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: TEXT, margin: 0 }}>{l.achado?.desc} · {formatCurrency(l.valor)}</p>
                        <p style={{ fontSize: 10.5, color: TEXTMU, margin: '1px 0 0' }}>{rotuloCartao(l)} · {l.descBanco} — {l.achado?.motivo}</p>
                      </div>
                      <button onClick={() => atualiza(l.id, { incluir: !l.incluir })} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, height: 30, padding: '0 10px', fontSize: 11, fontWeight: 600, color: l.incluir ? RED : TERRA, cursor: 'pointer', flexShrink: 0 }}>
                        {l.incluir ? 'Não lançar' : 'Lançar mesmo assim'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Conferência e importar */}
          <div style={caixa}>
            <p style={tit}>3. Confira o total</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '8px 0 4px' }}>
              {([['Total da fatura (PDF)', totalPdf, TEXT], ['Já no app', totalJa, TEXTMU], ['A lançar agora', totalLancar, GREEN], ['Fora (você tirou)', totalFora, TEXTMU]] as const).map(([r, v, c]) => (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: TEXTLT }}>{r}</span><b style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(v)}</b>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: fecha ? GREEN : RED, margin: '6px 0 0' }}>{fecha ? '✓ As partes fecham com o total da fatura.' : '⚠️ As partes não fecham com o total do PDF.'}</p>
            <button onClick={() => setVerCartoes(v => !v)} style={{ background: 'none', border: 'none', color: TERRA, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 0 0' }}>{verCartoes ? 'Esconder' : 'Ver'} por cartão</button>
            {verCartoes && conf.map(c => (
              <p key={c.final} style={{ fontSize: 11.5, color: TEXTLT, margin: '4px 0 0' }}>{c.cartao} ···{c.final}: PDF {formatCurrency(c.totalPdf)} = já {formatCurrency(c.jaNoApp)} + lançar {formatCurrency(c.aLancar)} + fora {formatCurrency(c.fora)}</p>
            ))}
            {semResposta > 0 && <p style={{ fontSize: 12, color: AMBER, margin: '10px 0 0', fontWeight: 600 }}>Responda as {semResposta} pergunta{semResposta > 1 ? 's' : ''} acima para importar.</p>}
            {outros > 0 && <p style={{ ...sub, marginTop: 8 }}>{outros} compra{outros > 1 ? 's estão' : ' está'} em “Outros”. Dá para importar assim e ajustar depois.</p>}
            <button onClick={importar} disabled={!podeImportar}
              style={{ ...botao(GREEN), width: '100%', marginTop: 12, opacity: podeImportar ? 1 : 0.4, cursor: podeImportar ? 'pointer' : 'not-allowed' }}>
              {importando ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />Importando… {progresso}%</> : `Importar ${aLancar.length} compra${aLancar.length === 1 ? '' : 's'} (${formatCurrency(totalLancar)})`}
            </button>
          </div>
        </>
      )}

      <p style={{ ...sub, textAlign: 'center', marginTop: 8 }}>
        Prefere planilha? <Link href="/importar" style={{ color: TERRA, fontWeight: 700 }}>Importar por planilha</Link>
        {' · '}Importações anteriores e “Desfazer”: também lá.
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
