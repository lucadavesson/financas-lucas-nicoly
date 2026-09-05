/**
 * Aritmética de mês e leitura de prazo de conta recorrente.
 *
 * Vive separado de recurrents.ts porque é lógica pura — sem Supabase, sem
 * React — e é justamente a parte que precisa estar certa: é ela que decide em
 * que meses uma conta aparece, até quando vai e qual dia cai em mês curto.
 * Sendo pura, dá para testar sozinha.
 */

export type ContaRec = {
  chave: string
  descricao: string
  holder: string
  /** Ocorrência mais recente — é dela que saem os dados ao gerar o próximo mês. */
  template: any
  linhas: any[]
  primeiroMes: string
  ultimoMes: string
  ativa: boolean
  ocorrencias: number
}

export type Prazo =
  | { tipo: 'sem_prazo' }
  | { tipo: 'com_prazo'; ultimoMes: string; restantes: number }
  | { tipo: 'encerrada'; ultimoMes: string }

/* ── Helpers de mês ─────────────────────────────────────────────── */

export function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function mesDe(dateStr: string): string { return (dateStr || '').slice(0, 7) }
export function mesAtual(): string { return mesKey(new Date()) }

/** 'yyyy-MM' → Date no primeiro dia do mês (meio-dia, para não escorregar de fuso). */
export function mesParaData(mes: string): Date {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1, 12)
}

/** Soma meses a uma chave 'yyyy-MM'. */
export function somaMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  return mesKey(new Date(a, m - 1 + n, 1, 12))
}

/** Distância em meses entre duas chaves 'yyyy-MM' (b - a). */
export function distanciaMeses(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number)
  const [ba, bm] = b.split('-').map(Number)
  return (ba - aa) * 12 + (bm - am)
}

/** Último dia do mês da chave 'yyyy-MM'. */
export function ultimoDiaDoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m, 0).getDate()
}

/**
 * Data 'yyyy-MM-dd' do dia pedido dentro do mês, sem estourar mês curto:
 * dia 31 em fevereiro vira 28 (ou 29), dia 31 em abril vira 30.
 */
export function dataNoMes(mes: string, dia: number): string {
  const d = Math.min(Math.max(dia || 1, 1), ultimoDiaDoMes(mes))
  return `${mes}-${String(d).padStart(2, '0')}`
}

/** Rótulo curto de mês: '2026-12' → 'dez/2026'. */
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  if (!a || !m) return mes
  return `${MESES_PT[m - 1]}/${a}`
}

/**
 * Chave de identidade da conta. Precisa ser a MESMA em todo lugar: a tela de
 * Configurações agrupava por nome minúsculo e a geração comparava o nome cru,
 * então "Netflix " e "netflix" viravam uma conta numa tela e duas na outra.
 */
export function chaveConta(descricao: string, holder: string): string {
  return `${(descricao || '').trim().toLowerCase()}|${holder || ''}`
}

/* ── Leitura e resumo ───────────────────────────────────────────── */

/** Agrupa linhas soltas de transações recorrentes em contas. */
export function resumirRecorrentes(linhas: any[]): ContaRec[] {
  const mapa = new Map<string, ContaRec>()
  for (const l of linhas || []) {
    const chave = chaveConta(l.description, l.holder)
    const mes = mesDe(l.purchase_date)
    const atual = mapa.get(chave)
    if (!atual) {
      mapa.set(chave, {
        chave,
        descricao: l.description,
        holder: l.holder,
        template: l,
        linhas: [l],
        primeiroMes: mes,
        ultimoMes: mes,
        // Basta UMA linha encerrada para a conta estar encerrada: o app grava
        // recurring_active em todas as ocorrências ao mesmo tempo, e linhas
        // antigas podem estar com null (default) de antes desse recurso.
        ativa: l.recurring_active !== false,
        ocorrencias: 1,
      })
      continue
    }
    atual.linhas.push(l)
    atual.ocorrencias++
    if (l.recurring_active === false) atual.ativa = false
    if (mes < atual.primeiroMes) atual.primeiroMes = mes
    if (mes > atual.ultimoMes) {
      atual.ultimoMes = mes
      atual.template = l
      atual.descricao = l.description
    }
  }
  return Array.from(mapa.values())
}

/**
 * Traduz o estado das linhas em prazo legível.
 * Ativa = sem prazo. Inativa com ocorrência futura = prazo determinado em curso.
 * Inativa sem ocorrência futura = já terminou.
 */
export function prazoDaConta(c: ContaRec, hoje = mesAtual()): Prazo {
  if (c.ativa) return { tipo: 'sem_prazo' }
  if (c.ultimoMes > hoje) {
    return { tipo: 'com_prazo', ultimoMes: c.ultimoMes, restantes: distanciaMeses(hoje, c.ultimoMes) }
  }
  return { tipo: 'encerrada', ultimoMes: c.ultimoMes }
}

