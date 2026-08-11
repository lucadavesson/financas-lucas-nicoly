import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function generateRecurrents(targetMonth: Date) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { generated: 0 }

  const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthKey = format(targetMonth, 'yyyy-MM')

  // 1. Buscar todas as transações recorrentes (templates)
  const { data: templates } = await s.from('transactions').select('*')
    .eq('is_recurring', true)
    .eq('owner_id', user.id)

  if (!templates || templates.length === 0) return { generated: 0 }

  // 2. Buscar transações já existentes no mês alvo
  const { data: existing } = await s.from('transactions').select('id,description,holder,is_recurring')
    .gte('purchase_date', monthStart)
    .lte('purchase_date', monthEnd)
    .eq('owner_id', user.id)

  const existingKeys = new Set(
    (existing || []).map(t => `${t.description}|${t.holder}`)
  )

  // 3. Para cada template, se não existe no mês alvo, criar
  let generated = 0
  for (const tpl of templates) {
    const key = `${tpl.description}|${tpl.holder}`
    if (existingKeys.has(key)) continue

    const day = tpl.recurring_day || new Date(tpl.purchase_date).getDate()
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    const actualDay = Math.min(day, lastDay)
    const purchaseDate = `${monthKey}-${String(actualDay).padStart(2, '0')}`

    const { error } = await s.from('transactions').insert({
      owner_id: user.id,
      owner_name: tpl.owner_name,
      holder: tpl.holder,
      type: tpl.type,
      transaction_type: tpl.transaction_type,
      nature: tpl.nature || 'Variável',
      description: tpl.description,
      amount: tpl.expected_amount || tpl.amount,
      category: tpl.category,
      subcategory: tpl.subcategory || null,
      purchase_date: purchaseDate,
      payment_method: tpl.payment_method,
      card_name: tpl.card_name || null,
      status: tpl.transaction_type === 'receita' ? 'Previsto' : 'Pendente',
      is_recurring: true,
      recurring_day: tpl.recurring_day,
      expected_amount: tpl.expected_amount || tpl.amount,
      notes: tpl.notes || null,
    })
    if (!error) generated++
  }

  return { generated }
}
