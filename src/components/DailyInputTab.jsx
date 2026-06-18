import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, UserX, CheckCircle, XCircle, Copy, Eraser } from 'lucide-react'

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

export default function DailyInputTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { workers = [], crews = [], daily = {}, absent = {}, daysOff = {} } = state
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [selectedCrew, setSelectedCrew] = useState(null)
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

  function getDailyVal(workerId, productId) {
    return daily[dk]?.[workerId]?.[productId] ?? ''
  }
  function setDailyVal(workerId, productId, val) {
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      if (!d[dk][workerId]) d[dk][workerId] = {}
      if (val === '' || val === '0' || val === 0) {
        delete d[dk][workerId][productId]
        if (!Object.keys(d[dk][workerId]).length) delete d[dk][workerId]
        if (!Object.keys(d[dk]).length) delete d[dk]
      } else {
        d[dk][workerId][productId] = Number(val)
      }
      return { ...s, daily: d }
    })
  }

  function isAbsent(workerId) { return !!absent[dk]?.[workerId] }

  function toggleAbsent(workerId) {
    updateState(s => {
      const a = { ...s.absent }
      if (!a[dk]) a[dk] = {}
      if (a[dk][workerId]) delete a[dk][workerId]
      else a[dk][workerId] = true
      if (!Object.keys(a[dk]).length) delete a[dk]
      return { ...s, absent: a }
    })
  }

  function isDayOff(day) { return !!daysOff[dateKey(selectedMonth, day)] }
  function toggleDayOff(day) {
    const k = dateKey(selectedMonth, day)
    updateState(s => {
      const d = { ...s.daysOff }
      if (d[k]) delete d[k]; else d[k] = true
      return { ...s, daysOff: d }
    })
  }

  const crewWorkers = useCallback((crewId) =>
    workers.filter(w => w.crewId === crewId && !w.leaveDate),
    [workers]
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
    const cw = crewWorkers(crewId).filter(w => !isAbsent(w.id))
    updateState(s => {
      const d = { ...s.daily }
      for (const w of cw) {
        if (val === '' || val === 0) {
          if (d[dk]?.[w.id]?.[productId]) delete d[dk][w.id][productId]
        } else {
          if (!d[dk]) d[dk] = {}
          if (!d[dk][w.id]) d[dk][w.id] = {}
          d[dk][w.id][productId] = Number(val)
        }
      }
      return { ...s, daily: d }
    })
    setBulkModal(null)
  }

  function copyPrevDay(crewId) {
    const prevDay = selectedDay > 1 ? selectedDay - 1 : null
    if (!prevDay) return alert('No previous day in this month.')
    const prevDk = dateKey(selectedMonth, prevDay)
    const cw = crewWorkers(crewId)
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      for (const w of cw) {
        if (s.absent[dk]?.[w.id]) continue
        const prevData = s.daily[prevDk]?.[w.id]
        if (prevData && Object.keys(prevData).length) {
          d[dk][w.id] = { ...prevData }
        }
      }
      return { ...s, daily: d }
    })
  }

  function clearCrewDay(crewId) {
    if (!confirm('Clear all data for this crew on this day?')) return
    const cw = crewWorkers(crewId)
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) return s
      for (const w of cw) delete d[dk][w.id]
      if (!Object.keys(d[dk]).length) delete d[dk]
      return { ...s, daily: d }
    })
  }

  const activeCrew = crews.filter(c => crewWorkers(c.id).length > 0)
  const daysOffCount = Array.from({ length: days }, (_, i) => i + 1).filter(d => isDayOff(d)).length
  const workingDays = days - daysOffCount

  const displayCrewId = selectedCrew || (activeCrew[0]?.id ?? null)
  const displayCrew = activeCrew.find(c => c.id === displayCrewId)

  const crewAbsentCount = displayCrew ? crewWorkers(displayCrew.id).filter(w => isAbsent(w.id)).length : 0
  const crewTotalCount = displayCrew ? crewWorkers(displayCrew.id).length : 0

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
            <span style={{ marginLeft: 6 }}>Right-click or long-press a day to toggle day off</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Array.from({ length: days }, (_, i) => i + 1).map(d => {
            const dk2 = dateKey(selectedMonth, d)
            const isOff = isDayOff(d)
            const hasData = !!daily[dk2] && Object.keys(daily[dk2]).length > 0
            const isSelected = d === selectedDay
            const dow = getDayOfWeek(selectedMonth, d)
            const isWeekend = dow === 'Sat' || dow === 'Sun'
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                onContextMenu={e => { e.preventDefault(); toggleDayOff(d) }}
                title={`${dk2} (${dow})${isOff ? ' — Day Off' : ''}${hasData ? ' — Has data' : ''}`}
                style={{
                  width: 42, height: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: isSelected ? 700 : 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                  background: isOff
                    ? 'rgba(239,68,68,0.15)'
                    : isSelected
                      ? 'var(--accent)'
                      : hasData
                        ? 'rgba(34,197,94,0.12)'
                        : isWeekend
                          ? 'rgba(139,92,246,0.1)'
                          : 'var(--surface2)',
                  color: isOff
                    ? 'var(--danger)'
                    : isSelected
                      ? '#fff'
                      : hasData
                        ? 'var(--success)'
                        : isWeekend
                          ? 'var(--accent3)'
                          : 'var(--text2)',
                  outline: isSelected ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 1,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{d}</span>
                <span style={{ fontSize: 9, opacity: 0.7, lineHeight: 1 }}>{dow}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Crew Selector Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {activeCrew.map(crew => {
          const isActive = crew.id === displayCrewId
          const absentCt = crewWorkers(crew.id).filter(w => isAbsent(w.id)).length
          return (
            <button
              key={crew.id}
              onClick={() => setSelectedCrew(crew.id)}
              style={{
                padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text2)',
                cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {crew.name}
              {absentCt > 0 && (
                <span style={{
                  marginLeft: 5,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--danger)',
                  color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10,
                }}>{absentCt}×</span>
              )}
            </button>
          )
        })}
        {activeCrew.length === 0 && <span className="text-muted text-sm">No crews with workers yet.</span>}
      </div>

      {/* Crew Input Section */}
      {displayCrew && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Crew header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="crew-dot" />
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk',sans-serif" }}>
                {displayCrew.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {dk} · {crewTotalCount - crewAbsentCount}/{crewTotalCount} present
              </span>
              {isDayOff(selectedDay) && (
                <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                  DAY OFF
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => copyPrevDay(displayCrew.id)} style={{ fontSize: 11 }}>
                <Copy size={11} /> Copy prev day
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => clearCrewDay(displayCrew.id)} style={{ fontSize: 11 }}>
                <Eraser size={11} /> Clear day
              </button>
              <button
                className="btn btn-sm"
                onClick={() => markAllAbsent(displayCrew.id)}
                style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <XCircle size={11} /> All Absent
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => clearAllAbsent(displayCrew.id)} style={{ fontSize: 11 }}>
                <CheckCircle size={11} /> Clear Absent
              </button>
            </div>
          </div>

          {/* Data table */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: 130 }}>Worker</th>
                  <th style={{ width: 80 }}>Level</th>
                  {displayCrew.products?.map(p => (
                    <th key={p.id} style={{ minWidth: 90, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span>{p.name}</span>
                        <button
                          onClick={() => setBulkModal({ crewId: displayCrew.id, productId: p.id, productName: p.name })}
                          style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 6,
                            border: '1px solid var(--accent)',
                            background: 'transparent', color: 'var(--accent)', cursor: 'pointer', lineHeight: 1.4,
                          }}
                          title={`Bulk fill ${p.name} for all`}
                        >
                          bulk fill
                        </button>
                      </div>
                    </th>
                  ))}
                  <th style={{ width: 80, textAlign: 'center' }}>Absent</th>
                </tr>
              </thead>
              <tbody>
                {crewWorkers(displayCrew.id).map((w, i) => {
                  const isAbs = isAbsent(w.id)
                  return (
                    <tr
                      key={w.id}
                      style={{
                        opacity: isAbs ? 0.45 : 1,
                        background: isAbs ? 'rgba(239,68,68,0.04)' : undefined,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                      <td className="fw-600" style={{ fontSize: 13 }}>{w.name}</td>
                      <td><span className={`badge lvl-${w.level}`}>{w.level}</span></td>
                      {displayCrew.products?.map(p => (
                        <td key={p.id} style={{ padding: '3px 6px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            className="num-input"
                            value={getDailyVal(w.id, p.id)}
                            disabled={isAbs}
                            onChange={e => setDailyVal(w.id, p.id, e.target.value)}
                            style={{ width: 72, textAlign: 'center' }}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '3px 6px' }}>
                        <button
                          className={`btn btn-sm ${isAbs ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => toggleAbsent(w.id)}
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          <UserX size={11} />
                          {isAbs ? ' Present' : ' Absent'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Daily totals footer */}
          {displayCrew.products?.length > 0 && (
            <div style={{
              display: 'flex', gap: 16, padding: '8px 14px',
              borderTop: '1px solid var(--border)', background: 'var(--surface2)',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Day totals:</span>
              {displayCrew.products.map(p => {
                const total = crewWorkers(displayCrew.id)
                  .filter(w => !isAbsent(w.id))
                  .reduce((sum, w) => sum + (daily[dk]?.[w.id]?.[p.id] || 0), 0)
                return (
                  <span key={p.id} style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>{p.name}:</span>{' '}
                    <span style={{ fontWeight: 600, color: total > 0 ? 'var(--success)' : 'var(--text3)' }}>
                      {new Intl.NumberFormat().format(total)}
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Bulk Fill Modal */}
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
      <div className="modal" style={{ maxWidth: 320 }}>
        <div className="modal-title">
          <span>Bulk Fill — {productName}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="input-group">
            <label>Value for all present workers</label>
            <input
              className="input"
              type="number"
              min={0}
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="e.g. 100"
              onKeyDown={e => e.key === 'Enter' && onApply(val)}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Sets <strong>{productName}</strong> to this value for all non-absent workers in this crew.
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onApply(val)}>Apply to All</button>
        </div>
      </div>
    </div>
  )
}
