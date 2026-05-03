import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Scale, Tag } from 'lucide-react'
import { fmtCurrency, fmtDate } from '../utils/format.js'

function AnimatedNumber({ target, prefix = '', suffix = '', duration = 1400, className = '' }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    startRef.current = null
    const start = 0
    const end = Math.abs(target)

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out expo
      const ease = 1 - Math.pow(2, -10 * progress)
      setDisplay(start + (end - start) * ease)
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  const fmt = (v) =>
    new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(v)

  return (
    <span className={`count-up tabular-nums ${className}`}>
      {prefix}{fmt(display)}{suffix}
    </span>
  )
}

function Card({ icon: Icon, iconBg, label, value, sub, trend, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="card flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend === 'up'
              ? 'bg-emerald-500/10 text-emerald-400'
              : trend === 'down'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-slate-500/10 text-slate-400'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '='} {sub}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
        <div className="stat-num text-2xl font-bold">{value}</div>
      </div>
    </motion.div>
  )
}

export default function ImpactCards({ data }) {
  const { totalIncome, totalExpenses, netBalance, expensesByCategory, period } = data
  const topCat = expensesByCategory[0]

  const cards = [
    {
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      label: 'Total recebido',
      value: <AnimatedNumber target={totalIncome} />,
      sub: `${period.months.toFixed(1)} meses`,
      trend: 'up',
      delay: 0.1,
    },
    {
      icon: TrendingDown,
      iconBg: 'bg-red-500/15 text-red-400',
      label: 'Total gasto',
      value: <AnimatedNumber target={totalExpenses} />,
      sub: `${fmtCurrency(totalExpenses / period.months)}/mês`,
      trend: 'down',
      delay: 0.2,
    },
    {
      icon: Scale,
      iconBg: netBalance >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
      label: 'Saldo do período',
      value: (
        <span className={netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {netBalance >= 0 ? '+' : ''}
          <AnimatedNumber target={netBalance} className={netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        </span>
      ),
      sub: netBalance >= 0 ? 'positivo' : 'negativo',
      trend: netBalance >= 0 ? 'up' : 'down',
      delay: 0.3,
    },
    {
      icon: Tag,
      iconBg: topCat ? `bg-[${topCat.color}]/15` : 'bg-violet-500/15 text-violet-400',
      label: 'Maior categoria',
      value: topCat ? (
        <span className="flex items-center gap-2">
          <span className="text-2xl">{topCat.icon}</span>
          <span className="text-xl">{topCat.name}</span>
        </span>
      ) : '—',
      sub: topCat ? `${topCat.percentage.toFixed(1)}% do total` : '',
      trend: null,
      delay: 0.4,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">
          <span className="text-violet-400">⚡</span>
          Resumo do período
        </h2>
        <span className="text-xs text-slate-500">
          {fmtDate(period.start)} – {fmtDate(period.end)}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <Card key={i} {...c} />
        ))}
      </div>
    </div>
  )
}
