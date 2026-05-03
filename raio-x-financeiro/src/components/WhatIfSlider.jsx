import { useState } from 'react'
import { motion } from 'framer-motion'
import { cutImpact } from '../utils/finance.js'
import { fmtCurrency } from '../utils/format.js'

export default function WhatIfSlider({ topCategory, months }) {
  const [cut, setCut] = useState(20)

  if (!topCategory) return null

  const monthlySpend = topCategory.total / months
  const extraMonthly = monthlySpend * (cut / 100)
  const gain30y = cutImpact(monthlySpend, cut, 30)
  const gain10y = cutImpact(monthlySpend, cut, 10)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass p-6 rounded-2xl border border-violet-500/20"
    >
      <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
        <span>🔧</span>
        E se cortasses em {topCategory.icon} {topCategory.name}?
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        Atualmente gastas {fmtCurrency(monthlySpend)}/mês nesta categoria.
      </p>

      {/* Slider */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Corte de:</span>
          <span className="font-bold text-violet-300">{cut}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={80}
          step={5}
          value={cut}
          onChange={(e) => setCut(+e.target.value)}
          className="w-full accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>5%</span>
          <span>80%</span>
        </div>
      </div>

      {/* Result */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="glass p-4 rounded-xl text-center">
          <p className="text-xs text-slate-500 mb-1">Poupança extra/mês</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{fmtCurrency(extraMonthly)}</p>
        </div>
        <div className="glass p-4 rounded-xl text-center">
          <p className="text-xs text-slate-500 mb-1">Impacto em 10 anos</p>
          <p className="text-xl font-bold text-violet-400 tabular-nums">{fmtCurrency(gain10y)}</p>
        </div>
      </div>

      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <p className="text-sm text-amber-300 text-center font-medium">
          🚀 Em 30 anos terias mais <strong className="tabular-nums">{fmtCurrency(gain30y)}</strong> na reforma
        </p>
      </div>
      <p className="text-xs text-slate-600 mt-2 text-center">
        Projeção com ETF moderado ~5% líquido/ano (após IRS 28%)
      </p>
    </motion.div>
  )
}
