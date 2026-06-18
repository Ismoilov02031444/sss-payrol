import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import LoginScreen from './components/LoginScreen'
import Header from './components/Header'
import WorkersTab from './components/WorkersTab'
import DailyInputTab from './components/DailyInputTab'
import PayrollTab from './components/PayrollTab'
import SetupTab from './components/SetupTab'
import {
  Users, ClipboardList, DollarSign, Settings,
  BarChart3
} from 'lucide-react'

const TABS = [
  { id: 'workers', label: 'Workers', icon: Users },
  { id: 'daily',   label: 'Daily Input', icon: ClipboardList },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'setup',   label: 'Setup', icon: Settings },
]

const EMPTY_STATE = {
  workers: [], crews: [],
  daily: {}, absent: {}, dayFraction: {}, dayOverride: {},
  stickyOverride: {}, daysOff: {}, dayNotes: {}, deductions: {},
  archive: [], _savedAt: 0, _lang: 'en',
}

function scoreState(s) {
  if (!s || typeof s !== 'object') return 0
  let score = 0
  score += (s.workers?.length || 0) * 10
  score += (s.crews?.length || 0) * 5
  score += Object.keys(s.daily || {}).length * 2
  score += (s._savedAt || 0) / 1e9
  return score
}

export default function App() {
  const [session, setSession]     = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [state, setState]         = useState(EMPTY_STATE)
  const [syncStatus, setSyncStatus] = useState('offline') // 'synced'|'syncing'|'offline'
  const [onlineCount, setOnlineCount] = useState(1)
  const [activeTab, setActiveTab] = useState('workers')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const channelRef = useRef(null)
  const pushTimerRef = useRef(null)

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // ── Load state from Supabase ──────────────────────────────────────────────
  const loadState = useCallback(async () => {
    if (!session) return
    setSyncStatus('syncing')
    try {
      const { data, error } = await supabase
        .from('payroll_state').select('state').eq('id', 'main').single()
      if (error) throw error
      const remote = data?.state || {}
      setState(prev => scoreState(remote) >= scoreState(prev) ? { ...EMPTY_STATE, ...remote } : prev)
      setSyncStatus('synced')
    } catch { setSyncStatus('offline') }
  }, [session])

  // ── Push state to Supabase (throttled) ───────────────────────────────────
  const pushState = useCallback((newState) => {
    clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      if (!session) return
      setSyncStatus('syncing')
      try {
        await supabase.from('payroll_state').upsert({
          id: 'main',
          state: { ...newState, _savedAt: Date.now() },
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
        setState(prev => {
          if (scoreState(remote) > scoreState(prev)) return { ...EMPTY_STATE, ...remote }
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

    return () => {
      supabase.removeChannel(channelRef.current)
    }
  }, [session, loadState])

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )

  if (!session) return (
    <>
      <div className="bg-canvas"><div className="grid-overlay"/><div className="orb3"/></div>
      <LoginScreen />
    </>
  )

  const tabProps = { state, updateState, selectedMonth, setSelectedMonth, session }

  return (
    <>
      <div className="bg-canvas"><div className="grid-overlay"/><div className="orb3"/></div>
      <div className="app-shell">
        <Header
          session={session}
          syncStatus={syncStatus}
          onlineCount={onlineCount}
          onReload={loadState}
        />
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
        <div className="main-content" style={{paddingTop: 16}}>
          {activeTab === 'workers' && <WorkersTab {...tabProps} />}
          {activeTab === 'daily'   && <DailyInputTab {...tabProps} />}
          {activeTab === 'payroll' && <PayrollTab {...tabProps} />}
          {activeTab === 'setup'   && <SetupTab {...tabProps} />}
        </div>
      </div>
    </>
  )
}
