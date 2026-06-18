import { useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, UserX, CheckCircle, XCircle, Copy, Eraser, AlertTriangle, Eye } from 'lucide-react'
import { crewDayEarning, detectAnomaly } from '../payroll'

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function dateKey(ym, day) {
  const [y, m] = ym.split('-')
  return `${y}-${m}-${String(day).padStart(2, '0')}`
}
function getDayOfWeek(ym, day) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en', { weekday: 'short' })
}
function fmtNum(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) }

export default function DailyInputTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { workers = [], crews = [], daily = {}, absent = {}, dayFraction = {},
    dayOverride = {}, stickyOverride = {}, daysOff = {}, dayNotes = {} } = state

  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [selectedCrew, setSelectedCrew] = useState(null)
  const [showPreview, setShowPreview] = useState(true)
  const [bulkModal, setBulkModal] = useState(null)

  const days = daysInMonth(selectedMonth)
  const dk = dateKey(selectedMonth, selectedDay)

  const [y, m] = selectedMonth.split('-')
  const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── daysOff helpers (per-crew or global) ──────────────────────────────────
  function isDayOff(day, crewId) {
    const k = dateKey(selectedMonth, day)
    const v = daysOff[k]
    if (!v) return false
    if (v === true) return true
    if (typeof v === 'object' && crewId) return !!v[crewId]
    return false
  }
  function toggleDayOff(day, crewId) {
    const k = dateKey(selectedMonth, day)
    updateState(s => {
      const d = { ...s.daysOff }
      if (!crewId) {
        if (d[k]) delete d[k]; else d[k] = true
      } else {
        if (!d[k] || d[k] === true) d[k] = crewId ? { [crewId]: true } : true
        else {
          d[k] = { ...d[k] }
          if (d[k][crewId]) delete d[k][crewId]; else d[k][crewId] = true
          if (!Object.keys(d[k]).length) delete d[k]
        }
      }
      return { ...s, daysOff: d }
    })
  }

  // ── Daily product units ────────────────────────────────────────────────────
  function getDailyVal(crewId, productId) {
    return daily[dk]?.[crewId]?.[productId] ?? ''
  }
  function setDailyVal(crewId, productId, val) {
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      if (!d[dk][crewId]) d[dk][crewId] = {}
      if (val === '' || val === '0' || val === 0) {
        delete d[dk][crewId][productId]
        if (!Object.keys(d[dk][crewId]).length) delete d[dk][crewId]
        if (!Object.keys(d[dk]).length) delete d[dk]
      } else {
        d[dk][crewId][productId] = Number(val)
      }
      return { ...s, daily: d }
    })
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  function getAttendance(workerId) {
    if (absent[dk]?.[workerId]) return 0
    return dayFraction[dk]?.[workerId] ?? 1
  }
  function setAttendance(workerId, val) {
    // val: 0 (absent), 0.5 (half), 1 (full)
    updateState(s => {
      const a = { ...s.absent }
      const df = { ...s.dayFraction }
      if (!a[dk]) a[dk] = {}
      if (!df[dk]) df[dk] = {}

      if (val === 0) {
        a[dk][workerId] = true
        delete df[dk][workerId]
      } else {
        delete a[dk][workerId]
        if (!Object.keys(a[dk]).length) delete a[dk]
        if (val === 0.5) {
          df[dk][workerId] = 0.5
        } else {
          delete df[dk][workerId]
          if (!Object.keys(df[dk]).length) delete df[dk]
        }
      }
      return { ...s, absent: a, dayFraction: df }
    })
  }

  // ── Override ──────────────────────────────────────────────────────────────
  function getOverride(workerId) {
    return dayOverride[dk]?.[workerId] ?? stickyOverride?.[workerId] ?? ''
  }
  function setOverride(workerId, val) {
    updateState(s => {
      const ov = { ...s.dayOverride }
      if (!ov[dk]) ov[dk] = {}
      if (val === '' || val === null) {
        delete ov[dk][workerId]
        if (!Object.keys(ov[dk]).length) delete ov[dk]
      } else {
        ov[dk][workerId] = Number(val)
      }
      return { ...s, dayOverride: ov }
    })
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const crewWorkers = useCallback((crewId) =>
    workers.filter(w => w.crewId === crewId && !w.leaveDate && (!w.joinDate || w.joinDate <= dk)),
    [workers, dk]
  )

  function markAllAbsent(crewId) {
    const cw = crewWorkers(crewId)
    updateState(s => {
      const a = { ...s.absent }
      if (!a[dk]) a[dk] = {}
      for (const w of cw) a[dk][w.id] = true
      return { ...s, absent: a }
    })
  }
  function clearAllAbsent(crewId) {
    const cw = crewWorkers(crewId)
    updateState(s => {
      const a = { ...s.absent }
      if (!a[dk]) return s
      for (const w of cw) delete a[dk][w.id]
      if (!Object.keys(a[dk]).length) delete a[dk]
      return { ...s, absent: a }
    })
  }

  function applyBulkFill(crewId, productId, val) {
    const cw = crewWorkers(crewId)
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      if (!d[dk][crewId]) d[dk][crewId] = {}
      if (val === '' || val === 0) {
        delete d[dk][crewId][productId]
      } else {
        d[dk][crewId][productId] = Number(val)
      }
      if (!Object.keys(d[dk][crewId]).length) delete d[dk][crewId]
      if (!Object.keys(d[dk]).length) delete d[dk]
      return { ...s, daily: d }
    })
    setBulkModal(null)
  }

  function copyPrevDay(crewId) {
    const prevDay = selectedDay > 1 ? selectedDay - 1 : null
    if (!prevDay) return alert('No previous day.')
    const prevDk = dateKey(selectedMonth, prevDay)
    const prevData = state.daily[prevDk]?.[crewId]
    if (!prevData || !Object.keys(prevData).length) return alert('No data for previous day.')
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      d[dk][crewId] = { ...prevData }
      return { ...s, daily: d }
    })
  }

  function clearCrewDay(crewId) {
    if (!confirm('Clear all production data for this crew today?')) return
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) return s
      delete d[dk][crewId]
      if (!Object.keys(d[dk]).length) delete d[dk]
      return { ...s, daily: d }
    })
  }

  // ── Day note ──────────────────────────────────────────────────────────────
  function setDayNote(crewId, text) {
    updateState(s => {
      const n = { ...s.dayNotes }
      if (!n[dk]) n[dk] = {}
      if (!text.trim()) delete n[dk][crewId]
      else n[dk][crewId] = text
      if (!Object.keys(n[dk]).length) delete n[dk]
      return { ...s, dayNotes: n }
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeCrew = crews.filter(c => crewWorkers(c.id).length > 0)
  const daysOffCount = Array.from({ length: days }, (_, i) => i + 1)
    .filter(d => isDayOff(d)).length
  const workingDays = days - daysOffCount

  const displayCrewId = selectedCrew || (activeCrew[0]?.id ?? null)
  const displayCrew = activeCrew.find(c => c.id === displayCrewId)

  // Live distribution preview for current crew+day
  const preview = useMemo(() => {
    if (!displayCrew) return {}
    const { earnings } = crewDayEarning(
      displayCrew, dk, workers, daily, absent, dayFraction, dayOverride, stickyOverride
    )
    return earnings
  }, [displayCrew, dk, workers, daily, absent, dayFraction, dayOverride, stickyOverride])

  const crewTotalCount = displayCrew ? crewWorkers(displayCrew.id).length : 0
  const crewAbsentCount = displayCrew
    ? crewWorkers(displayCrew.id).filter(w => getAttendance(w.id) === 0).length
    : 0

  // Revenue for current day
  const dayRevenue = useMemo(() => {
    if (!displayCrew) return 0
    let rev = 0
    for (const p of (displayCrew.products || [])) {
      rev += (daily[dk]?.[displayCrew.id]?.[p.id] || 0) * (p.price || 0)
    }
    return rev
  }, [displayCrew, dk, daily])

  return (
    <div>
      {/* Month + Day Navigator */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, minWidth: 150, textAlign: 'center' }}>{monthLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{workingDays} working</span>
            {daysOffCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>· {daysOffCount} days off</span>}
            <span style={{ marginLeft: 6 }}>· Right-click a day to mark as day off</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Array.from({ length: days }, (_, i) => i + 1).map(d => {
            const dk2 = dateKey(selectedMonth, d)
            const isOff = isDayOff(d, displayCrewId)
            const hasData = !!(daily[dk2]?.[displayCrewId] && Object.keys(daily[dk2][displayCrewId]).length)
            const isSelected = d === selectedDay
            const dow = getDayOfWeek(selectedMonth, d)
            const isWeekend = dow === 'Sat' || dow === 'Sun'
            return (
              <button key={d}
                onClick={() => setSelectedDay(d)}
                onContextMenu={e => { e.preventDefault(); toggleDayOff(d, displayCrewId) }}
                title={`${dk2} (${dow})${isOff ? ' — Day Off' : ''}${hasData ? ' — Has data' : ''}`}
                style={{
                  width: 42, height: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: isSelected ? 700 : 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                  background: isOff ? 'rgba(239,68,68,0.15)' : isSelected ? 'var(--accent)' : hasData ? 'rgba(34,197,94,0.12)' : isWeekend ? 'rgba(139,92,246,0.1)' : 'var(--surface2)',
                  color: isOff ? 'var(--danger)' : isSelected ? '#fff' : hasData ? 'var(--success)' : isWeekend ? 'var(--accent3)' : 'var(--text2)',
                  outline: isSelected ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{d}</span>
                <span style={{ fontSize: 9, opacity: 0.7, lineHeight: 1 }}>{dow}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Crew Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {activeCrew.map(crew => {
          const isActive = crew.id === displayCrewId
          const absCt = crewWorkers(crew.id).filter(w => getAttendance(w.id) === 0).length
          const hasData = !!(daily[dk]?.[crew.id] && Object.keys(daily[dk][crew.id]).length)
          return (
            <button key={crew.id} onClick={() => setSelectedCrew(crew.id)} style={{
              padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
              borderColor: isActive ? 'var(--accent)' : hasData ? 'var(--success)' : 'var(--border)',
              background: isActive ? 'var(--accent)' : 'var(--surface)',
              color: isActive ? '#fff' : hasData ? 'var(--success)' : 'var(--text2)',
              cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 600 : 400, transition: 'all 0.15s',
            }}>
              {crew.name}
              {absCt > 0 && (
                <span style={{ marginLeft: 5, background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--danger)', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>
                  {absCt}×
                </span>
              )}
            </button>
          )
        })}
        {activeCrew.length === 0 && <span className="text-muted text-sm">No crews with workers yet.</span>}
      </div>

      {/* Crew input section */}
      {displayCrew && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="crew-dot" />
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk',sans-serif" }}>{displayCrew.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {dk} · {crewTotalCount - crewAbsentCount}/{crewTotalCount} present
              </span>
              {isDayOff(selectedDay, displayCrewId) && (
                <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>DAY OFF</span>
              )}
              {dayRevenue > 0 && (
                <span style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                  Revenue: {fmtNum(dayRevenue)} so'm
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview(v => !v)} style={{ fontSize: 11, color: showPreview ? 'var(--accent)' : undefined }}>
                <Eye size={11} /> {showPreview ? 'Hide' : 'Show'} preview
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => copyPrevDay(displayCrew.id)} style={{ fontSize: 11 }}>
                <Copy size={11} /> Copy prev day
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => clearCrewDay(displayCrew.id)} style={{ fontSize: 11 }}>
                <Eraser size={11} /> Clear
              </button>
              <button className="btn btn-sm" onClick={() => markAllAbsent(displayCrew.id)}
                style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <XCircle size={11} /> All Absent
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => clearAllAbsent(displayCrew.id)} style={{ fontSize: 11 }}>
                <CheckCircle size={11} /> Clear Absent
              </button>
            </div>
          </div>

          {/* Products input section */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>Production Units</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
              {(displayCrew.products || []).map(p => {
                const val = getDailyVal(displayCrew.id, p.id)
                const anomaly = val ? detectAnomaly(displayCrew.id, p.id, Number(val), dk, daily) : null
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtNum(p.price)} so'm</span>
                      <button
                        onClick={() => setBulkModal({ crewId: displayCrew.id, productId: p.id, productName: p.name })}
                        style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}
                      >bulk</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min={0} className="num-input"
                        value={val}
                        onChange={e => setDailyVal(displayCrew.id, p.id, e.target.value)}
                        style={{ width: 100, textAlign: 'center', fontSize: 16, padding: '6px 10px', borderColor: anomaly?.isAnomaly ? 'var(--warning)' : undefined }}
                      />
                      {val > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--success)' }}>
                          = {fmtNum(Number(val) * p.price)} so'm
                        </span>
                      )}
                      {anomaly?.isAnomaly && (
                        <span title={`⚠ Unusual: avg is ${fmtNum(anomaly.avg)}, ratio ${anomaly.ratio}×`}
                          style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                          <AlertTriangle size={12} /> {anomaly.ratio}× avg
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {(displayCrew.products || []).length === 0 && (
                <span className="text-muted text-sm">No products configured for this crew. Go to Setup tab.</span>
              )}
            </div>
          </div>

          {/* Workers table with preview */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ width: 24 }}>#</th>
                  <th>Worker</th>
                  <th style={{ width: 80 }}>Level</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Attendance</th>
                  {showPreview && <th style={{ width: 120, textAlign: 'right' }}>Today's Earning</th>}
                  <th style={{ width: 100, textAlign: 'center' }}>Override</th>
                </tr>
              </thead>
              <tbody>
                {crewWorkers(displayCrew.id).map((w, i) => {
                  const att = getAttendance(w.id)
                  const isAbs = att === 0
                  const isHalf = att === 0.5
                  const earning = preview[w.id] || 0
                  return (
                    <tr key={w.id} style={{ opacity: isAbs ? 0.4 : 1, background: isAbs ? 'rgba(239,68,68,0.04)' : undefined }}>
                      <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                      <td className="fw-600" style={{ fontSize: 13 }}>{w.name}</td>
                      <td><span className={`badge lvl-${w.level}`}>{w.level}</span></td>
                      <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => setAttendance(w.id, 1)}
                            style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid', fontSize: 10, cursor: 'pointer',
                              borderColor: att === 1 ? 'var(--success)' : 'var(--border)',
                              background: att === 1 ? 'rgba(34,197,94,0.15)' : 'transparent',
                              color: att === 1 ? 'var(--success)' : 'var(--text3)',
                            }}
                          >Full</button>
                          <button
                            onClick={() => setAttendance(w.id, 0.5)}
                            style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid', fontSize: 10, cursor: 'pointer',
                              borderColor: isHalf ? 'var(--warning)' : 'var(--border)',
                              background: isHalf ? 'rgba(245,158,11,0.15)' : 'transparent',
                              color: isHalf ? 'var(--warning)' : 'var(--text3)',
                            }}
                          >½</button>
                          <button
                            onClick={() => setAttendance(w.id, 0)}
                            style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid', fontSize: 10, cursor: 'pointer',
                              borderColor: isAbs ? 'var(--danger)' : 'var(--border)',
                              background: isAbs ? 'rgba(239,68,68,0.15)' : 'transparent',
                              color: isAbs ? 'var(--danger)' : 'var(--text3)',
                            }}
                          >Abs</button>
                        </div>
                      </td>
                      {showPreview && (
                        <td style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 600, fontSize: 12,
                          color: earning > 0 ? 'var(--success)' : 'var(--text3)' }}>
                          {isAbs ? '—' : earning > 0 ? fmtNum(earning) : '—'}
                          {isHalf && <span style={{ fontSize: 9, color: 'var(--warning)', marginLeft: 3 }}>½</span>}
                        </td>
                      )}
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                        <input
                          type="number" min={0}
                          className="num-input"
                          placeholder="override"
                          value={dayOverride[dk]?.[w.id] ?? ''}
                          onChange={e => setOverride(w.id, e.target.value)}
                          style={{ width: 80, fontSize: 11, textAlign: 'center', opacity: isAbs ? 0.4 : 1 }}
                          disabled={isAbs}
                          title="Manual override for this worker today (replaces commission formula)"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Day note */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Day note</div>
            <input
              className="input"
              placeholder="e.g. Machine stopped at 2pm, New milk batch received…"
              value={dayNotes[dk]?.[displayCrew.id] || ''}
              onChange={e => setDayNote(displayCrew.id, e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>
      )}

      {/* Bulk fill modal */}
      {bulkModal && (
        <BulkFillModal
          productName={bulkModal.productName}
          onApply={val => applyBulkFill(bulkModal.crewId, bulkModal.productId, val)}
          onClose={() => setBulkModal(null)}
        />
      )}
    </div>
  )
}

function BulkFillModal({ productName, onApply, onClose }) {
  const [val, setVal] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 300 }}>
        <div className="modal-title">
          Bulk Fill — {productName}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="input-group">
            <label>Units (sets the crew total)</label>
            <input className="input" type="number" min={0} autoFocus value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onApply(val)} placeholder="e.g. 4000" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onApply(val)}>Apply</button>
        </div>
      </div>
    </div>
  )
}
