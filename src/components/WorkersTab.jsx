import { useState, useRef } from 'react'
import { LEVEL_RANK, LEVEL_LABEL, LEVEL_COLOR, LEVELS, workerMonthlyEarning, workerMonthDeductions } from '../payroll'

function uid() { return 'x' + Math.random().toString(36).slice(2, 10) }
function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }

const CREW_COLORS = ['#16a34a','#2563eb','#d97706','#9333ea','#e11d48','#0891b2']

function crewColor(crews, cid) {
  const i = crews.findIndex(c => c.id === cid)
  return CREW_COLORS[i % CREW_COLORS.length] || '#16a34a'
}

function LevelBadge({ level }) {
  if (!level) return null
  const colors = { SeniorHigh: '#e6b800', High: '#2d8a00', Mid: '#1a6bbf', Beginner: '#6a0dad', Junior: '#888' }
  return (
    <span style={{
      background: (colors[level] || '#888') + '18',
      color: colors[level] || '#888',
      border: `1px solid ${colors[level] || '#888'}44`,
      borderRadius: 6, padding: '1px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: 1
    }}>{LEVEL_LABEL[level] || level}</span>
  )
}

function TypeBadge({ type }) {
  if (type === 'fixed') return (
    <span style={{ background: 'rgba(230,126,34,.12)', color: '#d97706', border: '1px solid rgba(230,126,34,.3)', borderRadius: 6, padding: '1px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>★ FIXED</span>
  )
  if (type === 'daily') return (
    <span style={{ background: 'rgba(59,130,246,.12)', color: '#2563eb', border: '1px solid rgba(59,130,246,.3)', borderRadius: 6, padding: '1px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>📅 DAILY</span>
  )
  return (
    <span style={{ background: 'rgba(22,163,74,.08)', color: 'var(--accent)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 6, padding: '1px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>◆ COMM</span>
  )
}

// Deduction modal
function DeductionModal({ wid, workers, selectedMonth, state, updateState, onClose, editDid }) {
  const w = workers.find(x => x.id === wid)
  const existing = editDid ? (state.deductions?.[wid] || []).find(d => d.id === editDid) : null
  const [reason, setReason] = useState(existing?.reason || '')
  const [amount, setAmount] = useState(existing?.amount || '')
  const [month, setMonth] = useState(existing?.month || selectedMonth)
  const [recurring, setRecurring] = useState(existing ? existing.month === null : false)

  function submit() {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) { alert('Enter an amount greater than 0'); return }
    updateState(s => {
      const deds = { ...(s.deductions || {}) }
      if (!deds[wid]) deds[wid] = []
      if (editDid) {
        deds[wid] = deds[wid].map(d => d.id === editDid
          ? { ...d, reason: reason || 'Deduction', amount: amt, month: recurring ? null : month }
          : d)
      } else {
        deds[wid] = [...deds[wid], { id: uid(), reason: reason || 'Deduction', amount: amt, month: recurring ? null : month }]
      }
      return { ...s, deductions: deds }
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 14, padding: 28, minWidth: 340, maxWidth: 420, width: '90%' }}>
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 16, letterSpacing: 1, marginBottom: 4 }}>
          {editDid ? '✎ Edit Deduction' : '+ 💸 Add Deduction'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>{w?.name}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Avans" style={{ width: '100%', boxSizing: 'border-box' }} autoFocus />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Amount (so'm)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="ded-rec" checked={recurring} onChange={e => setRecurring(e.target.checked)} style={{ width: 16, height: 16 }} />
            <label htmlFor="ded-rec" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>↻ Recurring every month</label>
          </div>
          {!recurring && (
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={submit} style={{
            flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 8, cursor: 'pointer', padding: '10px 0',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700
          }}>{editDid ? '✎ Save Changes' : '💸 Add Deduction'}</button>
          <button onClick={onClose} style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', padding: '10px 0',
            fontFamily: 'var(--font-mono)', fontSize: 12
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// Level history modal
function LevelHistoryModal({ wid, workers, updateState, onClose }) {
  const w = workers.find(x => x.id === wid)
  if (!w) return null
  const history = [...(w.levelHistory || [])].sort((a, b) => a.from.localeCompare(b.from))
  const [newLevel, setNewLevel] = useState('Mid')
  const [newFrom, setNewFrom] = useState(() => new Date().toISOString().slice(0, 10))

  function addEntry() {
    updateState(s => {
      const ws = s.workers.map(x => {
        if (x.id !== wid) return x
        const hist = [...(x.levelHistory || []), { id: uid(), level: newLevel, from: newFrom }]
          .sort((a, b) => a.from.localeCompare(b.from))
        return { ...x, levelHistory: hist, level: hist[hist.length - 1].level }
      })
      return { ...s, workers: ws }
    })
  }

  function removeEntry(eid) {
    updateState(s => {
      const ws = s.workers.map(x => {
        if (x.id !== wid) return x
        const hist = (x.levelHistory || []).filter(e => e.id !== eid)
        return { ...x, levelHistory: hist, level: hist.length ? hist[hist.length - 1].level : x.level }
      })
      return { ...s, workers: ws }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 14, padding: 28, minWidth: 360, maxWidth: 480, width: '90%' }}>
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 16, letterSpacing: 1, marginBottom: 4 }}>Level History</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>{w.name}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
          {history.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', width: 90 }}>{e.from}</span>
              <LevelBadge level={e.level} />
              {i === history.length - 1 && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>← current</span>}
              <button onClick={() => removeEntry(e.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          {history.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>No history yet.</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <select value={newLevel} onChange={e => setNewLevel(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
          <input type="date" value={newFrom} onChange={e => setNewFrom(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          <button onClick={addEntry} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>+ Add</button>
        </div>

        <button onClick={onClose} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '9px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Close</button>
      </div>
    </div>
  )
}

export default function WorkersTab({ state, updateState, selectedMonth }) {
  const { crews = [], workers = [] } = state
  const [openCrewId, setOpenCrewId] = useState(crews[0]?.id || null)
  const [searchQ, setSearchQ] = useState('')
  const [dedModal, setDedModal] = useState(null) // { wid, editDid }
  const [lvlModal, setLvlModal] = useState(null) // wid
  const [dragWid, setDragWid] = useState(null)

  function addWorker(crewId, workerType) {
    const personId = uid()
    const w = {
      id: uid(), personId, crewId, name: 'NEW WORKER',
      workerType, level: 'Beginner', fixedSalary: 0, dailyRate: 100000,
      taxAmount: 0, joinDate: new Date().toISOString().slice(0, 10),
      leaveDate: null, inactive: false, sortOrder: Date.now(),
      levelHistory: [{ id: uid(), level: 'Beginner', from: new Date().toISOString().slice(0, 10) }]
    }
    updateState(s => ({ ...s, workers: [...s.workers, w] }))
  }

  function updateWorker(wid, field, val) {
    updateState(s => ({
      ...s,
      workers: s.workers.map(w => {
        if (w.id !== wid) return w
        const updated = { ...w, [field]: val }
        // Keep levelHistory in sync when level changes
        if (field === 'level') {
          const hist = [...(w.levelHistory || [])]
          const today = new Date().toISOString().slice(0, 10)
          if (!hist.find(e => e.from === today && e.level === val)) {
            hist.push({ id: uid(), level: val, from: today })
          }
          updated.levelHistory = hist.sort((a, b) => a.from.localeCompare(b.from))
        }
        return updated
      })
    }))
  }

  function removeWorker(wid) {
    if (!confirm('Remove this worker? Their payroll history will be lost.')) return
    updateState(s => ({ ...s, workers: s.workers.filter(w => w.id !== wid) }))
  }

  function toggleActive(wid) {
    updateState(s => ({ ...s, workers: s.workers.map(w => w.id === wid ? { ...w, inactive: !w.inactive } : w) }))
  }

  function removeDeduction(wid, did) {
    if (!confirm('Remove this deduction?')) return
    updateState(s => {
      const deds = { ...(s.deductions || {}) }
      if (deds[wid]) deds[wid] = deds[wid].filter(d => d.id !== did)
      return { ...s, deductions: deds }
    })
  }

  const crewWorkers = (cid, type, includeInactive = false) =>
    workers.filter(w => w.crewId === cid && (type ? w.workerType === type : true) && (includeInactive || !w.inactive))

  const sortByLevel = arr => [...arr].sort((a, b) => {
    const r = (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0)
    if (r !== 0) return r
    return (a.sortOrder || 0) - (b.sortOrder || 0)
  })

  const sq = searchQ.toLowerCase()
  const matchingWids = sq ? new Set(workers.filter(w => w.name.toLowerCase().includes(sq)).map(w => w.id)) : null

  // Summary table totals
  const summaryRows = crews.map(crew => {
    const cw = workers.filter(w => w.crewId === crew.id && !w.inactive)
    const gross = cw.reduce((a, w) => a + workerMonthlyEarning(w.id, selectedMonth, state), 0)
    return { crew, count: cw.length, gross }
  })

  return (
    <div>
      {/* Deduction modal */}
      {dedModal && (
        <DeductionModal
          wid={dedModal.wid} editDid={dedModal.editDid}
          workers={workers} selectedMonth={selectedMonth}
          state={state} updateState={updateState}
          onClose={() => setDedModal(null)}
        />
      )}
      {/* Level history modal */}
      {lvlModal && (
        <LevelHistoryModal
          wid={lvlModal} workers={workers}
          updateState={updateState}
          onClose={() => setLvlModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>◈ Workers</h2>
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="🔍 Search workers…"
          style={{ flex: 1, minWidth: 160, fontFamily: 'var(--font-mono)', fontSize: 12 }}
        />
        {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
      </div>

      {/* Summary table */}
      {!sq && (
        <div style={{ marginBottom: 20, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '2px solid var(--border2)', color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>CREW</th>
                <th style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '2px solid var(--border2)', color: 'var(--text2)', fontWeight: 700 }}>WORKERS</th>
                <th style={{ padding: '7px 12px', textAlign: 'right', borderBottom: '2px solid var(--border2)', color: 'var(--text2)', fontWeight: 700 }}>GROSS ({selectedMonth})</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(({ crew, count, gross }) => (
                <tr key={crew.id} onClick={() => setOpenCrewId(crew.id)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700, color: crewColor(crews, crew.id) }}>{crew.name}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>{count}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>{fmt(Math.round(gross))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Crew accordions */}
      {crews.map(crew => {
        const commW = sortByLevel(crewWorkers(crew.id, 'commission'))
        const fixedW = crewWorkers(crew.id, 'fixed')
        const dailyW = crewWorkers(crew.id, 'daily')
        const inactiveW = crewWorkers(crew.id, null, true).filter(w => w.inactive)

        const visCommW = matchingWids ? commW.filter(w => matchingWids.has(w.id)) : commW
        const visFixedW = matchingWids ? fixedW.filter(w => matchingWids.has(w.id)) : fixedW
        const visDailyW = matchingWids ? dailyW.filter(w => matchingWids.has(w.id)) : dailyW
        const hasMatch = matchingWids ? (visCommW.length + visFixedW.length + visDailyW.length) > 0 : true
        if (!hasMatch) return null

        const isOpen = matchingWids ? hasMatch : openCrewId === crew.id
        const col = crewColor(crews, crew.id)

        const WorkerRow = ({ w, type }) => {
          const wDeds = (state.deductions?.[w.id] || []).filter(d => d.month === null || d.month === selectedMonth)
          return (
            <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px' }}>
                <input
                  value={w.name}
                  onChange={e => updateWorker(w.id, 'name', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--text)', width: 140 }}
                />
              </td>
              {type === 'commission' && (
                <>
                  <td style={{ padding: '7px 8px' }}><LevelBadge level={w.level} /></td>
                  <td style={{ padding: '7px 8px' }}>
                    <button onClick={() => setLvlModal(w.id)} style={{
                      background: 'var(--surface)', border: '1px solid var(--border2)',
                      borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}>
                      {LEVEL_LABEL[w.level] || w.level}
                      {w.levelHistory?.length > 1 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 9 }}>{w.levelHistory.length}</span>}
                      <span style={{ fontSize: 10, color: 'var(--text2)' }}>▾</span>
                    </button>
                  </td>
                </>
              )}
              {type === 'fixed' && (
                <td style={{ padding: '7px 8px' }}>
                  <input type="number" value={w.fixedSalary || 0}
                    onChange={e => updateWorker(w.id, 'fixedSalary', parseFloat(e.target.value) || 0)}
                    style={{ width: 130, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', marginLeft: 4 }}>so'm/mo</span>
                </td>
              )}
              {type === 'daily' && (
                <td style={{ padding: '7px 8px' }}>
                  <input type="number" value={w.dailyRate || 0}
                    onChange={e => updateWorker(w.id, 'dailyRate', parseFloat(e.target.value) || 0)}
                    style={{ width: 130, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', color: '#2563eb' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', marginLeft: 4 }}>so'm/day</span>
                </td>
              )}
              <td style={{ padding: '7px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" value={w.taxAmount || 0}
                    onChange={e => updateWorker(w.id, 'taxAmount', parseFloat(e.target.value) || 0)}
                    placeholder="0" style={{ width: 90, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>tax</span>
                </div>
              </td>
              {/* Deductions */}
              <td style={{ padding: '7px 8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <button onClick={() => setDedModal({ wid: w.id, editDid: null })} style={{
                    background: 'rgba(220,53,69,.07)', border: '1px solid rgba(220,53,69,.2)',
                    color: 'var(--danger)', padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap'
                  }}>+ 💸</button>
                  {wDeds.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(212,32,32,.06)', border: '1px solid rgba(212,32,32,.2)', borderRadius: 4, padding: '2px 6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>−{fmt(d.amount)}</span>
                      {d.month === null && <span style={{ fontSize: 9, color: '#2563eb' }}>↻</span>}
                      <button onClick={() => setDedModal({ wid: w.id, editDid: d.id })} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✎</button>
                      <button onClick={() => removeDeduction(w.id, d.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                </div>
              </td>
              {/* Start/End date */}
              <td style={{ padding: '7px 8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input type="date" value={w.joinDate || ''} onChange={e => updateWorker(w.id, 'joinDate', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px' }} />
                  <input type="date" value={w.leaveDate || ''} onChange={e => updateWorker(w.id, 'leaveDate', e.target.value || null)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px' }} placeholder="Leave date" />
                </div>
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => toggleActive(w.id)} title="Pause worker" style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 4, cursor: 'pointer', padding: '3px 7px', fontSize: 12,
                    color: 'var(--text2)'
                  }}>⏸</button>
                  <button onClick={() => removeWorker(w.id)} style={{
                    background: 'transparent', border: '1px solid rgba(220,38,38,.25)',
                    color: 'var(--danger)', borderRadius: 4, cursor: 'pointer', padding: '3px 7px', fontSize: 12
                  }}>✕</button>
                </div>
              </td>
            </tr>
          )
        }

        return (
          <div key={crew.id} style={{
            border: `2px solid ${col}${isOpen ? 'ff' : '44'}`,
            borderLeft: `4px solid ${col}`,
            borderRadius: 12, marginBottom: 12, overflow: 'hidden',
            boxShadow: 'var(--shadow)', transition: 'all .2s'
          }}>
            {/* Crew header */}
            <div onClick={() => setOpenCrewId(isOpen && !matchingWids ? '__none__' : crew.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                background: isOpen ? col : 'var(--surface2)', cursor: 'pointer', userSelect: 'none'
              }}>
              <span style={{ color: isOpen ? '#fff' : col, fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 18, letterSpacing: 2, color: isOpen ? '#fff' : 'var(--text)' }}>{crew.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isOpen ? 'rgba(255,255,255,.7)' : 'var(--text2)', marginTop: 2 }}>
                  {commW.length} commission · {fixedW.length} fixed · {dailyW.length} daily
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['◆', commW.length], ['★', fixedW.length], dailyW.length > 0 ? ['📅', dailyW.length] : null].filter(Boolean).map(([icon, n]) => (
                  <span key={icon} style={{
                    background: isOpen ? 'rgba(255,255,255,.2)' : col + '22',
                    color: isOpen ? '#fff' : col,
                    border: `1px solid ${isOpen ? 'rgba(255,255,255,.35)' : col + '44'}`,
                    borderRadius: 20, padding: '3px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600
                  }}>{icon} {n}</span>
                ))}
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: 20, background: 'var(--surface)', borderTop: '1px solid var(--border2)' }}>
                {/* Commission workers */}
                {(visCommW.length > 0 || !matchingWids) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 8, letterSpacing: 1 }}>◆ Commission Workers</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Name</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Level</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Change Level</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Tax (so'm)</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Avans</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Start / End</th>
                            <th style={{ padding: '6px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>{visCommW.map(w => <WorkerRow key={w.id} w={w} type="commission" />)}</tbody>
                      </table>
                    </div>
                    <button onClick={() => addWorker(crew.id, 'commission')} style={{
                      marginTop: 8, background: 'var(--surface2)', color: 'var(--accent)',
                      border: '1px solid var(--border2)', borderRadius: 6, cursor: 'pointer',
                      padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 12
                    }}>+ Add Commission Worker</button>
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

                {/* Daily rate workers */}
                {(visDailyW.length > 0 || !matchingWids) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#2563eb', marginBottom: 8, letterSpacing: 1 }}>📅 Daily Rate Workers</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Name</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Rate/Day</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Tax (so'm)</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Avans</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Start / End</th>
                            <th style={{ padding: '6px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>{visDailyW.map(w => <WorkerRow key={w.id} w={w} type="daily" />)}</tbody>
                      </table>
                    </div>
                    <button onClick={() => addWorker(crew.id, 'daily')} style={{
                      marginTop: 8, background: 'rgba(59,130,246,.08)', color: '#2563eb',
                      border: '1px solid rgba(59,130,246,.3)', borderRadius: 6, cursor: 'pointer',
                      padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 12
                    }}>+ Add Daily Rate Worker</button>
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

                {/* Fixed workers */}
                {(visFixedW.length > 0 || !matchingWids) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#d97706', marginBottom: 8, letterSpacing: 1 }}>★ Fixed Salary Workers</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)' }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Name</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Monthly Salary</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Tax (so'm)</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Avans</th>
                            <th style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>Start / End</th>
                            <th style={{ padding: '6px 8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>{visFixedW.map(w => <WorkerRow key={w.id} w={w} type="fixed" />)}</tbody>
                      </table>
                    </div>
                    <button onClick={() => addWorker(crew.id, 'fixed')} style={{
                      marginTop: 8, background: 'rgba(230,126,34,.08)', color: '#d97706',
                      border: '1px solid rgba(230,126,34,.3)', borderRadius: 6, cursor: 'pointer',
                      padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 12
                    }}>+ Add Fixed Worker</button>
                  </div>
                )}

                {/* Inactive/paused workers */}
                {inactiveW.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', letterSpacing: 2, marginBottom: 8 }}>⏸ PAUSED WORKERS</div>
                    {inactiveW.map(w => (
                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'rgba(0,0,0,.04)', border: '1px dashed var(--border)', borderRadius: 6, marginBottom: 5, opacity: .65 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text2)', flex: 1 }}>{w.name}</span>
                        <button onClick={() => toggleActive(w.id)} style={{ background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.3)', color: 'var(--accent)', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>▶ Reactivate</button>
                        <button onClick={() => removeWorker(w.id)} style={{ background: 'transparent', border: '1px solid rgba(220,38,38,.2)', color: 'var(--danger)', padding: '4px 9px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {crews.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 40 }}>
          No crews yet. Go to ⚙ Setup to add crews and products first.
        </div>
      )}
    </div>
  )
}
