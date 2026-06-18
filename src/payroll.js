/**
 * SSS Payroll — Payment Engine
 * Exact implementation of the formula in SSS_Payroll_Concept.md §5
 */

export const LEVEL_RANK = {
  SeniorHigh: 4,
  High: 3,
  Mid: 2,
  Beginner: 1,
  Junior: 0,
}

export const LEVEL_ORDER = ['SeniorHigh', 'High', 'Mid', 'Beginner', 'Junior']

/**
 * Get the level a worker had on a specific date, using their levelHistory.
 * levelHistory = [{ level, from }] sorted by date ascending, latest has no "to".
 */
export function getWorkerLevelOnDate(worker, date) {
  const history = worker.levelHistory
  if (!history || history.length === 0) return worker.level || 'Beginner'

  // Sort ascending by from date
  const sorted = [...history].sort((a, b) => a.from.localeCompare(b.from))

  let result = sorted[0].level
  for (const entry of sorted) {
    if (entry.from <= date) result = entry.level
    else break
  }
  return result
}

/**
 * crewDayEarning — the core payment function.
 * Runs per crew, per day.
 *
 * Returns { earnings: { workerId: amount }, pool, revenue, base }
 */
export function crewDayEarning(crew, date, workers, daily, absent, dayFraction, dayOverride, stickyOverride) {
  if (!crew) return { earnings: {}, pool: 0, revenue: 0, base: 0 }

  // ── Step 0: Crew revenue for the day ───────────────────────────────────────
  const dayData = daily?.[date]?.[crew.id] || {}
  let revenue = 0
  for (const product of (crew.products || [])) {
    revenue += (dayData[product.id] || 0) * (product.price || 0)
  }

  // ── Get active crew workers for this date ──────────────────────────────────
  const crewWorkers = workers.filter(w =>
    w.crewId === crew.id &&
    !w.leaveDate &&
    w.joinDate <= date
  )

  // Build attendance map
  // fraction: 0 = absent, 0.5 = half day, 1 = full day
  const fractions = {}
  for (const w of crewWorkers) {
    if (absent?.[date]?.[w.id]) {
      fractions[w.id] = 0
    } else if (dayFraction?.[date]?.[w.id] !== undefined) {
      fractions[w.id] = dayFraction[date][w.id]
    } else {
      fractions[w.id] = 1
    }
  }

  // Present = fraction > 0
  const present = crewWorkers.filter(w => fractions[w.id] > 0)

  // ── Step 1: Fixed salary workers ───────────────────────────────────────────
  // Working days this month for this crew (rough: count days in month minus daysOff)
  // We use a simple helper: caller can pass crewWorkingDays, defaulting to 26
  let fixedCost = 0
  let dailyCost = 0
  let overrideCost = 0

  // Collect override workers (manual amount for this day)
  const overrideWorkers = new Set()
  for (const w of present) {
    const overrideAmt = dayOverride?.[date]?.[w.id] ?? stickyOverride?.[w.id]
    if (overrideAmt !== undefined && overrideAmt !== null) {
      overrideWorkers.add(w.id)
      overrideCost += overrideAmt * fractions[w.id]
    }
  }

  // Fixed salary (paid before pool — divided across ~26 working days)
  const WORKING_DAYS = 26
  for (const w of present) {
    if (overrideWorkers.has(w.id)) continue
    if (w.workerType === 'fixed' && w.fixedSalary) {
      fixedCost += (w.fixedSalary / WORKING_DAYS) * fractions[w.id]
    }
  }

  // Daily rate workers
  for (const w of present) {
    if (overrideWorkers.has(w.id)) continue
    if (w.workerType === 'daily' && w.dailyRate) {
      dailyCost += w.dailyRate * fractions[w.id]
    }
  }

  // ── Step 3: Commission pool ────────────────────────────────────────────────
  const pool = Math.max(0, revenue - fixedCost - dailyCost - overrideCost)

  // Commission workers (exclude override, fixed, daily from pool split)
  const commissionPresent = present.filter(w =>
    !overrideWorkers.has(w.id) &&
    w.workerType === 'commission'
  )
  const n = commissionPresent.length

  const earnings = {}

  // ── Step 4: Split pool by level ────────────────────────────────────────────
  if (n === 0) {
    // No commission workers present — pool is unassigned (or could go to dailies)
    // Assign fixed/daily/override workers their amounts
    for (const w of present) {
      if (overrideWorkers.has(w.id)) {
        const amt = dayOverride?.[date]?.[w.id] ?? stickyOverride?.[w.id]
        earnings[w.id] = amt * fractions[w.id]
      } else if (w.workerType === 'fixed' && w.fixedSalary) {
        earnings[w.id] = (w.fixedSalary / WORKING_DAYS) * fractions[w.id]
      } else if (w.workerType === 'daily' && w.dailyRate) {
        earnings[w.id] = w.dailyRate * fractions[w.id]
      } else {
        earnings[w.id] = 0
      }
    }
    return { earnings, pool, revenue, base: 0 }
  }

  const gap = crew.levelGap || 10000

  // Count by rank for present commission workers (use level on this date)
  let rankSum = 0
  for (const w of commissionPresent) {
    const lvl = getWorkerLevelOnDate(w, date)
    rankSum += (LEVEL_RANK[lvl] || 0)
  }

  // base = (pool − gap × rankSum) / n
  const base = (pool - gap * rankSum) / n

  // Full share per worker (before day fraction)
  const fullShares = {}
  for (const w of commissionPresent) {
    const lvl = getWorkerLevelOnDate(w, date)
    fullShares[w.id] = Math.max(0, base + (LEVEL_RANK[lvl] || 0) * gap)
  }

  // ── Step 5: Half-day redistribution ───────────────────────────────────────
  // savedPool = sum of (fullShare × (1 - fraction)) for partial workers
  let savedPool = 0
  const fullDayWorkers = commissionPresent.filter(w => fractions[w.id] === 1)
  const partialWorkers = commissionPresent.filter(w => fractions[w.id] > 0 && fractions[w.id] < 1)

  for (const w of partialWorkers) {
    savedPool += fullShares[w.id] * (1 - fractions[w.id])
  }

  const bonus = fullDayWorkers.length > 0 ? savedPool / fullDayWorkers.length : 0

  for (const w of commissionPresent) {
    const frac = fractions[w.id]
    if (frac === 1) {
      earnings[w.id] = fullShares[w.id] + bonus
    } else {
      earnings[w.id] = fullShares[w.id] * frac
    }
  }

  // Assign non-commission present workers
  for (const w of present) {
    if (earnings[w.id] !== undefined) continue
    if (overrideWorkers.has(w.id)) {
      const amt = dayOverride?.[date]?.[w.id] ?? stickyOverride?.[w.id]
      earnings[w.id] = amt * fractions[w.id]
    } else if (w.workerType === 'fixed' && w.fixedSalary) {
      earnings[w.id] = (w.fixedSalary / WORKING_DAYS) * fractions[w.id]
    } else if (w.workerType === 'daily' && w.dailyRate) {
      earnings[w.id] = w.dailyRate * fractions[w.id]
    } else {
      earnings[w.id] = 0
    }
  }

  return { earnings, pool, revenue, base, fullShares, gap }
}

/**
 * Compute monthly payroll for all workers.
 * Returns array of per-worker results.
 */
export function computeMonthlyPayroll(state, selectedMonth) {
  const { workers = [], crews = [], daily = {}, absent = {}, dayFraction = {},
    dayOverride = {}, stickyOverride = {}, daysOff = {}, deductions = {} } = state

  const [y, m] = selectedMonth.split('-')
  const totalDays = new Date(Number(y), Number(m), 0).getDate()

  // Build list of production days (not day-off)
  // daysOff can be { date: true } or { date: { crewId: true } }
  function isDayOff(date, crewId) {
    const v = daysOff[date]
    if (!v) return false
    if (v === true) return true
    if (typeof v === 'object') return !!v[crewId]
    return false
  }

  const results = []

  for (const worker of workers) {
    if (worker.leaveDate && worker.leaveDate < `${y}-${m}-01`) continue
    const crew = crews.find(c => c.id === worker.crewId)
    if (!crew) continue

    let totalEarned = 0
    let daysWorked = 0
    let daysPresent = 0

    for (let d = 1; d <= totalDays; d++) {
      const date = `${y}-${m}-${String(d).padStart(2, '0')}`
      if (isDayOff(date, crew.id)) continue
      if (worker.joinDate && worker.joinDate > date) continue

      const frac = absent?.[date]?.[worker.id]
        ? 0
        : (dayFraction?.[date]?.[worker.id] ?? 1)

      if (frac > 0) {
        daysPresent++
        if (frac === 1) daysWorked++
        else daysWorked += frac
      }

      const { earnings } = crewDayEarning(
        crew, date, workers, daily, absent, dayFraction, dayOverride, stickyOverride
      )
      totalEarned += earnings[worker.id] || 0
    }

    // Deductions (avans) for this month
    const workerDeductions = deductions?.[worker.id] || []
    const monthAvans = workerDeductions
      .filter(d => d.month === selectedMonth)
      .reduce((s, d) => s + (d.amount || 0), 0)

    const tax = (worker.taxAmount || 0) // monthly flat tax
    const netPay = totalEarned - tax - monthAvans

    results.push({
      worker,
      crew,
      daysWorked: Math.round(daysWorked * 2) / 2, // round to 0.5
      daysPresent,
      totalEarned: Math.round(totalEarned),
      tax,
      monthAvans,
      netPay: Math.round(netPay),
    })
  }

  return results
}

/**
 * Anomaly detection: flag if value is >3x or <25% of 30-day product average.
 * Returns { isAnomaly, avg, ratio } or null if not enough history.
 */
export function detectAnomaly(crewId, productId, value, date, daily) {
  const vals = []
  const [y, m, d] = date.split('-').map(Number)
  const ref = new Date(y, m - 1, d)

  for (let i = 1; i <= 30; i++) {
    const past = new Date(ref)
    past.setDate(past.getDate() - i)
    const dk = past.toISOString().slice(0, 10)
    const v = daily?.[dk]?.[crewId]?.[productId]
    if (v !== undefined && v > 0) vals.push(v)
  }

  if (vals.length < 5) return null
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (avg === 0) return null
  const ratio = value / avg

  return {
    isAnomaly: ratio > 3 || ratio < 0.25,
    avg: Math.round(avg),
    ratio: Math.round(ratio * 100) / 100,
  }
}
