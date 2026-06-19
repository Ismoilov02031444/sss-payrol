import { useState } from 'react'

function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }

export default function ArchiveTab({ state, updateState }) {
  const { archive = [] } = state
  const [expandedId, setExpandedId] = useState(null)

  function deleteEntry(id) {
    if (!confirm('Delete this archive entry? This cannot be undone.')) return
    updateState(s => ({ ...s, archive: (s.archive || []).filter(e => e.id !== id) }))
  }

  const sorted = [...archive].sort((a, b) => b.month.localeCompare(a.month))

  if (sorted.length === 0) {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, marginBottom: 20 }}>🗂 Archive</h2>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 40 }}>
          No archived months yet. Use the "Archive Month" button in the Payroll tab.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>🗂 Archive</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{sorted.length} month{sorted.length !== 1 ? 's' : ''} archived</span>
      </div>

      {sorted.map(entry => {
        const isOpen = expandedId === entry.id
        return (
          <div key={entry.id} style={{
            border: '2px solid var(--border)', borderRadius: 12, marginBottom: 12,
            overflow: 'hidden', boxShadow: 'var(--shadow)'
          }}>
            <div onClick={() => setExpandedId(isOpen ? null : entry.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              background: isOpen ? 'var(--surface2)' : 'var(--surface)',
              cursor: 'pointer', userSelect: 'none'
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 18, letterSpacing: 2 }}>{entry.month}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                  Archived {new Date(entry.archivedAt).toLocaleDateString()} · {(entry.results || []).length} workers
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {fmt(Math.round(entry.totalNet))} so'm net
              </div>
              <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id) }} style={{
                background: 'transparent', border: '1px solid rgba(220,38,38,.25)',
                color: 'var(--danger)', borderRadius: 4, cursor: 'pointer', padding: '4px 9px', fontSize: 12
              }}>🗑</button>
            </div>

            {isOpen && (
              <div style={{ padding: 16, background: 'var(--surface)', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text2)', fontWeight: 700 }}>Worker</th>
                      <th style={{ padding: '6px 8px', color: 'var(--text2)', fontWeight: 700 }}>Crew</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent2)', fontWeight: 700 }}>Gross</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>Tax</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>Avans</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#fff', background: 'var(--accent)', fontWeight: 700 }}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.results || []).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>{r.name}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text2)' }}>{r.crewName}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--accent)' }}>{fmt(Math.round(r.gross))}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)' }}>{r.tax > 0 ? `(${fmt(r.tax)})` : '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--danger)' }}>{(r.dedTotal || 0) > 0 ? `(${fmt(r.dedTotal)})` : '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(Math.round(r.net))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: '7px 10px' }}>TOTAL</td>
                      <td colSpan={2} style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--accent)', fontSize: 13 }}>{fmt(Math.round(entry.totalNet))} so'm</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
