import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

const LEVEL_ORDER = ['SeniorHigh','High','Mid','Beginner','Junior']

function daysInMonth(ym) {
  const [y,m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function computePayroll(state, selectedMonth) {
  const { workers=[], crews=[], daily={}, absent={}, daysOff={}, dayOverride={}, deductions={} } = state

  const [y,m] = selectedMonth.split('-')
  const totalDays = daysInMonth(selectedMonth)
  const workDays = Array.from({length:totalDays},(_,i)=>i+1)
    .filter(d => {
      const dk = `${y}-${m}-${String(d).padStart(2,'0')}`
      return !daysOff[dk]
    }).length

  const results = []

  for (const worker of workers) {
    const crew = crews.find(c => c.id === worker.crewId)
    if (!crew) continue

    // Days worked
    let daysWorked = 0
    let totalEarned = 0

    for (let d = 1; d <= totalDays; d++) {
      const dk = `${y}-${m}-${String(d).padStart(2,'0')}`
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

    // Level bonus — based on level gap and days worked
    const levelGap = crew.levelGap || 10000
    const levelIdx = LEVEL_ORDER.indexOf(worker.level)
    const seniorIdx = LEVEL_ORDER.indexOf('SeniorHigh')
    const levelBonus = Math.max(0, seniorIdx - levelIdx) * levelGap * daysWorked

    const grossPay = totalEarned + levelBonus
    const tax = (worker.taxAmount || 0) * daysWorked
    const extraDeduct = deductions?.[selectedMonth]?.[worker.id] || 0
    const netPay = Math.max(0, grossPay - tax - extraDeduct)

    results.push({
      worker,
      crew,
      daysWorked,
      totalDays: workDays,
      totalEarned,
      levelBonus,
      grossPay,
      tax,
      extraDeduct,
      netPay,
    })
  }

  return { results, workDays }
}

function fmt(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n))
}

export default function PayrollTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  function prevMonth() {
    const [y,m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m-2, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  function nextMonth() {
    const [y,m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  const [y,m] = selectedMonth.split('-')
  const monthLabel = new Date(Number(y), Number(m)-1, 1).toLocaleString('en',{month:'long',year:'numeric'})

  const { results, workDays } = useMemo(() => computePayroll(state, selectedMonth), [state, selectedMonth])

  const totalNet   = results.reduce((s,r) => s + r.netPay, 0)
  const totalGross = results.reduce((s,r) => s + r.grossPay, 0)

  // Group by crew
  const byCrew = {}
  for (const r of results) {
    const cid = r.crew.id
    if (!byCrew[cid]) byCrew[cid] = { crew: r.crew, rows: [] }
    byCrew[cid].rows.push(r)
  }

  function exportCSV() {
    const rows = [['Name','Crew','Level','Days','Earned','Bonus','Tax','Net Pay']]
    for (const r of results) {
      rows.push([r.worker.name, r.crew.name, r.worker.level, r.daysWorked, r.totalEarned, r.levelBonus, r.tax, r.netPay])
    }
    const csv = rows.map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`payroll-${selectedMonth}.csv`; a.click()
  }

  return (
    <div>
      {/* Month selector */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14}/></button>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,fontSize:16,minWidth:160,textAlign:'center'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14}/></button>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV} style={{marginLeft:'auto'}}>
          <Download size={13}/> Export CSV
        </button>
      </div>

      {/* Summary header */}
      <div className="summary-header mb-3">
        <div className="summary-title">📊 Monthly Summary — {monthLabel}</div>
        <div className="summary-metrics">
          <div className="metric">
            <div className="metric-val" style={{color:'var(--accent)'}}>{results.length}</div>
            <div className="metric-lbl">Workers</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{color:'var(--accent3)'}}>{workDays}</div>
            <div className="metric-lbl">Work Days</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{color:'var(--warning)'}}>{fmt(totalGross)}</div>
            <div className="metric-lbl">Gross (so'm)</div>
          </div>
          <div className="metric">
            <div className="metric-val" style={{color:'var(--success)'}}>{fmt(totalNet)}</div>
            <div className="metric-lbl">Net Total (so'm)</div>
          </div>
        </div>
      </div>

      {/* Per crew tables */}
      {Object.values(byCrew).map(({ crew, rows }) => {
        const crewNet = rows.reduce((s,r)=>s+r.netPay,0)
        return (
          <div key={crew.id} style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}>
                <div className="crew-dot"/>
                {crew.name}
                <span className="text-muted text-sm">({rows.length} workers)</span>
              </div>
              <span style={{fontSize:13,color:'var(--success)',fontWeight:600}}>{fmt(crewNet)} so'm</span>
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
                  {rows.map((r,i) => (
                    <tr key={r.worker.id}>
                      <td className="text-muted">{i+1}</td>
                      <td className="fw-600">{r.worker.name}</td>
                      <td><span className={`badge lvl-${r.worker.level}`}>{r.worker.level}</span></td>
                      <td className="td-num">{r.daysWorked}/{workDays}</td>
                      <td className="td-num">{fmt(r.totalEarned)}</td>
                      <td className="td-num" style={{color:'var(--warning)'}}>{fmt(r.levelBonus)}</td>
                      <td className="td-num text-danger">{r.tax ? fmt(r.tax) : '—'}</td>
                      <td className="td-num" style={{color:'var(--success)',fontWeight:600}}>{fmt(r.netPay)}</td>
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
    </div>
  )
}
