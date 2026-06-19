import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Cloud, CloudOff, RefreshCw, LogOut, Users, Sun, Moon } from 'lucide-react'

export default function Header({ session, syncStatus, onlineCount, onReload }) {
  const [dark, setDark] = useState(() => localStorage.getItem('sss_theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('sss_theme', dark ? 'dark' : 'light')
  }, [dark])

  async function signOut() {
    await supabase.auth.signOut()
  }

  const email = session?.user?.email || ''
  const shortEmail = email.length > 20 ? email.slice(0, 18) + '…' : email

  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon" style={{ fontSize: 20 }}>🏭</div>
        <div>
          <div className="logo-text" style={{ fontFamily: 'var(--font-disp)', fontWeight: 800, letterSpacing: '-0.3px' }}>
            SSS <span>Payroll</span>
          </div>
          <div className="logo-sub">Sadaf Sut Smons</div>
        </div>
      </div>

      <div className="header-right">
        {/* Online count */}
        {onlineCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)' }}>
            <Users size={13} />
            {onlineCount} online
          </div>
        )}

        {/* Sync status */}
        <div className={`cloud-badge ${syncStatus}`}>
          {syncStatus === 'synced'  && <><Cloud size={12} /> Synced</>}
          {syncStatus === 'syncing' && <><RefreshCw size={12} className="spin" /> Syncing…</>}
          {syncStatus === 'offline' && <><CloudOff size={12} /> Offline</>}
        </div>

        {/* Reload */}
        <button className="btn btn-ghost btn-sm" onClick={onReload} title="Reload from cloud">
          <RefreshCw size={13} />
        </button>

        {/* Dark / Light toggle */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDark(d => !d)}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: dark ? 'rgba(255,255,255,0.06)' : 'var(--surface2)',
            border: '1px solid var(--border)',
            transition: 'all 0.2s'
          }}
        >
          {dark
            ? <><Sun size={13} style={{ color: '#fbbf24' }} /><span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>Light</span></>
            : <><Moon size={13} style={{ color: '#6366f1' }} /><span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>Dark</span></>
          }
        </button>

        {/* User chip */}
        <div className="user-chip">
          <div className="user-dot" />
          <span className="user-email" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{shortEmail}</span>
        </div>

        {/* Sign out */}
        <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">
          <LogOut size={13} />
        </button>
      </div>
    </header>
  )
}
