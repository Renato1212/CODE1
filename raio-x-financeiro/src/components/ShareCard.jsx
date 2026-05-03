import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, Download } from 'lucide-react'
import { generateInsights } from '../utils/insights.js'
import { fmtCurrency } from '../utils/format.js'

export default function ShareCard({ data }) {
  const [open, setOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const cardRef = useRef(null)

  const insights = generateInsights(data)
  const top = insights[0]
  const { totalExpenses, monthlyAvgSavings, expensesByCategory, period } = data
  const topCat = expensesByCategory[0]

  const handleCapture = async () => {
    if (!cardRef.current) return
    setCapturing(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = 'raio-x-financeiro.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      alert('Erro ao gerar imagem. Tenta usar a função de screenshot do browser.')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost flex items-center gap-2 text-sm no-print"
      >
        <Camera size={16} />
        Partilhar resultado
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm"
            >
              {/* Shareable card - portrait 9:16 ish */}
              <div
                ref={cardRef}
                className="relative overflow-hidden rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1040 50%, #0f0f1a 100%)',
                  aspectRatio: '9/16',
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Glow */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.25), transparent)',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
                    <span style={{ fontSize: 20 }}>💰</span>
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Raio-X Financeiro
                    </span>
                  </div>

                  {top && (
                    <div style={{
                      background: 'rgba(124,58,237,0.15)',
                      border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: 16,
                      padding: '20px',
                      marginBottom: 24,
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>{top.emoji}</div>
                      <p style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
                        {top.text}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Total gasto', value: fmtCurrency(totalExpenses), color: '#f87171' },
                      {
                        label: 'Poupança/mês',
                        value: fmtCurrency(monthlyAvgSavings),
                        color: monthlyAvgSavings >= 0 ? '#4ade80' : '#f87171',
                      },
                      { label: 'Maior categoria', value: topCat ? (topCat.icon + ' ' + topCat.name) : '—', color: '#c084fc' },
                      { label: 'Período', value: `${period.months.toFixed(0)} meses`, color: '#60a5fa' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12,
                          padding: '14px',
                        }}
                      >
                        <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          {stat.label}
                        </p>
                        <p style={{ color: stat.color, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <p style={{ color: '#334155', fontSize: 11 }}>
                    Análise gerada com Raio-X Financeiro · 100% privado
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {capturing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {capturing ? 'A guardar…' : 'Guardar imagem'}
                </button>
                <button onClick={() => setOpen(false)} className="btn-ghost !px-3">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-600 text-center mt-2">
                Sem dados pessoais · partilha à vontade
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
