import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { projectAll, SCENARIOS } from '../utils/finance.js'
import { fmtCurrency, fmtCurrencyShort } from '../utils/format.js'
import WhatIfSlider from './WhatIfSlider.jsx'

const HORIZON_LABELS = { 10: '10 anos', 20: '20 anos', 30: '30 anos' }

function ScenarioCard({ scenario, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass p-5 rounded-2xl"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{scenario.icon}</span>
        <div>
          <p className="font-semibold text-slate-200">{scenario.label}</p>
          <p className="text-xs text-slate-500">{scenario.description}</p>
        </div>
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: scenario.color }}>
        {fmtCurrency(value)}
      </p>
      <p className="text-xs text-slate-600 mt-1">
        {(scenario.grossRate * 100).toFixed(1)}% bruto/ano →{' '}
        {(scenario.grossRate * 0.72 * 100).toFixed(1)}% líquido (IRS 28%)
      </p>
    </motion.div>
  )
}

export default function WealthProjection({ data }) {
  const [horizon, setHorizon] = useState(30)
  const { monthlyAvgSavings, expensesByCategory, period } = data

  const pmt = Math.max(0, monthlyAvgSavings)
  const projection = projectAll(pmt, 35)

  const chartData = projection
    .filter((r) => r.year % 2 === 0 || r.year === 1 || r.year === 35)
    .map((r) => ({ ...r, year: `${r.year}a` }))

  const values30 = projection.find((r) => r.year === 30) || {}
  const topCat = expensesByCategory.find((c) => c.id !== 'income')

  if (pmt <= 0) {
    return (
      <div>
        <h2 className="section-title"><span>🚀</span> Projeção de património</h2>
        <div className="card text-center py-10">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-lg font-semibold text-slate-300 mb-2">
            As despesas superam os rendimentos
          </p>
          <p className="text-slate-500 max-w-sm mx-auto">
            Para construir poupança precisas de um excedente mensal positivo.
            Usa a secção "Fugas detetadas" abaixo para identificar onde poupar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title"><span>🚀</span> Projeção de património</h2>

      {/* Poupança mensal */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
      >
        <span className="text-3xl">💚</span>
        <div>
          <p className="font-semibold text-emerald-300">
            Poupas em média {fmtCurrency(pmt)}/mês
          </p>
          <p className="text-sm text-emerald-600">
            Se investires consistentemente, eis o que o tempo e os juros compostos podem fazer
          </p>
        </div>
      </motion.div>

      {/* Horizon picker */}
      <div className="flex gap-2 mb-6">
        {Object.entries(HORIZON_LABELS).map(([y, label]) => (
          <button
            key={y}
            onClick={() => setHorizon(+y)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              horizon === +y
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'btn-ghost'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {SCENARIOS.map((s, i) => {
          const row = projection.find((r) => r.year === horizon)
          return (
            <ScenarioCard
              key={s.id}
              scenario={s}
              value={row?.[s.id] || 0}
              delay={i * 0.1}
            />
          )
        })}
      </div>

      {/* Chart */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">
          <span>📈</span>
          Crescimento ao longo do tempo
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtCurrencyShort(v)}
            />
            <Tooltip
              formatter={(v, name) => {
                const s = SCENARIOS.find((x) => x.id === name)
                return [fmtCurrency(v), s?.label || name]
              }}
              labelFormatter={(l) => `Ano ${l}`}
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend
              formatter={(v) => {
                const s = SCENARIOS.find((x) => x.id === v)
                return <span style={{ color: '#94a3b8', fontSize: 12 }}>{s?.label}</span>
              }}
            />
            {SCENARIOS.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* What-if slider */}
      <WhatIfSlider topCategory={topCat} months={period.months} />

      {/* Legal note */}
      <p className="mt-4 text-xs text-slate-700 text-center">
        * Valores ilustrativos. Considera IRS de 28% sobre rendimentos de capitais (taxa liberatória PT 2026).
        Rentabilidades passadas não garantem rentabilidades futuras. Não constitui aconselhamento financeiro.
      </p>
    </div>
  )
}
