import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

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
  const s = createClient()
  const mesHoje = format(new Date(), 'yyyy-MM')

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
}
