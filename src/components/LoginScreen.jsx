import { useState } from 'react'
import { supabase } from '../supabase'
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react'

export default function LoginScreen() {
  const [mode, setMode]       = useState('login') // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [msg, setMsg]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setMsg(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="card card-glow login-card">
        {/* Logo */}
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:28}}>
          <div className="logo-icon" style={{width:48,height:48,fontSize:24}}>🏭</div>
          <div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:22}}>
              SSS <span style={{color:'var(--accent3)'}}>Payroll</span>
            </div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Sadaf Sut Smons — Management System</div>
          </div>
        </div>

        <div className="login-title">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </div>
        <div className="login-sub">
          {mode === 'login'
            ? 'Sign in to access the payroll system'
            : 'Register a new account to get started'}
        </div>

        {error && <div className="login-error">{error}</div>}
        {msg   && <div className="login-error" style={{background:'rgba(34,197,94,0.1)',borderColor:'rgba(34,197,94,0.3)',color:'var(--success)'}}>{msg}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email address</label>
            <div style={{position:'relative'}}>
              <Mail size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}} />
              <input
                className="input" type="email" required
                placeholder="your@email.com"
                style={{paddingLeft:32}}
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <label>Password</label>
            <div style={{position:'relative'}}>
              <Lock size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}} />
              <input
                className="input" type="password" required minLength={6}
                placeholder="••••••••"
                style={{paddingLeft:32}}
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',padding:'11px'}}>
            {loading
              ? <span className="spinner" style={{width:16,height:16,borderWidth:2}} />
              : mode === 'login'
                ? <><LogIn size={14}/> Sign in</>
                : <><UserPlus size={14}/> Create account</>
            }
          </button>
        </form>

        <div className="login-divider" style={{marginTop:20}}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMsg('') }}
            style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:500}}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
