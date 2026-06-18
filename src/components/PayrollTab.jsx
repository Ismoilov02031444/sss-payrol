import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Archive, FileSpreadsheet, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import { computeMonthlyPayroll } from '../payroll'

function fmt(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) }

export default function PayrollTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const [archiveModal, setArchiveModal] = useState(false)
  const [deductModal, setDeductModal] = useState(null) // { worker }

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

  const [y, m] = selectedMonth.split('-')
  const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })

  const results = useMemo(() => computeMonthlyPayroll(state, selectedMonth), [state, selectedMonth])

  const totalNet = results.reduce((s, r) => s + r.netPay, 0)
  const totalGross = results.reduce((s, r) => s + r.totalEarned, 0)

  // Group by crew
  const byCrew = {}
  for (const r of results) {
    const cid = r.crew.id
    if (!byCrew[cid]) byCrew[cid] = { crew: r.crew, rows: [] }
    byCrew[cid].rows.push(r)
  }

  // ── Deduction management ───────────────────────────────────────────────────
  function addDeduction(workerId, amount, reason) {
    updateState(s => {
      const d = { ...(s.deductions || {}) }
      if (!d[workerId]) d[workerId] = []
      d[workerId] = [...d[workerId], { amount: Number(amount), reason, month: selectedMonth, id: 'x' + Math.random().toString(36).slice(2, 8) }]
      return { ...s, deductions: d }
    })
  }
  function removeDeduction(workerId, dedId) {
    updateState(s => {
      const d = { ...(s.deductions || {}) }
      d[workerId] = (d[workerId] || []).filter(x => x.id !== dedId)
      return { ...s, deductions: d }
    })
  }

  // ── Excel export (4 types) ─────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    // 1. Summary sheet
    const summaryData = [
      [`SSS Payroll — ${monthLabel}`], [],
      ['Total Workers', results.length],
      ['Total Gross (so\'m)', Math.round(totalGross)],
      ['Total Net (so\'m)', Math.round(totalNet)],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // 2. All workers sheet
    const headers = ['#', 'Name', 'Crew', 'Level', 'Days Worked', 'Gross (so\'m)', 'Tax (so\'m)', 'Avans (so\'m)', 'Net Pay (so\'m)']
    const allRows = results.map((r, i) => [
      i + 1, r.worker.name, r.crew.name, r.worker.level,
      r.daysWorked, Math.round(r.totalEarned), Math.round(r.tax),
      Math.round(r.monthAvans), Math.round(r.netPay),
    ])
    const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows])
    wsAll['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Workers')

    // 3. Per-crew sheets
    for (const { crew, rows } of Object.values(byCrew)) {
      const ch = ['#', 'Name', 'Level', 'Days', 'Gross', 'Tax', 'Avans', 'Net Pay']
      const cd = rows.map((r, i) => [i + 1, r.worker.name, r.worker.level, r.daysWorked,
        Math.round(r.totalEarned), Math.round(r.tax), Math.round(r.monthAvans), Math.round(r.netPay)])
      const crewNet = rows.reduce((s, r) => s + r.netPay, 0)
      cd.push(['', 'TOTAL', '', '', '', '', '', Math.round(crewNet)])
      const ws = XLSX.utils.aoa_to_sheet([ch, ...cd])
      ws['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, ws, crew.name.replace(/[:\\/?*[\]]/g, '').slice(0, 31))
    }

    // 4. Units production sheet (Date × Product per crew)
    for (const { crew } of Object.values(byCrew)) {
      const products = crew.products || []
      if (!products.length) continue
      const [yr, mn] = selectedMonth.split('-')
      const totalDays = new Date(Number(yr), Number(mn), 0).getDate()
      const prodHeaders = ['Date', ...products.map(p => p.name), 'Total Units', 'Total Earning']
      const prodRows = []
      for (let d = 1; d <= totalDays; d++) {
        const date = `${yr}-${mn}-${String(d).padStart(2, '0')}`
        const dayData = state.daily?.[date]?.[crew.id] || {}
        const units = products.map(p => dayData[p.id] || 0)
        const totalUnits = units.reduce((a, b) => a + b, 0)
        const totalEarning = units.reduce((s, u, i) => s + u * (products[i].price || 0), 0)
        if (totalUnits > 0) {
          prodRows.push([date, ...units, totalUnits, Math.round(totalEarning)])
        }
      }
      if (prodRows.length) {
        const ws = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows])
        XLSX.utils.book_append_sheet(wb, ws, (crew.name + ' units').replace(/[:\\/?*[\]]/g, '').slice(0, 31))
      }
    }

    XLSX.writeFile(wb, `SSS-Payroll-${selectedMonth}.xlsx`)
  }

  function exportCSV() {
    const rows = [['Name', 'Crew', 'Level', 'Days', 'Gross', 'Tax', 'Avans', 'Net Pay']]
    for (const r of results) {
      rows.push([r.worker.name, r.crew.name, r.worker.level, r.daysWorked,
        Math.round(r.totalEarned), Math.round(r.tax), Math.round(r.monthAvans), Math.round(r.netPay)])
    }
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `SSS-Payroll-${selectedMonth}.csv`; a.click()
  }

  // ── Archive month ──────────────────────────────────────────────────────────
  function archiveMonth() {
    updateState(s => {
      const archives = [...(s.archives || [])]
      const existing = archives.findIndex(a => a.month === selectedMonth)
      const snapshot = {
        month: selectedMonth, archivedAt: Date.now(),
        results: results.map(r => ({
          name: r.worker.name, crew: r.crew.name, level: r.worker.level,
          daysWorked: r.daysWorked, totalEarned: Math.round(r.totalEarned),
          tax: Math.round(r.tax), monthAvans: Math.round(r.monthAvans), netPay: Math.round(r.netPay),
        })),
        summary: { workers: results.length, totalGross: Math.round(totalGross), totalNet: Math.round(totalNet) }
      }
      if (existing >= 0) archives[existing] = snapshot
      else archives.push(snapshot)
      return { ...s, archives }
    })
    setArchiveModal(false)
    alert(`${monthLabel} archived!`)
  }

  const archives = state.archives || []
  const isArchived = archives.some(a => a.month === selectedMonth)

  return (
    <div>
      {/* Month selector + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 16, minWidth: 160, textAlign: 'center' }}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}><FileText size={13} /> CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={exportExcel} style={{ color: 'var(--success)' }}><FileSpreadsheet size={13} /> Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setArchiveModal(true)} style={{ color: isArchived ? 'var(--warning)' : undefined }}>
            <Archive size={13} /> {isArchived ? 'Re-Archive' : 'Archive Month'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-header mb-3">
        <div className="summary-title">📊 Monthly Summary — {monthLabel}</div>
        <div className="summary-metrics">
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--accent)' }}>{results.length}</div>
            <div className="metric-lbl">Workers</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--warning)' }}>{fmt(totalGross)}</div>
            <div className="metric-lbl">Gross (so'm)</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--success)' }}>{fmt(totalNet)}</div>
            <div className="metric-lbl">Net Total (so'm)</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--danger)' }}>
              {fmt(results.reduce((s, r) => s + r.monthAvans, 0))}
            </div>
            <div className="metric-lbl">Total Avans</div>
          </div>
        </div>
      </div>

      {/* Per crew tables */}
      {Object.values(byCrew).map(({ crew, rows }) => {
        const crewNet = rows.reduce((s, r) => s + r.netPay, 0)
        return (
          <div key={crew.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="crew-dot" />{crew.name}
                <span className="text-muted text-sm">({rows.length} workers)</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{fmt(crewNet)} so'm net</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Level</th>
                    <th className="td-num">Days</th>
                    <th className="td-num">Gross</th>
                    <th className="td-num">Tax</th>
                    <th className="td-num">Avans</th>
                    <th className="td-num">Net Pay</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.worker.id} style={{ background: r.netPay < 0 ? 'rgba(239,68,68,0.05)' : undefined }}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="fw-600">{r.worker.name}</td>
                      <td><span className={`badge lvl-${r.worker.level}`}>{r.worker.level}</span></td>
                      <td className="td-num">{r.daysWorked}</td>
                      <td className="td-num">{fmt(r.totalEarned)}</td>
                      <td className="td-num text-danger">{r.tax ? fmt(r.tax) : '—'}</td>
                      <td className="td-num" style={{ color: 'var(--warning)' }}>
                        {r.monthAvans ? fmt(r.monthAvans) : '—'}
                      </td>
                      <td className="td-num" style={{ color: r.netPay < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                        {fmt(r.netPay)}
                      </td>
                      <td style={{ padding: '3px 6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeductModal(r)}
                          style={{ padding: '2px 6px', fontSize: 10 }} title="Manage avans/deductions">+</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {results.length === 0 && (
        <div className="empty-state">
          <div>No payroll data for this month.</div>
          <div className="text-sm mt-2">Enter production data in Daily Input first.</div>
        </div>
      )}

      {/* Archives */}
      {archives.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={14} style={{ color: 'var(--warning)' }} /> Archived Months
          </div>
          {archives.map(a => {
            const aLabel = new Date(a.month + '-01').toLocaleString('en', { month: 'long', year: 'numeric' })
            return (
              <div key={a.month} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 6,
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{aLabel}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 10 }}>
                    {a.summary.workers} workers · {fmt(a.summary.totalNet)} so'm net
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const wb = XLSX.utils.book_new()
                  const headers = ['#', 'Name', 'Crew', 'Level', 'Days', 'Gross', 'Tax', 'Avans', 'Net Pay']
                  const rows2 = a.results.map((r, i) => [i + 1, r.name, r.crew, r.level, r.daysWorked, r.totalEarned, r.tax, r.monthAvans || 0, r.netPay])
                  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows2])
                  XLSX.utils.book_append_sheet(wb, ws, aLabel.slice(0, 31))
                  XLSX.writeFile(wb, `SSS-Archive-${a.month}.xlsx`)
                }} style={{ fontSize: 11 }}>
                  <Download size={11} /> Download
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Archive modal */}
      {archiveModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setArchiveModal(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-title">Archive {monthLabel}?
              <button className="btn btn-ghost btn-sm" onClick={() => setArchiveModal(false)}>✕</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                Saves a frozen snapshot of <strong>{monthLabel}</strong> — {results.length} workers, {fmt(totalNet)} so'm net.
                Archived months can be downloaded as Excel any time.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setArchiveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={archiveMonth}><Archive size={13} /> Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction modal */}
      {deductModal && (
        <DeductionModal
          result={deductModal}
          selectedMonth={selectedMonth}
          state={state}
          onAdd={(wid, amt, reason) => { addDeduction(wid, amt, reason); }}
          onRemove={(wid, did) => { removeDeduction(wid, did); }}
          onClose={() => setDeductModal(null)}
        />
      )}
    </div>
  )
}

function DeductionModal({ result, selectedMonth, state, onAdd, onRemove, onClose }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const deductions = (state.deductions?.[result.worker.id] || []).filter(d => d.month === selectedMonth)

  function add() {
    if (!amount || !reason.trim()) return
    onAdd(result.worker.id, amount, reason)
    setAmount(''); setReason('')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-title">
          Avans/Deductions — {result.worker.name}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            Month: {selectedMonth} · Total avans: {new Intl.NumberFormat().format(result.monthAvans)} so'm
          </div>
          {deductions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {deductions.map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface2)', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)'
                }}>
                  <span style={{ flex: 1, fontSize: 12 }}>{d.reason}</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>−{new Intl.NumberFormat().format(d.amount)}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => onRemove(result.worker.id, d.id)} style={{ padding: '2px 6px', fontSize: 10 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="sep" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group">
              <label>Amount (so'm)</label>
              <input className="input" type="number" min={0} value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="e.g. 500000" />
            </div>
            <div className="input-group">
              <label>Reason</label>
              <input className="input" value={reason}
                onChange={e => setReason(e.target.value)} placeholder="e.g. Avans" />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={add}>Add Deduction</button>
        </div>
      </div>
    </div>
  )
}
