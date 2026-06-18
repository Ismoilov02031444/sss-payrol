import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Package } from 'lucide-react'

function uid() { return 'x' + Math.random().toString(36).slice(2,10) }

export default function SetupTab({ state, updateState }) {
  const { crews = [] } = state
  const [crewModal, setCrewModal]     = useState(null)
  const [productModal, setProductModal] = useState(null) // { crewId, product }

  // ── Crew CRUD ─────────────────────────────────────────────────────────────
  function openAddCrew() { setCrewModal({ mode:'add', crew:{ id:uid(), name:'', levelGap:10000, products:[] } }) }
  function openEditCrew(c) { setCrewModal({ mode:'edit', crew:{ ...c, products:[...(c.products||[])] } }) }
  function saveCrew() {
    const c = crewModal.crew
    if (!c.name.trim()) return
    if (crewModal.mode === 'add') updateState(s=>({ ...s, crews:[...s.crews,c] }))
    else updateState(s=>({ ...s, crews:s.crews.map(x=>x.id===c.id?c:x) }))
    setCrewModal(null)
  }
  function removeCrew(id) {
    if (!confirm('Remove crew? Workers assigned to it will lose their crew.')) return
    updateState(s=>({ ...s, crews:s.crews.filter(x=>x.id!==id) }))
  }
  function setCrewField(k,v) { setCrewModal(m=>({ ...m, crew:{ ...m.crew,[k]:v } })) }

  // ── Product CRUD (within crew modal) ─────────────────────────────────────
  function openAddProduct() { setProductModal({ mode:'add', product:{ id:uid(), name:'', price:0 } }) }
  function openEditProduct(p) { setProductModal({ mode:'edit', product:{ ...p } }) }
  function saveProduct() {
    const p = productModal.product
    if (!p.name.trim()) return
    if (productModal.mode === 'add') {
      setCrewModal(m=>({ ...m, crew:{ ...m.crew, products:[...m.crew.products,p] } }))
    } else {
      setCrewModal(m=>({ ...m, crew:{ ...m.crew, products:m.crew.products.map(x=>x.id===p.id?p:x) } }))
    }
    setProductModal(null)
  }
  function removeProduct(id) {
    setCrewModal(m=>({ ...m, crew:{ ...m.crew, products:m.crew.products.filter(x=>x.id!==id) } }))
  }
  function setProdField(k,v) { setProductModal(m=>({ ...m, product:{ ...m.product,[k]:v } })) }

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>Crews & Products Setup</h2>
          <div className="subtitle">Configure production crews and their products/prices</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAddCrew}>
          <Plus size={13}/> Add Crew
        </button>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {crews.map(crew=>(
          <div className="card" key={crew.id} style={{padding:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="crew-dot"/>
                <span className="fw-600" style={{fontSize:15}}>{crew.name}</span>
                <span className="badge badge-gray">Gap: {new Intl.NumberFormat().format(crew.levelGap||10000)} so'm/day</span>
                <span className="badge badge-blue">{(crew.products||[]).length} products</span>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEditCrew(crew)}><Pencil size={12}/></button>
                <button className="btn btn-danger btn-sm" onClick={()=>removeCrew(crew.id)}><Trash2 size={12}/></button>
              </div>
            </div>
            {crew.products?.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {crew.products.map(p=>(
                  <span key={p.id} className="badge badge-purple" style={{fontSize:12,padding:'4px 10px'}}>
                    <Package size={10}/> {p.name} — {new Intl.NumberFormat().format(p.price)} so'm
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {crews.length === 0 && (
          <div className="empty-state">No crews yet. Click "Add Crew" to get started.</div>
        )}
      </div>

      {/* Crew modal */}
      {crewModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setCrewModal(null)}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-title">
              {crewModal.mode==='add'?'Add Crew':'Edit Crew'}
              <button className="btn btn-ghost btn-sm" onClick={()=>setCrewModal(null)}><X size={14}/></button>
            </div>
            <div className="modal-form">
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12}}>
                <div className="input-group">
                  <label>Crew Name *</label>
                  <input className="input" value={crewModal.crew.name} onChange={e=>setCrewField('name',e.target.value)} placeholder="e.g. БРИНЗА цех" />
                </div>
                <div className="input-group">
                  <label>Level Gap (so'm/day)</label>
                  <input className="input" type="number" min={0} step={1000} value={crewModal.crew.levelGap||10000} onChange={e=>setCrewField('levelGap',+e.target.value)} />
                </div>
              </div>

              <div className="sep"/>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span className="fw-600" style={{fontSize:13}}>Products / Price per unit</span>
                <button className="btn btn-ghost btn-sm" onClick={openAddProduct}><Plus size={12}/> Add Product</button>
              </div>
              {crewModal.crew.products.length === 0 && <div className="text-muted text-sm">No products yet.</div>}
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {crewModal.crew.products.map(p=>(
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface2)',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)'}}>
                    <Package size={13} style={{color:'var(--text3)'}}/>
                    <span style={{flex:1,fontSize:13}}>{p.name}</span>
                    <span style={{color:'var(--success)',fontSize:13,fontWeight:600}}>{new Intl.NumberFormat().format(p.price)} so'm</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEditProduct(p)}><Pencil size={11}/></button>
                    <button className="btn btn-danger btn-sm" onClick={()=>removeProduct(p.id)}><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setCrewModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCrew}><Check size={13}/> Save Crew</button>
            </div>
          </div>
        </div>
      )}

      {/* Product modal */}
      {productModal && (
        <div className="modal-overlay" style={{zIndex:200}} onClick={e=>e.target===e.currentTarget&&setProductModal(null)}>
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-title">
              {productModal.mode==='add'?'Add Product':'Edit Product'}
              <button className="btn btn-ghost btn-sm" onClick={()=>setProductModal(null)}><X size={14}/></button>
            </div>
            <div className="modal-form">
              <div className="input-group">
                <label>Product Name *</label>
                <input className="input" value={productModal.product.name} onChange={e=>setProdField('name',e.target.value)} placeholder="e.g. БРИНЗА" autoFocus />
              </div>
              <div className="input-group">
                <label>Price per unit (so'm)</label>
                <input className="input" type="number" min={0} step={1} value={productModal.product.price} onChange={e=>setProdField('price',+e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setProductModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProduct}><Check size={13}/> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
