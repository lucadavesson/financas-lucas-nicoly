import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { calcBillingMonth } from '@/lib/utils'
import {
  conferirGrupo, baseDaDescricao, totalDoGrupo, pagamentoFoiAutomatico,
  type LinhaParcela, type Problema,
} from '@/lib/utils/parcelasCore'

/**
 * Conferência de parcelamentos — a parte que fala com o banco.
 *
 * Existe porque um furo de dado não aparece na tela: a parcela 12 da
 * M3PRODUTOS estava com a data da parcela 1, e o resultado visível era só um
 * mês (set/2026) que sumia da lista, sem nenhum aviso. Conferir grupo a grupo
 * na mão não escala e não se repete; aqui vira um botão.
 *
 * Só aponta. Corrigir é um segundo passo, explícito, porque mexer em data e
 * status de lançamento é mexer no histórico financeiro de alguém.
 */

export type GrupoAuditado = {
  chave: string
  base: string
  holder: string
  card: string
  total: number
  linhas: LinhaParcela[]
  problemas: Problema[]
}

export type Auditoria = {
  gruposConferidos: number
  linhasConferidas: number
  comProblema: GrupoAuditado[]
}

async function carregarParcelas(): Promise<LinhaParcela[]> {
  // Sem filtro de owner_id: as compras são do casal. Filtrar por quem está
  // logado esconderia justamente os grupos lançados pelo outro — que são os
  // que mais têm chance de estar torto, por serem os mais antigos.
  const { data } = await createClient().from('transactions').select('*')
    .eq('transaction_type', 'parcelada')
  return (data || []) as LinhaParcela[]
}

function agrupar(linhas: LinhaParcela[]): Map<string, LinhaParcela[]> {
  const grupos = new Map<string, LinhaParcela[]>()
  for (const l of linhas) {
    // Mesma chave da tela de Parcelamentos e do statusEngine.
    const chave = `${baseDaDescricao(l.description)}|${l.holder || ''}|${l.card_name || ''}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(l)
  }
  return grupos
}

export async function auditarParcelas(): Promise<Auditoria> {
  const linhas = await carregarParcelas()
  const grupos = agrupar(linhas)
  const comProblema: GrupoAuditado[] = []

  for (const [chave, doGrupo] of grupos) {
    const total = totalDoGrupo(doGrupo)
    if (!total || total <= 1) continue
    const problemas = conferirGrupo(doGrupo, total)
    if (problemas.length === 0) continue
    const [base, holder, card] = chave.split('|')
    comProblema.push({ chave, base, holder, card, total, linhas: doGrupo, problemas })
  }

  return {
    gruposConferidos: Array.from(grupos.values()).filter(g => totalDoGrupo(g) > 1).length,
    linhasConferidas: linhas.length,
    comProblema,
  }
}

/** Texto curto do problema, para a tela. */
export function descreverProblema(p: Problema): string {
  const br = (d: string) => d.split('-').reverse().join('/')
  switch (p.tipo) {
    case 'data_fora_de_sequencia':
      return `Parcela ${p.num} está em ${br(p.deData)} — deveria estar em ${br(p.paraData)}`
    case 'parcela_faltando':
      return `Falta a parcela ${p.num} (${br(p.dataEsperada)})`
    case 'numero_repetido':
      return `Parcela ${p.num} aparece ${p.ids.length}x`
    case 'sem_numero':
      return p.numSugerido
        ? `Uma linha sem número de parcela — pela data, é a ${p.numSugerido}`
        : 'Uma linha sem número de parcela'
  }
}

/**
 * Corrige as datas fora de sequência.
 *
 * Só mexe no que é claramente conserto mecânico:
 *  - a data da parcela e o mês da fatura;
 *  - o status, pela mesma regra de mês do resto do app;
 *  - o pagamento, apenas quando ele tinha sido carimbado automaticamente
 *    (paid_date igual à data da parcela). Se a pessoa registrou um pagamento
 *    de verdade, com data própria, o registro fica como está — o app não tem
 *    o direito de apagar isso.
 */
export async function corrigirDatas(grupos: GrupoAuditado[]): Promise<{ corrigidas: number; erros: string[] }> {
  const s = createClient()
  const { data: cards } = await s.from('cards').select('name,holder,closing_day')
  const fechamento: Record<string, number> = {}
  for (const c of cards || []) fechamento[`${c.name} — ${c.holder}`] = c.closing_day || 1

  const mesHoje = format(new Date(), 'yyyy-MM')
  let corrigidas = 0
  const erros: string[] = []

  for (const g of grupos) {
    for (const p of g.problemas) {
      if (p.tipo !== 'data_fora_de_sequencia') continue
      const linha = g.linhas.find(l => l.id === p.id)
      if (!linha) continue

      const patch: Record<string, any> = { purchase_date: p.paraData }

      if (linha.card_name) {
        const fech = fechamento[linha.card_name] || 1
        patch.billing_month = format(calcBillingMonth(parseISO(p.paraData), fech), 'yyyy-MM-dd')
      }

      if (pagamentoFoiAutomatico(linha)) {
        // O "pago" era só o carimbo do motor em cima da data errada. Com a data
        // certa, vale a regra de mês — e um mês que ainda não chegou volta a
        // ser uma conta em aberto, não um pagamento inventado.
        const mes = p.paraData.slice(0, 7)
        patch.status = mes < mesHoje ? 'Pago' : (mes === mesHoje ? 'Pendente' : 'Previsto')
        patch.paid_date = mes < mesHoje ? p.paraData : null
        patch.paid_amount = mes < mesHoje ? (linha.paid_amount ?? null) : null
      }

      const { error } = await s.from('transactions').update(patch).eq('id', linha.id)
      if (error) erros.push(`${g.base} parcela ${p.num}: ${error.message}`)
      else corrigidas++
    }
  }

  return { corrigidas, erros }
}
