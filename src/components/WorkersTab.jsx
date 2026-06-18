import { useState } from 'react'
import { UserPlus, Pencil, Trash2, X, Check } from 'lucide-react'

const LEVELS = ['SeniorHigh','High','Mid','Beginner','Junior']
const WORKER_TYPES = ['commission','fixed','daily']

function uid() { return 'x' + Math.random().toString(36).slice(2,10) }

const EMPTY_WORKER = { name:'', crewId:'', workerType:'commission', level:'Mid', taxAmount:0, joinDate: new Date().toISOString().slice(0,10) }

export default function WorkersTab({ state, updateState }) {
  const { workers = [], crews = [] } = state
  const [modal, setModal]   = useState(null) // null | { mode:'add'|'edit', worker }
  const [search, setSearch] = useState('')
  const [filterCrew, setFilterCrew] = useState('all')

  const filtered = workers.filter(w => {
    const matchName = w.name.toLowerCase().includes(search.toLowerCase())
    const matchCrew = filterCrew === 'all' || w.crewId === filterCrew
    return matchName && matchCrew
  })

  function openAdd() { setModal({ mode:'add', worker: { ...EMPTY_WORKER, id: uid(), personId: uid() } }) }
  function openEdit(w) { setModal({ mode:'edit', worker: { ...w } }) }

  function save() {
    const w = modal.worker
    if (!w.name.trim()) return
    if (modal.mode === 'add') {
      updateState(s => ({ ...s, workers: [...s.workers, w] }))
    } else {
      updateState(s => ({ ...s, workers: s.workers.map(x => x.id === w.id ? w : x) }))
    }
    setModal(null)
  }

  function remove(id) {
    if (!confirm('Remove this worker?')) return
    updateState(s => ({ ...s, workers: s.workers.filter(x => x.id !== id) }))
  }

  function setField(key, val) { setModal(m => ({ ...m, worker: { ...m.worker, [key]: val } })) }

  const crewName = (id) => crews.find(c => c.id === id)?.name || '—'

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
          <div className="stat-value green">{workers.filter(w=>!w.leaveDate).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Crews</div>
          <div className="stat-value purple">{crews.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Commission</div>
          <div className="stat-value cyan">{workers.filter(w=>w.workerType==='commission').length}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{display:'flex', gap:10, marginBottom:14, flexWrap:'wrap'}}>
        <input className="input" placeholder="Search workers…" value={search}
          onChange={e=>setSearch(e.target.value)} style={{maxWidth:240}} />
        <select className="input" value={filterCrew} onChange={e=>setFilterCrew(e.target.value)} style={{maxWidth:180}}>
          <option value="all">All crews</option>
          {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={openAdd} style={{marginLeft:'auto'}}>
          <UserPlus size={13}/> Add Worker
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
              <th>Level</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="empty-state">No workers found</td></tr>
            )}
            {filtered.map((w, i) => (
              <tr key={w.id}>
                <td className="text-muted">{i+1}</td>
                <td className="fw-600">{w.name}</td>
                <td className="text-muted">{crewName(w.crewId)}</td>
                <td><span className="badge badge-blue">{w.workerType}</span></td>
                <td><span className={`badge lvl-${w.level}`}>{w.level}</span></td>
                <td className="text-muted">{w.joinDate}</td>
                <td>
                  {w.leaveDate
                    ? <span className="badge badge-red">Left {w.leaveDate}</span>
                    : <span className="badge badge-green">Active</span>}
                </td>
                <td>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(w)}><Pencil size={12}/></button>
                    <button className="btn btn-danger btn-sm" onClick={()=>remove(w.id)}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-title">
              {modal.mode === 'add' ? 'Add Worker' : 'Edit Worker'}
              <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}><X size={14}/></button>
            </div>
            <div className="modal-form">
              <div className="input-group">
                <label>Full Name *</label>
                <input className="input" value={modal.worker.name} onChange={e=>setField('name',e.target.value)} placeholder="SURNAME NAME" />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="input-group">
                  <label>Crew</label>
                  <select className="input" value={modal.worker.crewId} onChange={e=>setField('crewId',e.target.value)}>
                    <option value="">— Select —</option>
                    {crews.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Type</label>
                  <select className="input" value={modal.worker.workerType} onChange={e=>setField('workerType',e.target.value)}>
                    {WORKER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Level</label>
                  <select className="input" value={modal.worker.level} onChange={e=>setField('level',e.target.value)}>
                    {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Join Date</label>
                  <input className="input" type="date" value={modal.worker.joinDate} onChange={e=>setField('joinDate',e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Tax (so'm/day)</label>
                  <input className="input" type="number" min={0} value={modal.worker.taxAmount||0} onChange={e=>setField('taxAmount',+e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Leave Date (optional)</label>
                  <input className="input" type="date" value={modal.worker.leaveDate||''} onChange={e=>setField('leaveDate',e.target.value||undefined)} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Check size={13}/> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
