import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, Zap, Shield, Eye, Clock, ChevronRight } from 'lucide-react'

export default function UploadZone({ onFile, onDemo, loading }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback((file) => {
    setError(null)
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'ofx', 'qfx', 'xls', 'xlsx'].includes(ext)) {
      setError('Formato não suportado. Usa CSV, OFX ou QFX.')
      return
    }
    onFile(file)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const banks = [
    'Millennium BCP', 'CGD', 'Novobanco', 'Santander',
    'ActivoBank', 'BPI', 'Revolut', 'N26',
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Glow orbs de fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-3xl"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6"
          >
            <Zap size={14} />
            100% privado · tudo corre no teu browser
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
            Descobre para onde{' '}
            <span className="text-gradient">foge o teu dinheiro</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
            Carrega o extrato do teu banco em CSV ou OFX e descobre insights
            financeiros que o banco não te conta.
          </p>
        </div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl p-10 text-center transition-all duration-300 ${
            dragging
              ? 'bg-violet-500/15 border-2 border-violet-500 scale-[1.01]'
              : 'bg-white/[0.03] border-2 border-dashed border-white/20 hover:border-violet-500/50 hover:bg-white/[0.05]'
          }`}
        >
          {/* Animated border gradient when dragging */}
          {dragging && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 animated-border opacity-30 blur-sm" />
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.ofx,.qfx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-slate-300 font-medium">A analisar o teu extrato…</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                  dragging ? 'bg-violet-500/30' : 'bg-white/[0.06]'
                }`}>
                  <Upload size={28} className={dragging ? 'text-violet-300' : 'text-slate-400'} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-200 mb-1">
                    {dragging ? 'Larga para analisar' : 'Arrasta o extrato aqui'}
                  </p>
                  <p className="text-sm text-slate-500">
                    CSV, OFX ou QFX · ou clica para escolher ficheiro
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 text-center text-red-400 text-sm"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Demo button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <button
            onClick={onDemo}
            className="group inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            <FileText size={16} />
            Ver demo com dados de exemplo (João Silva, Lisboa)
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Supported banks */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-xs text-slate-600 uppercase tracking-widest mb-4">Bancos suportados</p>
          <div className="flex flex-wrap justify-center gap-2">
            {banks.map((b) => (
              <span key={b} className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs">
                {b}
              </span>
            ))}
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-500 text-xs">
              + qualquer CSV genérico
            </span>
          </div>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-slate-600"
        >
          <span className="flex items-center gap-1.5">
            <Shield size={13} className="text-emerald-600" /> Os teus dados nunca saem do browser
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={13} className="text-emerald-600" /> Sem conta, sem tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-emerald-600" /> Análise em segundos
          </span>
        </motion.div>
      </motion.div>
    </div>
  )
}
