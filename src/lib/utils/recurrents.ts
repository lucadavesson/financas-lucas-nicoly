import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function generateRecurrents(targetMonth: Date) {
  const s = createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) return { generated: 0 }

  const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthKey = format(targetMonth, 'yyyy-MM')

  // 1. Buscar todas as transações recorrentes
  // recurring_active=false = conta encerrada: para de gerar daqui pra frente,
  // mas o histórico continua com is_recurring=true para não mudar de
  // classificação nos relatórios dos meses em que ela existiu de verdade.
  // Contas recorrentes são compartilhadas do casal — não filtrar por
  // owner_id, senão uma conta criada por um dos dois nunca é gerada quando
  // é o outro quem abre o Início (mesmo padrão já usado em statusEngine.ts
  // e na tela Configurações > Contas Recorrentes).
  const { data: allRecurring } = await s.from('transactions').select('*')
    .eq('is_recurring', true)
    .or('recurring_active.is.null,recurring_active.eq.true')
    .order('purchase_date', { ascending: false })

  if (!allRecurring || allRecurring.length === 0) return { generated: 0 }

  // 2. Deduplica: pega o template mais recente de cada description+holder
  const templateMap = new Map<string, any>()
  for (const t of allRecurring) {
    const key = `${t.description}|${t.holder}`
    if (!templateMap.has(key)) templateMap.set(key, t)
  }
  const templates = Array.from(templateMap.values())

  // 3. Buscar transações já existentes no mês alvo
  // Mesma lógica: não filtrar por owner_id, para não gerar uma conta
  // duplicada (ou deixar de detectar a existente) quando ela foi criada
  // pelo outro titular do casal.
  const { data: existing } = await s.from('transactions').select('id,description,holder')
    .gte('purchase_date', monthStart)
    .lte('purchase_date', monthEnd)

  const existingKeys = new Set(
    (existing || []).map(t => `${t.description}|${t.holder}`)
  )

  // 4. Para cada template único, se não existe no mês alvo, criar
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
      type: tpl.type || 'Despesa',
      nature: tpl.nature || 'Variável',
      transaction_type: tpl.transaction_type,
      description: tpl.description,
      amount: tpl.expected_amount || tpl.amount,
      category: tpl.category,
      subcategory: tpl.subcategory || null,
      purchase_date: purchaseDate,
      payment_method: tpl.payment_method || null,
      card_name: tpl.card_name || null,
      status: tpl.transaction_type === 'receita' ? 'Previsto' : 'Pendente',
      is_recurring: true,
      recurring_day: tpl.recurring_day,
      expected_amount: tpl.expected_amount || tpl.amount,
      notes: tpl.notes || null,
    })
    if (!error) generated++
  }

  // Gerar receita de salário se configurado
  // Config compartilhada do casal — não filtrar por owner_id
  const { data: settings } = await s.from('app_settings').select('*').limit(1).maybeSingle()
  if (settings) {
    const salaryDay = settings.salary_day || 1
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    const actualDay = Math.min(salaryDay, lastDay)
    const salaryDate = `${monthKey}-${String(actualDay).padStart(2, '0')}`

    // Lucas
    if (settings.salary_lucas && settings.salary_lucas > 0) {
      const existsL = (existing || []).some(t => t.description === 'Salário Lucas' && t.holder === 'Lucas')
      if (!existsL) {
        const { error } = await s.from('transactions').insert({
          owner_id: user.id, owner_name: 'Lucas', holder: 'Lucas',
          type: 'Receita', transaction_type: 'receita', nature: 'Fixo',
          description: 'Salário Lucas', amount: settings.salary_lucas,
          category: 'Salário', purchase_date: salaryDate,
          status: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? 'Pago' : 'Previsto',
          paid_date: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? salaryDate : null,
          paid_amount: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? settings.salary_lucas : null,
          is_recurring: true, recurring_day: salaryDay,
          expected_amount: settings.salary_lucas,
        })
        if (!error) generated++
      }
    }

    // Nicoly
    if (settings.salary_nicoly && settings.salary_nicoly > 0) {
      const existsN = (existing || []).some(t => t.description === 'Salário Nicoly' && t.holder === 'Nicoly')
      if (!existsN) {
        const { error } = await s.from('transactions').insert({
          owner_id: user.id, owner_name: 'Nicoly', holder: 'Nicoly',
          type: 'Receita', transaction_type: 'receita', nature: 'Fixo',
          description: 'Salário Nicoly', amount: settings.salary_nicoly,
          category: 'Salário', purchase_date: salaryDate,
          status: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? 'Pago' : 'Previsto',
          paid_date: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? salaryDate : null,
          paid_amount: salaryDate <= format(new Date(), 'yyyy-MM-dd') ? settings.salary_nicoly : null,
          is_recurring: true, recurring_day: salaryDay,
          expected_amount: settings.salary_nicoly,
        })
        if (!error) generated++
      }
    }
  }

  return { generated }
}
