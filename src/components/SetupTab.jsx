import { useState } from 'react'
import { safeNum } from '../payroll'

function uid() { return crypto.randomUUID() }

export default function SetupTab({ state, updateState }) {
  const { crews = [], workers = [] } = state
  const [newCrewName, setNewCrewName] = useState('')
  const [newProductName, setNewProductName] = useState({})
  const [newProductPrice, setNewProductPrice] = useState({})
  const [openCrewId, setOpenCrewId] = useState(null)

  function addCrew() {
    const name = newCrewName.trim().toUpperCase()
    if (!name) return
    const crew = { id: uid(), name, products: [], levelGap: 10000 }
    updateState(s => ({ ...s, crews: [...s.crews, crew] }))
    setNewCrewName('')
  }

  function removeCrew(cid) {
    if (!confirm('Remove this crew? All workers in it will lose their crew assignment.')) return
    updateState(s => ({
      ...s,
      crews: s.crews.filter(c => c.id !== cid),
      workers: s.workers.map(w => w.crewId === cid ? { ...w, crewId: null } : w)
    }))
  }

  function updateCrewName(cid, name) {
    updateState(s => ({ ...s, crews: s.crews.map(c => c.id === cid ? { ...c, name: name.toUpperCase() } : c) }))
  }

  function updateLevelGap(cid, gap) {
    updateState(s => ({ ...s, crews: s.crews.map(c => c.id === cid ? { ...c, levelGap: safeNum(gap, 0) || 10000 } : c) }))
  }

  function addProduct(cid) {
    const name = (newProductName[cid] || '').trim().toUpperCase()
    const price = safeNum(newProductPrice[cid])
    if (!name) return
    const prod = { id: uid(), name, price }
    updateState(s => ({
      ...s,
      crews: s.crews.map(c => c.id === cid ? { ...c, products: [...(c.products || []), prod] } : c)
    }))
    setNewProductName(p => ({ ...p, [cid]: '' }))
    setNewProductPrice(p => ({ ...p, [cid]: '' }))
  }

  function updateProduct(cid, pid, field, val) {
    updateState(s => ({
      ...s,
      crews: s.crews.map(c => c.id !== cid ? c : {
        ...c,
        products: (c.products || []).map(p => p.id === pid ? { ...p, [field]: field === 'price' ? safeNum(val) : val } : p)
      })
    }))
  }

  function removeProduct(cid, pid) {
    updateState(s => ({
      ...s,
      crews: s.crews.map(c => c.id !== cid ? c : { ...c, products: (c.products || []).filter(p => p.id !== pid) })
    }))
  }

  const crewColors = ['#16a34a','#2563eb','#d97706','#9333ea','#e11d48','#0891b2']
  const crewColor = (cid) => crewColors[crews.findIndex(c => c.id === cid) % crewColors.length] || '#16a34a'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, letterSpacing: 2, margin: 0 }}>⚙ Setup</h2>
      </div>

      {crews.map(crew => {
        const isOpen = openCrewId === crew.id
        const col = crewColor(crew.id)
        return (
          <div key={crew.id} style={{
            border: `2px solid ${isOpen ? col : col + '44'}`,
            borderLeft: `4px solid ${col}`,
            borderRadius: 12, marginBottom: 16, overflow: 'hidden',
            boxShadow: 'var(--shadow)', transition: 'border-color .2s'
          }}>
            <div
              onClick={() => setOpenCrewId(isOpen ? null : crew.id)}
              style={{
                padding: '14px 18px',
                background: isOpen ? col + '22' : 'var(--surface2)',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                cursor: 'pointer', userSelect: 'none',
                borderBottom: isOpen ? `1px solid ${col}44` : 'none'
              }}>
              <span style={{
                color: col, fontSize: 20, fontWeight: 700, lineHeight: 1,
                display: 'inline-block',
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform .2s'
              }}>›</span>
              <input
                value={crew.name}
                onClick={e => e.stopPropagation()}
                onChange={e => updateCrewName(crew.id, e.target.value)}
                style={{
                  fontFamily: 'var(--font-disp)', fontSize: 16, letterSpacing: 2,
                  fontWeight: 700, border: 'none', background: 'transparent',
                  color: 'var(--text)', width: 160
                }}
              />
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
                onClick={e => e.stopPropagation()}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>Level Gap (so'm):</label>
                <input
                  type="number"
                  value={crew.levelGap || 10000}
                  onChange={e => updateLevelGap(crew.id, e.target.value)}
                  style={{ width: 100, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
                <button onClick={() => removeCrew(crew.id)} style={{
                  background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                  color: 'var(--danger)', borderRadius: 6, cursor: 'pointer', padding: '4px 10px',
                  fontFamily: 'var(--font-mono)', fontSize: 11
                }}>✕ Remove Crew</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '16px 18px', background: 'var(--surface)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', marginBottom: 8, letterSpacing: 1 }}>PRODUCTS / PRICES</div>

                {(crew.products || []).length === 0 && (
                  <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>No products yet.</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {(crew.products || []).map(prod => (
                    <div key={prod.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        value={prod.name}
                        onChange={e => updateProduct(crew.id, prod.id, 'name', e.target.value.toUpperCase())}
                        style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 80 }}
                        placeholder="Product name"
                      />
                      <input
                        type="number"
                        value={prod.price}
                        onChange={e => updateProduct(crew.id, prod.id, 'price', e.target.value)}
                        style={{ width: 110, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' }}
                        placeholder="Price/unit"
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)' }}>so'm/unit</span>
                      <button onClick={() => removeProduct(crew.id, prod.id)} style={{
                        background: 'transparent', border: '1px solid rgba(220,38,38,.25)',
                        color: 'var(--danger)', borderRadius: 4, cursor: 'pointer', padding: '3px 8px',
                        fontFamily: 'var(--font-mono)', fontSize: 11
                      }}>✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={newProductName[crew.id] || ''}
                    onChange={e => setNewProductName(p => ({ ...p, [crew.id]: e.target.value }))}
                    placeholder="Product name"
                    style={{ flex: 1, minWidth: 120, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    onKeyDown={e => e.key === 'Enter' && addProduct(crew.id)}
                  />
                  <input
                    type="number"
                    value={newProductPrice[crew.id] || ''}
                    onChange={e => setNewProductPrice(p => ({ ...p, [crew.id]: e.target.value }))}
                    placeholder="Price/unit"
                    style={{ width: 110, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right' }}
                    onKeyDown={e => e.key === 'Enter' && addProduct(crew.id)}
                  />
                  <button onClick={() => addProduct(crew.id)} style={{
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 6, cursor: 'pointer', padding: '6px 14px',
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700
                  }}>+ Add Product</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <input
          value={newCrewName}
          onChange={e => setNewCrewName(e.target.value)}
          placeholder="New crew name (e.g. KASR 1)"
          style={{ flex: 1, fontFamily: 'var(--font-disp)', fontSize: 14, letterSpacing: 1 }}
          onKeyDown={e => e.key === 'Enter' && addCrew()}
        />
        <button onClick={addCrew} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer', padding: '8px 20px',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700
        }}>+ Add Crew</button>
      </div>

      {crews.length === 0 && (
        <div style={{
          marginTop: 40, textAlign: 'center', color: 'var(--text2)',
          fontFamily: 'var(--font-mono)', fontSize: 13
        }}>
          No crews yet. Add your first crew above.
        </div>
      )}
    </div>
  )
}
