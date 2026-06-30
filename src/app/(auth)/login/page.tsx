'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error('E-mail ou senha incorretos'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72,
          background: 'linear-gradient(135deg,#8B6914,#C4622D)',
          borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 32,
        }}>💰</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FAF7F4', margin: 0 }}>Finanças L&N</h1>
        <p style={{ fontSize: 13, color: 'rgba(250,247,244,0.4)', marginTop: 4 }}>Lucas & Nicoly</p>
      </div>

      {/* Form */}
      <div style={{
        background: '#FAF7F4', borderRadius: 24,
        padding: '24px 20px', border: '0.5px solid rgba(139,105,20,0.2)',
      }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5C3D2E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              E-mail
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" placeholder="seu@email.com"
              className="input-base" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5C3D2E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" placeholder="••••••••"
                className="input-base" style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
              }}>
                {showPw ? <EyeOff size={17} color="#8B6914" /> : <Eye size={17} color="#8B6914" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
            {loading ? <><Loader2 size={18} className="animate-spin" /> Entrando...</> : 'Entrar'}
          </button>
        </form>
      </div>

      <p style={{ color: 'rgba(250,247,244,0.25)', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
        Acesso restrito ao casal
      </p>
    </div>
  )
}
