import { createClient } from '@/lib/supabase/client'
import { format, addMonths, parseISO } from 'date-fns'
import { calcBillingMonth } from '@/lib/utils'

/**
 * Corrige automaticamente o status de parcelas de compras parceladas cujo mês
 * já passou mas ainda não foram marcadas como 'Pago'. Regra de negócio (mesma
 * usada há tempos na tela de Parcelamentos, agora rodando sozinha sem precisar
 * clicar em "Corrigir"):
 *
 *   mês_da_parcela < mês_atual  → 'Pago'   (mês fechou, considera-se pago)
 *   mês_da_parcela === mês_atual→ 'Pendente'
 *   mês_da_parcela > mês_atual  → 'Previsto'
 *
 * Nunca mexe em 'Cancelado' nem desfaz um pagamento real já registrado
 * (status 'Pago' com paid_date preenchido). Roda automaticamente ao abrir
 * Dashboard, Parcelamentos, Cartões e Lançamentos, para que as 4 telas
 * sempre mostrem o mesmo status (fonte única de verdade: o banco).
 */
export async function autoCorrigirStatusVencido(): Promise<{ corrigidas: number }> {
  try {
  const s = createClient()
  const mesHoje = format(new Date(), 'yyyy-MM')

  // Antes de corrigir status, garante que todo parcelamento tem TODAS as suas
  // linhas no banco — senão parcelas de meses passados nem existem para corrigir
  // e a tela mostra "Futuro" sem data (bug do Vestido Noiva).
  await materializarParcelasFaltantes()

  // Só compras parceladas — regras de conta avulsa/recorrente exigem confirmação manual
  const { data, error } = await s
    .from('transactions')
    .select('id,status,purchase_date,installment_value,amount,paid_date')
    .eq('transaction_type', 'parcelada')
    .neq('status', 'Pago')
    .neq('status', 'Cancelado')
    .lt('purchase_date', `${mesHoje}-01`)

  if (error || !data || data.length === 0) return { corrigidas: 0 }

  let corrigidas = 0
  for (const p of data) {
    const mesParcela = p.purchase_date.slice(0, 7)
    if (mesParcela >= mesHoje) continue // segurança extra, o filtro do banco já cobre isso
    const { error: upErr } = await s
      .from('transactions')
      .update({
        status: 'Pago',
        paid_date: p.purchase_date,
        paid_amount: p.installment_value || p.amount,
      })
      .eq('id', p.id)
    if (!upErr) corrigidas++
  }
  return { corrigidas }
  } catch (e) {
    console.error('autoCorrigirStatusVencido:', e)
    return { corrigidas: 0 }
  }
}

/** Extrai o número da parcela de uma descrição no formato "Nome (3/12)". */
function numDaDescricao(desc: string): number | null {
  const m = desc?.match(/\((\d+)\/(\d+)\)$/)
  return m ? parseInt(m[1]) : null
}
/** Extrai o nome base, sem o sufixo "(3/12)". */
function baseDaDescricao(desc: string): string {
  return (desc || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

/**
 * Corrige compras parceladas LEGADAS que foram salvas com menos linhas do que o
 * número real de parcelas. Ex.: "Vestido Noiva" comprado em 03/2026 em 10x tinha
 * só a parcela 1 no banco — as outras 9 nunca foram criadas, então a tela de
 * Parcelamentos não tinha data para mostrar e caía no rótulo genérico "Futuro",
 * mesmo para parcelas de meses que já passaram.
 *
 * Esta função gera as linhas que faltam:
 *  - data de cada parcela = addMonths(data da parcela 1, n-1) — nunca new Date()
 *    manual, para não pular mês em fevereiro e meses curtos
 *  - se a parcela 1 não existir, a data base é retrocalculada a partir da
 *    parcela mais antiga que existir
 *  - status pela regra de mês (passado = Pago, atual = Pendente, futuro = Previsto)
 *  - billing_month recalculado pelo closing_day do cartão
 *
 * É idempotente: só insere números de parcela que ainda não existem no grupo.
 */
export async function materializarParcelasFaltantes(): Promise<{ criadas: number }> {
  try {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { criadas: 0 }

  const [{ data: txs }, { data: cards }] = await Promise.all([
    s.from('transactions').select('*').eq('transaction_type', 'parcelada'),
    s.from('cards').select('name,holder,closing_day'),
  ])
  if (!txs || txs.length === 0) return { criadas: 0 }

  const closingPorCartao: Record<string, number> = {}
  ;(cards || []).forEach((c: any) => { closingPorCartao[`${c.name} — ${c.holder}`] = c.closing_day || 1 })

  // Agrupa por (nome base | titular | cartão) — mesma chave usada na tela de Parcelamentos
  const grupos = new Map<string, any[]>()
  for (const tx of txs) {
    const key = `${baseDaDescricao(tx.description)}|${tx.holder}|${tx.card_name || ''}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(tx)
  }

  const mesHoje = format(new Date(), 'yyyy-MM')
  const novasLinhas: any[] = []

  for (const parcelas of grupos.values()) {
    const total = parcelas[0].installment_total || parcelas[0].total_installments || 0
    if (total <= 1) continue

    // Mapeia quais números de parcela já existem
    const existentes = new Map<number, any>()
    parcelas.forEach(p => {
      const n = numDaDescricao(p.description) ?? p.installment_num ?? p.installment_number
      if (n && !existentes.has(n)) existentes.set(n, p)
    })
    // GUARDA DE IDEMPOTÊNCIA — precisa vir antes de tudo.
    // Uma linha legada sem número (sem "(3/12)" na descrição e sem
    // installment_num) nunca entra em `existentes`. Sem esta guarda, a cada
    // carregamento de tela o grupo parecia estar faltando uma parcela e uma
    // nova linha era criada, duplicando dados a cada visita. Contar as LINHAS
    // (e não os números reconhecidos) torna a operação segura de repetir.
    if (parcelas.length >= total) continue

    // Dado legado sem número em lugar nenhum: trata a linha mais antiga como
    // sendo a parcela 1. Sem esta guarda, Math.min de um Map vazio dá Infinity
    // e a linha seguinte estoura com "Cannot read properties of undefined".
    if (existentes.size === 0) {
      const maisAntiga = [...parcelas].sort((a, b) =>
        (a.purchase_date || '').localeCompare(b.purchase_date || ''))[0]
      if (!maisAntiga?.purchase_date) continue
      existentes.set(1, maisAntiga)
      // Normaliza a linha no banco para ela passar a ser reconhecida como a
      // parcela 1 daqui pra frente, em vez de continuar "invisível"
      await s.from('transactions').update({
        installment_num: 1,
        description: `${baseDaDescricao(maisAntiga.description)} (1/${total})`,
      }).eq('id', maisAntiga.id)
    }
    if (existentes.size >= total) continue // grupo completo, nada a fazer

    // Data da parcela 1 (retrocalculada se a 1 não existir)
    const menorNum = Math.min(...Array.from(existentes.keys()))
    const refer = existentes.get(menorNum)
    if (!refer?.purchase_date) continue
    const dataParcela1 = addMonths(parseISO(refer.purchase_date), -(menorNum - 1))

    const modelo = existentes.get(1) || refer
    const base = baseDaDescricao(modelo.description)
    const closing = closingPorCartao[modelo.card_name || ''] || 1

    for (let n = 1; n <= total; n++) {
      if (existentes.has(n)) continue
      const dataParcela = addMonths(dataParcela1, n - 1)
      const purchaseDate = format(dataParcela, 'yyyy-MM-dd')
      const mesParcela = format(dataParcela, 'yyyy-MM')

      let status = 'Previsto'
      if (mesParcela < mesHoje) status = 'Pago'
      else if (mesParcela === mesHoje) status = 'Pendente'

      const valor = modelo.installment_value || modelo.amount

      novasLinhas.push({
        owner_id: user.id,
        owner_name: modelo.owner_name === 'Prata' ? 'Lucas' : (modelo.owner_name || 'Lucas'),
        holder: modelo.holder || 'Lucas',
        transaction_type: 'parcelada',
        type: 'Despesa',
        nature: modelo.nature || 'Variável',
        description: `${base} (${n}/${total})`,
        amount: valor,
        category: modelo.category,
        subcategory: modelo.subcategory || null,
        purchase_date: purchaseDate,
        payment_method: modelo.payment_method || 'cartao_credito',
        card_name: modelo.card_name || null,
        billing_month: modelo.payment_method === 'cartao_credito' || modelo.card_name
          ? format(calcBillingMonth(dataParcela, closing), 'yyyy-MM-dd')
          : null,
        status,
        paid_date: status === 'Pago' ? purchaseDate : null,
        paid_amount: status === 'Pago' ? valor : null,
        installment_total: total,
        installment_value: valor,
        installment_num: n,
      })
    }
  }

  if (novasLinhas.length === 0) return { criadas: 0 }
  const { error } = await s.from('transactions').insert(novasLinhas)
  if (error) return { criadas: 0 }
  return { criadas: novasLinhas.length }
  } catch (e) {
    // Correção de dado legado nunca pode impedir a tela de carregar
    console.error('materializarParcelasFaltantes:', e)
    return { criadas: 0 }
  }
}
