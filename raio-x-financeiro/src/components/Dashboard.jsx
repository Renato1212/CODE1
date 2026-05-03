import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Printer, Shield } from 'lucide-react'
import ImpactCards from './ImpactCards.jsx'
import InsightBomb from './InsightBomb.jsx'
import Charts from './Charts.jsx'
import WealthProjection from './WealthProjection.jsx'
import LeakDetector from './LeakDetector.jsx'
import ShareCard from './ShareCard.jsx'
import { fmtDate } from '../utils/format.js'

const sectionVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

function Section({ children, delay = 0 }) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  )
}

export default function Dashboard({ data, bankName, onReset }) {
  const shareRef = useRef(null)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/[0.06] no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="btn-ghost !px-3 !py-2 flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft size={15} />
              Novo extrato
            </button>
            <div className="h-5 w-px bg-white/10" />
            <div>
              <span className="text-sm font-semibold text-slate-200">Raio-X Financeiro</span>
              {bankName && (
                <span className="ml-2 text-xs text-slate-500">{bankName}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600">
              <Shield size={12} className="text-emerald-600" />
              Dados locais
            </span>
            <ShareCard data={data} shareRef={shareRef} />
            <button
              onClick={() => window.print()}
              className="btn-ghost flex items-center gap-1.5 text-sm no-print"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {/* 1. Impact cards */}
        <Section delay={0}>
          <ImpactCards data={data} />
        </Section>

        {/* 2. Insight bomb */}
        <Section delay={0.1}>
          <InsightBomb data={data} shareRef={shareRef} />
        </Section>

        {/* 3. Charts */}
        <Section delay={0.2}>
          <Charts data={data} />
        </Section>

        {/* 4. Wealth projection */}
        <Section delay={0.3}>
          <WealthProjection data={data} />
        </Section>

        {/* 5. Leak detector */}
        <Section delay={0.4}>
          <LeakDetector data={data} />
        </Section>

        {/* Footer */}
        <footer className="pb-6 text-center text-xs text-slate-700 no-print">
          <p>
            Raio-X Financeiro · Análise 100% local ·{' '}
            {fmtDate(data.period.start)} – {fmtDate(data.period.end)} ·{' '}
            {data.transactions.length} transações processadas
          </p>
        </footer>
      </main>
    </div>
  )
}
