/**
 * SSS Payroll — Payment Engine
 * Matches original SSS_Payroll HTML app logic exactly.
 */

export const LEVEL_RANK = { SeniorHigh: 4, High: 3, Mid: 2, Beginner: 1, Junior: 0 }
export const LEVEL_LABEL = { SeniorHigh: 'SeniorHigh', High: 'High', Mid: 'Mid', Beginner: 'Beginner', Junior: 'Junior' }
export const LEVEL_COLOR = { SeniorHigh: '#e6b800', High: '#2d8a00', Mid: '#1a6bbf', Beginner: '#6a0dad', Junior: '#888' }
export const LEVELS = ['SeniorHigh', 'High', 'Mid', 'Beginner', 'Junior']

export function getWorkerLevelOnDate(worker, date) {
  const history = worker.levelHistory
  if (!history || history.length === 0) return worker.level || 'Beginner'
  const sorted = [...history].sort((a, b) => a.from.localeCompare(b.from))
  let result = sorted[0].level
  for (const entry of sorted) {
    if (entry.from <= date) result = entry.level
    else break
  }
  return result
}

export function isDayOff(daysOff, date, crewId) {
  const v = daysOff?.[date]
  if (!v) return false
  if (v === true) return true
  if (typeof v === 'object' && crewId && v[crewId]) return true
  return false
}

export function crewHasUnitsOnDay(crewId, date, daily, products) {
  if (!daily?.[date]?.[crewId]) return false
  return (products || []).some(p => (daily[date][crewId][p.id] || 0) > 0)
}

export function getDayFraction(date, wid, absent, dayFraction) {
  if (absent?.[date]?.[wid]) return 0
  const f = dayFraction?.[date]?.[wid]
  return f !== undefined ? f : 1
}

export function getDayOverride(date, wid, dayOverride, stickyOverride) {
  const d = dayOverride?.[date]?.[wid]
  if (d !== undefined && d !== null) return d
  const s = stickyOverride?.[wid]
  if (s !== undefined && s !== null) return s
  return null
}

/**
 * crewDayEarning — core per-crew, per-day payment function
 * Returns { total, shares: { workerId: amount } }
 */
export function crewDayEarning(crewId, date, state) {
  const { crews = [], workers = [], daily = {}, absent = {}, dayFraction = {},
    dayOverride = {}, stickyOverride = {} } = state
  const crew = crews.find(c => c.id === crewId)
  if (!crew) return { total: 0, shares: {} }

  const products = crew.products || []
  const dayData = daily?.[date]?.[crewId] || {}
  let revenue = 0
  for (const p of products) revenue += (dayData[p.id] || 0) * (p.price || 0)

  const allW = workers.filter(w =>
    w.crewId === crewId && !w.inactive &&
    (!w.joinDate || w.joinDate <= date) &&
    (!w.leaveDate || w.leaveDate >= date)
  )

  const fracs = {}
  for (const w of allW) fracs[w.id] = getDayFraction(date, w.id, absent, dayFraction)

  const present = allW.filter(w => fracs[w.id] > 0)

  let fixedCost = 0, dailyCost = 0, overrideCost = 0
  const overrideSet = new Set()
  const WORKING_DAYS = 26

  for (const w of present) {
    const ov = getDayOverride(date, w.id, dayOverride, stickyOverride)
    if (ov !== null) { overrideSet.add(w.id); overrideCost += ov * fracs[w.id] }
  }
  for (const w of present) {
    if (overrideSet.has(w.id)) continue
    if (w.workerType === 'fixed') fixedCost += (w.fixedSalary || 0) / WORKING_DAYS * fracs[w.id]
    if (w.workerType === 'daily') dailyCost += (w.dailyRate || 0) * fracs[w.id]
  }

  const pool = Math.max(0, revenue - fixedCost - dailyCost - overrideCost)

  const commPresent = present.filter(w => !overrideSet.has(w.id) && w.workerType === 'commission')
  const shares = {}

  if (commPresent.length === 0) {
    for (const w of present) {
      const ov = overrideSet.has(w.id) ? getDayOverride(date, w.id, dayOverride, stickyOverride) : null
      if (ov !== null) shares[w.id] = ov * fracs[w.id]
      else if (w.workerType === 'fixed') shares[w.id] = (w.fixedSalary || 0) / WORKING_DAYS * fracs[w.id]
      else if (w.workerType === 'daily') shares[w.id] = (w.dailyRate || 0) * fracs[w.id]
      else shares[w.id] = 0
    }
    return { total: revenue, shares }
  }

  const gap = crew.levelGap || 10000
  let rankSum = 0
  for (const w of commPresent) rankSum += (LEVEL_RANK[getWorkerLevelOnDate(w, date)] || 0)

  const n = commPresent.length
  const base = (pool - gap * rankSum) / n

  const fullShares = {}
  for (const w of commPresent) {
    const lvl = getWorkerLevelOnDate(w, date)
    fullShares[w.id] = Math.max(0, base + (LEVEL_RANK[lvl] || 0) * gap)
  }

  // Half-day redistribution
  let savedPool = 0
  const fullW = commPresent.filter(w => fracs[w.id] === 1)
  for (const w of commPresent.filter(w => fracs[w.id] > 0 && fracs[w.id] < 1))
    savedPool += fullShares[w.id] * (1 - fracs[w.id])

  const bonus = fullW.length > 0 ? savedPool / fullW.length : 0

  for (const w of commPresent) {
    const f = fracs[w.id]
    shares[w.id] = f === 1 ? fullShares[w.id] + bonus : fullShares[w.id] * f
  }

  for (const w of present) {
    if (shares[w.id] !== undefined) continue
    const ov = overrideSet.has(w.id) ? getDayOverride(date, w.id, dayOverride, stickyOverride) : null
    if (ov !== null) shares[w.id] = ov * fracs[w.id]
    else if (w.workerType === 'fixed') shares[w.id] = (w.fixedSalary || 0) / WORKING_DAYS * fracs[w.id]
    else if (w.workerType === 'daily') shares[w.id] = (w.dailyRate || 0) * fracs[w.id]
    else shares[w.id] = 0
  }

  return { total: revenue, shares }
}

export function monthDates(ym) {
  const [y, m] = ym.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    return `${ym}-${d}`
  })
}

export function crewProductionDays(ym, crewId, state) {
  const { daysOff = {}, daily = {}, crews = [] } = state
  const crew = crews.find(c => c.id === crewId)
  const products = crew?.products || []
  return monthDates(ym).filter(d =>
    !isDayOff(daysOff, d, crewId) &&
    crewHasUnitsOnDay(crewId, d, daily, products)
  ).length
}

export function workerDaysWorked(wid, ym, state) {
  const { workers = [], daysOff = {}, daily = {}, dayFraction = {}, absent = {} } = state
  const w = workers.find(x => x.id === wid)
  if (!w) return 0
  const crew = (state.crews || []).find(c => c.id === w.crewId)
  const products = crew?.products || []
  let days = 0
  for (const date of monthDates(ym)) {
    if (isDayOff(daysOff, date, w.crewId)) continue
    if (!crewHasUnitsOnDay(w.crewId, date, daily, products)) continue
    if (w.joinDate && date < w.joinDate) continue
    if (w.leaveDate && date > w.leaveDate) continue
    const f = getDayFraction(date, wid, absent, dayFraction)
    days += f
  }
  return days
}

export function workerMonthlyEarning(wid, ym, state) {
  const { workers = [], daysOff = {}, daily = {}, dayFraction = {}, absent = {} } = state
  const w = workers.find(x => x.id === wid)
  if (!w) return 0
  const crew = (state.crews || []).find(c => c.id === w.crewId)
  const products = crew?.products || []
  const allDates = monthDates(ym)
  const activeDates = allDates.filter(d =>
    (!w.joinDate || d >= w.joinDate) && (!w.leaveDate || d <= w.leaveDate)
  )
  const WORKING_DAYS = 26

  if (w.workerType === 'fixed') {
    if (!activeDates.length) return 0
    const totalWD = Math.max(1, allDates.filter(d => !isDayOff(daysOff, d, w.crewId)).length)
    const activeWD = activeDates.filter(d => !isDayOff(daysOff, d, w.crewId)).length
    return (w.fixedSalary || 0) * (activeWD / totalWD)
  }
  if (w.workerType === 'daily') {
    return activeDates.reduce((a, d) => {
      if (isDayOff(daysOff, d, w.crewId)) return a
      if (!crewHasUnitsOnDay(w.crewId, d, daily, products)) return a
      return a + (w.dailyRate || 0) * getDayFraction(d, wid, absent, dayFraction)
    }, 0)
  }
  // commission
  return activeDates.reduce((a, d) => {
    if (isDayOff(daysOff, d, w.crewId)) return a
    if (!crewHasUnitsOnDay(w.crewId, d, daily, products)) return a
    const { shares } = crewDayEarning(w.crewId, d, state)
    return a + (shares[wid] || 0)
  }, 0)
}

export function workerMonthDeductions(wid, ym, deductions) {
  if (!wid || !deductions?.[wid]) return 0
  return deductions[wid].reduce((a, d) => {
    if (d.month === null || d.month === ym) return a + (d.amount || 0)
    return a
  }, 0)
}

export function detectAnomaly(crewId, productId, value, date, daily) {
  if (!value || value <= 0) return false
  const past = []
  for (const [d, crews] of Object.entries(daily || {})) {
    if (d >= date) continue
    const v = crews?.[crewId]?.[productId]
    if (v > 0) past.push(v)
    if (past.length >= 30) break
  }
  if (past.length < 3) return false
  const avg = past.reduce((a, b) => a + b, 0) / past.length
  return value > avg * 3 || value < avg * 0.25
}
