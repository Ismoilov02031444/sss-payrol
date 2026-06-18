import { supabase } from '../supabase'
import { Cloud, CloudOff, RefreshCw, LogOut, Users } from 'lucide-react'

export default function Header({ session, syncStatus, onlineCount, onReload }) {
  async function signOut() {
    await supabase.auth.signOut()
  }

  const email = session?.user?.email || ''
  const shortEmail = email.length > 20 ? email.slice(0, 18) + '…' : email

  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">🏭</div>
        <div>
          <div className="logo-text">SSS <span>Payroll</span></div>
          <div className="logo-sub">Sadaf Sut Smons</div>
        </div>
      </div>

      <div className="header-right">
        {/* Online count */}
        {onlineCount > 1 && (
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text3)'}}>
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
          <RefreshCw size={12} />
        </button>

        {/* User chip */}
        <div className="user-chip">
          <div className="user-dot" />
          <span className="user-email">{shortEmail}</span>
        </div>

        {/* Sign out */}
        <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">
          <LogOut size={13} />
        </button>
      </div>
    </header>
  )
}
