import { useState, useMemo, useRef, useEffect } from 'react'
import { workerMonthlyEarning, workerMonthDeductions, crewProductionDays, workerDaysWorked, LEVEL_LABEL, monthDates, isDayOff, crewHasUnitsOnDay } from '../payroll'

function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }
function fmtDays(d) { return d == null ? '?' : (d % 1 === 0 ? d : d.toFixed(1)) }
function uid() { return crypto.randomUUID() }

// ── Column labels per language ───────────────────────────────────────────────
const LABELS = {
  en: { title: 'SSS PAYROLL', num: '#', worker: 'Worker', crew: 'Crew', daysWorked: 'Days Worked', crewDays: 'Crew Days', gross: 'Gross', tax: 'Tax', avans: 'Avans', net: 'Net Salary', total: 'TOTAL', type: 'Type' },
  ru: { title: 'ССС ЗАРПЛАТА', num: '№', worker: 'Работник', crew: 'Бригада', daysWorked: 'Отраб. дней', crewDays: 'Дней бригады', gross: 'Начислено', tax: 'Налог', avans: 'Аванс', net: 'К выдаче', total: 'ИТОГО', type: 'Тип' },
  uz: { title: 'SSS OYLIK', num: '№', worker: 'Xodim', crew: 'Brigada', daysWorked: 'Ishlagan kun', crewDays: 'Brigada kun', gross: 'Yalpi', tax: 'Soliq', avans: 'Avans', net: 'Oylik', total: 'JAMI', type: 'Turi' },
}

// ── ALL WORKERS — 1 sheet ─────────────────────────────────────────────────────
async function exportAllWorkers({ sorted, crews, results, deductions, selectedMonth, crewDaysMap, lang = 'en' }) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
  const L = LABELS[lang]
  const wb = XLSX.utils.book_new()

  const rows = sorted.map((r, i) => {
    const wDeds = (deductions?.[r.id] || []).filter(d => d.month === null || d.month === selectedMonth)
    const avanTotal = wDeds.reduce((a, d) => a + (d.amount || 0), 0)
    const crewDays = r.crewId ? (crewDaysMap[r.crewId] ?? '') : ''
    return [i + 1, r.name, r.crewName, r.daysWorked ?? '', crewDays,
      Math.round(r.gross), Math.round(r.tax || 0), Math.round(avanTotal), Math.round(r.net)]
  })

  const ws = XLSX.utils.aoa_to_sheet([
    [`${L.title} — ${selectedMonth}`], [],
    [L.num, L.worker, L.crew, L.daysWorked, L.crewDays, L.gross, L.tax, L.avans, L.net],
    ...rows, [],
    ['', L.total, '', '', '',
      Math.round(sorted.reduce((a, r) => a + r.gross, 0)),
      Math.round(sorted.reduce((a, r) => a + (r.tax || 0), 0)),
      Math.round(sorted.reduce((a, r) => {
        const wDeds = (deductions?.[r.id] || []).filter(d => d.month === null || d.month === selectedMonth)
        return a + wDeds.reduce((b, d) => b + (d.amount || 0), 0)
      }, 0)),
      Math.round(sorted.reduce((a, r) => a + r.net, 0)),
    ],
  ])
  ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, L.worker + 's')
  XLSX.writeFile(wb, `SSS_Payroll_${selectedMonth}_${lang.toUpperCase()}.xlsx`)
}

// ── BY CREWS — separate sheets ────────────────────────────────────────────────
async function exportByCrews({ sorted, crews, results, deductions, selectedMonth, crewDaysMap, lang = 'en' }) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
  const L = LABELS[lang]
  const wb = XLSX.utils.book_new()

  // Summary sheet first
  const summaryRows = sorted.map((r, i) => {
    const wDeds = (deductions?.[r.id] || []).filter(d => d.month === null || d.month === selectedMonth)
    const avanTotal = wDeds.reduce((a, d) => a + (d.amount || 0), 0)
    return [i + 1, r.name, r.crewName, r.daysWorked ?? '', Math.round(r.gross), Math.round(r.tax || 0), Math.round(avanTotal), Math.round(r.net)]
  })
  const wsSummary = XLSX.utils.aoa_to_sheet([
    [`${L.title} — ${selectedMonth}`], [],
    [L.num, L.worker, L.crew, L.daysWorked, L.gross, L.tax, L.avans, L.net],
    ...summaryRows, [],
    ['', L.total, '', '',
      Math.round(sorted.reduce((a, r) => a + r.gross, 0)),
      Math.round(sorted.reduce((a, r) => a + (r.tax || 0), 0)),
      Math.round(sorted.reduce((a, r) => {
        const wDeds = (deductions?.[r.id] || []).filter(d => d.month === null || d.month === selectedMonth)
        return a + wDeds.reduce((b, d) => b + (d.amount || 0), 0)
      }, 0)),
      Math.round(sorted.reduce((a, r) => a + r.net, 0)),
    ],
  ])
  wsSummary['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, lang === 'uz' ? 'Jami' : lang === 'ru' ? 'Все' : 'All')

  // Per-crew sheets
  crews.forEach(crew => {
    const cw = results.filter(r => r.crewId === crew.id)
    if (!cw.length) return
    const crewDays = crewDaysMap[crew.id] ?? ''
    const rows = cw.map((r, i) => [
      i + 1, r.name,
      r.workerType === 'fixed' ? (lang === 'uz' ? 'Belgilangan' : lang === 'ru' ? 'Фикс.' : 'Fixed')
        : r.workerType === 'daily' ? (lang === 'uz' ? 'Kunlik' : lang === 'ru' ? 'Суточный' : 'Daily')
        : (LEVEL_LABEL[r.level] || r.level),
      r.daysWorked ?? '', crewDays,
      Math.round(r.gross), Math.round(r.tax || 0), Math.round(r.net),
    ])
    const crewNet = cw.reduce((a, r) => a + r.net, 0)
    const ws = XLSX.utils.aoa_to_sheet([
      [`${crew.name} — ${selectedMonth}`], [],
      [L.num, L.worker, L.type, L.daysWorked, L.crewDays, L.gross, L.tax, L.net],
      ...rows, [],
      ['', L.total, '', '', '', Math.round(cw.reduce((a, r) => a + r.gross, 0)), Math.round(cw.reduce((a, r) => a + (r.tax || 0), 0)), Math.round(crewNet)],
    ])
    ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]
    const safeName = crew.name.replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })

  XLSX.writeFile(wb, `SSS_Payroll_ByCrew_${selectedMonth}_${lang.toUpperCase()}.xlsx`)
}

// ── DAILY TABLE — Date × Worker grid ─────────────────────────────────────────
async function exportDailyTable({ crews, state, selectedMonth, crewDaysMap }) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
  const { workers = [], daily = {}, absent = {}, dayFraction = {}, daysOff = {} } = state
  const dates = monthDates(selectedMonth)
  const wb = XLSX.utils.book_new()

  crews.forEach(crew => {
    const crewWorkers = workers.filter(w => w.crewId === crew.id && !w.inactive)
    if (!crewWorkers.length) return

    const header = ['Worker / Date', ...dates.map(d => d.slice(8)), 'Total']
    const rows = crewWorkers.map(w => {
      let total = 0
      const cells = dates.map(date => {
        if (isDayOff(daysOff, date, crew.id)) return 'OFF'
        if (absent?.[date]?.[w.id]) return 'ABS'
        const frac = dayFraction?.[date]?.[w.id]
        if (frac !== undefined && frac !== null && frac !== 1) { total += frac; return frac }
        // check if crew worked that day
        const dayData = daily?.[date]?.[crew.id]
        const crewWorked = dayData && Object.values(dayData).some(v => v > 0)
        if (crewWorked) { total += 1; return 1 }
        return ''
      })
      return [w.name, ...cells, total]
    })

    const ws = XLSX.utils.aoa_to_sheet([
      [`${crew.name} — Daily Table — ${selectedMonth}`], [],
      header,
      ...rows,
    ])
    ws['!cols'] = [{ wch: 28 }, ...dates.map(() => ({ wch: 4 })), { wch: 6 }]
    const safeName = crew.name.replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 29) + '-D'
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })

  XLSX.writeFile(wb, `SSS_DailyTable_${selectedMonth}.xlsx`)
}

// ── UNITS PRODUCTION — Date × Product units ──────────────────────────────────
async function exportUnitsProduction({ crews, state, selectedMonth }) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
  const { daily = {} } = state
  const dates = monthDates(selectedMonth)
  const wb = XLSX.utils.book_new()

  crews.forEach(crew => {
    const products = crew.products || []
    if (!products.length) return

    const header = ['Date', ...products.map(p => p.name), 'Total Units', 'Total Revenue']
    const rows = dates.map(date => {
      const dayData = daily?.[date]?.[crew.id] || {}
      let totalUnits = 0, totalRev = 0
      const cells = products.map(p => {
        const units = dayData[p.id] || 0
        totalUnits += units
        totalRev += units * (p.price || 0)
        return units || ''
      })
      return [date.slice(5), ...cells, totalUnits || '', Math.round(totalRev) || '']
    })

    // Totals row
    const totalsRow = [
      'TOTAL',
      ...products.map(p => dates.reduce((a, date) => a + (daily?.[date]?.[crew.id]?.[p.id] || 0), 0)),
      dates.reduce((a, date) => a + products.reduce((b, p) => b + (daily?.[date]?.[crew.id]?.[p.id] || 0), 0), 0),
      Math.round(dates.reduce((a, date) => a + products.reduce((b, p) => b + (daily?.[date]?.[crew.id]?.[p.id] || 0) * (p.price || 0), 0), 0)),
    ]

    const ws = XLSX.utils.aoa_to_sheet([
      [`${crew.name} — Units Production — ${selectedMonth}`], [],
      header,
      ...rows, [],
      totalsRow,
    ])
    ws['!cols'] = [{ wch: 8 }, ...products.map(p => ({ wch: Math.max(10, p.name.length + 2) })), { wch: 12 }, { wch: 16 }]
    const safeName = crew.name.replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 29) + '-U'
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  })

  XLSX.writeFile(wb, `SSS_Units_${selectedMonth}.xlsx`)
}

const CREW_COLORS = ['#16a34a','#2563eb','#d97706','#9333ea','#e11d48','#0891b2']
function crewColor(crews, cid) {
  const i = crews.findIndex(c => c.id === cid)
  return CREW_COLORS[i % CREW_COLORS.length] || '#16a34a'
}

function DeductionModal({ wid, workers, selectedMonth, state, updateState, onClose, editDid }) {
  const w = workers.find(x => x.id === wid)
  const existing = editDid ? (state.deductions?.[wid] || []).find(d => d.id === editDid) : null
  const [reason, setReason] = useState(existing?.reason || '')
  const [amount, setAmount] = useState(existing?.amount || '')
  const [month, setMonth] = useState(existing?.month || selectedMonth)
  const [recurring, setRecurring] = useState(existing ? existing.month === null : false)

  function submit() {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) { alert('Enter an amount > 0'); return }
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
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 16, letterSpacing: 1, marginBottom: 4 }}>{editDid ? '✎ Edit Deduction' : '+ 💸 Add Deduction'}</div>
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
            <input type="checkbox" id="ded-rec-p" checked={recurring} onChange={e => setRecurring(e.target.checked)} style={{ width: 16, height: 16 }} />
            <label htmlFor="ded-rec-p" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>↻ Recurring every month</label>
          </div>
          {!recurring && (
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={submit} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
            {editDid ? '✎ Save Changes' : '💸 Add Deduction'}
          </button>
          <button onClick={onClose} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function PayrollTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { crews = [], workers = [], deductions = {} } = state
  const [searchQ, setSearchQ] = useState('')
  const [openAllWorkers, setOpenAllWorkers] = useState(true)
  const [openCrewId, setOpenCrewId] = useState(null)
  const [dedModal, setDedModal] = useState(null) // { wid, editDid }
  const [archiveModal, setArchiveModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportBtnRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showExportMenu) return
    function handleClick(e) {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showExportMenu])

  async function runExport(fn, ...args) {
    setShowExportMenu(false)
    setExporting(true)
    try { await fn(...args) }
    catch (e) { alert('Export failed: ' + e.message) }
    finally { setExporting(false) }
  }

  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', textAlign: 'left',
    background: 'transparent', border: 'none',
    padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    color: 'var(--text)',
    transition: 'background .1s',
  }

  function removeDeduction(wid, did) {
    if (!confirm('Remove this deduction?')) return
    updateState(s => {
      const deds = { ...(s.deductions || {}) }
      if (deds[wid]) deds[wid] = deds[wid].filter(d => d.id !== did)
      return { ...s, deductions: deds }
    })
  }

  const crewDaysMap = useMemo(() => {
    const m = {}
    crews.forEach(c => { m[c.id] = crewProductionDays(selectedMonth, c.id, state) })
    return m
  }, [crews, selectedMonth, state])

  const results = useMemo(() => {
    const activeWorkers = workers.filter(w => !w.inactive)
    const entryResults = activeWorkers.map(w => {
      const gross = workerMonthlyEarning(w.id, selectedMonth, state)
      const daysWorked = (w.workerType === 'commission' || w.workerType === 'daily')
        ? workerDaysWorked(w.id, selectedMonth, state) : null
      const crew = crews.find(c => c.id === w.crewId)
      return { ...w, gross, daysWorked, crewName: crew?.name || '' }
    })

    // Group by personId
    const personMap = new Map()
    entryResults.forEach(r => {
      const pid = (r.personId && r.personId !== 'null') ? r.personId : r.id
      if (!personMap.has(pid)) {
        personMap.set(pid, { personId: pid, name: r.name, tax: r.taxAmount || 0, entries: [], totalGross: 0 })
      }
      const p = personMap.get(pid)
      if (!p.entries.find(e => e.id === r.id)) { p.entries.push(r); p.totalGross += r.gross }
    })

    return [...personMap.values()].map(p => {
      const wid = p.entries[0]?.id
      const dedTotal = workerMonthDeductions(wid, selectedMonth, deductions)
      return {
        ...p,
        gross: p.totalGross,
        dedTotal,
        net: p.totalGross - (p.tax || 0) - dedTotal,
        isMultiCrew: p.entries.length > 1,
        workerType: p.entries[0]?.workerType || 'commission',
        level: p.entries[0]?.level || '',
        daysWorked: p.entries.length === 1 ? (p.entries[0]?.daysWorked ?? null) : null,
        crewName: p.entries.length === 1 ? p.entries[0].crewName : 'Multiple Crews',
        crewId: p.entries.length === 1 ? p.entries[0].crewId : null,
        id: wid,
      }
    })
  }, [workers, crews, selectedMonth, state, deductions])

  const sq = searchQ.toLowerCase()
  const filtered = sq ? results.filter(r => r.name.toLowerCase().includes(sq)) : results
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  const totalGross = sorted.reduce((a, r) => a + r.gross, 0)
  const totalTax = sorted.reduce((a, r) => a + (r.tax || 0), 0)
  const totalDed = sorted.reduce((a, r) => a + (r.dedTotal || 0), 0)
  const totalNet = sorted.reduce((a, r) => a + r.net, 0)
  const anyTax = sorted.some(r => r.tax > 0)

  function doArchive() {
    const entry = {
      id: uid(),
      month: selectedMonth,
      archivedAt: new Date().toISOString(),
      results: results.map(r => ({ name: r.name, crewName: r.crewName, gross: r.gross, tax: r.tax || 0, dedTotal: r.dedTotal || 0, net: r.net })),
      totalNet, totalGross
    }
    updateState(s => ({ ...s, archive: [...(s.archive || []), entry] }))
    setArchiveModal(false)
    alert(`✅ ${selectedMonth} archived!`)
  }

  return (
    <div>
      {dedModal && (
        <DeductionModal
          wid={dedModal.wid} editDid={dedModal.editDid}
          workers={workers} selectedMonth={selectedMonth}
          state={state} updateState={updateState}
          onClose={() => setDedModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>⊕ Payroll</h2>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 10px' }} />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Search workers…"
          style={{ flex: 1, minWidth: 140, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
        {/* Excel export dropdown */}
        <div ref={exportBtnRef} style={{ position: 'relative' }}>
          <button
            onClick={() => !exporting && setShowExportMenu(v => !v)}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: showExportMenu ? '#16a34a' : 'rgba(22,163,74,.1)',
              border: '1px solid rgba(22,163,74,.4)',
              color: showExportMenu ? '#fff' : '#16a34a',
              borderRadius: 8, cursor: exporting ? 'wait' : 'pointer',
              padding: '7px 13px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              opacity: exporting ? 0.7 : 1, transition: 'all .15s'
            }}
          >
            {exporting ? '⏳ Exporting…' : <><span>📊 Download Excel</span><span style={{ fontSize: 10, marginLeft: 2 }}>▾</span></>}
          </button>

          {showExportMenu && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 999,
              background: 'var(--surface)', border: '2px solid var(--border2)',
              borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.25)',
              minWidth: 240, overflow: 'hidden',
            }}>
              {/* ALL WORKERS */}
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#16a34a', letterSpacing: 1, fontWeight: 700, background: 'rgba(22,163,74,.06)' }}>
                📋 ALL WORKERS (1 sheet)
              </div>
              {[['🇬🇧', 'English', 'en'], ['🇷🇺', 'Russian', 'ru'], ['🇺🇿', "O'zbek", 'uz']].map(([flag, label, lang]) => (
                <button key={lang} onClick={() => runExport(exportAllWorkers, { sorted, crews, results, deductions, selectedMonth, crewDaysMap, lang })}
                  style={menuItemStyle}>
                  <span style={{ fontSize: 14 }}>{flag}</span> {label}
                </button>
              ))}

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* BY CREWS */}
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2563eb', letterSpacing: 1, fontWeight: 700, background: 'rgba(37,99,235,.06)' }}>
                🏭 BY CREWS (separate sheets)
              </div>
              {[['🇬🇧', 'English', 'en'], ['🇷🇺', 'Russian', 'ru'], ['🇺🇿', "O'zbek", 'uz']].map(([flag, label, lang]) => (
                <button key={lang} onClick={() => runExport(exportByCrews, { sorted, crews, results, deductions, selectedMonth, crewDaysMap, lang })}
                  style={menuItemStyle}>
                  <span style={{ fontSize: 14 }}>{flag}</span> {label}
                </button>
              ))}

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* DAILY TABLE */}
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#d97706', letterSpacing: 1, fontWeight: 700, background: 'rgba(217,119,6,.06)' }}>
                📅 DAILY TABLE (like on screen)
              </div>
              <button onClick={() => runExport(exportDailyTable, { crews, state, selectedMonth, crewDaysMap })}
                style={menuItemStyle}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span>One sheet per crew —<br /><span style={{ color: 'var(--text2)', fontSize: 11 }}>Date × Worker grid</span></span>
              </button>

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* UNITS PRODUCTION */}
              <div style={{ padding: '8px 14px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9333ea', letterSpacing: 1, fontWeight: 700, background: 'rgba(147,51,234,.06)' }}>
                📦 UNITS PRODUCTION
              </div>
              <button onClick={() => runExport(exportUnitsProduction, { crews, state, selectedMonth })}
                style={{ ...menuItemStyle, paddingBottom: 12 }}>
                <span style={{ fontSize: 14 }}>📈</span>
                <span>One sheet per crew —<br /><span style={{ color: 'var(--text2)', fontSize: 11 }}>Date × Product units</span></span>
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setArchiveModal(true)} style={{
          background: 'rgba(22,163,74,.08)', border: '1px solid var(--border2)',
          color: 'var(--accent)', borderRadius: 8, cursor: 'pointer',
          padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700
        }}>🗂 Archive Month</button>
      </div>

      {/* Factory net badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 16px', background: 'var(--accent)', borderRadius: 10, marginBottom: 16,
        fontFamily: 'var(--font-mono)', color: '#fff'
      }}>
        <span style={{ fontSize: 12, opacity: .8 }}>
          {sq ? `${sorted.length} found ·` : `${sorted.length} workers ·`} {selectedMonth}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, marginLeft: 'auto' }}>
          FACTORY NET: {fmt(Math.round(totalNet))} SO'M
        </span>
      </div>

      {/* All Workers accordion */}
      <div style={{
        border: `2px solid ${openAllWorkers ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, marginBottom: 20, overflow: 'hidden', boxShadow: 'var(--shadow)'
      }}>
        <div onClick={() => setOpenAllWorkers(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          background: openAllWorkers ? 'var(--accent)' : 'var(--surface2)',
          cursor: 'pointer', userSelect: 'none'
        }}>
          <span style={{ color: openAllWorkers ? '#fff' : 'var(--accent)', fontSize: 18, transform: openAllWorkers ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-disp)', fontSize: 17, letterSpacing: 2, color: openAllWorkers ? '#fff' : 'var(--text)' }}>
              🏭 All Workers — {selectedMonth}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: openAllWorkers ? 'rgba(255,255,255,.7)' : 'var(--text2)', marginTop: 2 }}>
              {sorted.length} workers · alphabetical
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span style={{ color: openAllWorkers ? 'rgba(255,255,255,.8)' : 'var(--accent2)' }}>gross {fmt(Math.round(totalGross))}</span>
            {anyTax && <span style={{ color: openAllWorkers ? 'rgba(255,180,180,.9)' : 'var(--danger)' }}>({fmt(Math.round(totalTax))})</span>}
            <span style={{ background: openAllWorkers ? 'rgba(255,255,255,.2)' : 'var(--accent)', color: '#fff', borderRadius: 20, padding: '3px 12px', fontWeight: 700 }}>{fmt(Math.round(totalNet))}</span>
          </div>
        </div>

        {openAllWorkers && (
          <div style={{ padding: 16, background: 'var(--surface)', borderTop: '1px solid var(--border2)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: '7px 8px', textAlign: 'center', width: 32, color: 'var(--text2)', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700 }}>Worker</th>
                  <th style={{ padding: '7px 8px', color: 'var(--text2)', fontWeight: 700 }}>Crew</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text2)', fontWeight: 700 }}>Days</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', background: 'rgba(22,163,74,.08)', color: 'var(--accent2)', fontWeight: 700 }}>Gross</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', background: 'rgba(220,38,38,.06)', color: 'var(--danger)', fontWeight: 700 }}>Tax</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', background: 'rgba(220,38,38,.06)', color: 'var(--danger)', fontWeight: 700 }}>Avans</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>NET SALARY</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const wDeds = (deductions?.[r.id] || []).filter(d => d.month === null || d.month === selectedMonth)
                  const crewDays = r.crewId ? (crewDaysMap[r.crewId] ?? '?') : '?'
                  return (
                    <tr key={r.personId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text2)' }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700 }}>
                        {r.name}
                        {r.isMultiCrew && <span style={{ marginLeft: 6, background: 'rgba(22,163,74,.08)', color: 'var(--accent)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 10, padding: '1px 7px', fontSize: 9 }}>⬡ multi</span>}
                      </td>
                      <td style={{ padding: '7px 8px', color: 'var(--text2)' }}>{r.crewName}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {r.isMultiCrew
                          ? <span style={{ color: 'var(--accent)', fontSize: 10 }}>{r.entries.length} crews</span>
                          : r.workerType === 'commission' || r.workerType === 'daily'
                            ? <span style={{
                                background: r.daysWorked === 0 ? 'rgba(220,38,38,.08)' : 'rgba(22,163,74,.08)',
                                color: r.daysWorked === 0 ? 'var(--danger)' : 'var(--accent)',
                                border: `1px solid ${r.daysWorked === 0 ? 'rgba(220,38,38,.2)' : 'rgba(22,163,74,.2)'}`,
                                borderRadius: 6, padding: '2px 7px', fontSize: 11, fontFamily: 'var(--font-mono)'
                              }}>{fmtDays(r.daysWorked)}/{crewDays}</span>
                            : <span style={{ color: '#d97706', fontSize: 11 }}>fixed</span>
                        }
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: r.workerType === 'fixed' ? '#d97706' : r.workerType === 'daily' ? '#2563eb' : 'var(--accent)', fontWeight: 700 }}>{fmt(Math.round(r.gross))}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--danger)' }}>{r.tax > 0 ? `(${fmt(r.tax)})` : '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap' }}>
                          {wDeds.map(d => (
                            <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 11 }}>({fmt(d.amount)})</span>
                              {d.month === null && <span style={{ fontSize: 9, color: '#2563eb' }}>↻</span>}
                              <button onClick={() => setDedModal({ wid: r.id, editDid: d.id })} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✎</button>
                              <button onClick={() => removeDeduction(r.id, d.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>✕</button>
                            </span>
                          ))}
                          <button onClick={() => setDedModal({ wid: r.id, editDid: null })} style={{
                            background: 'rgba(220,53,69,.08)', border: '1px solid rgba(220,53,69,.25)',
                            color: 'var(--danger)', padding: '2px 8px', borderRadius: 5,
                            cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap'
                          }}>+ 💸</button>
                        </div>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{fmt(Math.round(r.net))}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>TOTAL — {sorted.length} workers</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmt(Math.round(totalGross))}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)' }}>{anyTax ? `(${fmt(Math.round(totalTax))})` : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)' }}>{totalDed > 0 ? `(${fmt(Math.round(totalDed))})` : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)' }}>{fmt(Math.round(totalNet))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Per-crew accordions */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: 1, marginBottom: 10 }}>▼ BREAKDOWN BY CREW — click to expand</div>
      {crews.map(crew => {
        const cw = results.filter(r => r.crewId === crew.id)
        if (!cw.length) return null
        const isOpen = openCrewId === crew.id
        const col = crewColor(crews, crew.id)
        const crewGross = cw.reduce((a, r) => a + r.gross, 0)
        const crewTax = cw.reduce((a, r) => a + (r.tax || 0), 0)
        const crewNet = cw.reduce((a, r) => a + r.net, 0)
        const thisDays = crewDaysMap[crew.id] ?? '?'
        const commR = cw.filter(r => r.workerType === 'commission')
        const fixedR = cw.filter(r => r.workerType === 'fixed')
        const dailyR = cw.filter(r => r.workerType === 'daily')

        const makeRows = (arr, showDays) => arr.map(r => (
          <tr key={r.personId} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '7px 10px', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.name}</td>
            <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: r.workerType === 'fixed' ? '#d97706' : r.workerType === 'daily' ? '#2563eb' : 'var(--accent)' }}>
              {r.workerType === 'fixed' ? '★ FIXED' : r.workerType === 'daily' ? '📅 DAILY' : LEVEL_LABEL[r.level] || r.level}
            </td>
            {showDays
              ? <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  <span style={{ background: 'rgba(22,163,74,.08)', color: 'var(--accent)', border: '1px solid rgba(22,163,74,.2)', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    {fmtDays(r.daysWorked)}/{thisDays}
                  </span>
                </td>
              : <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text2)', fontSize: 11 }}>—</td>
            }
            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 12, color: r.workerType === 'fixed' ? '#d97706' : r.workerType === 'daily' ? '#2563eb' : 'var(--accent)' }}>{fmt(Math.round(r.gross))}</td>
            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)' }}>{r.tax > 0 ? `(${fmt(r.tax)})` : '—'}</td>
            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)' }}>{fmt(Math.round(r.net))}</td>
          </tr>
        ))

        return (
          <div key={crew.id} style={{
            border: `2px solid ${isOpen ? col : col + '55'}`,
            borderLeft: `4px solid ${col}`, borderRadius: 12, marginBottom: 10,
            overflow: 'hidden', boxShadow: 'var(--shadow)', transition: 'all .2s'
          }}>
            <div onClick={() => setOpenCrewId(isOpen ? null : crew.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              background: isOpen ? col : 'var(--surface2)', cursor: 'pointer', userSelect: 'none'
            }}>
              <span style={{ color: isOpen ? '#fff' : col, fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 17, letterSpacing: 2, color: isOpen ? '#fff' : 'var(--text)' }}>{crew.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isOpen ? 'rgba(255,255,255,.7)' : 'var(--text2)', marginTop: 2 }}>
                  {cw.length} workers · Net: {fmt(Math.round(crewNet))} so'm
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ color: isOpen ? 'rgba(255,255,255,.8)' : col }}>gross {fmt(Math.round(crewGross))}</span>
                {crewTax > 0 && <span style={{ color: isOpen ? 'rgba(255,180,180,.9)' : 'var(--danger)' }}>({fmt(Math.round(crewTax))})</span>}
                <span style={{ background: isOpen ? 'rgba(255,255,255,.2)' : col, color: '#fff', borderRadius: 20, padding: '3px 12px', fontWeight: 700 }}>{fmt(Math.round(crewNet))}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: 16, background: 'var(--surface)', borderTop: `1px solid ${col}33`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700 }}>Worker</th>
                      <th style={{ padding: '6px 8px', color: 'var(--text2)', fontWeight: 700 }}>Level</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text2)', fontWeight: 700 }}>Days</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', background: 'rgba(22,163,74,.08)', color: 'var(--accent2)', fontWeight: 700 }}>Gross</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', background: 'rgba(220,38,38,.06)', color: 'var(--danger)', fontWeight: 700 }}>Tax</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commR.length > 0 && <>
                      <tr><td colSpan={6} style={{ padding: '5px 10px', background: 'rgba(22,163,74,.06)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 1 }}>◆ Commission</td></tr>
                      {makeRows(commR, true)}
                    </>}
                    {dailyR.length > 0 && <>
                      <tr><td colSpan={6} style={{ padding: '5px 10px', background: 'rgba(59,130,246,.06)', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2563eb', letterSpacing: 1 }}>📅 Daily Rate</td></tr>
                      {makeRows(dailyR, true)}
                    </>}
                    {fixedR.length > 0 && <>
                      <tr><td colSpan={6} style={{ padding: '5px 10px', background: 'rgba(230,126,34,.06)', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#d97706', letterSpacing: 1 }}>★ Fixed</td></tr>
                      {makeRows(fixedR, false)}
                    </>}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>CREW TOTAL</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmt(Math.round(crewGross))}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)' }}>{crewTax > 0 ? `(${fmt(Math.round(crewTax))})` : '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmt(Math.round(crewNet))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Archive confirmation modal */}
      {archiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '2px solid var(--border2)', borderRadius: 14, padding: 28, minWidth: 320, maxWidth: 400, width: '90%' }}>
            <div style={{ fontFamily: 'var(--font-disp)', fontSize: 18, letterSpacing: 1, marginBottom: 8 }}>🗂 Archive {selectedMonth}?</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>
              This will save a snapshot of the current payroll for <strong>{selectedMonth}</strong> to the archive.<br />
              Factory net: <strong>{fmt(Math.round(totalNet))} so'm</strong>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doArchive} style={{ flex: 1, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>✅ Yes, Archive</button>
              <button onClick={() => setArchiveModal(false)} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
