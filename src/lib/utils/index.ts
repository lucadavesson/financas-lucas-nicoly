import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, addMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/**
 * Numa compra parcelada, cada parcela é uma linha própria cujo purchase_date
 * é a data DE REFERÊNCIA daquela parcela (mês a mês) — não a data em que a
 * compra foi feita. Mostrar esse campo cru em qualquer lista dava a entender
 * que "a Moto" tinha sido comprada em agosto, depois em setembro, conforme a
 * parcela exibida. Esta função reconstrói a data real da compra (a mesma
 * conta usada no editor de lançamento e já usada em Parcelamentos), para que
 * TODA tela que mostra uma parcela mostre a mesma data — a original, fixa —
 * em vez da data rolante de cada linha.
 *
 * Retorna null quando a descrição não tem o padrão "(N/T)" (não é parcela).
 */
export function dataCompraOriginal(description: string, purchaseDate: string): Date | null {
  const m = (description || '').match(/\((\d+)\/(\d+)\)$/)
  if (!m || !purchaseDate) return null
  const num = parseInt(m[1])
  if (!num) return null
  return addMonths(parseISO(purchaseDate), -(num - 1))
}

/** Data a mostrar numa linha de lançamento: a da compra original se for parcela, senão a própria. */
export function dataParaExibir(description: string, purchaseDate: string): Date {
  return dataCompraOriginal(description, purchaseDate) || parseISO(purchaseDate)
}

export function calcBillingMonth(purchaseDate: Date, closingDay: number): Date {
  const day = purchaseDate.getDate()
  if (day <= closingDay) {
    return new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1)
  }
  return new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, 1)
}

export function calcImplicitInterest(totalValue: number, entry: number, installmentValue: number, installments: number) {
  const financed = totalValue - entry
  const totalPaid = installmentValue * installments
  const totalInterest = Math.max(0, totalPaid - financed)
  const interestPct = financed > 0 ? (totalInterest / financed) * 100 : 0
  return { totalPaid, totalInterest, interestPct, financed }
}

export const CATS_RECEITA = ['Salário','Renda Extra','Investimentos','Benefícios','Outros']
export const CATS_DESPESA = ['Moradia','Alimentação','Transporte','Saúde','Educação','Dívidas e Financiamentos','Impostos e Taxas','Cuidados Pessoais','Lazer e Entretenimento','Roupas e Compras','Investimentos','Casamento','Outros']
export const SUBCATS: Record<string, string[]> = {
  'Moradia':['Financiamento','Aluguel','Condomínio','Energia','Água','Internet','Manutenção da Casa','Outros'],
  'Alimentação':['Mercado','Restaurante','Delivery','Outros'],
  'Transporte':['Veículo','Manutenção Veículo','Acessórios Veículo','Seguro Veículo','Estacionamento','Uber / 99','Combustível','Transporte Público','Outros'],
  'Saúde':['Plano de Saúde','Consulta','Exames','Farmácia','Outros'],
  'Educação':['Faculdade / Pós','Cursos','Livros','Assinaturas Educacionais','Outros'],
  'Impostos e Taxas':['IPVA','IPTU','Imposto de Renda','Taxas Bancárias','Outros'],
  'Cuidados Pessoais':['Academia','Barbeiro / Cabelo','Estética','Manicure','Procedimentos','Outros'],
  'Lazer e Entretenimento':['Eventos','Viagens','Festas','Assinaturas','Outros'],
  'Roupas e Compras':['Roupas','Calçados','Acessórios','Outros'],
  'Investimentos':['Aportes','Objetivos Financeiros','Poupança','Outros'],
  'Casamento':['Fotógrafo','Espaço + Buffet','Cerimonialista','Vestido da Noiva','Terno do Noivo','Músicos','Outros'],
  'Dívidas e Financiamentos':['Financiamento Veículo','Financiamento Imóvel','Empréstimo Pessoal','Cartão de Crédito','Outros'],
  'Renda Extra':['Freelance','Comissão','Aluguel Recebido','Outros'],
  'Benefícios':['Vale Refeição','Vale Alimentação','Bônus','Férias','Outros'],
  'Outros':['Imprevistos','Outros'],
}
export const STATUS_LABEL: Record<string, string> = {
  pendente:'Pendente', pago:'Pago', previsto:'Previsto', atrasado:'Atrasado', cancelado:'Cancelado'
}
export const STATUS_COLORS: Record<string, string> = {
  pago:'bg-green-50 text-green-700', pendente:'bg-amber-50 text-amber-700',
  previsto:'bg-blue-50 text-blue-700', atrasado:'bg-red-50 text-red-700',
  cancelado:'bg-gray-100 text-gray-500',
}
export const CAT_ICONS: Record<string, string> = {
  'Moradia':'🏠','Alimentação':'🍔','Transporte':'🚗','Saúde':'💊','Educação':'📚',
  'Lazer e Entretenimento':'🎬','Roupas e Compras':'👕','Investimentos':'📈',
  'Casamento':'💍','Cuidados Pessoais':'💆','Impostos e Taxas':'📋',
  'Dívidas e Financiamentos':'💳','Salário':'💰','Renda Extra':'💵',
  'Benefícios':'🎁','Outros':'📦',
}

/* ── Máscara monetária BR ────────────────── */
export function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function unmaskCurrency(masked: string): number {
  const digits = masked.replace(/\D/g, '')
  return parseInt(digits || '0', 10) / 100
}
