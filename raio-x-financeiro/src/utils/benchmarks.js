// Médias de consumo da família portuguesa — INE 2024 / PORDATA
// Fontes: INE IDEF 2022-23, PORDATA 2024, Banco de Portugal relatório famílias 2024

export const PT_BENCHMARKS = {
  supermarket: {
    label: 'Supermercado / Alimentação em casa',
    monthlyAvg: 380,
    source: 'INE IDEF 2022-23',
    icon: '🛒',
  },
  food_out: {
    label: 'Refeições fora de casa',
    monthlyAvg: 120,
    source: 'INE 2023',
    icon: '🍔',
  },
  transport: {
    label: 'Transportes (combustível + portagens + TP)',
    monthlyAvg: 180,
    source: 'PORDATA 2024',
    icon: '🚗',
  },
  home_telecom: {
    label: 'Telecomunicações (internet + TV + móvel)',
    monthlyAvg: 65,
    source: 'ANACOM 2024',
    icon: '📡',
  },
  home_energy: {
    label: 'Eletricidade + Gás',
    monthlyAvg: 95,
    source: 'ERSE 2024',
    icon: '⚡',
  },
  leisure: {
    label: 'Lazer e cultura',
    monthlyAvg: 80,
    source: 'INE 2023',
    icon: '🎬',
  },
  health: {
    label: 'Saúde (farmácia + consultas)',
    monthlyAvg: 55,
    source: 'INE 2023',
    icon: '💊',
  },
}

// Mapeamento de categoria → benchmark
const CAT_TO_BENCHMARK = {
  supermarket: 'supermarket',
  food_out: 'food_out',
  transport: 'transport',
  home: 'home_telecom',
  leisure: 'leisure',
  health: 'health',
}

/**
 * Compara gasto mensal do utilizador com média nacional.
 * Retorna string descritiva se desvio > 15%.
 */
export function compareToBenchmark(categoryId, userMonthly) {
  const key = CAT_TO_BENCHMARK[categoryId]
  if (!key) return null
  const b = PT_BENCHMARKS[key]
  if (!b) return null

  const diff = ((userMonthly - b.monthlyAvg) / b.monthlyAvg) * 100

  if (diff > 15) {
    return {
      text: `Gastas ${Math.round(diff)}% mais em ${b.label.toLowerCase()} que a média portuguesa (${fmtEur(b.monthlyAvg)}/mês — ${b.source})`,
      direction: 'above',
      pct: Math.round(diff),
    }
  }
  if (diff < -15) {
    return {
      text: `Gastas ${Math.round(Math.abs(diff))}% menos em ${b.label.toLowerCase()} que a média portuguesa — bem! (média: ${fmtEur(b.monthlyAvg)}/mês)`,
      direction: 'below',
      pct: Math.round(Math.abs(diff)),
    }
  }
  return null
}

function fmtEur(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
