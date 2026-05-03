import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Area, AreaChart,
} from 'recharts'
import { fmtCurrency, fmtCurrencyShort, WEEKDAYS_PT, MONTHS_PT } from '../utils/format.js'

// ── Tooltip personalizado ────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass px-3 py-2 text-sm shadow-xl">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold tabular-nums">
          {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Donut chart por categoria ────────────────────────────────────────────

function DonutChart({ data }) {
  const [active, setActive] = useState(null)

  const chartData = data.expensesByCategory
    .filter((c) => c.id !== 'income')
    .slice(0, 8)

  const total = chartData.reduce((s, c) => s + c.total, 0)
  const highlighted = active ? chartData.find((c) => c.id === active) : null

  return (
    <div className="card">
      <h3 className="section-title">
        <span>🎯</span>
        Gastos por categoria
      </h3>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="relative w-52 h-52 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="total"
                onMouseEnter={(_, i) => setActive(chartData[i]?.id)}
                onMouseLeave={() => setActive(null)}
              >
                {chartData.map((c) => (
                  <Cell
                    key={c.id}
                    fill={c.color}
                    opacity={active && active !== c.id ? 0.35 : 1}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const c = payload[0].payload
                  return (
                    <div className="glass px-3 py-2 text-sm shadow-xl">
                      <p className="text-white font-semibold">{c.icon} {c.name}</p>
                      <p className="text-slate-300 tabular-nums">{fmtCurrency(c.total)}</p>
                      <p className="text-slate-400">{c.percentage.toFixed(1)}%</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {highlighted ? (
              <>
                <span className="text-2xl">{highlighted.icon}</span>
                <span className="text-xs text-slate-400 mt-1 text-center leading-tight max-w-[80px]">
                  {highlighted.name}
                </span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {highlighted.percentage.toFixed(0)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {fmtCurrencyShort(total)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-1.5">
          {chartData.map((c) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(c.id)}
              onMouseLeave={() => setActive(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                active === c.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span className="text-sm text-slate-300 flex-1 text-left">{c.icon} {c.name}</span>
              <span className="text-xs text-slate-500 tabular-nums">{c.percentage.toFixed(1)}%</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {fmtCurrency(c.total)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Bar chart por dia da semana ──────────────────────────────────────────

function WeekdayChart({ data }) {
  const avg = data.byWeekday.reduce((a, b) => a + b, 0) / 7
  const chartData = WEEKDAYS_PT.map((day, i) => ({
    day,
    value: Math.round(data.byWeekday[i]),
    above: data.byWeekday[i] > avg * 1.3,
  }))

  return (
    <div className="card">
      <h3 className="section-title">
        <span>📅</span>
        Gastos por dia da semana
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.above ? '#7c3aed' : '#3b4f6b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-600 mt-2">
        Barras roxas = acima da média semanal ({fmtCurrency(avg)})
      </p>
    </div>
  )
}

// ── Line chart de evolução do saldo ─────────────────────────────────────

function BalanceChart({ data }) {
  const chartData = data.dailyBalances
    .filter((_, i) => i % 2 === 0 || i === data.dailyBalances.length - 1)
    .map((d) => ({
      date: d.date.slice(5).replace('-', '/'),
      balance: d.balance,
    }))

  const min = Math.min(...chartData.map((d) => d.balance))
  const isPositive = data.netBalance >= 0

  return (
    <div className="card">
      <h3 className="section-title">
        <span>📈</span>
        Evolução do saldo
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <defs>
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtCurrencyShort(v)}
            domain={[min * 0.95, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth={2}
            fill="url(#balanceGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Heatmap mensal ───────────────────────────────────────────────────────

function MonthlyHeatmap({ data }) {
  const dailyExpenses = {}
  for (const t of data.transactions) {
    if (t.amount >= 0) continue
    const key = t.date.toISOString().slice(0, 10)
    dailyExpenses[key] = (dailyExpenses[key] || 0) + Math.abs(t.amount)
  }

  const maxSpend = Math.max(...Object.values(dailyExpenses))

  // Group by year-month
  const months = {}
  for (const [date, amt] of Object.entries(dailyExpenses)) {
    const [y, m] = date.split('-')
    const key = `${y}-${m}`
    if (!months[key]) months[key] = {}
    months[key][parseInt(date.split('-')[2])] = amt
  }

  const getColor = (amount) => {
    if (!amount) return 'bg-white/[0.03]'
    const pct = amount / maxSpend
    if (pct > 0.75) return 'bg-violet-500'
    if (pct > 0.5) return 'bg-violet-500/70'
    if (pct > 0.25) return 'bg-violet-500/40'
    return 'bg-violet-500/20'
  }

  return (
    <div className="card">
      <h3 className="section-title">
        <span>🗓️</span>
        Mapa de calor — despesas diárias
      </h3>
      <div className="space-y-4">
        {Object.entries(months).sort().map(([ym, days]) => {
          const [y, m] = ym.split('-')
          const daysInMonth = new Date(+y, +m, 0).getDate()
          const firstDay = new Date(+y, +m - 1, 1).getDay()

          return (
            <div key={ym}>
              <p className="text-xs text-slate-500 mb-2">
                {MONTHS_PT[parseInt(m) - 1]} {y}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-xs text-slate-700 pb-1">{d}</div>
                ))}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const amt = days[day]
                  return (
                    <div
                      key={day}
                      title={amt ? `Dia ${day}: ${fmtCurrency(amt)}` : `Dia ${day}: sem despesas`}
                      className={`aspect-square rounded-sm ${getColor(amt)} transition-all hover:ring-1 hover:ring-violet-400/50 cursor-default`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <span>Menos</span>
        {['bg-white/[0.03]', 'bg-violet-500/20', 'bg-violet-500/40', 'bg-violet-500/70', 'bg-violet-500'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  )
}

// ── Top 10 maiores despesas ──────────────────────────────────────────────

function TopTransactions({ data }) {
  return (
    <div className="card">
      <h3 className="section-title">
        <span>🏆</span>
        Top 10 maiores despesas
      </h3>
      <div className="space-y-2">
        {data.topExpenses.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3 py-1.5">
            <span className="text-xs text-slate-600 w-5 text-right flex-shrink-0">{i + 1}</span>
            <span className="text-xl flex-shrink-0">{t.category.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{t.description}</p>
              <p className="text-xs text-slate-600">
                {t.date.toLocaleDateString('pt-PT')} · {t.category.name}
              </p>
            </div>
            <span className="text-sm font-bold text-red-400 tabular-nums flex-shrink-0">
              {fmtCurrency(Math.abs(t.amount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────

export default function Charts({ data }) {
  return (
    <div>
      <h2 className="section-title">
        <span>📊</span>
        Análise detalhada
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <DonutChart data={data} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <WeekdayChart data={data} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <BalanceChart data={data} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <MonthlyHeatmap data={data} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <TopTransactions data={data} />
        </motion.div>
      </div>
    </div>
  )
}
