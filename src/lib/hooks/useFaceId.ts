'use client'
import { useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const LOCK_KEY    = 'ln_locked'
const EMAIL_KEY   = 'ln_last_email'
const PW_KEY      = 'ln_saved_pw'
const TIMEOUT_MS  = 30000 // 30 segundos

export function useFaceId() {
  const router   = useRouter()
  const pathname = usePathname()

  const lock = useCallback(() => {
    sessionStorage.setItem(LOCK_KEY, '1')
  }, [])

  const unlock = useCallback(() => {
    sessionStorage.removeItem(LOCK_KEY)
  }, [])

  const isLocked = useCallback(() => {
    return sessionStorage.getItem(LOCK_KEY) === '1'
  }, [])

  // Bloqueia quando vai para background
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function onHide() {
      timer = setTimeout(() => { lock() }, TIMEOUT_MS)
    }

    function onShow() {
      clearTimeout(timer)
      if (isLocked()) {
        router.push('/login?locked=1')
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHide()
      else onShow()
    })

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [lock, isLocked, router])

  return { lock, unlock, isLocked }
}

// Solicita Face ID via WebAuthn (biometria do iPhone)
export async function requestFaceId(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // iOS Safari — usa biometria nativa via credentials
  if (!window.PublicKeyCredential) return false

  try {
    // Verifica se biometria está disponível
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    if (!available) return false

    // Gera um challenge aleatório
    const challenge = crypto.getRandomValues(new Uint8Array(32))

    // Tenta usar uma credencial existente
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId:             window.location.hostname,
        userVerification: 'required', // força biometria
        timeout:          30000,
        allowCredentials: [], // aceita qualquer credencial registrada
      }
    })

    return !!credential
  } catch (err: any) {
    // NotAllowedError = usuário cancelou ou não tem biometria
    console.log('FaceID error:', err.name)
    return false
  }
}

// Registra credencial para Face ID (primeira vez)
export async function registerFaceId(userId: string, userName: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false

  try {
    const challenge  = crypto.getRandomValues(new Uint8Array(32))
    const userId8    = new TextEncoder().encode(userId.slice(0, 16))

    await navigator.credentials.create({
      publicKey: {
        challenge,
        rp:               { name: 'Finanças L&N', id: window.location.hostname },
        user:             { id: userId8, name: userName, displayName: userName },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // usa o biométrico do dispositivo
          userVerification:        'required',
          requireResidentKey:      true,
        },
        timeout: 30000,
      }
    })

    localStorage.setItem(`ln_faceid_${userId}`, '1')
    return true
  } catch (err: any) {
    console.log('Register FaceID error:', err.name)
    return false
  }
}

export function hasFaceId(userId: string): boolean {
  return localStorage.getItem(`ln_faceid_${userId}`) === '1'
}
