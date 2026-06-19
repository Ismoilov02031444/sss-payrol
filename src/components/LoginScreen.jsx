import { useState } from 'react'
import { supabase } from '../supabase'
import { Mail, Lock, LogIn } from 'lucide-react'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="card card-glow login-card">
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:28}}>
          <div className="logo-icon" style={{width:48,height:48,fontSize:24}}>&#x1F3ED;</div>
          <div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:22}}>
              SSS <span style={{color:'var(--accent3)'}}>Payroll</span>
            </div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Sadaf Sut Smons - Management System</div>
          </div>
        </div>

        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to access the payroll system</div>

        {error && <div className="login-error">{error}</div>}

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
                placeholder="Password"
                style={{paddingLeft:32}}
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{width:'100%',justifyContent:'center',padding:'11px'}}>
            {loading
              ? <span className="spinner" style={{width:16,height:16,borderWidth:2}} />
              : <><LogIn size={14}/> Sign in</>
            }
          </button>
        </form>

        <div style={{marginTop:16, textAlign:'center', fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)'}}>
          Access restricted - contact admin for an account
        </div>
      </div>
    </div>
  )
}
