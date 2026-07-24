'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestFaceId, registerFaceId, hasFaceId } from '@/lib/hooks/useFaceId'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

const KNOWN_USERS: Record<string, string> = {
  'lucasdavesson@gmail.com': 'Lucas Davisson',
}

export default function LoginPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const isLocked    = params.get('locked') === '1'

  const [step, setStep]             = useState<'email'|'auth'>('email')
  const [email, setEmail]           = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [faceLoading, setFaceLoading] = useState(false)
  const [userName, setUserName]     = useState('')
  const [userId, setUserId]         = useState('')
  const [faceAvailable, setFaceAvailable] = useState(false)
  const [autoFaceId, setAutoFaceId] = useState(false)

  // Verifica e-mail salvo + se tem Face ID registrado
  useEffect(() => {
    async function init() {
      const saved = localStorage.getItem('ln_last_email')
      const savedUid = localStorage.getItem('ln_user_id')

      if (saved) {
        setSavedEmail(saved)
        setEmail(saved)
        const name = KNOWN_USERS[saved] || saved.split('@')[0]
        setUserName(name)
        if (savedUid) setUserId(savedUid)
        setStep('auth')

        // Verifica se Face ID está disponível
        if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          setFaceAvailable(available)

          // Se já tem Face ID registrado e app foi bloqueado, pede automaticamente
          if (available && savedUid && hasFaceId(savedUid) && isLocked) {
            setAutoFaceId(true)
          }
        }
      }
    }
    init()
  }, [isLocked])

  // Auto solicita Face ID quando bloqueado
  useEffect(() => {
    if (autoFaceId) {
      handleFaceId()
      setAutoFaceId(false)
    }
  }, [autoFaceId])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    const name = KNOWN_USERS[email] || email.split('@')[0]
    setUserName(name)
    setSavedEmail(email)
    localStorage.setItem('ln_last_email', email)
    setStep('auth')

    if (window.PublicKeyCredential) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      setFaceAvailable(available)
    }
  }

  async function handleFaceId() {
    setFaceLoading(true)
    try {
      const savedUid = userId || localStorage.getItem('ln_user_id') || ''
      const hasFace  = savedUid && hasFaceId(savedUid)

      if (!hasFace) {
        // Primeira vez — precisa logar com senha primeiro para registrar
        toast.info('Use sua senha primeiro. O Face ID será configurado automaticamente!')
        setFaceLoading(false)
        return
      }

      const ok = await requestFaceId()
      if (ok) {
        // Face ID aprovado — usa senha salva para logar
        const savedPw = localStorage.getItem('ln_saved_pw')
        if (savedPw) {
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithPassword({
            email: savedEmail,
            password: atob(savedPw)
          })
          if (!error) {
            sessionStorage.removeItem('ln_locked')
            router.push('/dashboard')
            router.refresh()
            return
          }
        }
        toast.info('Face ID reconhecido! Digite sua senha para confirmar.')
      } else {
        toast.error('Face ID não reconhecido. Use sua senha.')
      }
    } catch {
      toast.info('Use sua senha para entrar.')
    } finally {
      setFaceLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: savedEmail, password
    })
    if (error) {
      toast.error('Senha incorreta')
      setLoading(false)
      return
    }

    // Salva dados para Face ID
    const uid = data.user?.id || ''
    setUserId(uid)
    localStorage.setItem('ln_user_id', uid)
    localStorage.setItem('ln_saved_pw', btoa(password))

    // Registra Face ID se ainda não foi registrado
    if (uid && !hasFaceId(uid) && faceAvailable) {
      const name = KNOWN_USERS[savedEmail] || savedEmail.split('@')[0]
      const registered = await registerFaceId(uid, name)
      if (registered) {
        toast.success('Face ID configurado! Na próxima vez use o Face ID para entrar.')
      }
    }

    sessionStorage.removeItem('ln_locked')
    router.push('/dashboard')
    router.refresh()
  }

  // ── Tela 1: E-mail ──
  if (step === 'email') return (
    <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ width:72, height:72, background:'linear-gradient(135deg,#8B6914,#C4622D)', borderRadius:22, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:32 }}>💰</div>
        <h1 style={{ fontSize:26, fontWeight:700, color:'#FAF7F4', margin:0 }}>Finanças L&N</h1>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.4)', marginTop:4 }}>Lucas & Nicoly</p>
      </div>
      <div style={{ background:'#FAF7F4', borderRadius:24, padding:'24px 20px', width:'100%' }}>
        <form onSubmit={handleEmailSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8B6914', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
              E-mail
            </label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              required autoFocus placeholder="seu@email.com"
              style={{ width:'100%', height:44, background:'#fff', border:'0.5px solid #D4C4B0', borderRadius:12, padding:'0 14px', fontSize:15, outline:'none', boxSizing:'border-box' as any }}/>
          </div>
          <button type="submit" style={{ width:'100%', height:50, background:'#2C1810', color:'#FAF7F4', borderRadius:14, border:'none', fontSize:15, fontWeight:600, cursor:'pointer' }}>
            Continuar
          </button>
        </form>
      </div>
      <p style={{ color:'rgba(250,247,244,0.2)', fontSize:11, textAlign:'center', marginTop:20 }}>Acesso restrito ao casal</p>
    </div>
  )

  // ── Tela 2: Auth ──
  return (
    <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center' }}>
      {isLocked && (
        <div style={{ background:'rgba(196,98,45,0.2)', borderRadius:12, padding:'10px 16px', marginBottom:20, textAlign:'center' }}>
          <p style={{ fontSize:13, color:'#FAF7F4', margin:0 }}>🔒 Sessão bloqueada — confirme sua identidade</p>
        </div>
      )}

      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:60, height:60, background:'linear-gradient(135deg,#8B6914,#C4622D)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:26 }}>💰</div>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.5)', marginBottom:3 }}>Olá,</p>
        <h2 style={{ fontSize:22, fontWeight:700, color:'#FAF7F4', margin:0 }}>{userName} 👋</h2>
        <button onClick={()=>{setStep('email');setPassword('')}}
          style={{ fontSize:11, color:'#8B6914', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>
          ✏️ Trocar conta
        </button>
      </div>

      <div style={{ background:'#FAF7F4', borderRadius:24, padding:'24px 20px', width:'100%' }}>
        {/* Face ID — só mostra se disponível */}
        {faceAvailable && (
          <>
            <button type="button" onClick={handleFaceId} disabled={faceLoading}
              style={{ width:'100%', height:54, background:'#1C1C1E', color:'#FAF7F4', borderRadius:16, border:'none', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
              {faceLoading
                ? <><Loader2 size={20} style={{animation:'spin 0.8s linear infinite'}}/> Verificando...</>
                : <><span style={{fontSize:20}}>🔒</span> Entrar com Face ID</>}
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ flex:1, height:'0.5px', background:'#D4C4B0' }}/>
              <span style={{ fontSize:11, color:'#C4A882' }}>ou use sua senha</span>
              <div style={{ flex:1, height:'0.5px', background:'#D4C4B0' }}/>
            </div>
          </>
        )}

        <form onSubmit={handlePasswordLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8B6914', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
              Senha
            </label>
            <div style={{ position:'relative' }}>
              <input type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                required autoFocus={!faceAvailable} placeholder="••••••••"
                style={{ width:'100%', height:44, background:'#fff', border:'0.5px solid #D4C4B0', borderRadius:12, padding:'0 44px 0 14px', fontSize:15, outline:'none', boxSizing:'border-box' as any }}/>
              <button type="button" onClick={()=>setShowPw(!showPw)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
                {showPw ? <EyeOff size={17} color="#8B6914"/> : <Eye size={17} color="#8B6914"/>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', height:50, background:'#2C1810', color:'#FAF7F4', borderRadius:14, border:'none', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {loading ? <><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/> Entrando...</> : 'Entrar com senha'}
          </button>
        </form>
      </div>
      <p style={{ color:'rgba(250,247,244,0.2)', fontSize:11, textAlign:'center', marginTop:20 }}>Acesso restrito ao casal</p>
    </div>
  )
}
