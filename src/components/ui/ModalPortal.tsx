'use client'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

/**
 * Monta o modal direto em document.body, fora da hierarquia da <main>.
 *
 * A <main> do app usa overflowY:'auto' + WebkitOverflowScrolling:'touch'
 * (necessário para o scroll suave em iOS). O Safari do iPhone tem um bug
 * antigo e conhecido: um elemento position:fixed que vive DENTRO de um
 * ancestral com -webkit-overflow-scrolling:touch pode ser posicionado em
 * relação a esse ancestral rolado, e não à tela — em vez de cobrir o
 * viewport inteiro, o modal cobre só a área (rolada) da <main>, tampando o
 * meio da tela e deixando a barra inferior aparecer por baixo dele, e o
 * rodapé do próprio modal (o botão de salvar) fica fora da faixa visível.
 *
 * Foi exatamente esse bug quem explica o "está cortando" mesmo depois de já
 * ter reestruturado o modal em cabeçalho/corpo/rodapé: a estrutura interna
 * estava certa, mas o modal inteiro não estava alinhado com a tela real do
 * aparelho. Renderizar num portal em document.body tira o modal de dentro
 * da <main> rolável, então o position:fixed passa a valer para a tela
 * inteira, como devia.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  if (!montado) return null
  return createPortal(children, document.body)
}
