const fmt = (n, cur = 'NGN') => `${cur} ${Number(n).toLocaleString()}`

export function HouseholdPanel({ household, currency }) {
  return (
    <section className="panel bank">
      <h2>Household</h2>
      <ul className="rows">
        {household.members.map((m) => (
          <li key={m.id}><span>{m.name}, age {m.age}</span><b>{fmt(m.monthly_income, currency)} / month</b></li>
        ))}
      </ul>
      <p className="muted">Combined monthly income {fmt(household.monthlyIncome, currency)}.</p>
    </section>
  )
}

export function GoalPanel({ goal, savings, currency }) {
  const pct = Math.max(0, Math.min(100, Math.round(goal.progress ?? 0)))
  return (
    <section className="panel bank">
      <h2>{goal.name}</h2>
      <p className="muted">{goal.purpose}</p>
      <p className="big">{fmt(savings.currentBalance, currency)} <span>of {fmt(goal.targetAmount, currency)}</span></p>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${pct}%` }} /></div>
      <p className="muted">{pct}% saved · {fmt(goal.amountRemaining, currency)} to go · target date {goal.targetDate} ({goal.monthsRemaining} months left)</p>
      <ul className="rows">
        <li><span>Status</span><b>{String(goal.status).replace(/_/g, ' ')}</b></li>
        <li><span>Planned monthly contribution</span><b>{fmt(savings.plannedMonthly, currency)}</b></li>
        <li><span>Now needed per month</span><b>{fmt(goal.requiredMonthly, currency)}</b></li>
      </ul>
    </section>
  )
}

export function ContributionsPanel({ savings, currency }) {
  const list = savings.contributions || []
  return (
    <section className="panel bank">
      <h2>Contribution history</h2>
      {list.length === 0 ? <p className="muted">No contributions yet.</p> : (
        <ul className="rows">
          {list.map((c) => (
            <li key={c.month}>
              <span>{c.month}</span>
              <span>{c.amount === 0 ? <i className="muted">no contribution</i> : <b>{fmt(c.amount, currency)}</b>} <span className="muted">· balance {Number(c.balanceAfter).toLocaleString()}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function TransactionsPanel({ transactions }) {
  return (
    <section className="panel bank">
      <h2>Recent transactions</h2>
      {transactions.length === 0 ? <p className="muted">No transactions found.</p> : (
        <ul className="rows">
          {transactions.map((t) => {
            const out = t.type === 'expense' || t.type === 'debit'
            return (
              <li key={t.id}>
                <span>{t.date} · {t.description} <span className="muted">({t.category})</span></span>
                <b className={out ? 'debit' : 'credit'}>{out ? '−' : '+'}{Number(t.amount).toLocaleString()}</b>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
