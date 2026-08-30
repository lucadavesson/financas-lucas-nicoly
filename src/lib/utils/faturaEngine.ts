import { format } from 'date-fns'

/**
 * Retorna o primeiro dia (yyyy-MM-dd) do ciclo de fatura mais recente que já FECHOU
 * para um cartão com o dia de fechamento informado.
 *
 * Ex.: closingDay=2, hoje=30/08 → dia(30) > 2 → o ciclo de agosto já fechou dia 2/08
 *      closingDay=13, hoje=05/08 → dia(5) <= 13 → agosto ainda não fechou, o fechado é julho
 */
export function getCicloFechado(closingDay: number, hoje: Date = new Date()): string {
  const dia = hoje.getDate()
  if (dia > closingDay) {
    return format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')
  }
  return format(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), 'yyyy-MM-dd')
}

/** Evita mostrar alerta de confirmação para ciclos muito antigos (histórico anterior a este recurso). */
export function cicloEhRecente(cicloFechado: string, hoje: Date = new Date(), diasMax = 60): boolean {
  const dt = new Date(cicloFechado + 'T12:00:00')
  const diffDias = (hoje.getTime() - dt.getTime()) / 86400000
  return diffDias <= diasMax
}
