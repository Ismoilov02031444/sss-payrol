import { useState, useRef, useEffect } from 'react'
import { crewDayEarning, monthDates, isDayOff, crewHasUnitsOnDay, getDayFraction, detectAnomaly, safeNum } from '../payroll'

function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }
function uid() { return crypto.randomUUID() }

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CREW_COLORS = ['#16a34a','#2563eb','#d97706','#9333ea','#e11d48','#0891b2']
function crewColor(crews, cid) {
  const i = crews.findIndex(c => c.id === cid)
  return CREW_COLORS[i % CREW_COLORS.length] || '#16a34a'
}

export default function DailyInputTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { crews = [], workers = [], daily = {}, absent = {}, dayFraction = {},
    dayOverride = {}, stickyOverride = {}, daysOff = {}, dayNotes = {} } = state

  const today = new Date().toISOString().slice(0, 10)
  const [selectedCrew, setSelectedCrew] = useState(crews[0]?.id || null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [attOpen, setAttOpen] = useState(true)
  const [weekModal, setWeekModal] = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkWeekStart, setBulkWeekStart] = useState(() => getWeekDates(today)[0])
  const [dayOverrideModal, setDayOverrideModal] = useState(null) // { wid }
  const [overrideAmt, setOverrideAmt] = useState('')
  const [overrideSticky, setOverrideSticky] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null) // { wid, x, y }
  const noteRef = useRef()

  const crew = crews.find(c => c.id === selectedCrew)
  const products = crew?.products || []

  // Crew workers active on selected date
  const crewWs = workers.filter(w =>
    w.crewId === selectedCrew && !w.inactive &&
    (!w.joinDate || w.joinDate <= selectedDate) &&
    (!w.leaveDate || w.leaveDate >= selectedDate)
  )

  const allDates = monthDates(selectedMonth)
  const currentWeekDates = getWeekDates(selectedDate)

  function setUnit(date, crewId, productId, val) {
    const v = safeNum(val)
    updateState(s => {
      const d = { ...(s.daily || {}) }
      if (!d[date]) d[date] = {}
      if (!d[date][crewId]) d[date][crewId] = {}
      d[date][crewId][productId] = v
      return { ...s, daily: d }
    })
  }

  function getUnit(date, crewId, productId) {
    return daily?.[date]?.[crewId]?.[productId] || 0
  }

  function toggleDayOff(date, crewId) {
    updateState(s => {
      const daysOff = { ...(s.daysOff || {}) }
      if (!daysOff[date]) daysOff[date] = {}
      if (typeof daysOff[date] === 'boolean') {
        daysOff[date] = { [crewId]: !daysOff[date] }
      } else {
        daysOff[date] = { ...daysOff[date], [crewId]: !daysOff[date][crewId] }
      }
      return { ...s, daysOff }
    })
  }

  function setFrac(date, wid, frac) {
    updateState(s => {
      const df = { ...(s.dayFraction || {}) }
      if (!df[date]) df[date] = {}
      df[date] = { ...df[date], [wid]: frac }
      const ab = { ...(s.absent || {}) }
      if (!ab[date]) ab[date] = {}
      if (frac === 0) { ab[date] = { ...ab[date], [wid]: true } }
      else { const copy = { ...ab[date] }; delete copy[wid]; ab[date] = copy }
      return { ...s, dayFraction: df, absent: ab }
    })
  }

  function saveDayNote(date, text) {
    updateState(s => {
      const dn = { ...(s.dayNotes || {}) }
      if (text.trim()) dn[date] = text.trim()
      else delete dn[date]
      return { ...s, dayNotes: dn }
    })
  }

  function submitDayOverride() {
    if (!dayOverrideModal) return
    const wid = dayOverrideModal.wid
    const amt = overrideAmt !== '' ? safeNum(overrideAmt) : null
    updateState(s => {
      const res = {}
      if (overrideSticky) {
        const so = { ...(s.stickyOverride || {}) }
        if (amt != null) so[wid] = amt; else delete so[wid]
        res.stickyOverride = so
      } else {
        const dov = { ...(s.dayOverride || {}) }
        if (!dov[selectedDate]) dov[selectedDate] = {}
        if (amt != null) dov[selectedDate] = { ...dov[selectedDate], [wid]: amt }
        else { const c = { ...dov[selectedDate] }; delete c[wid]; dov[selectedDate] = c }
        res.dayOverride = dov
      }
      return { ...s, ...res }
    })
    setDayOverrideModal(null)
  }

  function clearOverride(wid) {
    updateState(s => {
      const dov = { ...(s.dayOverride || {}) }
      if (dov[selectedDate]) {
        const c = { ...dov[selectedDate] }; delete c[wid]; dov[selectedDate] = c
      }
      const so = { ...(s.stickyOverride || {}) }
      delete so[wid]
      return { ...s, dayOverride: dov, stickyOverride: so }
    })
  }

  // Bulk week attendance helpers
  function bulkGetFrac(date, wid) {
    if (absent?.[date]?.[wid]) return 0
    const f = dayFraction?.[date]?.[wid]
    return f !== undefined ? f : 1
  }

  function bulkSetFrac(date, wid, frac) {
    updateState(s => {
      const df = { ...(s.dayFraction || {}) }
      if (!df[date]) df[date] = {}
      df[date] = { ...df[date], [wid]: frac }
      const ab = { ...(s.absent || {}) }
      if (!ab[date]) ab[date] = {}
      if (frac === 0) ab[date] = { ...ab[date], [wid]: true }
      else { const c = { ...ab[date] }; delete c[wid]; ab[date] = c }
      return { ...s, dayFraction: df, absent: ab }
    })
  }

  function bulkSetAll(date, frac) {
    const ws = workers.filter(w => w.crewId === selectedCrew && !w.inactive)
    ws.forEach(w => bulkSetFrac(date, w.id, frac))
  }

  function cycleFrac(f) {
    if (f === 1) return 0.5
    if (f === 0.5) return 0
    return 1
  }

  // Bulk units for the week
  function bulkGetUnit(date, pid) { return daily?.[date]?.[selectedCrew]?.[pid] || 0 }
  function bulkSetUnit(date, pid, val) { setUnit(date, selectedCrew, pid, val) }

  function copyDayUnits(fromDate) {
    if (!crew) return
    products.forEach(p => {
      const v = bulkGetUnit(fromDate, p.id)
      getWeekDates(bulkWeekStart).forEach(d => {
        if (d !== fromDate) bulkSetUnit(d, p.id, v)
      })
    })
  }

  function clearWeekUnits() {
    if (!confirm('Clear all production units for this week?')) return
    getWeekDates(bulkWeekStart).forEach(d => {
      products.forEach(p => bulkSetUnit(d, p.id, 0))
    })
  }

  // Distribution preview for selected date
  const distResult = crew ? crewDayEarning(selectedCrew, selectedDate, state) : null

  // Monthly overview data
  const overviewWorkers = workers.filter(w => w.crewId === selectedCrew && !w.inactive)

  function getWorkerDayEarning(wid, date) {
    if (!crew) return null
    if (isDayOff(daysOff, date, selectedCrew)) return null
    if (!crewHasUnitsOnDay(selectedCrew, date, daily, products)) return null
    const w = workers.find(x => x.id === wid)
    if (!w) return null
    if (w.joinDate && date < w.joinDate) return null
    if (w.leaveDate && date > w.leaveDate) return null
    const { shares } = crewDayEarning(selectedCrew, date, state)
    return shares[wid] ?? null
  }

  // Context menu on attendance cells
  function openCtxMenu(e, wid) {
    e.preventDefault()
    setCtxMenu({ wid, x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (crews.length && !selectedCrew) setSelectedCrew(crews[0].id)
  }, [crews])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const dayOffForCrew = isDayOff(daysOff, selectedDate, selectedCrew)
  const hasUnits = crewHasUnitsOnDay(selectedCrew, selectedDate, daily, products)

  return (
    <div onClick={() => setCtxMenu(null)}>
      {/* Context menu */}
      {ctxMenu && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 2000,
          background: 'var(--surface)', border: '2px solid var(--border2)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          minWidth: 180, overflow: 'hidden'
        }}>
          {[
            ['✅ Full day', () => { setFrac(selectedDate, ctxMenu.wid, 1); setCtxMenu(null) }],
            ['½ Half day', () => { setFrac(selectedDate, ctxMenu.wid, 0.5); setCtxMenu(null) }],
            ['❌ Absent', () => { setFrac(selectedDate, ctxMenu.wid, 0); setCtxMenu(null) }],
            ['💰 Set Amount', () => { setDayOverrideModal({ wid: ctxMenu.wid }); setCtxMenu(null) }],
            ['🗑 Clear Override', () => { clearOverride(ctxMenu.wid); setCtxMenu(null) }],
          ].map(([label, action]) => (
            <div key={label} onClick={action} style={{
              padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12,
              borderBottom: '1px solid var(--border)'
            }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseOut={e => e.currentTarget.style.background = ''}
            >{label}</div>
          ))}
        </div>
      )}

      {/* Day Override Modal */}
      {dayOverrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 380, width: '90%' }}>
            <div style={{ fontFamily: 'var(--font-disp)', fontSize: 16, letterSpacing: 1, marginBottom: 4 }}>💰 Set Day Override</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
              {workers.find(w => w.id === dayOverrideModal.wid)?.name} · {selectedDate}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Amount (so'm, blank = remove override)</label>
                <input type="number" value={overrideAmt} onChange={e => setOverrideAmt(e.target.value)}
                  placeholder="e.g. 50000" style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} autoFocus />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="sticky-ov" checked={overrideSticky} onChange={e => setOverrideSticky(e.target.checked)} style={{ width: 16, height: 16 }} />
                <label htmlFor="sticky-ov" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>📌 Sticky (apply every day)</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={submitDayOverride} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>Save</button>
              <button onClick={() => setDayOverrideModal(null)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Week (bulk attendance) Modal */}
      {weekModal && (() => {
        const weekDates = currentWeekDates
        const weekWorkers = workers.filter(w => w.crewId === selectedCrew && !w.inactive)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 16, padding: 24, maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 18, letterSpacing: 1, flex: 1 }}>📅 Edit Week Attendance</div>
                <button onClick={() => setWeekModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '7px 10px', textAlign: 'left', background: 'var(--surface2)', fontWeight: 700 }}>Worker</th>
                      {weekDates.map((d, i) => {
                        const off = isDayOff(daysOff, d, selectedCrew)
                        return (
                          <th key={d} style={{ padding: '6px 4px', background: off ? 'rgba(220,38,38,.06)' : 'var(--surface2)', minWidth: 70 }}>
                            <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 10 }}>{DAY_LABELS[i]}</div>
                            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11 }}>{d.slice(8)}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 3 }}>
                              <button onClick={() => bulkSetAll(d, 1)} style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(22,163,74,.1)', color: 'var(--accent)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 3, cursor: 'pointer' }}>All ✓</button>
                              <button onClick={() => bulkSetAll(d, 0)} style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(220,38,38,.08)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 3, cursor: 'pointer' }}>All ✕</button>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {weekWorkers.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{w.name}</td>
                        {weekDates.map(d => {
                          const f = bulkGetFrac(d, w.id)
                          const isOff = isDayOff(daysOff, d, selectedCrew)
                          return (
                            <td key={d} style={{ padding: 4, textAlign: 'center', background: isOff ? 'rgba(220,38,38,.04)' : '' }}>
                              <button onClick={() => bulkSetFrac(d, w.id, cycleFrac(f))} style={{
                                width: 52, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
                                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, transition: 'all .15s',
                                background: f === 1 ? 'rgba(22,163,74,.15)' : f === 0.5 ? 'rgba(251,191,36,.15)' : 'rgba(220,38,38,.10)',
                                color: f === 1 ? 'var(--accent)' : f === 0.5 ? '#d97706' : 'var(--danger)',
                                boxShadow: f === 1 ? '0 0 0 1.5px var(--accent)' : f === 0.5 ? '0 0 0 1.5px #d97706' : '0 0 0 1.5px var(--danger)'
                              }}>
                                {f === 1 ? '✓ Full' : f === 0.5 ? '½' : '✕'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setWeekModal(false)} style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', padding: '10px 24px',
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700
                }}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Bulk Units Modal */}
      {bulkModal && (() => {
        const weekDates = getWeekDates(bulkWeekStart)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 16, padding: 24, maxWidth: 820, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 18, letterSpacing: 1, flex: 1 }}>📦 Bulk Units — {crew?.name}</div>
                <button onClick={() => {
                  const prev = new Date(bulkWeekStart + 'T00:00:00')
                  prev.setDate(prev.getDate() - 7)
                  setBulkWeekStart(prev.toISOString().slice(0, 10))
                }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>◀ Prev</button>
                <button onClick={() => {
                  const next = new Date(bulkWeekStart + 'T00:00:00')
                  next.setDate(next.getDate() + 7)
                  setBulkWeekStart(next.toISOString().slice(0, 10))
                }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Next ▶</button>
                <button onClick={clearWeekUnits} style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>🗑 Clear Week</button>
                <button onClick={() => setBulkModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '7px 10px', textAlign: 'left', background: 'var(--surface2)', fontWeight: 700 }}>Product</th>
                      {weekDates.map((d, i) => {
                        const dayOff = isDayOff(daysOff, d, selectedCrew)
                        return (
                          <th key={d} style={{ padding: '6px 6px', background: dayOff ? 'rgba(220,38,38,.06)' : 'var(--surface2)', minWidth: 80, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text2)' }}>{DAY_LABELS[i]}</div>
                            <div style={{ fontWeight: 700, fontSize: 11 }}>{d.slice(5)}</div>
                            <button onClick={() => copyDayUnits(d)} style={{
                              marginTop: 3, fontSize: 9, padding: '1px 5px',
                              background: 'rgba(22,163,74,.08)', color: 'var(--accent)',
                              border: '1px solid rgba(22,163,74,.2)', borderRadius: 3, cursor: 'pointer'
                            }} title="Copy this day to all other days">⎘ Copy</button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>{p.name}</td>
                        {weekDates.map(d => {
                          const dayOff = isDayOff(daysOff, d, selectedCrew)
                          return (
                            <td key={d} style={{ padding: 4, background: dayOff ? 'rgba(220,38,38,.04)' : '' }}>
                              <input
                                type="number"
                                value={bulkGetUnit(d, p.id) || ''}
                                onChange={e => bulkSetUnit(d, p.id, e.target.value)}
                                disabled={dayOff}
                                style={{
                                  width: '100%', textAlign: 'right',
                                  fontFamily: 'var(--font-mono)', fontSize: 12,
                                  background: dayOff ? 'rgba(220,38,38,.04)' : '',
                                  border: `1px solid var(--border)`, borderRadius: 4, padding: '5px 6px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 16, textAlign: 'center', color: 'var(--text2)', fontStyle: 'italic' }}>No products in this crew. Add them in Setup.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>Revenue</td>
                      {weekDates.map(d => {
                        const dayData = daily?.[d]?.[selectedCrew] || {}
                        const rev = products.reduce((a, p) => a + (dayData[p.id] || 0) * (p.price || 0), 0)
                        return (
                          <td key={d} style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                            {rev > 0 ? fmt(Math.round(rev)) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setBulkModal(false)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '10px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Crew pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 20, letterSpacing: 2, margin: 0, marginRight: 8 }}>▦ Daily Input</h2>
        {crews.map(c => (
          <button key={c.id} onClick={() => setSelectedCrew(c.id)} style={{
            background: selectedCrew === c.id ? crewColor(crews, c.id) : 'var(--surface2)',
            color: selectedCrew === c.id ? '#fff' : crewColor(crews, c.id),
            border: `2px solid ${crewColor(crews, c.id)}`,
            borderRadius: 20, padding: '5px 16px',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            transition: 'all .15s'
          }}>{c.name}</button>
        ))}
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '5px 10px' }} />
      </div>

      {!crew && (
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 40 }}>
          No crews yet. Go to ⚙ Setup to add crews and products.
        </div>
      )}

      {crew && (
        <>
          {/* Day picker */}
          <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
              {allDates.map(d => {
                const hasData = crewHasUnitsOnDay(selectedCrew, d, daily, products)
                const off = isDayOff(daysOff, d, selectedCrew)
                const note = dayNotes?.[d]
                const isSelected = d === selectedDate
                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    minWidth: 38, padding: '6px 4px', borderRadius: 7, cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: isSelected ? crewColor(crews, selectedCrew) : off ? 'rgba(220,38,38,.08)' : hasData ? 'rgba(22,163,74,.1)' : 'var(--surface2)',
                    color: isSelected ? '#fff' : off ? 'var(--danger)' : hasData ? 'var(--accent)' : 'var(--text2)',
                    border: `2px solid ${isSelected ? crewColor(crews, selectedCrew) : 'transparent'}`,
                    position: 'relative', fontWeight: isSelected ? 700 : 400,
                    transition: 'all .12s'
                  }}>
                    {d.slice(8)}
                    {note && <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, background: '#f59e0b', borderRadius: '50%' }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected date info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-disp)', fontSize: 17, letterSpacing: 1 }}>{selectedDate}</div>
            <button onClick={() => toggleDayOff(selectedDate, selectedCrew)} style={{
              background: dayOffForCrew ? 'rgba(220,38,38,.1)' : 'var(--surface2)',
              border: `1px solid ${dayOffForCrew ? 'var(--danger)' : 'var(--border)'}`,
              color: dayOffForCrew ? 'var(--danger)' : 'var(--text2)',
              borderRadius: 6, cursor: 'pointer', padding: '5px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 12
            }}>{dayOffForCrew ? '🔴 Day Off' : '📅 Mark Day Off'}</button>
            <button onClick={() => { setBulkWeekStart(getWeekDates(selectedDate)[0]); setBulkModal(true) }} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--accent)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700
            }}>📦 Bulk Units</button>
            <button onClick={() => setWeekModal(true)} style={{
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              color: 'var(--accent)', borderRadius: 6, cursor: 'pointer', padding: '5px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700
            }}>📅 Edit Week</button>
          </div>

          {/* Production input table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: 1, marginBottom: 10 }}>📦 PRODUCTION INPUT</div>
            {products.length === 0 ? (
              <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12, fontStyle: 'italic' }}>No products. Add them in ⚙ Setup.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>Product</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>Price</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>Units</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const units = getUnit(selectedDate, selectedCrew, p.id)
                    const rev = units * (p.price || 0)
                    const anomaly = detectAnomaly(selectedCrew, p.id, units, selectedDate, daily)
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          {p.name}
                          {anomaly && <span style={{ marginLeft: 6, color: '#f59e0b', fontSize: 11 }}>⚠️ anomaly</span>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text2)', fontSize: 11 }}>{fmt(p.price)}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={units || ''}
                            onChange={e => setUnit(selectedDate, selectedCrew, p.id, e.target.value)}
                            disabled={dayOffForCrew}
                            style={{
                              width: 100, textAlign: 'right', fontFamily: 'var(--font-mono)',
                              fontSize: 14, fontWeight: 700, padding: '6px 8px',
                              border: `2px solid ${units > 0 ? 'var(--border2)' : 'var(--border)'}`,
                              borderRadius: 6, background: dayOffForCrew ? 'rgba(220,38,38,.04)' : ''
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: rev > 0 ? 'var(--accent)' : 'var(--text2)' }}>
                          {rev > 0 ? fmt(Math.round(rev)) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>TOTAL REVENUE</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)' }}>
                      {fmt(Math.round(distResult?.total || 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Day note */}
          <div style={{ marginBottom: 16 }}>
            <textarea
              ref={noteRef}
              defaultValue={dayNotes?.[selectedDate] || ''}
              key={selectedDate}
              placeholder="📝 Day note (optional)…"
              rows={2}
              onBlur={e => saveDayNote(selectedDate, e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', resize: 'vertical' }}
            />
          </div>

          {/* Attendance section */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div onClick={() => setAttOpen(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
              background: 'var(--surface2)', cursor: 'pointer', userSelect: 'none'
            }}>
              <span style={{ transform: attOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', fontSize: 16, color: 'var(--accent)' }}>›</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>👥 ATTENDANCE ({crewWs.length} workers)</span>
            </div>
            {attOpen && (
              <div style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {crewWs.map(w => {
                    const f = getDayFraction(selectedDate, w.id, absent, dayFraction)
                    const ov = dayOverride?.[selectedDate]?.[w.id] ?? stickyOverride?.[w.id]
                    const hasOv = ov !== undefined && ov !== null
                    return (
                      <div key={w.id} onContextMenu={e => { e.preventDefault(); openCtxMenu(e, w.id) }} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        background: f === 0 ? 'rgba(220,38,38,.06)' : f < 1 ? 'rgba(251,191,36,.06)' : 'var(--surface2)',
                        border: `1px solid ${f === 0 ? 'rgba(220,38,38,.2)' : f < 1 ? 'rgba(251,191,36,.3)' : 'var(--border)'}`,
                        borderRadius: 8, cursor: 'context-menu', userSelect: 'none'
                      }}>
                        <button onClick={() => setFrac(selectedDate, w.id, f === 1 ? 0 : f === 0.5 ? 0 : f === 0 ? 1 : 1)} style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: f === 1 ? 'rgba(22,163,74,.2)' : f === 0.5 ? 'rgba(251,191,36,.2)' : 'rgba(220,38,38,.15)',
                          color: f === 1 ? 'var(--accent)' : f === 0.5 ? '#d97706' : 'var(--danger)',
                          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, flexShrink: 0
                        }}>{f === 1 ? '✓' : f === 0.5 ? '½' : '✕'}</button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: f === 0 ? 'var(--danger)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                          {hasOv && <div style={{ fontSize: 9, color: '#2563eb', fontFamily: 'var(--font-mono)' }}>💰 {fmt(ov)}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button onClick={() => setFrac(selectedDate, w.id, 1)} style={{ background: 'rgba(22,163,74,.1)', border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer', fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓</button>
                          <button onClick={() => setFrac(selectedDate, w.id, 0.5)} style={{ background: 'rgba(251,191,36,.1)', border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer', fontSize: 10, color: '#d97706', fontWeight: 700 }}>½</button>
                          <button onClick={() => setFrac(selectedDate, w.id, 0)} style={{ background: 'rgba(220,38,38,.1)', border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer', fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                  {crewWs.length === 0 && <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12, fontStyle: 'italic', gridColumn: '1/-1' }}>No workers active on this date.</div>}
                </div>
              </div>
            )}
          </div>

          {/* Distribution preview */}
          {distResult && hasUnits && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: 1, marginBottom: 12 }}>💰 DAILY EARNINGS PREVIEW</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {crewWs.map(w => {
                  const earning = distResult.shares[w.id] || 0
                  const f = getDayFraction(selectedDate, w.id, absent, dayFraction)
                  return (
                    <div key={w.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      background: earning > 0 ? 'rgba(22,163,74,.06)' : 'var(--surface2)',
                      border: `1px solid ${earning > 0 ? 'var(--border2)' : 'var(--border)'}`,
                      borderRadius: 8
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                        {f < 1 && <div style={{ fontSize: 9, color: f === 0 ? 'var(--danger)' : '#d97706', fontFamily: 'var(--font-mono)' }}>{f === 0 ? 'absent' : '½ day'}</div>}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: earning > 0 ? 'var(--accent)' : 'var(--text2)', flexShrink: 0 }}>
                        {fmt(Math.round(earning))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                <span>Pool: <strong style={{ color: 'var(--accent)' }}>{fmt(Math.round(distResult.total || 0))}</strong></span>
              </div>
            </div>
          )}

          {/* Monthly Overview table */}
          {overviewWorkers.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflowX: 'auto' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: 1, marginBottom: 12 }}>📊 MONTHLY OVERVIEW — {selectedMonth}</div>
              <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: '100%' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--surface2)', borderBottom: '2px solid var(--border2)', minWidth: 100, fontWeight: 700 }}>Date</th>
                    {overviewWorkers.map(w => (
                      <th key={w.id} style={{ padding: '6px 8px', background: 'var(--surface2)', borderBottom: '2px solid var(--border2)', minWidth: 80, textAlign: 'right', fontWeight: 700, fontSize: 10 }}>
                        {w.name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allDates.map(date => {
                    const off = isDayOff(daysOff, date, selectedCrew)
                    const noData = !crewHasUnitsOnDay(selectedCrew, date, daily, products)
                    if (off || noData) return (
                      <tr key={date} style={{ background: off ? 'rgba(220,38,38,.04)' : '' }} onClick={() => setSelectedDate(date)}>
                        <td style={{ padding: '4px 10px', color: off ? 'var(--danger)' : 'var(--text2)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                          {date.slice(5)} {off ? '🔴' : ''}
                        </td>
                        {overviewWorkers.map(w => <td key={w.id} style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>—</td>)}
                      </tr>
                    )
                    return (
                      <tr key={date}
                        onClick={() => setSelectedDate(date)}
                        style={{
                          cursor: 'pointer',
                          background: date === selectedDate ? 'rgba(22,163,74,.1)' : 'transparent',
                          borderBottom: '1px solid var(--border)'
                        }}>
                        <td style={{
                          padding: '4px 10px', fontWeight: date === selectedDate ? 700 : 400,
                          outline: date === selectedDate ? '2px solid var(--accent)' : 'none',
                          outlineOffset: -1, color: 'var(--text)'
                        }}>{date.slice(5)}</td>
                        {overviewWorkers.map(w => {
                          const earning = getWorkerDayEarning(w.id, date)
                          const f = getDayFraction(date, w.id, absent, dayFraction)
                          return (
                            <td key={w.id} style={{ padding: '4px 8px', textAlign: 'right', color: f === 0 ? 'var(--danger)' : earning != null ? 'var(--text)' : 'var(--text2)' }}>
                              {f === 0
                                ? <span style={{ textDecoration: 'line-through', color: 'var(--danger)', fontSize: 10 }}>absent</span>
                                : earning != null ? fmt(Math.round(earning)) : '—'
                              }
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>GROSS</td>
                    {overviewWorkers.map(w => {
                      const gross = allDates.reduce((a, date) => {
                        const e = getWorkerDayEarning(w.id, date)
                        return a + (e || 0)
                      }, 0)
                      return <td key={w.id} style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{fmt(Math.round(gross))}</td>
                    })}
                  </tr>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>DAYS</td>
                    {overviewWorkers.map(w => {
                      const days = allDates.reduce((a, date) => {
                        if (isDayOff(daysOff, date, selectedCrew)) return a
                        if (!crewHasUnitsOnDay(selectedCrew, date, daily, products)) return a
                        return a + getDayFraction(date, w.id, absent, dayFraction)
                      }, 0)
                      return <td key={w.id} style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>{Math.round(days * 2) / 2}</td>
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
