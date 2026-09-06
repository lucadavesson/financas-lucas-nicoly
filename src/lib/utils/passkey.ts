/**
 * Face ID / biometria do aparelho, num lugar só.
 *
 * O desbloqueio pedia a credencial SEM `allowCredentials`. Sem essa lista o
 * navegador não tem como saber que a passkey está neste próprio aparelho, então
 * cai no fluxo genérico e mostra o menu inteiro: "Face ID", depois "usar este
 * dispositivo / usar iPhone ou Android / chave de segurança". Dois toques antes
 * de chegar no que a gente já sabia que era.
 *
 * Guardando o ID da credencial no registro e mirando ela no desbloqueio — com
 * transports 'internal', que quer dizer "essa passkey mora aqui dentro" — o
 * navegador pula o menu e chama o Face ID do aparelho direto.
 *
 * Quem já tinha o Face ID ativado antes desta mudança não precisa reconfigurar:
 * o primeiro desbloqueio ainda mostra o menu, e a gente aproveita a resposta
 * para guardar o ID. Da segunda vez em diante já vai direto.
 */

const CHAVE_ATIVO = (uid: string) => `ln_faceid_${uid}`
const CHAVE_CRED = (uid: string) => `ln_faceid_cred_${uid}`

/* ── base64url (localStorage só guarda texto) ──────────────────── */

function paraBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Devolve ArrayBuffer (e não Uint8Array) porque é o que a API de credenciais
// espera em `id` — com Uint8Array o TypeScript reclama de ArrayBufferLike.
function deBase64url(txt: string): ArrayBuffer {
  const b64 = txt.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
  const buf = new ArrayBuffer(bin.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return buf
}

/* ── Estado guardado ───────────────────────────────────────────── */

export function faceIdAtivo(userId: string): boolean {
  try { return localStorage.getItem(CHAVE_ATIVO(userId)) === '1' } catch { return false }
}

export function credencialSalva(userId: string): ArrayBuffer | null {
  try {
    const txt = localStorage.getItem(CHAVE_CRED(userId))
    return txt ? deBase64url(txt) : null
  } catch { return null }
}

function guardarCredencial(userId: string, rawId: ArrayBuffer) {
  try { localStorage.setItem(CHAVE_CRED(userId), paraBase64url(rawId)) } catch {}
}

export function esquecerFaceId(userId: string) {
  try {
    localStorage.removeItem(CHAVE_ATIVO(userId))
    localStorage.removeItem(CHAVE_CRED(userId))
    localStorage.removeItem('ln_saved_pw')
  } catch {}
}

/** Esquece só qual passkey usar, mantendo o Face ID ligado. */
export function esquecerCredencial(userId: string) {
  try { localStorage.removeItem(CHAVE_CRED(userId)) } catch {}
}

/* ── Disponibilidade ───────────────────────────────────────────── */

export async function biometriaDisponivel(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

/* ── Registro ──────────────────────────────────────────────────── */

export async function registrarFaceId(userId: string, email: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    if (!(await biometriaDisponivel())) {
      return { ok: false, erro: 'Este aparelho não tem biometria disponível para o navegador.' }
    }

    const anterior = credencialSalva(userId)
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Finanças L&N', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId.slice(0, 16)),
          name: email,
          displayName: email.split('@')[0],
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          // 'platform' = só o sensor do próprio aparelho. Sem isso o navegador
          // ofereceria também chave física e celular por QR code.
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
          requireResidentKey: true,
        },
        // Evita cadastrar a mesma coisa duas vezes se já existir uma passkey.
        excludeCredentials: anterior
          ? [{ id: anterior, type: 'public-key', transports: ['internal'] as AuthenticatorTransport[] }]
          : [],
        timeout: 60000,
      },
    }) as PublicKeyCredential | null

    if (!cred) return { ok: false, erro: 'Não foi possível criar a chave.' }

    // É este ID que faz o desbloqueio ir direto ao Face ID depois.
    guardarCredencial(userId, cred.rawId)
    localStorage.setItem(CHAVE_ATIVO(userId), '1')
    return { ok: true }
  } catch (e: any) {
    if (e?.name === 'InvalidStateError') {
      // Já existe passkey deste app no aparelho: considera ativo.
      try { localStorage.setItem(CHAVE_ATIVO(userId), '1') } catch {}
      return { ok: true }
    }
    if (e?.name === 'NotAllowedError') return { ok: false, erro: 'Cancelado.' }
    return { ok: false, erro: e?.message || 'Não foi possível configurar.' }
  }
}

/* ── Desbloqueio ───────────────────────────────────────────────── */

export type ResultadoDesbloqueio =
  | { ok: true }
  | { ok: false; cancelado: boolean; erro: string }

/**
 * @param userId  dono da sessão
 * @param mirado  true = usa a passkey guardada (vai direto ao Face ID).
 *                false = fluxo aberto, para o caso de a passkey guardada não
 *                servir mais (trocou de aparelho, apagou a chave, etc).
 */
export async function pedirFaceId(userId: string, mirado = true): Promise<ResultadoDesbloqueio> {
  try {
    const salva = mirado ? credencialSalva(userId) : null

    const opcoes: PublicKeyCredentialRequestOptions = {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      userVerification: 'required',
      timeout: 60000,
    }
    if (salva) {
      opcoes.allowCredentials = [{
        id: salva,
        type: 'public-key',
        // 'internal' = a chave está neste aparelho. É o que faz o navegador
        // parar de oferecer "usar outro celular" e ir reto na biometria.
        transports: ['internal'] as AuthenticatorTransport[],
      }]
    }
    // WebAuthn L3: reforça "resolve aqui mesmo". Navegador que não conhece ignora.
    ;(opcoes as any).hints = ['client-device']

    const cred = await navigator.credentials.get({ publicKey: opcoes }) as PublicKeyCredential | null
    if (!cred) return { ok: false, cancelado: false, erro: 'Não reconhecido.' }

    // Quem já usava o app antes desta mudança não tem o ID guardado. Guardamos
    // agora, aproveitando este desbloqueio: da próxima vez já vai direto.
    if (!salva) guardarCredencial(userId, cred.rawId)

    return { ok: true }
  } catch (e: any) {
    const cancelado = e?.name === 'NotAllowedError' || e?.name === 'AbortError'
    return {
      ok: false,
      cancelado,
      erro: cancelado ? 'Não reconhecido. Tente de novo.' : (e?.message || 'Falha na verificação.'),
    }
  }
}
