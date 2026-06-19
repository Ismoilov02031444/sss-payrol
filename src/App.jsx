import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import LoginScreen from './components/LoginScreen'
import Header from './components/Header'
import WorkersTab from './components/WorkersTab'
import DailyInputTab from './components/DailyInputTab'
import PayrollTab from './components/PayrollTab'
import SetupTab from './components/SetupTab'
import SummaryTab from './components/SummaryTab'
import ArchiveTab from './components/ArchiveTab'
import { UserRound, CalendarDays, Banknote, SlidersHorizontal, TrendingUp, FolderArchive } from 'lucide-react'

const TABS = [
  { id: 'setup',   label: 'Setup',       icon: SlidersHorizontal },
  { id: 'workers', label: 'Workers',     icon: UserRound },
  { id: 'daily',   label: 'Daily Input', icon: CalendarDays },
  { id: 'payroll', label: 'Payroll',     icon: Banknote },
  { id: 'summary', label: 'Summary',     icon: TrendingUp },
  { id: 'archive', label: 'Archive',     icon: FolderArchive },
]

const EMPTY_STATE = {
  workers: [], crews: [], products: [],
  daily: {}, absent: {}, dayFraction: {}, dayOverride: {},
  stickyOverride: {}, daysOff: {}, dayNotes: {}, deductions: {},
  archive: [], _savedAt: 0,
}

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

// Toast notification system
let _toastId = 0
function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? 'var(--danger)' : t.type === 'warning' ? '#d97706' : 'var(--accent)',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.25)', minWidth: 200,
          animation: 'slideIn .2s ease-out'
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [session, setSession]         = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [state, setState]             = useState(EMPTY_STATE)
  const [syncStatus, setSyncStatus]   = useState('offline')
  const [onlineCount, setOnlineCount] = useState(1)
  const [activeTab, setActiveTab]     = useState('workers')
  const [selectedMonth, setSelectedMonthRaw] = useState(
    () => localStorage.getItem('sss_month') || defaultMonth()
  )
  const [toasts, setToasts]           = useState([])
  const channelRef   = useRef(null)
  const pushTimerRef = useRef(null)
  const localSavedAt = useRef(0)  // track our own last save time

  // Persist selectedMonth to localStorage
  function setSelectedMonth(m) {
    setSelectedMonthRaw(m)
    localStorage.setItem('sss_month', m)
  }

  function showToast(msg, type = 'success') {
    const id = ++_toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        // Session expired — clear state
        setState(EMPTY_STATE)
        showToast('Session expired — please sign in again', 'warning')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load state from Supabase ─────────────────────────────────────────────
  const loadState = useCallback(async () => {
    if (!session) return
    setSyncStatus('syncing')
    try {
      const { data, error } = await supabase
        .from('payroll_state').select('state').eq('id', 'main').single()
      if (error) throw error
      const remote = data?.state || {}
      const remoteTime = remote._savedAt || 0
      setState(prev => {
        const localTime = prev._savedAt || 0
        return remoteTime >= localTime ? { ...EMPTY_STATE, ...remote } : prev
      })
      setSyncStatus('synced')
    } catch { setSyncStatus('offline') }
  }, [session])

  // ── Push state to Supabase (throttled 1.5s) ───────────────────────────────
  const pushState = useCallback((newState) => {
    clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      if (!session) return
      setSyncStatus('syncing')
      const savedAt = Date.now()
      localSavedAt.current = savedAt
      try {
        await supabase.from('payroll_state').upsert({
          id: 'main',
          state: { ...newState, _savedAt: savedAt },
          updated_by: session.user.email,
          updated_by_uid: session.user.id,
        })
        setSyncStatus('synced')
      } catch { setSyncStatus('offline') }
    }, 1500)
  }, [session])

  // ── Update state and sync ─────────────────────────────────────────────────
  const updateState = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      pushState(next)
      return next
    })
  }, [pushState])

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    loadState()

    channelRef.current = supabase.channel('payroll-room', {
      config: { presence: { key: session.user.id } }
    })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'payroll_state', filter: 'id=eq.main'
      }, (payload) => {
        const remote = payload.new?.state || {}
        const remoteTime = remote._savedAt || 0
        setState(prev => {
          const localTime = prev._savedAt || 0
          // Only apply remote if it's newer than what we last saved
          if (remoteTime > localTime && remoteTime > localSavedAt.current) {
            showToast('Data updated by another session', 'warning')
            return { ...EMPTY_STATE, ...remote }
          }
          return prev
        })
        setSyncStatus('synced')
      })
      .on('presence', { event: 'sync' }, () => {
        const presences = channelRef.current.presenceState()
        setOnlineCount(Object.keys(presences).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current.track({ user: session.user.email, online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channelRef.current) }
  }, [session, loadState])

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="loading-screen"><div className="spinner" /></div>
  )

  if (!session) return (
    <>
      <div className="bg-canvas"><div className="grid-overlay"/><div className="orb3"/></div>
      <LoginScreen />
    </>
  )

  const tabProps = { state, updateState, selectedMonth, setSelectedMonth, session, showToast }

  return (
    <>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }`}</style>
      <div className="bg-canvas"><div className="grid-overlay"/><div className="orb3"/></div>
      <div className="app-shell">
        <Header session={session} syncStatus={syncStatus} onlineCount={onlineCount} onReload={loadState} />
        <div className="nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="main-content" style={{ paddingTop: 16 }}>
          {activeTab === 'setup'   && <SetupTab   {...tabProps} />}
          {activeTab === 'workers' && <WorkersTab {...tabProps} />}
          {activeTab === 'daily'   && <DailyInputTab {...tabProps} />}
          {activeTab === 'payroll' && <PayrollTab {...tabProps} />}
          {activeTab === 'summary' && <SummaryTab {...tabProps} />}
          {activeTab === 'archive' && <ArchiveTab {...tabProps} />}
        </div>
      </div>
      <Toast toasts={toasts} />
    </>
  )
}
