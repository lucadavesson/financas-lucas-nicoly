import { createClient } from '@/lib/supabase/client'
import { rotuloMes } from '@/lib/utils/mesUtils'

/**
 * De quem é cada receita.
 *
 * O campo `holder` diz a quem o dinheiro pertence, e é ele que alimenta a
 * divisão por pessoa no Início. Várias receitas da Nicoly foram lançadas com
 * titular Lucas — o dinheiro até cai na conta dela ("C6 Bank — Nicoly"), mas a
 * tela dava a entrada para ele. Resultado: a parte dele aparecia bem maior do
 * que é, e a dela bem menor.
 *
 * Consertar isso na mão é inviável: cada receita parcelada é uma linha por
 * mês, então são dezenas de linhas para meia dúzia de compromissos. Aqui a
 * troca é por compromisso, de uma vez.
 */

export type GrupoReceita = {
  chave: string
  base: string
  holder: string
  qtd: number
  total: number
  periodo: string
  contas: string[]
  ids: string[]
  /** Salário vem do Ciclo Salarial: trocar o titular aqui brigaria com o gerador. */
  travado: boolean
}

function semParcela(desc: string): string {
  return (desc || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

export async function receitasPorTitular(): Promise<GrupoReceita[]> {
  const { data } = await createClient().from('transactions')
    .select('id,description,holder,purchase_date,amount,installment_value,transaction_type,type,card_name')
  const receitas = (data || []).filter((t: any) => t.transaction_type === 'receita' || t.type === 'Receita')

  const mapa = new Map<string, GrupoReceita & { _meses: string[] }>()
  for (const r of receitas) {
    const base = semParcela(r.description)
    const chave = `${base.toLowerCase()}|${r.holder || ''}`
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave, base, holder: r.holder || '', qtd: 0, total: 0, periodo: '',
        contas: [], ids: [], _meses: [],
        // 'Salário Lucas' e 'Salário Nicoly' são recriados todo mês pelo Ciclo
        // Salarial a partir de description + holder. Trocar o titular faria o
        // gerador achar que falta o do outro e criar de novo — some um, nasce
        // outro. Quem muda isso é a tela de Ciclo Salarial.
        travado: /^sal[áa]rio (lucas|nicoly)$/i.test(base),
      })
    }
    const g = mapa.get(chave)!
    g.qtd++
    g.total += (r.installment_value ?? r.amount ?? 0)
    g.ids.push(r.id)
    g._meses.push((r.purchase_date || '').slice(0, 7))
    if (r.card_name && !g.contas.includes(r.card_name)) g.contas.push(r.card_name)
  }

  return Array.from(mapa.values())
    .map(g => {
      const meses = g._meses.filter(Boolean).sort()
      const periodo = meses.length === 0 ? ''
        : meses[0] === meses[meses.length - 1] ? rotuloMes(meses[0])
        : `${rotuloMes(meses[0])} → ${rotuloMes(meses[meses.length - 1])}`
      const { _meses, ...resto } = g
      return { ...resto, periodo }
    })
    .sort((a, b) => a.holder.localeCompare(b.holder) || b.total - a.total)
}

export async function trocarTitular(ids: string[], novo: string): Promise<{ alteradas: number; erro?: string }> {
  const s = createClient()
  let alteradas = 0
  // Em lotes: uma lista longa demais no .in() estoura a URL do PostgREST.
  for (let i = 0; i < ids.length; i += 50) {
    const lote = ids.slice(i, i + 50)
    // owner_name acompanha o titular: é o que algumas telas usam como rótulo.
    const { error } = await s.from('transactions')
      .update({ holder: novo, owner_name: novo }).in('id', lote)
    if (error) return { alteradas, erro: error.message }
    alteradas += lote.length
  }
  return { alteradas }
}
