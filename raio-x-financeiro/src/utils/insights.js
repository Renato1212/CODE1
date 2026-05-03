import { fmtCurrency } from './format.js'
import { compareToBenchmark } from './benchmarks.js'

export function generateInsights(data) {
  const {
    byCategory,
    totalExpenses,
    transactions,
    period,
    byWeekday,
    expensesByCategory,
    monthlyAvgExpenses,
    monthlyAvgSavings,
  } = data

  const insights = []
  const months = period.months
  const cat = (id) => byCategory[id]

  // ── 1. Food delivery ───────────────────────────────────────────────────
  const delivery = cat('food_out')
  if (delivery && delivery.total > 40) {
    const monthly = delivery.total / months
    const lidlShops = Math.round(monthly / 22)
    const lidlYear = Math.round((monthly * 12) / 22)
    insights.push({
      id: 'delivery',
      emoji: '🍔',
      text: `Gastaste ${fmtCurrency(monthly)}/mês em refeições fora — dava para fazer ${lidlShops} compras no Lidl. Em 12 meses serão ${fmtCurrency(monthly * 12)} (${lidlYear} compras!)`,
      impact: monthly * 12,
      type: 'warning',
      easterEgg: monthly > 200,
    })
  }

  // ── 2. Subscriptions ──────────────────────────────────────────────────
  const leisure = cat('leisure')
  if (leisure) {
    const monthly = leisure.total / months
    const annual = monthly * 12
    // Fun comparison: voo low-cost PT-Londres ~80€, estadia 3 noites ~150€
    const acores = Math.round(annual / 230)
    insights.push({
      id: 'subscriptions',
      emoji: '📺',
      text: `As tuas subscrições e lazer somam ${fmtCurrency(monthly)}/mês = ${fmtCurrency(annual)}/ano — ${acores > 0 ? `dava para ${acores} escapadinha${acores > 1 ? 's' : ''} aos Açores 🏝️` : 'um valor considerável a rever'}`,
      impact: annual,
      type: 'info',
    })
  }

  // ── 3. Impulse purchases (<20€, not coffee/supermarket/transport) ──────
  const impulse = transactions.filter(
    (t) =>
      t.amount < 0 &&
      Math.abs(t.amount) < 20 &&
      !['supermarket', 'transport', 'home', 'fees', 'income', 'transfers_out'].includes(t.category.id)
  )
  if (impulse.length >= 8) {
    const total = impulse.reduce((s, t) => s + Math.abs(t.amount), 0)
    const monthly = total / months
    insights.push({
      id: 'impulse',
      emoji: '💸',
      text: `Fizeste ${impulse.length} pequenas compras por impulso abaixo dos 20 € — total ${fmtCurrency(total)} (${fmtCurrency(monthly)}/mês). Cada "só vou gastar pouco" soma!`,
      impact: (total / months) * 12,
      type: 'warning',
    })
  }

  // ── 4. Top category dominance ─────────────────────────────────────────
  const topCat = expensesByCategory[0]
  if (topCat && totalExpenses > 0) {
    const pct = Math.round((topCat.total / totalExpenses) * 100)
    if (pct >= 25) {
      const monthly = topCat.total / months
      insights.push({
        id: 'top_cat',
        emoji: topCat.icon,
        text: `${topCat.name} foi a tua maior despesa — ${fmtCurrency(monthly)}/mês = ${pct}% de tudo o que gastaste`,
        impact: topCat.total,
        type: 'info',
      })
    }
  }

  // ── 5. Coffee vs Health ───────────────────────────────────────────────
  const coffeeTotal = transactions
    .filter((t) => {
      const d = t.description.toLowerCase()
      return t.amount < 0 && (d.includes('café') || d.includes('cafe') || d.includes('coffee') || d.includes('padaria') || d.includes('pastelaria'))
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  const healthTotal = cat('health')?.total || 0
  if (coffeeTotal > 0 && coffeeTotal > healthTotal && healthTotal > 0) {
    insights.push({
      id: 'coffee_vs_health',
      emoji: '☕',
      text: `Gastaste ${fmtCurrency(coffeeTotal / months)}/mês em cafés e pastelarias — mais do que em saúde (${fmtCurrency(healthTotal / months)}/mês). Os bicos de pato cobram a conta!`,
      impact: (coffeeTotal / months) * 12,
      type: 'funny',
    })
  }

  // ── 6. Weekend splurge ────────────────────────────────────────────────
  const weekdaySpend = byWeekday.slice(1, 5).reduce((a, b) => a + b, 0) / 4
  const weekendSpend = (byWeekday[0] + byWeekday[6]) / 2
  if (weekdaySpend > 0 && weekendSpend / weekdaySpend > 1.8) {
    const ratio = (weekendSpend / weekdaySpend).toFixed(1)
    insights.push({
      id: 'weekend',
      emoji: '🎉',
      text: `Gastas ${ratio}× mais ao fim de semana do que durante a semana — os sábados e domingos são caros para a tua carteira!`,
      impact: weekendSpend * 52,
      type: 'info',
    })
  }

  // ── 7. Savings rate ───────────────────────────────────────────────────
  if (monthlyAvgSavings < 0) {
    insights.push({
      id: 'deficit',
      emoji: '🚨',
      text: `Atenção: as tuas despesas superam os rendimentos em ${fmtCurrency(Math.abs(monthlyAvgSavings))}/mês. Em 12 meses acumulas um défice de ${fmtCurrency(Math.abs(monthlyAvgSavings) * 12)}.`,
      impact: Math.abs(monthlyAvgSavings) * 12,
      type: 'danger',
    })
  } else if (monthlyAvgSavings < 100) {
    insights.push({
      id: 'low_savings',
      emoji: '⚠️',
      text: `Poupes apenas ${fmtCurrency(monthlyAvgSavings)}/mês (${Math.round((monthlyAvgSavings / (data.monthlyAvgIncome || 1)) * 100)}% do rendimento). A regra dos 20% recomenda mais ${fmtCurrency(data.monthlyAvgIncome * 0.2 - monthlyAvgSavings)}/mês extra.`,
      impact: (data.monthlyAvgIncome * 0.2 - monthlyAvgSavings) * 12,
      type: 'warning',
    })
  }

  // ── 8. Benchmark comparisons ──────────────────────────────────────────
  for (const c of expensesByCategory.slice(0, 4)) {
    const monthly = c.total / months
    const cmp = compareToBenchmark(c.id, monthly)
    if (cmp && cmp.direction === 'above' && cmp.pct > 25) {
      insights.push({
        id: `bench_${c.id}`,
        emoji: c.icon,
        text: cmp.text,
        impact: (monthly - 0) * 12,
        type: 'info',
      })
      break // só um benchmark por vez
    }
  }

  // Ordenar por impacto, devolver top 7
  return insights.sort((a, b) => b.impact - a.impact)
}
