import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import UploadZone from './components/UploadZone.jsx'
import Dashboard from './components/Dashboard.jsx'
import { parseFile, analyzeTransactions } from './utils/parsers.js'
import { SAMPLE_TRANSACTIONS, SAMPLE_OWNER } from './data/sample-data.js'

const SCREENS = {
  UPLOAD: 'upload',
  ANALYZING: 'analyzing',
  DASHBOARD: 'dashboard',
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.UPLOAD)
  const [data, setData] = useState(null)
  const [bankName, setBankName] = useState(null)
  const [error, setError] = useState(null)

  const processTransactions = useCallback((transactions, bank) => {
    const analyzed = analyzeTransactions(transactions)
    if (!analyzed) {
      setError('Não foram encontradas transações válidas.')
      setScreen(SCREENS.UPLOAD)
      return
    }
    setData(analyzed)
    setBankName(bank)
    setScreen(SCREENS.DASHBOARD)
  }, [])

  const handleFile = useCallback(async (file) => {
    setError(null)
    setScreen(SCREENS.ANALYZING)
    try {
      const { transactions, bankName: bank } = await parseFile(file)
      processTransactions(transactions, bank)
    } catch (err) {
      setError(err.message)
      setScreen(SCREENS.UPLOAD)
    }
  }, [processTransactions])

  const handleDemo = useCallback(() => {
    setScreen(SCREENS.ANALYZING)
    // Small delay to show the loading state
    setTimeout(() => {
      processTransactions(SAMPLE_TRANSACTIONS, SAMPLE_OWNER.bank)
    }, 600)
  }, [processTransactions])

  const handleReset = useCallback(() => {
    setData(null)
    setBankName(null)
    setError(null)
    setScreen(SCREENS.UPLOAD)
  }, [])

  return (
    <AnimatePresence mode="wait">
      {screen === SCREENS.UPLOAD && (
        <motion.div
          key="upload"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          <UploadZone
            onFile={handleFile}
            onDemo={handleDemo}
            loading={false}
            error={error}
          />
        </motion.div>
      )}

      {screen === SCREENS.ANALYZING && (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex flex-col items-center justify-center gap-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent"
          />
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-200">A analisar o teu extrato…</p>
            <p className="text-sm text-slate-500 mt-1">Categorização inteligente em curso</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 0.2, 0.4].map((d, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                className="w-2 h-2 rounded-full bg-violet-500"
              />
            ))}
          </div>
        </motion.div>
      )}

      {screen === SCREENS.DASHBOARD && data && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Dashboard data={data} bankName={bankName} onReset={handleReset} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
