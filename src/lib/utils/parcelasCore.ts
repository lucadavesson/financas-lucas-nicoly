/**
 * Conferência de compras parceladas — lógica pura, sem banco e sem React.
 *
 * A regra de um parcelamento é simples: a parcela N cai N-1 meses depois da
 * primeira. Quando uma linha foge disso, algum mês desaparece da lista e outro
 * ganha uma parcela que não é dele — foi o que aconteceu com a M3PRODUTOS, em
 * que a parcela 12 ficou com a data da parcela 1 e set/2026 sumiu.
 *
 * A causa está em statusEngine: linhas legadas sem "(n/total)" na descrição
 * recebiam o primeiro número livre do grupo, em ordem de data, mas a data
 * delas não era corrigida junto. Número e data ficavam contando histórias
 * diferentes.
 *
 * Aqui a data manda. O número certo de uma linha é deduzido de quantos meses
 * ela está distante da primeira parcela.
 */

export type LinhaParcela = {
  id: string
  description: string
  purchase_date: string
  status?: string | null
  paid_date?: string | null
  paid_amount?: number | null
  installment_num?: number | null
  installment_number?: number | null
  installment_total?: number | null
  total_installments?: number | null
  card_name?: string | null
  holder?: string | null
}

export type Problema =
  | { tipo: 'data_fora_de_sequencia'; num: number; id: string; deData: string; paraData: string }
  | { tipo: 'numero_repetido'; num: number; ids: string[] }
  | { tipo: 'parcela_faltando'; num: number; dataEsperada: string }
  | { tipo: 'sem_numero'; id: string; numSugerido: number | null }

/* ── Datas ─────────────────────────────────────────────────────── */

/** Último dia de um mês (mes 1-12). */
function ultimoDia(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

/**
 * Soma meses a uma data 'yyyy-MM-dd' preservando o dia, encolhendo quando o
 * mês de destino é mais curto — 31/01 + 1 mês = 28/02. Mesmo comportamento do
 * addMonths do date-fns, que é o que o resto do app usa para gerar parcelas;
 * se divergisse, a conferência acusaria erro onde não há.
 */
export function somaMesesData(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const totalMeses = (a * 12 + (m - 1)) + n
  const anoDest = Math.floor(totalMeses / 12)
  const mesDest = (totalMeses % 12) + 1
  const dia = Math.min(d, ultimoDia(anoDest, mesDest))
  return `${anoDest}-${String(mesDest).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Distância em meses entre duas datas 'yyyy-MM-dd' (b - a), ignorando o dia. */
export function mesesEntre(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number)
  const [ba, bm] = b.split('-').map(Number)
  return (ba - aa) * 12 + (bm - am)
}

/* ── Identidade da parcela ─────────────────────────────────────── */

export function baseDaDescricao(desc: string): string {
  return (desc || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

export function numeroDaParcela(l: LinhaParcela): number | null {
  const m = (l.description || '').match(/\((\d+)\/(\d+)\)$/)
  if (m) return parseInt(m[1])
  return l.installment_num || l.installment_number || null
}

export function totalDoGrupo(linhas: LinhaParcela[]): number {
  for (const l of linhas) {
    const m = (l.description || '').match(/\((\d+)\/(\d+)\)$/)
    if (m) return parseInt(m[2])
    const t = l.installment_total || l.total_installments
    if (t) return t
  }
  return 0
}

/* ── Consenso ──────────────────────────────────────────────────── */

/**
 * Descobre a data da parcela 1 por votação: cada linha numerada "chuta" uma
 * data-base recuando (n-1) meses, e vence a mais votada.
 *
 * Votação em vez de simplesmente confiar na parcela de menor número porque uma
 * única linha errada não pode arrastar o grupo inteiro. Na M3PRODUTOS, onze
 * linhas apontam 15/10/2025 e só a décima segunda aponta 15/11/2024 — a
 * maioria ganha, e a linha errada é a que aparece como problema.
 */
export function baseConsenso(linhas: LinhaParcela[]): string | null {
  const votos = new Map<string, { n: number; menorNum: number }>()
  for (const l of linhas) {
    const num = numeroDaParcela(l)
    if (!num || !l.purchase_date) continue
    const candidata = somaMesesData(l.purchase_date, -(num - 1))
    const atual = votos.get(candidata)
    if (atual) { atual.n++; atual.menorNum = Math.min(atual.menorNum, num) }
    else votos.set(candidata, { n: 1, menorNum: num })
  }
  if (votos.size === 0) {
    const comData = linhas.filter(l => l.purchase_date)
      .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
    return comData[0]?.purchase_date || null
  }
  let melhor: string | null = null
  let melhorVoto = { n: -1, menorNum: Infinity }
  for (const [data, v] of votos) {
    // Mais votos vence. Empate: fica com quem tem a parcela de menor número,
    // que é a mais próxima da compra original.
    if (v.n > melhorVoto.n || (v.n === melhorVoto.n && v.menorNum < melhorVoto.menorNum)) {
      melhor = data; melhorVoto = v
    }
  }
  return melhor
}

/* ── Conferência ───────────────────────────────────────────────── */

/**
 * Aponta tudo que está inconsistente num grupo de parcelas.
 * Não altera nada — quem corrige é quem chama, depois de mostrar ao usuário.
 */
export function conferirGrupo(linhas: LinhaParcela[], total?: number): Problema[] {
  const problemas: Problema[] = []
  const totalReal = total || totalDoGrupo(linhas)
  if (!totalReal || totalReal <= 1) return problemas

  const base = baseConsenso(linhas)
  if (!base) return problemas

  // Linhas sem número não dá para conferir por posição; sugere pela data.
  for (const l of linhas) {
    if (numeroDaParcela(l)) continue
    const dist = l.purchase_date ? mesesEntre(base, l.purchase_date) : null
    const sugerido = dist !== null && dist >= 0 && dist < totalReal ? dist + 1 : null
    problemas.push({ tipo: 'sem_numero', id: l.id, numSugerido: sugerido })
  }

  const porNumero = new Map<number, LinhaParcela[]>()
  for (const l of linhas) {
    const num = numeroDaParcela(l)
    if (!num) continue
    if (!porNumero.has(num)) porNumero.set(num, [])
    porNumero.get(num)!.push(l)
  }

  for (let n = 1; n <= totalReal; n++) {
    const doNumero = porNumero.get(n) || []
    const esperada = somaMesesData(base, n - 1)

    if (doNumero.length === 0) {
      problemas.push({ tipo: 'parcela_faltando', num: n, dataEsperada: esperada })
      continue
    }
    if (doNumero.length > 1) {
      problemas.push({ tipo: 'numero_repetido', num: n, ids: doNumero.map(l => l.id) })
    }
    for (const l of doNumero) {
      // Compara só ano/mês: o dia pode variar de propósito (mês curto, ou o
      // usuário ajustou o vencimento de uma parcela específica).
      if (l.purchase_date && l.purchase_date.slice(0, 7) !== esperada.slice(0, 7)) {
        problemas.push({
          tipo: 'data_fora_de_sequencia',
          num: n, id: l.id,
          deData: l.purchase_date, paraData: esperada,
        })
      }
    }
  }

  // Números acima do total (ex.: "(13/12)") também são furo.
  for (const [n, doNumero] of porNumero) {
    if (n > totalReal) {
      for (const l of doNumero) {
        problemas.push({
          tipo: 'data_fora_de_sequencia',
          num: n, id: l.id,
          deData: l.purchase_date, paraData: somaMesesData(base, n - 1),
        })
      }
    }
  }

  return problemas
}

/**
 * O paid_date foi gerado automaticamente (é igual à data da parcela) ou é um
 * pagamento que a pessoa registrou de verdade?
 *
 * Importa na hora de corrigir: mexer numa data que o motor carimbou sozinho é
 * conserto; mexer num pagamento que a pessoa lançou é reescrever a vida dela.
 */
export function pagamentoFoiAutomatico(l: LinhaParcela): boolean {
  return !!l.paid_date && l.paid_date === l.purchase_date
}
