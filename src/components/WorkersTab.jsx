import { useState } from 'react'
import { UserPlus, Pencil, Trash2, X, Check, History, Plus, Minus } from 'lucide-react'
import { LEVEL_ORDER, getWorkerLevelOnDate } from '../payroll'

const WORKER_TYPES = ['commission', 'fixed', 'daily']

function uid() { return 'x' + Math.random().toString(36).slice(2, 10) }

const TODAY = new Date().toISOString().slice(0, 10)

function emptyWorker() {
  return {
    id: uid(),
    name: '',
    crewId: '',
    workerType: 'commission',
    level: 'Mid',
    levelHistory: [{ level: 'Mid', from: TODAY }],
    taxAmount: 240000,
    fixedSalary: 0,
    dailyRate: 0,
    joinDate: TODAY,
    leaveDate: '',
    sortOrder: 0,
  }
}

export default function WorkersTab({ state, updateState }) {
  const { workers = [], crews = [] } = state
  const [modal, setModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null) // { worker }
  const [search, setSearch] = useState('')
  const [filterCrew, setFilterCrew] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const today = TODAY

  const filtered = workers.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCrew !== 'all' && w.crewId !== filterCrew) return false
    if (filterType !== 'all' && w.workerType !== filterType) return false
    return true
  })

  function openAdd() { setModal({ mode: 'add', worker: emptyWorker() }) }
  function openEdit(w) { setModal({ mode: 'edit', worker: { ...w, levelHistory: w.levelHistory ? [...w.levelHistory] : [{ level: w.level || 'Mid', from: w.joinDate || TODAY }] } }) }

  function save() {
    const w = modal.worker
    if (!w.name.trim()) return
    // Sync level field with latest levelHistory entry
    const hist = w.levelHistory || []
    const sorted = [...hist].sort((a, b) => a.from.localeCompare(b.from))
    const currentLevel = sorted.length > 0 ? sorted[sorted.length - 1].level : w.level
    const finalWorker = { ...w, level: currentLevel }

    if (modal.mode === 'add') {
      updateState(s => ({ ...s, workers: [...s.workers, finalWorker] }))
    } else {
      updateState(s => ({ ...s, workers: s.workers.map(x => x.id === finalWorker.id ? finalWorker : x) }))
    }
    setModal(null)
  }

  function remove(id) {
    if (!confirm('Remove this worker? This cannot be undone.')) return
    updateState(s => ({ ...s, workers: s.workers.filter(x => x.id !== id) }))
  }

  function setField(key, val) {
    setModal(m => {
      const updated = { ...m.worker, [key]: val }
      // If level changed directly, update levelHistory's latest entry too
      if (key === 'level') {
        const hist = [...(updated.levelHistory || [])]
        if (hist.length > 0) hist[hist.length - 1] = { ...hist[hist.length - 1], level: val }
        else hist.push({ level: val, from: updated.joinDate || TODAY })
        updated.levelHistory = hist
      }
      return { ...m, worker: updated }
    })
  }

  // Level history helpers
  function addHistoryEntry() {
    setModal(m => {
      const hist = [...(m.worker.levelHistory || [])]
      hist.push({ level: 'Mid', from: TODAY })
      hist.sort((a, b) => a.from.localeCompare(b.from))
      return { ...m, worker: { ...m.worker, levelHistory: hist } }
    })
  }
  function updateHistoryEntry(idx, key, val) {
    setModal(m => {
      const hist = [...(m.worker.levelHistory || [])]
      hist[idx] = { ...hist[idx], [key]: val }
      hist.sort((a, b) => a.from.localeCompare(b.from))
      return { ...m, worker: { ...m.worker, levelHistory: hist } }
    })
  }
  function removeHistoryEntry(idx) {
    setModal(m => {
      const hist = [...(m.worker.levelHistory || [])]
      if (hist.length <= 1) return m
      hist.splice(idx, 1)
      return { ...m, worker: { ...m.worker, levelHistory: hist } }
    })
  }

  const crewName = (id) => crews.find(c => c.id === id)?.name || '—'
  const currentLevel = (w) => getWorkerLevelOnDate(w, today)

  return (
    <div>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Workers</div>
          <div className="stat-value blue">{workers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value green">{workers.filter(w => !w.leaveDate).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Crews</div>
          <div className="stat-value purple">{crews.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Commission</div>
          <div className="stat-value cyan">{workers.filter(w => w.workerType === 'commission').length}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" placeholder="Search workers…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="input" value={filterCrew} onChange={e => setFilterCrew(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All crews</option>
          {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="all">All types</option>
          {WORKER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ marginLeft: 'auto' }}>
          <UserPlus size={13} /> Add Worker
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Crew</th>
              <th>Type</th>
              <th>Level (today)</th>
              <th>Tax/mo</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="empty-state">No workers found</td></tr>
            )}
            {filtered.map((w, i) => (
              <tr key={w.id}>
                <td className="text-muted">{i + 1}</td>
                <td className="fw-600">{w.name}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{crewName(w.crewId)}</td>
                <td><span className="badge badge-blue">{w.workerType}</span></td>
                <td>
                  <span className={`badge lvl-${currentLevel(w)}`}>{currentLevel(w)}</span>
                  {(w.levelHistory?.length || 0) > 1 && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text3)' }}>
                      <History size={10} style={{ verticalAlign: 'middle' }} /> {w.levelHistory.length}
                    </span>
                  )}
                </td>
                <td className="text-muted" style={{ fontSize: 12 }}>
                  {w.taxAmount ? new Intl.NumberFormat().format(w.taxAmount) : '—'}
                </td>
                <td className="text-muted" style={{ fontSize: 12 }}>{w.joinDate}</td>
                <td>
                  {w.leaveDate
                    ? <span className="badge badge-red">Left {w.leaveDate}</span>
                    : <span className="badge badge-green">Active</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)} title="Edit"><Pencil size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(w.id)} title="Remove"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Worker Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-title">
              {modal.mode === 'add' ? 'Add Worker' : `Edit — ${modal.worker.name}`}
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Basic info */}
              <div className="input-group">
                <label>Full Name *</label>
                <input className="input" value={modal.worker.name}
                  onChange={e => setField('name', e.target.value)} placeholder="SURNAME NAME" autoFocus />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group">
                  <label>Crew</label>
                  <select className="input" value={modal.worker.crewId} onChange={e => setField('crewId', e.target.value)}>
                    <option value="">— Select —</option>
                    {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Worker Type</label>
                  <select className="input" value={modal.worker.workerType} onChange={e => setField('workerType', e.target.value)}>
                    {WORKER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Join Date</label>
                  <input className="input" type="date" value={modal.worker.joinDate}
                    onChange={e => setField('joinDate', e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Leave Date (if left)</label>
                  <input className="input" type="date" value={modal.worker.leaveDate || ''}
                    onChange={e => setField('leaveDate', e.target.value || '')} />
                </div>
                <div className="input-group">
                  <label>Monthly Tax (so'm)</label>
                  <input className="input" type="number" min={0} step={1000}
                    value={modal.worker.taxAmount || 0}
                    onChange={e => setField('taxAmount', +e.target.value)} />
                </div>
                {modal.worker.workerType === 'fixed' && (
                  <div className="input-group">
                    <label>Fixed Monthly Salary (so'm)</label>
                    <input className="input" type="number" min={0} step={10000}
                      value={modal.worker.fixedSalary || 0}
                      onChange={e => setField('fixedSalary', +e.target.value)} />
                  </div>
                )}
                {modal.worker.workerType === 'daily' && (
                  <div className="input-group">
                    <label>Daily Rate (so'm/day)</label>
                    <input className="input" type="number" min={0} step={1000}
                      value={modal.worker.dailyRate || 0}
                      onChange={e => setField('dailyRate', +e.target.value)} />
                  </div>
                )}
              </div>

              {/* Level History */}
              <div className="sep" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="fw-600" style={{ fontSize: 13 }}>
                  <History size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Level History
                </span>
                <button className="btn btn-ghost btn-sm" onClick={addHistoryEntry} style={{ fontSize: 11 }}>
                  <Plus size={11} /> Add entry
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                Each entry says "from this date, worker's level was X". Promotes/demotions only affect pay from the effective date onward.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(modal.worker.levelHistory || []).map((entry, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface2)', padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)', width: 20 }}>#{idx + 1}</span>
                    <select
                      className="input"
                      style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                      value={entry.level}
                      onChange={e => updateHistoryEntry(idx, 'level', e.target.value)}
                    >
                      {LEVEL_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>from</span>
                    <input
                      className="input"
                      type="date"
                      style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                      value={entry.from}
                      onChange={e => updateHistoryEntry(idx, 'from', e.target.value)}
                    />
                    {(modal.worker.levelHistory?.length || 0) > 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => removeHistoryEntry(idx)}
                        style={{ padding: '3px 6px', color: 'var(--danger)' }}>
                        <Minus size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Check size={13} /> Save Worker</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
