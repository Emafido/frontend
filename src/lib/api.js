import { MOCK_API_BASE_URL } from './config'
import { sampleRaw } from './mockData'

// Data adapter. The UI only calls loadAll() and receives a clean view model.
// Everything specific to the Apidog response shapes lives in this file.
const ENDPOINTS = { customer: '/customer', transactions: '/transactions', savings: '/savings', goal: '/goal' }
const REQUIRED = { customer: ['id', 'household'], transactions: ['transactions'], savings: ['contributions'], goal: ['target_amount'] }

async function getJson(path, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(MOCK_API_BASE_URL + path, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export function normalise(raw) {
  const { customer: c, savings: s, goal: g, transactions: t } = raw
  const members = c.household?.members || []
  return {
    customerId: c.id,
    currency: c.currency || s.currency || t.currency || 'NGN',
    household: {
      name: c.household?.name, location: c.household?.location, members,
      monthlyIncome: members.reduce((sum, m) => sum + (m.monthly_income || 0), 0),
    },
    goal: {
      id: g.goal_id, name: g.name, purpose: g.purpose, targetAmount: g.target_amount, currentBalance: g.current_balance,
      amountRemaining: g.amount_remaining, targetDate: g.target_date, monthsRemaining: g.months_remaining, status: g.status,
      progress: g.progress_percentage, originalMonthly: g.original_monthly_target, requiredMonthly: g.current_required_monthly_contribution,
    },
    savings: {
      currentBalance: s.current_balance, plannedMonthly: s.planned_monthly_contribution,
      contributions: (s.contributions || []).map((x) => ({ month: x.month, amount: x.amount, balanceAfter: x.balance_after_contribution })),
    },
    transactions: (t.transactions || []).map(({ id, date, type, category, description, amount }) => ({ id, date, type, category, description, amount })),
  }
}

function checkConsistency(raw) {
  const w = []
  const ids = new Set([raw.customer.id, raw.savings.customer_id, raw.goal.customer_id, raw.transactions.customer_id].filter(Boolean))
  if (ids.size > 1) w.push(`Customer identifiers differ between endpoints (${[...ids].join(', ')}).`)
  const balances = new Set([raw.customer.current_savings_balance, raw.savings.current_balance, raw.goal.current_balance].filter((x) => x != null))
  if (balances.size > 1) w.push(`Savings balance differs between endpoints (${[...balances].join(', ')}).`)
  const last = raw.savings.contributions?.at(-1)
  if (last && last.balance_after_contribution !== raw.savings.current_balance) w.push('Last contribution balance does not match the current savings balance.')
  return w
}

export async function loadAll() {
  if (!MOCK_API_BASE_URL) return { ...normalise(sampleRaw), source: 'sample', warnings: [] }
  const warnings = []
  const raw = {}
  let source = 'api'
  await Promise.all(
    Object.entries(ENDPOINTS).map(async ([key, path]) => {
      try {
        const json = await getJson(path)
        const missing = REQUIRED[key].find((k) => json?.[k] === undefined)
        if (missing) throw new Error(`unexpected response (missing "${missing}")`)
        raw[key] = json
      } catch (e) {
        warnings.push(`${path}: ${e.message}. Showing sample data for this part.`)
        raw[key] = sampleRaw[key]
        source = 'partial'
      }
    })
  )
  if (source === 'api') warnings.push(...checkConsistency(raw))
  return { ...normalise(raw), source, warnings }
}
