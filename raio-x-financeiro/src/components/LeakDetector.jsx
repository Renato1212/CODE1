import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { fmtCurrency, fmtDate } from '../utils/format.js'

const TYPE_LABELS = {
  subscription: { label: 'Subscrição recorrente', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  fee:          { label: 'Comissão bancária',      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  small_frequent: { label: 'Pequenas compras frequentes', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  duplicate:    { label: 'Possível duplicado',      color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20' },
}

function LeakCard({ leak, index }) {
  const [expanded, setExpanded] = useState(false)
  const style = TYPE_LABELS[leak.type] || TYPE_LABELS.fee

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className={`rounded-2xl border p-4 ${style.bg}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{leak.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-200 text-sm truncate">{leak.title}</p>
              <p className={`text-xs mt-0.5 ${style.color}`}>{style.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{leak.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-white tabular-nums">
                {fmtCurrency(leak.monthlyImpact)}<span className="text-slate-500 font-normal">/mês</span>
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {fmtCurrency(leak.annualImpact)}/ano
              </p>
            </div>
          </div>

          {leak.transactions.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Ocultar' : `Ver ${leak.transactions.length} transação(ões)`}
            </button>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {leak.transactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex justify-between text-xs text-slate-500 py-0.5 border-b border-white/5">
                      <span className="truncate flex-1 mr-2">{t.description}</span>
                      <span className="tabular-nums">{fmtDate(t.date)}</span>
                      <span className="tabular-nums ml-2 text-red-400">{fmtCurrency(Math.abs(t.amount))}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

export default function LeakDetector({ data }) {
  const { leaks } = data
  const totalAnnual = leaks.reduce((s, l) => s + l.annualImpact, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">
          <span>🕳️</span>
          Fugas detetadas
        </h2>
        {totalAnnual > 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Impacto anual total</p>
            <p className="text-lg font-bold text-red-400 tabular-nums">{fmtCurrency(totalAnnual)}</p>
          </div>
        )}
      </div>

      {leaks.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-slate-300 font-semibold">Parabéns! Não foram detetadas fugas significativas.</p>
          <p className="text-slate-500 text-sm mt-1">O teu extrato parece bem controlado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaks.map((leak, i) => (
            <LeakCard key={`${leak.type}-${i}`} leak={leak} index={i} />
          ))}
        </div>
      )}

      {leaks.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20"
        >
          <p className="text-sm text-violet-300">
            💡 Se eliminares estas fugas, poupas{' '}
            <strong className="tabular-nums">{fmtCurrency(totalAnnual)}</strong>/ano —
            investido com retorno moderado durante 20 anos resultaria em{' '}
            <strong className="tabular-nums">
              {fmtCurrency(
                (totalAnnual / 12) *
                  (((1 + 0.05 / 12) ** (20 * 12) - 1) / (0.05 / 12))
              )}
            </strong>.
          </p>
        </motion.div>
      )}
    </div>
  )
}
