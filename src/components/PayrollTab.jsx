import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Archive, FileSpreadsheet, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'

const LEVEL_ORDER = ['SeniorHigh', 'High', 'Mid', 'Beginner', 'Junior']

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function computePayroll(state, selectedMonth) {
  const { workers = [], crews = [], daily = {}, absent = {}, daysOff = {}, deductions = {} } = state

  const [y, m] = selectedMonth.split('-')
  const totalDays = daysInMonth(selectedMonth)
  const workDays = Array.from({ length: totalDays }, (_, i) => i + 1)
    .filter(d => {
      const dk = `${y}-${m}-${String(d).padStart(2, '0')}`
      return !daysOff[dk]
    }).length

  const results = []

  for (const worker of workers) {
    const crew = crews.find(c => c.id === worker.crewId)
    if (!crew) continue

    let daysWorked = 0
    let totalEarned = 0

    for (let d = 1; d <= totalDays; d++) {
      const dk = `${y}-${m}-${String(d).padStart(2, '0')}`
      if (daysOff[dk]) continue
      if (absent[dk]?.[worker.id]) continue
      daysWorked++

      const dayData = daily[dk]?.[worker.id] || {}
      if (worker.workerType === 'commission') {
        for (const product of (crew.products || [])) {
          const qty = dayData[product.id] || 0
          totalEarned += qty * (product.price || 0)
        }
      }
    }

    const levelGap = crew.levelGap || 10000
    const levelIdx = LEVEL_ORDER.indexOf(worker.level)
    const seniorIdx = LEVEL_ORDER.indexOf('SeniorHigh')
    const levelBonus = Math.max(0, seniorIdx - levelIdx) * levelGap * daysWorked

    const grossPay = totalEarned + levelBonus
    const tax = (worker.taxAmount || 0) * daysWorked
    const extraDeduct = deductions?.[selectedMonth]?.[worker.id] || 0
    const netPay = Math.max(0, grossPay - tax - extraDeduct)

    results.push({ worker, crew, daysWorked, totalDays: workDays, totalEarned, levelBonus, grossPay, tax, extraDeduct, netPay })
  }

  return { results, workDays }
}

function fmt(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

export default function PayrollTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const [archiveModal, setArchiveModal] = useState(false)

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

  const { results, workDays } = useMemo(() => computePayroll(state, selectedMonth), [state, selectedMonth])

  const totalNet = results.reduce((s, r) => s + r.netPay, 0)
  const totalGross = results.reduce((s, r) => s + r.grossPay, 0)

  const byCrew = {}
  for (const r of results) {
    const cid = r.crew.id
    if (!byCrew[cid]) byCrew[cid] = { crew: r.crew, rows: [] }
    byCrew[cid].rows.push(r)
  }

  // ── Excel Export ──────────────────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      [`SSS Payroll — ${monthLabel}`],
      [],
      ['Total Workers', results.length],
      ['Work Days', workDays],
      ['Total Gross (so\'m)', Math.round(totalGross)],
      ['Total Net (so\'m)', Math.round(totalNet)],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Main payroll sheet
    const headers = ['#', 'Name', 'Crew', 'Level', 'Days Worked', 'Total Days', 'Earned (so\'m)', 'Level Bonus (so\'m)', 'Tax (so\'m)', 'Extra Deduct', 'Net Pay (so\'m)']
    const rows = results.map((r, i) => [
      i + 1,
      r.worker.name,
      r.crew.name,
      r.worker.level,
      r.daysWorked,
      r.totalDays,
      Math.round(r.totalEarned),
      Math.round(r.levelBonus),
      Math.round(r.tax),
      Math.round(r.extraDeduct),
      Math.round(r.netPay),
    ])
    const wsMain = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Column widths
    wsMain['!cols'] = [
      { wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, wsMain, 'Payroll')

    // Per-crew sheets
    for (const { crew, rows: crewRows } of Object.values(byCrew)) {
      const ch = ['#', 'Name', 'Level', 'Days', 'Earned', 'Bonus', 'Tax', 'Net Pay']
      const cd = crewRows.map((r, i) => [
        i + 1, r.worker.name, r.worker.level, r.daysWorked,
        Math.round(r.totalEarned), Math.round(r.levelBonus),
        Math.round(r.tax), Math.round(r.netPay),
      ])
      // Totals row
      const crewNet = crewRows.reduce((s, r) => s + r.netPay, 0)
      cd.push(['', 'TOTAL', '', '', '', '', '', Math.round(crewNet)])
      const ws = XLSX.utils.aoa_to_sheet([ch, ...cd])
      ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]
      // Trim crew name for sheet name (max 31 chars, no special chars)
      const sheetName = crew.name.replace(/[:\\/?*[\]]/g, '').slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    XLSX.writeFile(wb, `SSS-Payroll-${selectedMonth}.xlsx`)
  }

  // ── CSV Export (quick) ────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [['Name', 'Crew', 'Level', 'Days', 'Earned', 'Bonus', 'Tax', 'Net Pay']]
    for (const r of results) {
      rows.push([r.worker.name, r.crew.name, r.worker.level, r.daysWorked, Math.round(r.totalEarned), Math.round(r.levelBonus), Math.round(r.tax), Math.round(r.netPay)])
    }
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `SSS-Payroll-${selectedMonth}.csv`; a.click()
  }

  // ── Archive month ─────────────────────────────────────────────────────────
  function archiveMonth() {
    updateState(s => {
      const archives = [...(s.archives || [])]
      const existing = archives.findIndex(a => a.month === selectedMonth)
      const snapshot = {
        month: selectedMonth,
        archivedAt: Date.now(),
        results: results.map(r => ({
          name: r.worker.name,
          crew: r.crew.name,
          level: r.worker.level,
          daysWorked: r.daysWorked,
          totalDays: r.totalDays,
          totalEarned: Math.round(r.totalEarned),
          levelBonus: Math.round(r.levelBonus),
          tax: Math.round(r.tax),
          netPay: Math.round(r.netPay),
        })),
        summary: {
          workers: results.length,
          workDays,
          totalGross: Math.round(totalGross),
          totalNet: Math.round(totalNet),
        }
      }
      if (existing >= 0) archives[existing] = snapshot
      else archives.push(snapshot)
      return { ...s, archives }
    })
    setArchiveModal(false)
    alert(`${monthLabel} archived successfully!`)
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
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
            <FileText size={13} /> CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportExcel} style={{ color: 'var(--success)' }}>
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setArchiveModal(true)}
            style={{ color: isArchived ? 'var(--warning)' : 'var(--text2)' }}
          >
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
            <div className="metric-val" style={{ color: 'var(--accent3)' }}>{workDays}</div>
            <div className="metric-lbl">Work Days</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--warning)' }}>{fmt(totalGross)}</div>
            <div className="metric-lbl">Gross (so'm)</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{ color: 'var(--success)' }}>{fmt(totalNet)}</div>
            <div className="metric-lbl">Net Total (so'm)</div>
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
                <div className="crew-dot" />
                {crew.name}
                <span className="text-muted text-sm">({rows.length} workers)</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{fmt(crewNet)} so'm</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th className="td-num">Days</th>
                    <th className="td-num">Earned</th>
                    <th className="td-num">Bonus</th>
                    <th className="td-num">Tax</th>
                    <th className="td-num">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.worker.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="fw-600">{r.worker.name}</td>
                      <td><span className={`badge lvl-${r.worker.level}`}>{r.worker.level}</span></td>
                      <td className="td-num">{r.daysWorked}/{workDays}</td>
                      <td className="td-num">{fmt(r.totalEarned)}</td>
                      <td className="td-num" style={{ color: 'var(--warning)' }}>{fmt(r.levelBonus)}</td>
                      <td className="td-num text-danger">{r.tax ? fmt(r.tax) : '—'}</td>
                      <td className="td-num" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(r.netPay)}</td>
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

      {/* Archives list */}
      {archives.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={14} style={{ color: 'var(--warning)' }} />
            Archived Months
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archives.map(a => {
              const aLabel = new Date(a.month + '-01').toLocaleString('en', { month: 'long', year: 'numeric' })
              const archivedDate = new Date(a.archivedAt).toLocaleDateString()
              return (
                <div key={a.month} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{aLabel}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 10 }}>
                      Archived {archivedDate} · {a.summary.workers} workers · {fmt(a.summary.totalNet)} so'm net
                    </span>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      // Export this archive as Excel
                      const wb = XLSX.utils.book_new()
                      const headers = ['#', 'Name', 'Crew', 'Level', 'Days', 'Earned', 'Bonus', 'Tax', 'Net Pay']
                      const rows2 = a.results.map((r, i) => [i + 1, r.name, r.crew, r.level, r.daysWorked, r.totalEarned, r.levelBonus, r.tax, r.netPay])
                      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows2])
                      XLSX.utils.book_append_sheet(wb, ws, aLabel.slice(0, 31))
                      XLSX.writeFile(wb, `SSS-Archive-${a.month}.xlsx`)
                    }}
                    style={{ fontSize: 11 }}
                  >
                    <Download size={11} /> Download
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Archive confirm modal */}
      {archiveModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setArchiveModal(false)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-title">
              Archive {monthLabel}?
              <button className="btn btn-ghost btn-sm" onClick={() => setArchiveModal(false)}>✕</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                This will save a snapshot of <strong>{monthLabel}</strong> payroll data ({results.length} workers, {fmt(totalNet)} so'm net) to your archives. You can download it as Excel at any time.
              </p>
              {isArchived && (
                <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>
                  ⚠ This month is already archived. Re-archiving will overwrite the previous snapshot.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setArchiveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={archiveMonth}>
                <Archive size={13} /> Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
