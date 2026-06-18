import { useState } from 'react'
import { ChevronLeft, ChevronRight, Save, UserX } from 'lucide-react'

function daysInMonth(ym) {
  const [y,m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
function dateKey(ym, day) {
  const [y,m] = ym.split('-')
  return `${y}-${m}-${String(day).padStart(2,'0')}`
}

export default function DailyInputTab({ state, updateState, selectedMonth, setSelectedMonth }) {
  const { workers=[], crews=[], daily={}, absent={}, daysOff={} } = state
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const days = daysInMonth(selectedMonth)

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

  const dk = dateKey(selectedMonth, selectedDay)

  function getDailyVal(workerId, productId) {
    return daily[dk]?.[workerId]?.[productId] || ''
  }
  function setDailyVal(workerId, productId, val) {
    updateState(s => {
      const d = { ...s.daily }
      if (!d[dk]) d[dk] = {}
      if (!d[dk][workerId]) d[dk][workerId] = {}
      if (val === '' || val === 0) {
        delete d[dk][workerId][productId]
        if (!Object.keys(d[dk][workerId]).length) delete d[dk][workerId]
        if (!Object.keys(d[dk]).length) delete d[dk]
      } else {
        d[dk][workerId][productId] = Number(val)
      }
      return { ...s, daily: d }
    })
  }

  function isAbsent(workerId) { return !!absent[dk]?.[workerId] }
  function toggleAbsent(workerId) {
    updateState(s => {
      const a = { ...s.absent }
      if (!a[dk]) a[dk] = {}
      if (a[dk][workerId]) delete a[dk][workerId]
      else a[dk][workerId] = true
      if (!Object.keys(a[dk]).length) delete a[dk]
      return { ...s, absent: a }
    })
  }

  function isDayOff(day) { return !!daysOff[dateKey(selectedMonth, day)] }
  function toggleDayOff(day) {
    const k = dateKey(selectedMonth, day)
    updateState(s => {
      const d = { ...s.daysOff }
      if (d[k]) delete d[k]; else d[k] = true
      return { ...s, daysOff: d }
    })
  }

  // Crew -> workers
  const crewWorkers = (crewId) => workers.filter(w => w.crewId === crewId && !w.leaveDate)
  const activeCrew = crews.filter(c => crewWorkers(c.id).length > 0)

  const [y,m] = selectedMonth.split('-')
  const monthLabel = new Date(Number(y), Number(m)-1, 1).toLocaleString('en',{month:'long',year:'numeric'})

  return (
    <div>
      {/* Month + day selector */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14}/></button>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,fontSize:16,minWidth:160,textAlign:'center'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14}/></button>

        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginLeft:8}}>
          {Array.from({length:days},(_,i)=>i+1).map(d=>(
            <button
              key={d}
              onClick={()=>setSelectedDay(d)}
              onContextMenu={e=>{e.preventDefault();toggleDayOff(d)}}
              title={isDayOff(d)?'Day off (right-click to toggle)':'Right-click to mark as day off'}
              style={{
                width:28,height:28,borderRadius:6,border:'none',cursor:'pointer',
                fontSize:11,fontWeight:500,
                background: isDayOff(d)
                  ? 'rgba(239,68,68,0.2)'
                  : d===selectedDay
                    ? 'var(--accent)'
                    : daily[dateKey(selectedMonth,d)] ? 'rgba(34,197,94,0.2)' : 'var(--surface2)',
                color: isDayOff(d) ? 'var(--danger)' : d===selectedDay ? '#fff' : 'var(--text2)',
              }}
            >{d}</button>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,color:'var(--text3)',marginBottom:12}}>
        Entering data for <strong style={{color:'var(--accent)'}}>{dk}</strong> · Right-click a day to mark it as day off
      </div>

      {/* Crew sections */}
      <div className="daily-grid">
        {activeCrew.map(crew => (
          <div className="crew-section" key={crew.id}>
            <div className="crew-header">
              <div className="crew-name">
                <div className="crew-dot"/>
                {crew.name}
                <span className="text-muted text-sm">({crewWorkers(crew.id).length} workers)</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Level</th>
                    {crew.products?.map(p=><th key={p.id}>{p.name}</th>)}
                    <th>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {crewWorkers(crew.id).map(w=>(
                    <tr key={w.id} style={{opacity: isAbsent(w.id)?0.4:1}}>
                      <td className="fw-600">{w.name}</td>
                      <td><span className={`badge lvl-${w.level}`}>{w.level}</span></td>
                      {crew.products?.map(p=>(
                        <td key={p.id}>
                          <input
                            type="number" min={0}
                            className="num-input"
                            value={getDailyVal(w.id,p.id)}
                            disabled={isAbsent(w.id)}
                            onChange={e=>setDailyVal(w.id,p.id,e.target.value)}
                          />
                        </td>
                      ))}
                      <td>
                        <button
                          className={`btn btn-sm ${isAbsent(w.id)?'btn-danger':'btn-ghost'}`}
                          onClick={()=>toggleAbsent(w.id)}
                          title="Toggle absent"
                        >
                          <UserX size={12}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {activeCrew.length === 0 && (
          <div className="empty-state">No active workers. Add workers in the Workers tab first.</div>
        )}
      </div>
    </div>
  )
}
