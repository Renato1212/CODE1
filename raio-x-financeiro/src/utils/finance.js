// Projeção de poupança com juros compostos mensais
// IRS sobre rendimentos de capitais em Portugal: 28% (taxa liberatória 2026)

export const IRS_RATE = 0.28

export const SCENARIOS = [
  {
    id: 'conservative',
    label: 'Conservador',
    description: 'Certificados de Aforro / Depósito a prazo',
    grossRate: 0.035, // ~3.5% bruto/ano
    color: '#3b82f6',
    gradient: 'from-blue-600 to-blue-400',
    icon: '🏦',
    note: 'Certificados de Aforro Série F ou depósito a prazo (TANB ~3,5%)',
  },
  {
    id: 'moderate',
    label: 'Moderado',
    description: 'ETF mundial (VWCE/IWDA) via Degiro / XTB',
    grossRate: 0.07, // ~7% real histórico pós-inflação
    color: '#8b5cf6',
    gradient: 'from-violet-600 to-violet-400',
    icon: '📈',
    note: 'ETF diversificado mundial — retorno histórico real ~7%/ano pós-inflação',
  },
  {
    id: 'optimistic',
    label: 'Otimista',
    description: 'Carteira diversificada agressiva',
    grossRate: 0.09,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-400',
    icon: '🚀',
    note: 'Carteira 100% ações globais — cenário histórico otimista',
  },
]

/**
 * Taxa líquida anual depois de IRS (28%)
 * O IRS em PT aplica-se às mais-valias realizadas + dividendos.
 * Simplificação: taxa efetiva líquida = grossRate * (1 - IRS_RATE)
 */
export function netRate(grossRate) {
  return grossRate * (1 - IRS_RATE)
}

/**
 * Valor futuro de contribuições mensais (PMT) durante n anos
 * com taxa anual net_r reinvestida mensalmente.
 *
 * FV = PMT × [((1 + r_m)^n_m - 1) / r_m]
 * onde r_m = taxa mensal, n_m = nº meses
 */
export function futureValue(monthlyPMT, years, annualNetRate) {
  const r = annualNetRate / 12
  const n = years * 12
  if (r === 0) return monthlyPMT * n
  return monthlyPMT * ((Math.pow(1 + r, n) - 1) / r)
}

/**
 * Gera tabela de projeção ano a ano para todos os cenários
 * @param {number} monthlyPMT - poupança mensal
 * @param {number} maxYears
 * @returns Array de { year, conservative, moderate, optimistic, contributions }
 */
export function projectAll(monthlyPMT, maxYears = 30) {
  const rows = []
  for (let y = 1; y <= maxYears; y++) {
    const row = { year: y, contributions: monthlyPMT * y * 12 }
    for (const s of SCENARIOS) {
      row[s.id] = Math.round(futureValue(monthlyPMT, y, netRate(s.grossRate)))
    }
    rows.push(row)
  }
  return rows
}

/**
 * Impacto de cortar X% na categoria mais cara
 * "Se cortares 30% nos supermercados, poupas +Y€ na reforma"
 */
export function cutImpact(categoryMonthly, cutPercent, years = 30) {
  const extra = categoryMonthly * (cutPercent / 100)
  const moderate = SCENARIOS.find((s) => s.id === 'moderate')
  return Math.round(futureValue(extra, years, netRate(moderate.grossRate)))
}
