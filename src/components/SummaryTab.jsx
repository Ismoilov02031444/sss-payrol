import { useState, useMemo } from 'react'
import { workerMonthlyEarning, monthDates, crewHasUnitsOnDay, isDayOff } from '../payroll'

function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }

const CREW_COLORS = ['#16a34a','#2563eb','#d97706','#9333ea','#e11d48','#0891b2']
function crewColor(crews, cid) {
  const i = crews.findIndex(c => c.id === cid)
  return CREW_COLORS[i % CREW_COLORS.length] || '#16a34a'
}

export default function SummaryTab({ state, selectedMonth, setSelectedMonth }) {
  const { crews = [], workers = [], daily = {}, daysOff = {} } = state

  const results = useMemo(() => {
    return workers.filter(w => !w.inactive).map(w => {
      const gross = workerMonthlyEarning(w.id, selectedMonth, state)
      const tax = w.taxAmount || 0
      return { ...w, gross, tax, net: gross - tax }
    })
  }, [workers, selectedMonth, state])

  const dates = monthDates(selectedMonth)

  const totalUnits = useMemo(() => dates.reduce((a, d) =>
    a + crews.reduce((b, c) =>
      b + (c.products || []).reduce((cc, p) => cc + ((daily?.[d]?.[c.id]?.[p.id]) || 0), 0)
    , 0)
  , 0), [dates, crews, daily])

  const totalGross = results.reduce((a, r) => a + r.gross, 0)
  const totalTax = results.reduce((a, r) => a + r.tax, 0)
  const totalNet = results.reduce((a, r) => a + r.net, 0)

  const uniquePersons = new Set(
    workers.filter(w => !w.inactive).map(w => (w.personId && w.personId !== 'null') ? w.personId : w.id)
  ).size

  const activeWorkers = workers.filter(w => !w.inactive)
  const commN = new Set(activeWorkers.filter(w => w.workerType === 'commission').map(w => (w.personId && w.personId !== 'null') ? w.personId : w.id)).size
  const fixedN = new Set(activeWorkers.filter(w => w.workerType === 'fixed').map(w => (w.personId && w.personId !== 'null') ? w.personId : w.id)).size
  const dailyN = new Set(activeWorkers.filter(w => w.workerType === 'daily').map(w => (w.personId && w.personId !== 'null') ? w.personId : w.id)).size

  const [expanded, setExpanded] = useState({})

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>◎ Summary</h2>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 10px' }} />
      </div>

      {/* Grand totals bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24,
        padding: 16, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border2)'
      }}>
        {[
          ['TOTAL WORKERS', uniquePersons],
          ['COMMISSION', commN + ' workers'],
          dailyN > 0 ? ['DAILY RATE', dailyN + ' workers'] : null,
          ['FIXED', fixedN + ' workers'],
          ['TOTAL UNITS', fmt(totalUnits)],
          ["TOTAL GROSS", fmt(Math.round(totalGross)) + " so'm"],
          ["TOTAL NET", fmt(Math.round(totalNet)) + " so'm"],
        ].filter(Boolean).map(([k, v], i, arr) => (
          <div key={k} style={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text2)', letterSpacing: 2, marginBottom: 4 }}>{k}</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: i === arr.length - 1 ? 18 : 15,
              fontWeight: 700, color: i === arr.length - 1 ? 'var(--accent)' : 'var(--text)'
            }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Per-crew stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {crews.map(crew => {
          const cw = results.filter(r => r.crewId === crew.id)
          const net = cw.reduce((a, r) => a + r.net, 0)
          const prods = crew.products || []
          const prodUnits = prods.map(p => ({
            name: p.name,
            units: dates.reduce((a, d) => a + ((daily?.[d]?.[crew.id]?.[p.id]) || 0), 0)
          })).filter(p => p.units > 0)
          const totalCrewUnits = prodUnits.reduce((a, p) => a + p.units, 0)
          const commCt = cw.filter(r => r.workerType === 'commission').length
          const fixedCt = cw.filter(r => r.workerType === 'fixed').length
          const dailyCt = cw.filter(r => r.workerType === 'daily').length
          const typeStr = [
            commCt ? `${commCt} commission` : '',
            dailyCt ? `${dailyCt} daily` : '',
            fixedCt ? `${fixedCt} fixed` : '',
          ].filter(Boolean).join(' · ')
          const col = crewColor(crews, crew.id)
          const isExp = expanded[crew.id]

          return (
            <div key={crew.id} onClick={() => setExpanded(e => ({ ...e, [crew.id]: !e[crew.id] }))}
              style={{
                border: `2px solid ${col}33`, borderLeft: `4px solid ${col}`,
                borderRadius: 12, padding: 16, cursor: 'pointer',
                background: 'var(--surface)', boxShadow: 'var(--shadow)',
                transition: 'box-shadow .2s'
              }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: col, letterSpacing: 2, marginBottom: 6 }}>{crew.name}</div>
              <div style={{ fontFamily: 'var(--font-disp)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{fmt(Math.round(net))}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>
                so'm net · {typeStr} · <strong>{fmt(totalCrewUnits)}</strong> units
              </div>
              {isExp && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text2)', letterSpacing: 1, marginBottom: 6 }}>UNITS PER PRODUCT</div>
                  {prodUnits.map(p => (
                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: col }}>{fmt(p.units)}</span>
                    </div>
                  ))}
                  {prodUnits.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', fontStyle: 'italic' }}>No production data</div>}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text2)', marginTop: 8 }}>
                {isExp ? '▲ collapse' : '▼ tap to see breakdown'}
              </div>
            </div>
          )
        })}
      </div>

      {crews.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 40 }}>
          No data yet. Add crews and workers in Setup & Workers tabs.
        </div>
      )}
    </div>
  )
}
