import { useState } from 'react'

function fmt(n) { return Number(n || 0).toLocaleString('uz-UZ') }

function downloadBackup(state) {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: 'SSS Payroll',
    data: state,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sss-payroll-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function restoreBackup(file, updateState, onDone) {
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result)
      const data = parsed.data || parsed // support both wrapped and raw
      if (!data.workers || !data.crews) throw new Error('Invalid backup file')
      if (!confirm(`Restore backup from ${parsed.exportedAt?.slice(0,10) || 'unknown date'}?\n\nThis will REPLACE all current data.`)) return
      updateState(() => data)
      onDone('✅ Backup restored successfully')
    } catch (err) {
      onDone('❌ Invalid backup file: ' + err.message)
    }
  }
  reader.readAsText(file)
}

export default function ArchiveTab({ state, updateState }) {
  const { archive = [] } = state
  const [expandedId, setExpandedId] = useState(null)
  const [restoreMsg, setRestoreMsg] = useState('')

  function deleteEntry(id) {
    if (!confirm('Delete this archive entry? This cannot be undone.')) return
    updateState(s => ({ ...s, archive: (s.archive || []).filter(e => e.id !== id) }))
  }

  const sorted = [...archive].sort((a, b) => b.month.localeCompare(a.month))

  const totalWorkers = state.workers?.length || 0
  const totalCrews = state.crews?.length || 0
  const dailyKeys = Object.keys(state.daily || {}).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>🗂 Archive</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', flex: 1 }}>
          {sorted.length} month{sorted.length !== 1 ? 's' : ''} archived
        </span>

        {/* Restore button */}
        <label style={{
          background: 'transparent', border: '1.5px solid var(--border2)',
          color: 'var(--text2)', borderRadius: 8, cursor: 'pointer',
          padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 12,
          fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6
        }}>
          📥 Restore Backup
          <input type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) restoreBackup(f, updateState, msg => { setRestoreMsg(msg); setTimeout(() => setRestoreMsg(''), 4000) })
              e.target.value = ''
            }}
          />
        </label>

        {/* Download backup button */}
        <button onClick={() => downloadBackup(state)} style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 8, cursor: 'pointer', padding: '7px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(22,163,74,.3)'
        }}>
          💾 Download Backup
        </button>
      </div>

      {/* Backup stats */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap'
      }}>
        {[
          { label: 'Workers', value: totalWorkers },
          { label: 'Crews', value: totalCrews },
          { label: 'Daily records', value: dailyKeys },
          { label: 'Archived months', value: sorted.length },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-mono)',
            fontSize: 11, color: 'var(--text2)'
          }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)', display: 'block' }}>{s.value}</span>
            {s.label}
          </div>
        ))}
      </div>

      {restoreMsg && (
        <div style={{
          background: restoreMsg.startsWith('✅') ? 'rgba(34,197,94,.1)' : 'rgba(220,38,38,.1)',
          border: `1px solid ${restoreMsg.startsWith('✅') ? 'rgba(34,197,94,.3)' : 'rgba(220,38,38,.3)'}`,
          color: restoreMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 14,
          fontFamily: 'var(--font-mono)', fontSize: 13
        }}>{restoreMsg}</div>
      )}

      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 40 }}>
          No archived months yet. Use the "Archive Month" button in the Payroll tab.
        </div>
      ) : sorted.map(entry => {
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
