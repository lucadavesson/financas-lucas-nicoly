'use client'
import { useEffect, useRef } from 'react'

/**
 * Faz o gesto de "arrastar para voltar" (e o botão Voltar do navegador) fechar
 * a camada que está aberta na tela — uma seção interna de Configurações, um
 * modal — em vez de sair da tela inteira.
 *
 * Sem isso, entrar em Configurações > Ciclo Salarial e arrastar para voltar
 * jogava o usuário para a aba anterior do app, quando o esperado era só voltar
 * um passo, como em qualquer app de celular.
 *
 * As camadas formam uma pilha (LIFO) com UM único ouvinte de popstate: se um
 * modal está aberto sobre uma seção, o gesto fecha só o modal. Se cada camada
 * registrasse o próprio ouvinte, um único gesto fecharia todas de uma vez.
 */
type Camada = { id: number; fechar: () => void }

const pilha: Camada[] = []
let ouvindo = false
let seq = 0

function aoPopState() {
  const topo = pilha.pop()
  if (topo) topo.fechar()
}

function garantirOuvinte() {
  if (ouvindo || typeof window === 'undefined') return
  window.addEventListener('popstate', aoPopState)
  ouvindo = true
}

export function useBackGuard(ativo: boolean, aoVoltar: () => void) {
  // Guardado em ref para o efeito não depender da identidade da função —
  // recriar a entrada do histórico a cada render duplicaria os passos.
  const cbRef = useRef(aoVoltar)
  cbRef.current = aoVoltar
  const idRef = useRef<number | null>(null)

  useEffect(() => {
    if (ativo) {
      if (idRef.current !== null) return
      garantirOuvinte()
      const id = ++seq
      idRef.current = id
      pilha.push({ id, fechar: () => { idRef.current = null; cbRef.current() } })
      // Preserva o state do Next: uma entrada sem os campos internos dele faz
      // o App Router cair no fallback de window.location.reload() quando o
      // usuário anda para frente no histórico.
      try { history.pushState({ ...(history.state || {}), lnCamada: id }, '') } catch { /* histórico cheio */ }
    } else {
      // Fechou por dentro (botão Cancelar/Voltar): consome a entrada que
      // criamos, senão sobraria um passo fantasma no histórico.
      const id = idRef.current
      if (id === null) return
      idRef.current = null
      const i = pilha.findIndex(c => c.id === id)
      if (i >= 0) {
        pilha.splice(i, 1)
        try { history.back() } catch { /* nada a desfazer */ }
      }
    }
  }, [ativo])

  // Saiu da tela com a camada aberta: tira da pilha para não fechar algo que
  // não existe mais no próximo gesto.
  useEffect(() => () => {
    const id = idRef.current
    if (id === null) return
    idRef.current = null
    const i = pilha.findIndex(c => c.id === id)
    if (i >= 0) pilha.splice(i, 1)
  }, [])
}
