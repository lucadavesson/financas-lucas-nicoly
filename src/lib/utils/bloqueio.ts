/**
 * Bloqueio por inatividade (como app de banco).
 *
 * O app só tranca depois de X minutos SEM USO — sair para ver uma mensagem e
 * voltar em seguida não pede nada. O relógio é a última atividade (toque,
 * rolagem, teclado) ou o momento em que o app foi para segundo plano, guardado
 * em localStorage para valer também quando o iOS descarta o app da memória e
 * ele reabre "do zero".
 */
const K_ATIVIDADE = 'ln_last_active'
const K_LIMITE = 'ln_lock_min'
export const LIMITES_MIN = [1, 5, 15, 30] as const
const PADRAO_MIN = 5

export function limiteMin(): number {
  try {
    const v = parseInt(localStorage.getItem(K_LIMITE) || '')
    return (LIMITES_MIN as readonly number[]).includes(v) ? v : PADRAO_MIN
  } catch { return PADRAO_MIN }
}
export function definirLimiteMin(min: number) {
  try { localStorage.setItem(K_LIMITE, String(min)) } catch { /* sem storage: segue no padrão */ }
}

export function marcarAtividade() {
  try { localStorage.setItem(K_ATIVIDADE, String(Date.now())) } catch { /* ignora */ }
}
export function esquecerAtividade() {
  try { localStorage.removeItem(K_ATIVIDADE) } catch { /* ignora */ }
}

/** Passou do limite sem uso? Sem registro nenhum conta como expirado. */
export function expirou(): boolean {
  try {
    const t = parseInt(localStorage.getItem(K_ATIVIDADE) || '0')
    if (!t) return true
    return Date.now() - t > limiteMin() * 60_000
  } catch { return true }
}
