import { AI_API_URL, MOCK_API_BASE_URL } from './config'

// Request/response follow the Apidog contract for POST /ai/analyse-savings.
// UI shape: { summary, observations[{type,message}], recommendations[{title,description}], suggestedAction{label,type}, source }

export function buildPayload(d) {
  const expenses = d.transactions.filter((t) => t.type === 'expense')
  const months = new Set(expenses.map((t) => String(t.date).slice(0, 7)))
  // Estimate: total expenses divided by the number of months that appear in the transaction list.
  const monthlyExpenses = months.size ? Math.round(expenses.reduce((s, t) => s + t.amount, 0) / months.size) : 0
  return {
    customer: { customer_id: d.customerId, household_name: d.household.name, currency: d.currency },
    financial_summary: {
      monthly_household_income: d.household.monthlyIncome,
      current_savings_balance: d.savings.currentBalance,
      target_amount: d.goal.targetAmount,
      monthly_expenses: monthlyExpenses,
      monthly_savings_contribution: d.savings.plannedMonthly,
      target_date: d.goal.targetDate,
    },
    recent_transactions: d.transactions.slice(-10).map(({ date, type, category, description, amount }) => ({ date, type, category, description, amount })),
  }
}

// Deterministic, rule-based fallback computed from the payload.
export function localInsight(p) {
  const f = p.financial_summary
  const remaining = Math.max(f.target_amount - f.current_savings_balance, 0)
  const pct = f.target_amount ? Math.round((f.current_savings_balance / f.target_amount) * 100) : 0
  const monthsNeeded = f.monthly_savings_contribution ? Math.ceil(remaining / f.monthly_savings_contribution) : null
  const spendPct = f.monthly_household_income ? Math.round((f.monthly_expenses / f.monthly_household_income) * 100) : null
  return {
    summary: monthsNeeded != null
      ? `You have saved ${pct}% of your target. At the planned monthly contribution, about ${monthsNeeded} more months would reach it.`
      : `You have saved ${pct}% of your target.`,
    observations: [
      { type: 'progress', message: `${remaining.toLocaleString()} ${p.customer.currency} remains to reach the target.` },
      ...(spendPct != null ? [{ type: 'spending', message: `Estimated monthly expenses are about ${spendPct}% of household income.` }] : []),
    ],
    recommendations: [
      { title: 'Keep contributions regular', description: 'A fixed monthly contribution is easier to sustain than occasional larger ones.' },
      { title: 'Review recurring expenses', description: 'Small savings on recurring bills can fund a higher monthly contribution.' },
    ],
    suggestedAction: { label: 'Review monthly savings plan', type: 'review_plan' },
    source: 'mock',
  }
}

function fromApi(json, source) {
  const a = json?.analysis
  if (!a || typeof a.summary !== 'string') throw new Error('Malformed AI response')
  return {
    summary: a.summary,
    observations: Array.isArray(a.observations) ? a.observations : [],
    recommendations: Array.isArray(a.recommendations) ? a.recommendations : [],
    suggestedAction: a.suggested_action ? { label: a.suggested_action.label, type: a.suggested_action.type } : null,
    source,
  }
}

export async function analyseSavings(data) {
  const payload = buildPayload(data)
  const base = AI_API_URL || MOCK_API_BASE_URL
  if (!base) return localInsight(payload)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(`${base}/ai/analyse-savings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`AI service returned ${res.status}`)
    return fromApi(await res.json(), AI_API_URL ? 'live' : 'mockapi')
  } catch {
    return { ...localInsight(payload), source: 'fallback' }
  } finally {
    clearTimeout(timer)
  }
}
