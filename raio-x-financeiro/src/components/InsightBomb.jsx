import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Share2, Camera } from 'lucide-react'
import { generateInsights } from '../utils/insights.js'

const TYPE_STYLES = {
  warning: 'from-orange-600/20 via-orange-500/10 to-transparent border-orange-500/30',
  danger:  'from-red-600/20 via-red-500/10 to-transparent border-red-500/30',
  info:    'from-violet-600/20 via-violet-500/10 to-transparent border-violet-500/30',
  funny:   'from-amber-600/20 via-amber-500/10 to-transparent border-amber-500/30',
}

function PizzaEasterEgg() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute -right-4 -top-4 text-4xl animate-float select-none pointer-events-none"
    >
      🍕
    </motion.div>
  )
}

export default function InsightBomb({ data, shareRef }) {
  const insights = generateInsights(data)
  const [idx, setIdx] = useState(0)
  const [showAll, setShowAll] = useState(false)

  if (!insights.length) return null

  const current = insights[idx]
  const hasPizza = current?.easterEgg

  const prev = () => setIdx((i) => (i - 1 + insights.length) % insights.length)
  const next = () => setIdx((i) => (i + 1) % insights.length)

  return (
    <div>
      <h2 className="section-title">
        <span>💣</span>
        Insight bomba
      </h2>

      {/* Main insight card */}
      <div ref={shareRef} className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-br border ${
              TYPE_STYLES[current.type] || TYPE_STYLES.info
            }`}
          >
            {/* Glow bg */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />

            {hasPizza && <PizzaEasterEgg />}

            <div className="relative flex items-start gap-5">
              <span className="text-4xl flex-shrink-0 mt-1">{current.emoji}</span>
              <div>
                <p className="text-white text-lg md:text-xl font-semibold leading-snug">
                  {current.text}
                </p>
                {hasPizza && (
                  <p className="mt-2 text-orange-300 text-sm font-medium">
                    Estás a alimentar mais o Uber Eats do que a tua poupança 😅
                  </p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center gap-3">
              <button onClick={prev} className="btn-ghost !px-2 !py-2">
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1.5">
                {insights.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/30'
                    }`}
                  />
                ))}
              </div>
              <button onClick={next} className="btn-ghost !px-2 !py-2">
                <ChevronRight size={16} />
              </button>
              <span className="ml-auto text-xs text-white/40">
                {idx + 1} / {insights.length}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* All insights list */}
      <div className="mt-3">
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          {showAll ? '▲ Ocultar insights' : `▼ Ver todos os ${insights.length} insights`}
        </button>

        <AnimatePresence>
          {showAll && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                {insights.map((ins, i) => (
                  <button
                    key={ins.id}
                    onClick={() => { setIdx(i); setShowAll(false) }}
                    className={`w-full text-left glass p-4 rounded-xl hover:bg-white/[0.07] transition-colors flex items-start gap-3 ${
                      i === idx ? 'border-violet-500/40' : ''
                    }`}
                  >
                    <span className="text-xl">{ins.emoji}</span>
                    <p className="text-sm text-slate-300 leading-relaxed">{ins.text}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
