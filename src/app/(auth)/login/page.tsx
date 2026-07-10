'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

const KNOWN_USERS: Record<string, string> = {
  'lucasdavesson@gmail.com': 'Lucas Davisson',
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep]           = useState<'email'|'auth'>('email')
  const [email, setEmail]         = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [faceLoading, setFaceLoading] = useState(false)
  const [userName, setUserName]   = useState('')

  // Verifica se tem e-mail salvo
  useEffect(() => {
    const saved = localStorage.getItem('ln_last_email')
    if (saved) {
      setSavedEmail(saved)
      setEmail(saved)
      const name = KNOWN_USERS[saved] || saved.split('@')[0]
      setUserName(name)
      setStep('auth')
    }
  }, [])

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    const name = KNOWN_USERS[email] || email.split('@')[0]
    setUserName(name)
    setSavedEmail(email)
    localStorage.setItem('ln_last_email', email)
    setStep('auth')
  }

  async function handleFaceId() {
    if (!window.PublicKeyCredential) {
      toast.info('Face ID não disponível — use sua senha')
      return
    }
    setFaceLoading(true)
    try {
      // Tenta autenticação biométrica via WebAuthn
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32).map(() => Math.random() * 256),
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 30000,
        }
      })
      if (assertion) {
        // Biometria aprovada — faz login com a senha salva
        const saved = localStorage.getItem('ln_saved_pw')
        if (saved) {
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithPassword({ email: savedEmail, password: atob(saved) })
          if (!error) { router.push('/dashboard'); router.refresh(); return }
        }
        toast.info('Face ID reconhecido! Digite sua senha para confirmar.')
      }
    } catch {
      toast.info('Face ID não configurado — use sua senha')
    } finally {
      setFaceLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: savedEmail, password })
    if (error) {
      toast.error('Senha incorreta')
      setLoading(false)
      return
    }
    // Salva senha encriptada para o Face ID
    localStorage.setItem('ln_saved_pw', btoa(password))
    router.push('/dashboard')
    router.refresh()
  }

  // ── Tela 1: E-mail ──────────────────────────────────
  if (step === 'email') return (
    <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ textAlign:'center', marginBottom:40 }}>
        <div style={{ width:72, height:72, background:'linear-gradient(135deg,#8B6914,#C4622D)', borderRadius:22, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>💰</div>
        <h1 style={{ fontSize:26, fontWeight:700, color:'#FAF7F4', margin:0 }}>Finanças L&N</h1>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.4)', marginTop:4 }}>Lucas & Nicoly</p>
      </div>
      <div style={{ background:'#FAF7F4', borderRadius:24, padding:'24px 20px', width:'100%' }}>
        <form onSubmit={handleEmailSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8B6914', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              required autoFocus placeholder="seu@email.com"
              style={{ width:'100%', height:44, background:'#fff', border:'0.5px solid #D4C4B0', borderRadius:12, padding:'0 14px', fontSize:15, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <button type="submit" style={{ width:'100%', height:50, background:'#2C1810', color:'#FAF7F4', borderRadius:14, border:'none', fontSize:15, fontWeight:600, cursor:'pointer' }}>
            Continuar
          </button>
        </form>
      </div>
      <p style={{ color:'rgba(250,247,244,0.2)', fontSize:11, textAlign:'center', marginTop:20 }}>Acesso restrito ao casal</p>
    </div>
  )

  // ── Tela 2: Auth (estilo Santander) ─────────────────
  return (
    <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center' }}>
      {/* Saudação */}
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ width:64, height:64, background:'linear-gradient(135deg,#8B6914,#C4622D)', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:28 }}>💰</div>
        <p style={{ fontSize:13, color:'rgba(250,247,244,0.5)', marginBottom:4 }}>Olá,</p>
        <h2 style={{ fontSize:22, fontWeight:700, color:'#FAF7F4', margin:0 }}>{userName} 👋</h2>
        <button onClick={()=>{setStep('email');setPassword('')}} style={{ fontSize:11, color:'#8B6914', background:'none', border:'none', cursor:'pointer', marginTop:4 }}>
          ✏️ Trocar conta
        </button>
      </div>

      <div style={{ background:'#FAF7F4', borderRadius:24, padding:'24px 20px', width:'100%' }}>
        {/* Face ID */}
        <button type="button" onClick={handleFaceId} disabled={faceLoading}
          style={{ width:'100%', height:56, background:'#1C1C1E', color:'#FAF7F4', borderRadius:16, border:'none', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
          {faceLoading
            ? <><Loader2 size={20} style={{animation:'spin 0.8s linear infinite'}}/> Verificando...</>
            : <><span style={{fontSize:22}}>🔒</span> Entrar com Face ID</>}
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, height:'0.5px', background:'#D4C4B0' }}/>
          <span style={{ fontSize:11, color:'#C4A882' }}>ou use sua senha</span>
          <div style={{ flex:1, height:'0.5px', background:'#D4C4B0' }}/>
        </div>

        {/* Senha */}
        <form onSubmit={handlePasswordLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8B6914', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Senha</label>
            <div style={{ position:'relative' }}>
              <input type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                required autoFocus placeholder="••••••••"
                style={{ width:'100%', height:44, background:'#fff', border:'0.5px solid #D4C4B0', borderRadius:12, padding:'0 44px 0 14px', fontSize:15, outline:'none', boxSizing:'border-box' }}/>
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
