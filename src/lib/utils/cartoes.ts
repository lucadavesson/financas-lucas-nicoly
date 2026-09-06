/**
 * A qual cartão pertence cada lançamento.
 *
 * A tela de Cartões decidia isso com uma busca solta:
 *
 *     cn.includes(nomeLower)   // "santander — lucas".includes("santander")
 *
 * Enquanto só existia um Santander, funcionava. No dia em que um segundo
 * cartão com o mesmo nome foi criado para a outra pessoa, TODA compra do
 * Santander do Lucas passou a casar também com o Santander da Nicoly — as
 * contas de um "replicaram" no outro. E como o limite usado soma cartão a
 * cartão, o mesmo gasto era contado duas vezes.
 *
 * A regra aqui é de mão única: cada lançamento é atribuído a NO MÁXIMO um
 * cartão. Mesmo que a atribuição erre num dado bagunçado, ela nunca duplica —
 * que é o estrago que realmente distorce os números.
 */

export type CartaoRef = { id: string; name: string; holder: string }
export type TxRef = { id: string; card_name?: string | null; holder?: string | null }

/** Nome canônico gravado pelo app: "Nubank — Lucas". */
export function nomeCanonico(c: { name: string; holder: string }): string {
  return `${c.name} — ${c.holder}`
}

/**
 * Deixa comparável: minúsculo, sem espaço sobrando e com qualquer variação de
 * traço (—, –, -) virando a mesma coisa. Dado antigo foi digitado à mão e
 * aparece como "Santander - Lucas" tanto quanto "Santander — Lucas".
 */
function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[—–-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Monta o mapa lançamento → cartão.
 *
 * Ordem de tentativa, da mais forte para a mais fraca:
 *  1. bate exatamente com "nome — titular";
 *  2. o card_name é só o nome do cartão (dado antigo, sem titular). Se houver
 *     mais de um cartão com esse nome, desempata pelo titular do lançamento e,
 *     em último caso, pelo primeiro na ordem recebida — sempre UM só;
 *  3. começa com o nome do cartão (formatos estranhos tipo "Santander Lucas"),
 *     com o mesmo desempate.
 */
export function atribuirCartoes(txs: TxRef[], cards: CartaoRef[]): Map<string, string> {
  const porCanonico = new Map<string, CartaoRef>()
  const porNome = new Map<string, CartaoRef[]>()
  for (const c of cards) {
    porCanonico.set(normalizar(nomeCanonico(c)), c)
    const n = normalizar(c.name)
    if (!porNome.has(n)) porNome.set(n, [])
    porNome.get(n)!.push(c)
  }

  const escolher = (candidatos: CartaoRef[], tx: TxRef): CartaoRef | null => {
    if (candidatos.length === 0) return null
    if (candidatos.length === 1) return candidatos[0]
    const doTitular = candidatos.find(c => normalizar(c.holder) === normalizar(tx.holder || ''))
    // Sem como saber de quem é: fica com o primeiro, de forma estável. O
    // importante é não devolver dois.
    return doTitular || candidatos[0]
  }

  const mapa = new Map<string, string>()
  for (const tx of txs) {
    const cn = normalizar(tx.card_name || '')
    if (!cn) continue

    const exato = porCanonico.get(cn)
    if (exato) { mapa.set(tx.id, exato.id); continue }

    const mesmoNome = porNome.get(cn)
    if (mesmoNome) {
      const c = escolher(mesmoNome, tx)
      if (c) { mapa.set(tx.id, c.id); continue }
    }

    // Prefixo: pega o nome de cartão mais longo que serve, para "Nubank Ultra"
    // não ser abocanhado por um cartão chamado só "Nubank".
    const prefixos = cards
      .filter(c => cn.startsWith(normalizar(c.name)))
      .sort((a, b) => normalizar(b.name).length - normalizar(a.name).length)
    if (prefixos.length > 0) {
      const maisLongo = normalizar(prefixos[0].name).length
      const empatados = prefixos.filter(c => normalizar(c.name).length === maisLongo)
      const c = escolher(empatados, tx)
      if (c) mapa.set(tx.id, c.id)
    }
  }
  return mapa
}
