'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { pedirFaceId, faceIdAtivo, credencialSalva, esquecerCredencial } from '@/lib/utils/passkey'
import { marcarAtividade, esquecerAtividade, expirou } from '@/lib/utils/bloqueio'

/**
 * Trava o app atrás do Face ID — só depois de um tempo SEM USO (padrão 5 min,
 * configurável em Configurações > Segurança), como app de banco.
 *
 * Antes tinha duas falhas: trancava na hora em qualquer ida ao segundo plano
 * (olhar uma mensagem e voltar já pedia Face ID) e, ao trancar, a tela de
 * bloqueio SUBSTITUÍA o app — os formulários eram desmontados e o que estava
 * sendo digitado se perdia. Agora o app continua montado por baixo e a tela de
 * bloqueio é só uma camada por cima: destravou, está tudo onde estava.
 */
export default function LockGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'verificando' | 'travado' | 'liberado'>('verificando')
  const [autenticando, setAutenticando] = useState(false)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [uid, setUid] = useState('')
  // Só oferece o "tentar de outro jeito" depois de uma tentativa mirada falhar.
  const [ofereceAlternativa, setOfereceAlternativa] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser()
        if (!vivo) return
        if (!user) { setEstado('liberado'); return }

        const email = user.email || ''
        setNome(email.split('@')[0].split(/[._-]/)[0])
        setUid(user.id)

        const ativo = faceIdAtivo(user.id)
        // Abriu o app: só pede Face ID se ficou parado além do limite
        if (ativo && expirou()) setEstado('travado')
        else { marcarAtividade(); setEstado('liberado') }
      } catch {
        if (vivo) setEstado('liberado')
      }
    })()
    return () => { vivo = false }
  }, [])

  const estadoRef = useRef(estado)
  const uidRef = useRef(uid)
  useEffect(() => { estadoRef.current = estado }, [estado])
  useEffect(() => { uidRef.current = uid }, [uid])

  // Tranca só quando o tempo sem uso passa do limite — ao voltar do segundo
  // plano, ao ficar parado com o app aberto, ou ao reabrir depois de descartado.
  useEffect(() => {
    function conferir() {
      if (estadoRef.current !== 'liberado' || !uidRef.current) return
      if (faceIdAtivo(uidRef.current) && expirou()) setEstado('travado')
    }
    function aoMudarVisibilidade() {
      if (document.visibilityState === 'hidden') {
        if (estadoRef.current === 'liberado') marcarAtividade() // o relógio começa ao sair
      } else {
        conferir()
      }
    }
    // Atividade: só conta com o app destravado (senão tocar na tela de bloqueio
    // zeraria o relógio e liberaria o app sem Face ID depois).
    let ultimo = 0
    function aoInteragir() {
      if (estadoRef.current !== 'liberado') return
      const agora = Date.now()
      if (agora - ultimo < 10_000) return
      ultimo = agora
      marcarAtividade()
    }
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach(e => document.addEventListener(e, aoInteragir, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('pagehide', aoMudarVisibilidade)
    const timer = setInterval(conferir, 20_000)
    return () => {
      eventos.forEach(e => document.removeEventListener(e, aoInteragir, { capture: true } as any))
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('pagehide', aoMudarVisibilidade)
      clearInterval(timer)
    }
  }, [])

  const desbloquear = useCallback(async (mirado = true) => {
    if (!uid) return
    setErro(''); setAutenticando(true)
    const r = await pedirFaceId(uid, mirado)
    setAutenticando(false)
    if (r.ok) {
      marcarAtividade()
      setEstado('liberado')
      return
    }
    setErro(r.erro)
    // Se a passkey guardada não serve mais (trocou de aparelho, apagou a chave),
    // não adianta insistir nela — abre a saída para o fluxo antigo.
    if (mirado && credencialSalva(uid)) setOfereceAlternativa(true)
  }, [uid])

  function tentarDeOutroJeito() {
    esquecerCredencial(uid)
    setOfereceAlternativa(false)
    desbloquear(false)
  }

  // Não dispara o Face ID sozinho: a tela abre e a pessoa escolhe entre Face ID
  // e senha. Disparar sozinho fazia o menu do navegador pular na cara antes de
  // qualquer escolha.

  // No Chrome do iPhone (CriOS) o navegador mostra o próprio seletor de passkeys
  // antes do Face ID; isso não dá para esconder pelo app, então avisamos.
  const [noChromeIOS, setNoChromeIOS] = useState(false)
  useEffect(() => {
    setNoChromeIOS(/CriOS/i.test(navigator.userAgent))
  }, [])

  async function sairDaConta() {
    await createClient().auth.signOut()
    sessionStorage.clear()
    esquecerAtividade()
    router.push('/login')
  }

  if (estado === 'verificando') {
    return (
      <div style={{ height: '100dvh', background: '#3A2016', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (estado === 'travado') {
    return (<>
      {children}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden',
        background: 'linear-gradient(165deg,#4A2A1C 0%,#7A4526 45%,#2A1610 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulseGlow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.06)}}`}</style>

        <div style={{ position: 'absolute', top: -140, right: -110, width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,255,255,0.055)' }} />
        <div style={{ position: 'absolute', bottom: 120, left: -130, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '0 28px' }}>
          <div style={{
            width: 78, height: 78, borderRadius: 24, background: 'rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>L&amp;N</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Lucas &amp; Nicoly</p>
          <p style={{ fontSize: 25, fontWeight: 700, color: '#fff', margin: '6px 0 0' }}>Finanças L&amp;N</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '14px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
            Suas finanças estão protegidas.<br />Escolha como quer entrar.
          </p>
        </div>

        <div style={{
          position: 'relative', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(255,255,255,0.14)', borderRadius: '26px 26px 0 0',
          padding: '22px 22px calc(26px + env(safe-area-inset-bottom, 16px))',
        }}>
          {nome && (
            <p style={{ fontSize: 15, color: '#fff', margin: '0 0 16px', fontWeight: 600, textTransform: 'capitalize' }}>
              Olá, {nome}
            </p>
          )}

          <button onClick={() => desbloquear()} disabled={autenticando} style={{
            width: '100%', height: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
            background: '#fff', color: '#3A2016', fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: autenticando ? 0.7 : 1,
          }}>
            {autenticando ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(58,32,22,0.35)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
                Aguardando Face ID...
              </>
            ) : (
              <>
                <FaceIdIcon />
                Desbloquear com Face ID
              </>
            )}
          </button>

          {erro && (
            <p style={{ fontSize: 12.5, color: 'rgba(255,190,185,0.95)', margin: '12px 0 0', textAlign: 'center', fontWeight: 600 }}>{erro}</p>
          )}

          {ofereceAlternativa && (
            <button onClick={tentarDeOutroJeito} style={{
              width: '100%', marginTop: 10, height: 42, background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Tentar de outro jeito
            </button>
          )}

          <button onClick={sairDaConta} style={{
            width: '100%', marginTop: 10, height: 50, borderRadius: 16, cursor: 'pointer',
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)',
            color: '#fff', fontSize: 15, fontWeight: 600,
          }}>
            Entrar com senha
          </button>

          {noChromeIOS && (
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', margin: '12px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              No Chrome, o iPhone pode mostrar uma tela de escolha antes do Face ID. No Safari ele vai direto.
            </p>
          )}
        </div>
      </div>
    </>)
  }

  return <>{children}</>
}

function FaceIdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M9 10v1" />
      <path d="M15 10v1" />
      <path d="M12 10v3" />
      <path d="M9 16c1 .9 4.5.9 6 0" />
    </svg>
  )
}
