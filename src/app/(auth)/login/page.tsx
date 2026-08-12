'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

const KNOWN_USERS: Record<string, string> = {
  'lucasdavesson@gmail.com': 'Lucas Davisson',
  'nicoly': 'Nicoly',
}

function hasFaceIdStored(uid: string): boolean {
  return localStorage.getItem(`ln_faceid_${uid}`) === '1'
}

function LoginContent() {
  const router   = useRouter()
  const params   = useSearchParams()
  const isLocked = params.get('locked') === '1'

  const [step, setStep]         = useState<'email'|'auth'>('email')
  const [email, setEmail]       = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [faceLoading, setFaceLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId]     = useState('')
  const [faceAvailable, setFaceAvailable] = useState(false)

  useEffect(() => {
    async function init() {
      const saved    = localStorage.getItem('ln_last_email')
      const savedUid = localStorage.getItem('ln_user_id') || ''
      if (!saved) return
      setSavedEmail(saved); setEmail(saved)
      setUserName(KNOWN_USERS[saved] || saved.split('@')[0])
      if (savedUid) setUserId(savedUid)
      setStep('auth')
      if (window.PublicKeyCredential) {
        const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        setFaceAvailable(ok)
      }
    }
    init()
  }, [])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setUserName(KNOWN_USERS[email] || email.split('@')[0])
    setSavedEmail(email)
    localStorage.setItem('ln_last_email', email)
    setStep('auth')
    if (window.PublicKeyCredential) {
      const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      setFaceAvailable(ok)
    }
  }

  async function handleFaceId() {
    setFaceLoading(true)
    try {
      const uid = userId || localStorage.getItem('ln_user_id') || ''
      if (!uid || !hasFaceIdStored(uid)) {
        toast.info('Use sua senha primeiro — o Face ID será configurado automaticamente!')
        setFaceLoading(false); return
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const credential = await navigator.credentials.get({
        publicKey: { challenge, rpId: window.location.hostname, userVerification:'required', timeout:30000, allowCredentials:[] }
      })
      if (credential) {
        const savedPw = localStorage.getItem('ln_saved_pw')
        if (savedPw) {
          const { error } = await createClient().auth.signInWithPassword({ email: savedEmail, password: atob(savedPw) })
          if (!error) { sessionStorage.removeItem('ln_locked'); router.push('/dashboard'); router.refresh(); return }
        }
        toast.info('Face ID reconhecido! Digite sua senha para confirmar.')
      }
    } catch { toast.info('Use sua senha para entrar.') }
    finally { setFaceLoading(false) }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await createClient().auth.signInWithPassword({ email: savedEmail, password })
    if (error) {
      // Se não encontrou o usuário, tentar criar conta
      if (error.message?.includes('Invalid login') || error.message?.includes('invalid')) {
        const confirm = window.confirm('Conta não encontrada. Deseja criar uma conta com esse email?')
        if (confirm) {
          const { data: signUpData, error: signUpError } = await createClient().auth.signUp({ email: savedEmail, password })
          if (signUpError) { toast.error(`Erro ao criar conta: ${signUpError.message}`); setLoading(false); return }
          if (signUpData?.user?.identities?.length === 0) { toast.error('Esse email já está cadastrado. Verifique a senha.'); setLoading(false); return }
          toast.success('Conta criada! Verifique seu email para confirmar.'); setLoading(false); return
        }
        setLoading(false); return
      }
      toast.error('Senha incorreta'); setLoading(false); return
    }
    const uid = data.user?.id || ''
    setUserId(uid)
    localStorage.setItem('ln_user_id', uid)
    localStorage.setItem('ln_saved_pw', btoa(password))
    // Registra Face ID se disponível e ainda não registrado
    if (uid && !hasFaceIdStored(uid) && faceAvailable) {
      try {
        const challenge = crypto.getRandomValues(new Uint8Array(32))
        const uid8 = new TextEncoder().encode(uid.slice(0,16))
        await navigator.credentials.create({
          publicKey: {
            challenge, rp:{ name:'Finanças L&N', id:window.location.hostname },
            user:{ id:uid8, name:savedEmail, displayName:userName },
            pubKeyCredParams:[{alg:-7,type:'public-key'},{alg:-257,type:'public-key'}],
            authenticatorSelection:{ authenticatorAttachment:'platform', userVerification:'required', requireResidentKey:true },
            timeout:30000,
          }
        })
        localStorage.setItem(`ln_faceid_${uid}`, '1')
        toast.success('Face ID configurado! Na próxima vez use o Face ID para entrar. 🔒')
      } catch { /* usuário cancelou */ }
    }
    sessionStorage.removeItem('ln_locked')
    router.push('/dashboard'); router.refresh()
  }

  const S = {
    wrap: { width:'100%', maxWidth:380, display:'flex', flexDirection:'column' as const, alignItems:'center' as const },
    logo: { width:72, height:72, background:'linear-gradient(135deg,#C4622D,#8B3A14)', borderRadius:22, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' },
    card: { background:'#FFFFFF', borderRadius:24, padding:'24px 20px', width:'100%' },
    lbl:  { display:'block', fontSize:11, fontWeight:600 as const, color:'#C4622D', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:6 },
    inp:  { width:'100%', height:44, background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:12, padding:'0 14px', fontSize:15, outline:'none', boxSizing:'border-box' as const },
    btn:  { width:'100%', height:50, background:'#C4622D', color:'#FFFFFF', borderRadius:14, border:'none', fontSize:15, fontWeight:600 as const, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
    foot: { color:'rgba(250,247,244,0.2)', fontSize:11, textAlign:'center' as const, marginTop:20 },
  }

  if (step === 'email') return (
    <div style={S.wrap}>
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={S.logo}><span style={{color:'#fff',fontSize:22,fontWeight:800,letterSpacing:'-0.5px'}}>L&N</span></div>
        <h1 style={{ fontSize:26, fontWeight:700, color:'#FFFFFF', margin:0 }}>Finanças L&N</h1>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.4)', marginTop:4 }}>Lucas & Nicoly</p>
      </div>
      <div style={S.card}>
        <form onSubmit={handleEmailSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={S.lbl}>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              required autoFocus placeholder="seu@email.com" style={S.inp}/>
          </div>
          <button type="submit" style={S.btn}>Continuar</button>
        </form>
      </div>
      <p style={S.foot}>Acesso restrito ao casal</p>
    </div>
  )

  return (
    <div style={S.wrap}>
      {isLocked && (
        <div style={{ background:'rgba(196,98,45,0.2)', borderRadius:12, padding:'10px 16px', marginBottom:20, textAlign:'center' }}>
          <p style={{ fontSize:13, color:'#FFFFFF', margin:0 }}>🔒 Sessão bloqueada — confirme sua identidade</p>
        </div>
      )}
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ ...S.logo, width:60, height:60, borderRadius:18 }}><span style={{color:'#fff',fontSize:18,fontWeight:800,letterSpacing:'-0.5px'}}>L&N</span></div>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.5)', marginBottom:3 }}>Olá,</p>
        <h2 style={{ fontSize:22, fontWeight:700, color:'#FFFFFF', margin:0 }}>{userName} 👋</h2>
        <button onClick={()=>{setStep('email');setPassword('')}}
          style={{ fontSize:11, color:'#C4622D', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>
          ✏️ Trocar conta
        </button>
      </div>
      <div style={S.card}>
        {faceAvailable && (<>
          <button type="button" onClick={handleFaceId} disabled={faceLoading}
            style={{ width:'100%', height:54, background:'#1C1C1E', color:'#FFFFFF', borderRadius:16, border:'none', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
            {faceLoading ? <><Loader2 size={20} style={{animation:'spin 0.8s linear infinite'}}/> Verificando...</> : <><span style={{fontSize:20}}>🔒</span> Entrar com Face ID</>}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ flex:1, height:'0.5px', background:'rgba(0,0,0,0.12)' }}/>
            <span style={{ fontSize:11, color:'#C4A882' }}>ou use sua senha</span>
            <div style={{ flex:1, height:'0.5px', background:'rgba(0,0,0,0.12)' }}/>
          </div>
        </>)}
        <form onSubmit={handlePasswordLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={S.lbl}>Senha</label>
            <div style={{ position:'relative' }}>
              <input type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                required autoFocus={!faceAvailable} placeholder="••••••••"
                style={{ ...S.inp, padding:'0 44px 0 14px' }}/>
              <button type="button" onClick={()=>setShowPw(!showPw)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
                {showPw ? <EyeOff size={17} color="#C4622D"/> : <Eye size={17} color="#C4622D"/>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} style={S.btn}>
            {loading ? <><Loader2 size={18} style={{animation:'spin 0.8s linear infinite'}}/> Entrando...</> : 'Entrar com senha'}
          </button>
        </form>
      </div>
      <p style={S.foot}>Acesso restrito ao casal</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
        <Loader2 size={24} color="#C4622D" style={{animation:'spin 0.8s linear infinite'}}/>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
