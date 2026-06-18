import { useState, useMemo, useCallback } from 'react'
import { crewDayEarning, getWorkerLevelOnDate, LEVEL_RANK } from '../payroll'

const fmt = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n || 0)

const LEVEL_COLORS = {
  SeniorHigh: '#e6b800',
  High: '#2d8a00',
  Mid: '#4f46e5',
  Beginner: '#3aa300',
  Junior: '#55bb00',
}
const LEVEL_LV = {
  SeniorHigh: 'lv-card-SeniorHigh',
  High: 'lv-card-High',
  Mid: 'lv-card-Mid',
  Beginner: 'lv-card-Beginner',
  Junior: 'lv-card-Junior',
}

function getDaysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function getDayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
}

function detectAnomaly(crewId, productId, value, date, daily) {
  if (!value || value <= 0) return false
  const past = []
  for (const [d, crews] of Object.entries(daily || {})) {
    if (d >= date) continue
    const v = crews?.[crewId]?.[productId]
    if (v > 0) past.push(v)
    if (past.length >= 30) break
  }
  if (past.length < 3) return false
  const avg = past.reduce((a,b) => a+b, 0) / past.length
  return value > avg * 3 || value < avg * 0.25
}

export default function DailyInputTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { workers = [], crews = [], daily = {}, dayFraction = {}, dayOverride = {},
    stickyOverride = {}, daysOff = {}, dayNotes = {}, absent = {} } = state

  const [selectedCrew, setSelectedCrew] = useState(() => crews[0]?.id || '')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    const [y, m] = selectedMonth.split('-')
    const monthPrefix = `${y}-${m}-`
    if (today.startsWith(monthPrefix)) return today
    return `${y}-${m}-01`
  })
  const [attOpen, setAttOpen] = useState(true)
  const [dayOverrideModal, setDayOverrideModal] = useState(null) // { workerId, amount }

  const crew = crews.find(c => c.id === selectedCrew) || crews[0]
  const crewId = crew?.id || ''

  // Resolve selectedDate to be in selectedMonth
  const [selY, selM] = selectedMonth.split('-')
  const daysInMonth = getDaysInMonth(selectedMonth)

  // Build date list for the month
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${selY}-${selM}-${d}`
  })

  // Check if a date is off for this crew
  function isDayOff(date) {
    const v = daysOff?.[date]
    if (!v) return false
    if (v === true) return true
    if (typeof v === 'object' && v[crewId]) return true
    return false
  }

  function toggleDayOff(date) {
    updateState(s => {
      const cur = s.daysOff?.[date]
      let next
      if (!cur) {
        next = { ...(s.daysOff || {}), [date]: true }
      } else {
        const copy = { ...(s.daysOff || {}) }
        delete copy[date]
        next = copy
      }
      return { ...s, daysOff: next }
    })
  }

  function hasData(date) {
    const d = daily?.[date]?.[crewId]
    if (!d) return false
    return (crew?.products || []).some(p => (d[p.id] || 0) > 0)
  }

  // Units input
  function setUnits(productId, value) {
    updateState(s => {
      const units = Math.max(0, parseInt(value) || 0)
      return {
        ...s,
        daily: {
          ...s.daily,
          [selectedDate]: {
            ...(s.daily?.[selectedDate] || {}),
            [crewId]: {
              ...(s.daily?.[selectedDate]?.[crewId] || {}),
              [productId]: units,
            },
          },
        },
      }
    })
  }

  // Attendance
  function setFraction(workerId, fraction) {
    updateState(s => {
      const cur = s.dayFraction?.[selectedDate] || {}
      const curAbsent = s.absent || {}
      let newFrac, newAbsent
      if (fraction === 0) {
        const { [workerId]: _, ...rest } = cur
        newFrac = rest
        newAbsent = { ...curAbsent, [selectedDate]: { ...(curAbsent[selectedDate] || {}), [workerId]: true } }
      } else {
        newFrac = { ...cur, [workerId]: fraction }
        const da = { ...(curAbsent[selectedDate] || {}) }
        delete da[workerId]
        newAbsent = { ...curAbsent, [selectedDate]: da }
      }
      return { ...s, dayFraction: { ...s.dayFraction, [selectedDate]: newFrac }, absent: newAbsent }
    })
  }

  function getWorkerFraction(workerId) {
    if (absent?.[selectedDate]?.[workerId]) return 0
    const f = dayFraction?.[selectedDate]?.[workerId]
    if (f !== undefined) return f
    return 1
  }

  // Override
  function setDayOverrideAmt(workerId, amount) {
    updateState(s => ({
      ...s,
      dayOverride: {
        ...s.dayOverride,
        [selectedDate]: {
          ...(s.dayOverride?.[selectedDate] || {}),
          [workerId]: amount === null ? undefined : Number(amount),
        },
      },
    }))
  }
  function clearOverride(workerId) {
    updateState(s => {
      const cur = { ...(s.dayOverride?.[selectedDate] || {}) }
      delete cur[workerId]
      return { ...s, dayOverride: { ...s.dayOverride, [selectedDate]: cur } }
    })
  }

  // Day note
  function saveDayNote(text) {
    updateState(s => ({
      ...s,
      dayNotes: {
        ...s.dayNotes,
        [selectedDate]: { ...(s.dayNotes?.[selectedDate] || {}), [crewId]: text },
      },
    }))
  }

  // Live distribution via payroll engine
  const distResult = useMemo(() => {
    if (!crew) return {}
    try {
      return crewDayEarning(crew, selectedDate, workers, daily, absent, dayFraction, dayOverride, stickyOverride)
    } catch { return {} }
  }, [crew, selectedDate, workers, daily, absent, dayFraction, dayOverride, stickyOverride])

  const crewWorkers = workers.filter(w => w.crewId === crewId && !w.leaveDate)

  // Attendance summary
  const attStats = useMemo(() => {
    let full = 0, partial = 0, absCount = 0
    for (const w of crewWorkers) {
      const f = getWorkerFraction(w.id)
      if (f === 0) absCount++
      else if (f < 1) partial++
      else full++
    }
    return { full, partial, absent: absCount }
  }, [crewWorkers, selectedDate, dayFraction, absent])

  // Products rows
  const products = crew?.products || []
  const dayData = daily?.[selectedDate]?.[crewId] || {}
  let crewRevenue = 0
  let crewUnits = 0
  for (const p of products) {
    const u = dayData[p.id] || 0
    crewRevenue += u * (p.price || 0)
    crewUnits += u
  }

  const dayNote = dayNotes?.[selectedDate]?.[crewId] || ''

  // Crew color — assign from index
  const crewColors = ['#2d8a00','#e6b800','#dc2626','#1a6bbf','#9c27b0','#e67e00','#00897b','#c62828','#283593','#558b2f','#6d4c41','#00838f']
  const crewColorMap = useMemo(() => {
    const map = {}
    crews.forEach((c, i) => { map[c.id] = crewColors[i % crewColors.length] })
    return map
  }, [crews])

  return (
    <div>
      {/* Controls row: Month + Crew pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>Month:</span>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 5,
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12,
            padding: '5px 10px', cursor: 'pointer', outline: 'none',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginLeft: 8 }}>Crew:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {crews.map(c => {
            const color = crewColorMap[c.id]
            const isActive = c.id === crewId
            return (
              <button
                key={c.id}
                onClick={() => { setSelectedCrew(c.id) }}
                style={{
                  background: isActive ? color : '',
                  borderColor: isActive ? color : color + '88',
                  color: isActive ? '#fff' : color,
                  border: '1px solid',
                  borderRadius: 20,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: 0.5,
                  transition: 'all .15s',
                  boxShadow: isActive ? `0 2px 8px ${color}44` : '',
                }}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day picker */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            {monthDates.filter(d => !isDayOff(d)).length} working ·{' '}
            <span style={{ color: 'rgba(212,32,32,.6)' }}>{monthDates.filter(d => isDayOff(d)).length} days off</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtle)' }}>Right-click a day to toggle day off</span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {monthDates.map(date => {
            const off = isDayOff(date)
            const active = date === selectedDate
            const hasD = hasData(date)
            let bg = 'var(--surface)', color = 'var(--muted)', border = '1px solid var(--border2)'
            if (off) {
              bg = 'rgba(212,32,32,.05)'; color = 'rgba(212,32,32,.4)'; border = '1px solid rgba(212,32,32,.25)'
            } else if (hasD) {
              bg = 'rgba(79,70,229,.06)'; color = 'var(--accent)'; border = '1px solid rgba(79,70,229,.5)'
            }
            if (active && off) {
              bg = 'var(--danger)'; color = '#fff'; border = '1px solid var(--danger)'
            } else if (active) {
              bg = 'var(--accent)'; color = '#fff'; border = '1px solid var(--accent)'
            }
            return (
              <button
                key={date}
                title={off ? 'Day off — right-click to restore' : 'Right-click to mark as day off'}
                onClick={() => setSelectedDate(date)}
                onContextMenu={e => { e.preventDefault(); toggleDayOff(date) }}
                style={{
                  background: bg, color, border, borderRadius: 6,
                  width: 40, height: 44, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', transition: 'all .12s', padding: 0,
                  textDecoration: off && !active ? 'none' : '',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, textDecoration: off ? 'line-through' : 'none' }}>
                  {date.slice(8)}
                </span>
                <span style={{ fontSize: 8, fontWeight: 400, letterSpacing: 1, opacity: active ? 0.8 : 0.5, textTransform: 'uppercase' }}>
                  {off ? 'off' : getDayOfWeek(date)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main card */}
      {crew ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontFamily: 'var(--font-disp)', fontSize: 17, letterSpacing: 2, color: 'var(--accent)' }}>
              📅 {selectedDate} — {crew.name}
            </div>
            <button
              onClick={() => {/* bulk week edit placeholder */}}
              style={{
                background: 'rgba(79,70,229,.08)', border: '1px solid rgba(79,70,229,.25)', color: 'var(--accent)',
                padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
              }}
            >
              📋 Edit Week
            </button>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {/* Products table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>Product</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>Price (so'm)</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>Units Produced ✏</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>Earning (so'm)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--subtle)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No products — add them in Setup</td></tr>
                  )}
                  {products.map(p => {
                    const units = dayData[p.id] || 0
                    const earning = units * (p.price || 0)
                    const isAnom = detectAnomaly(crewId, p.id, units, selectedDate, daily)
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: isAnom ? 'rgba(230,184,0,.06)' : '' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>
                          {p.name}
                          {isAnom && <span title="Unusual value — check for typo" style={{ marginLeft: 6, fontSize: 12, color: '#e6b800' }}>⚠</span>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)' }}>
                          {fmt(p.price)}
                        </td>
                        <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            value={units || ''}
                            placeholder="0"
                            onChange={e => setUnits(p.id, e.target.value)}
                            style={{
                              width: 110, textAlign: 'center', fontFamily: 'var(--font-mono)',
                              fontSize: 20, fontWeight: 700, padding: '6px 8px',
                              background: 'var(--bg)', border: '1px solid var(--border2)',
                              borderRadius: 6, color: 'var(--text)', outline: 'none',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border2)'}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                          {fmt(earning)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                    <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>
                      CREW TOTAL — {crew.name}
                    </td>
                    <td></td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                      {fmt(crewUnits)} units
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>
                      {fmt(crewRevenue)} so'm
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Day note */}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>📝</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 2 }}>DAY NOTE</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{selectedDate}</span>
                {dayNote && (
                  <button onClick={() => saveDayNote('')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--subtle)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px' }}>✕ Clear</button>
                )}
              </div>
              <textarea
                rows={2}
                value={dayNote}
                placeholder="Add a note for this day… e.g. 'Machine stopped at 2pm', 'New batch of milk received'"
                onChange={e => saveDayNote(e.target.value)}
                style={{
                  width: '100%', resize: 'vertical', padding: '8px 12px',
                  background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4,
                  fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
                  outline: 'none', lineHeight: 1.5, minHeight: 52,
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border2)'}
              />
            </div>

            {/* Attendance section */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
              {/* Attendance header — clickable to collapse */}
              <div
                onClick={() => setAttOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', userSelect: 'none', marginBottom: attOpen ? 10 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, transition: 'transform .2s', display: 'inline-block', transform: attOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                  👤 Attendance
                  <span style={{ fontSize: 10, color: 'var(--subtle)' }}>Right-click a row for quick actions</span>
                  {/* Summary badges */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(79,70,229,.08)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,.18)', borderRadius: 12, padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
                    ✓ {attStats.full} full
                  </span>
                  {attStats.partial > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(251,146,60,.1)', color: 'var(--fixed-col)', border: '1px solid rgba(251,146,60,.25)', borderRadius: 12, padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
                      ⏱ {attStats.partial} partial
                    </span>
                  )}
                  {attStats.absent > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(220,53,69,.08)', color: 'var(--danger)', border: '1px solid rgba(220,53,69,.2)', borderRadius: 12, padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
                      ✕ {attStats.absent} absent
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); /* bulk week */ }}
                  style={{
                    background: 'rgba(79,70,229,.08)', border: '1px solid rgba(79,70,229,.25)', color: 'var(--accent)',
                    padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  }}
                >
                  📋 Edit Week
                </button>
              </div>

              {/* Attendance table */}
              {attOpen && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {crewWorkers.map(w => {
                        const frac = getWorkerFraction(w.id)
                        const isAbsent = frac === 0
                        const isPartial = frac > 0 && frac < 1
                        const level = getWorkerLevelOnDate(w, selectedDate)
                        const overrideAmt = dayOverride?.[selectedDate]?.[w.id] ?? stickyOverride?.[w.id]
                        const hasStarted = !w.joinDate || w.joinDate <= selectedDate

                        // Not started yet
                        if (!hasStarted) {
                          return (
                            <tr key={w.id} style={{ opacity: 0.35, borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', width: 24 }}><span style={{ color: 'var(--subtle)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>–</span></td>
                              <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--subtle)' }}>{w.name}</td>
                              <td style={{ padding: '9px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtle)' }}>Starts {w.joinDate}</td>
                              <td colSpan={2} style={{ padding: '9px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--subtle)', fontStyle: 'italic' }}>Not started yet</td>
                            </tr>
                          )
                        }

                        let rowBg = '', rowBorderLeft = '3px solid transparent'
                        if (isAbsent) { rowBg = 'rgba(212,32,32,.07)'; rowBorderLeft = '3px solid var(--danger)' }
                        else if (isPartial) { rowBg = 'rgba(230,184,0,.08)'; rowBorderLeft = '3px solid var(--warning)' }

                        // Status badge
                        let statusBg, statusBorder, statusColor, statusText
                        if (isAbsent) {
                          statusBg = 'rgba(212,32,32,.12)'; statusBorder = '1.5px solid rgba(212,32,32,.4)'; statusColor = 'var(--danger)'; statusText = 'ABSENT'
                        } else if (isPartial) {
                          statusBg = 'rgba(230,184,0,.15)'; statusBorder = '1.5px solid rgba(230,184,0,.5)'; statusColor = '#9a6e00'; statusText = '½ DAY'
                        } else {
                          statusBg = 'rgba(79,70,229,.12)'; statusBorder = '1.5px solid rgba(79,70,229,.35)'; statusColor = 'var(--accent)'; statusText = 'FULL'
                        }

                        return (
                          <tr key={w.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg, borderLeft: rowBorderLeft }}>
                            {/* Status badge */}
                            <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block', background: statusBg, border: statusBorder,
                                color: statusColor, borderRadius: 20, padding: '3px 10px',
                                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: 0.5, whiteSpace: 'nowrap',
                              }}>{statusText}</span>
                            </td>
                            {/* Name */}
                            <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {w.name}
                            </td>
                            {/* Level */}
                            <td style={{ padding: '9px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', fontWeight: 600 }}>
                              <span style={{ color: LEVEL_COLORS[level] || 'var(--accent)' }}>{level}</span>
                            </td>
                            {/* Fraction buttons */}
                            <td style={{ padding: '6px 6px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <button
                                  title="Absent"
                                  onClick={() => setFraction(w.id, 0)}
                                  style={{
                                    width: 34, height: 30, borderRadius: 5,
                                    border: `1.5px solid ${isAbsent ? 'var(--danger)' : 'var(--border2)'}`,
                                    background: isAbsent ? 'var(--danger)' : 'var(--surface)',
                                    color: isAbsent ? '#fff' : 'var(--muted)',
                                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                                    boxShadow: isAbsent ? '0 2px 6px rgba(212,32,32,.4)' : '',
                                    transform: isAbsent ? 'scale(1.05)' : '',
                                  }}
                                >✕</button>
                                <button
                                  title="½ day"
                                  onClick={() => setFraction(w.id, 0.5)}
                                  style={{
                                    width: 34, height: 30, borderRadius: 5,
                                    border: `1.5px solid ${isPartial ? '#c49a00' : 'var(--border2)'}`,
                                    background: isPartial ? '#e6b800' : 'var(--surface)',
                                    color: isPartial ? '#111' : 'var(--muted)',
                                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                                    boxShadow: isPartial ? '0 2px 6px rgba(230,184,0,.4)' : '',
                                    transform: isPartial ? 'scale(1.05)' : '',
                                  }}
                                >½</button>
                                <button
                                  title="Full day"
                                  onClick={() => setFraction(w.id, 1)}
                                  style={{
                                    width: 46, height: 30, borderRadius: 5,
                                    border: `1.5px solid ${!isAbsent && !isPartial ? 'var(--accent)' : 'var(--border2)'}`,
                                    background: !isAbsent && !isPartial ? 'var(--accent)' : 'var(--surface)',
                                    color: !isAbsent && !isPartial ? '#fff' : 'var(--muted)',
                                    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                                    boxShadow: !isAbsent && !isPartial ? '0 2px 8px rgba(79,70,229,.35)' : '',
                                    transform: !isAbsent && !isPartial ? 'scale(1.05)' : '',
                                  }}
                                >Full</button>
                              </div>
                            </td>
                            {/* Override / amount */}
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                              {overrideAmt !== undefined && overrideAmt !== null ? (
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  background: 'rgba(96,165,250,.1)', border: '1px solid rgba(96,165,250,.3)',
                                  borderRadius: 3, padding: '3px 8px', color: 'var(--fixed-col)',
                                  fontFamily: 'var(--font-mono)', fontSize: 12,
                                }}>
                                  💰 {fmt(overrideAmt)}
                                  <button
                                    onClick={() => clearOverride(w.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--fixed-col)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 4 }}
                                  >×</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDayOverrideModal({ workerId: w.id, amount: '' })}
                                  title="Set fixed amount for today"
                                  style={{
                                    padding: '3px 8px', borderRadius: 3,
                                    border: '1px dashed rgba(79,70,229,.25)', background: 'transparent',
                                    color: 'var(--subtle)', cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)', fontSize: 11,
                                  }}
                                >💰 Set</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Distribution Preview */}
            {crewWorkers.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 8, letterSpacing: 1 }}>
                  Distribution Preview <span style={{ color: 'var(--subtle)' }}>(daily share — monthly tax subtracted at payroll)</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {crewWorkers.map(w => {
                    const frac = getWorkerFraction(w.id)
                    const isAbsent = frac === 0
                    const level = getWorkerLevelOnDate(w, selectedDate)
                    const earning = distResult?.earnings?.[w.id] ?? 0
                    const overrideAmt = dayOverride?.[selectedDate]?.[w.id] ?? stickyOverride?.[w.id]
                    const lvClass = LEVEL_LV[level] || 'lv-card-Mid'
                    const lvColor = LEVEL_COLORS[level] || 'var(--accent)'
                    const leftBorderColor = w.workerType === 'fixed' ? 'var(--fixed-col)' : w.workerType === 'daily' ? '#2563eb' : lvColor

                    return (
                      <div key={w.id} style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${leftBorderColor}`,
                        borderRadius: 8, padding: '12px 16px', minWidth: 140,
                        position: 'relative', boxShadow: 'var(--shadow)',
                        opacity: isAbsent ? 0.45 : 1,
                        filter: isAbsent ? 'grayscale(.4)' : '',
                      }}>
                        {isAbsent && (
                          <div style={{
                            position: 'absolute', top: 6, right: 8,
                            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--danger)',
                            letterSpacing: 1, border: '1px solid var(--danger)',
                            padding: '1px 5px', borderRadius: 3,
                          }}>ABSENT</div>
                        )}
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{w.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 4, letterSpacing: 1, color: lvColor }}>
                          {w.workerType === 'fixed' ? 'Fixed' : w.workerType === 'daily' ? 'Daily' : level}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>
                          {fmt(earning)} so'm
                        </div>
                        {overrideAmt !== undefined && overrideAmt !== null && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2563eb', fontWeight: 600, marginTop: 2 }}>💰 Fixed override</div>
                        )}
                        {frac > 0 && frac < 1 && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fixed-col)', fontWeight: 600, marginTop: 2 }}>⏱ Half day</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--subtle)', fontFamily: 'var(--font-mono)' }}>
          No crews configured — add them in Setup first.
        </div>
      )}

      {/* Day Override Modal */}
      {dayOverrideModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDayOverrideModal(null)}>
          <div className="modal" style={{ maxWidth: 340 }}>
            <div className="modal-title">
              💰 Set Fixed Amount
              <button className="btn btn-ghost btn-sm" onClick={() => setDayOverrideModal(null)}>✕</button>
            </div>
            <div className="modal-form">
              <div className="input-group">
                <label>Override amount (so'm) for {selectedDate}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  autoFocus
                  value={dayOverrideModal.amount}
                  onChange={e => setDayOverrideModal(m => ({ ...m, amount: e.target.value }))}
                  placeholder="e.g. 150000"
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--font-mono)' }}>
                This replaces the formula for this worker today only.
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDayOverrideModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (dayOverrideModal.amount !== '') {
                    setDayOverrideAmt(dayOverrideModal.workerId, dayOverrideModal.amount)
                  }
                  setDayOverrideModal(null)
                }}
              >✓ Set Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
