import Papa from 'papaparse'
import { categorize } from './categorizer.js'

// ── Helpers ────────────────────────────────────────────────────────────────

let _nextId = 1
const uid = () => String(_nextId++)

/** Remove BOM + extra whitespace */
const clean = (s) => s.replace(/^﻿/, '').trim()

/** Normalize header string */
const normHeader = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Parse PT/BR amount: "1.234,56" or "1,234.56" or "-50,00" */
function parseAmount(raw) {
  if (!raw) return NaN
  let s = String(raw).trim().replace(/\s/g, '')
  // Remove currency symbols
  s = s.replace(/[€$£]/g, '')
  if (!s || s === '-' || s === '') return NaN

  const hasCommaDecimal = /,\d{1,2}$/.test(s)
  const hasDotDecimal = /\.\d{1,2}$/.test(s)

  if (hasCommaDecimal) {
    // PT format: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasDotDecimal) {
    // EN format: 1,234.56
    s = s.replace(/,/g, '')
  } else {
    // Could be integer or "1.234" (thousands in PT) — treat comma as decimal separator
    s = s.replace(/\./g, '').replace(',', '.')
  }
  return parseFloat(s)
}

/** Parse date from common formats */
function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()

  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])

  // YYYY-MM-DD (ISO)
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])

  // YYYYMMDD (OFX)
  m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])

  // DD.MM.YYYY
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])

  const d = new Date(s)
  return isNaN(d) ? null : d
}

// ── Bank format definitions ────────────────────────────────────────────────

const FORMATS = [
  {
    name: 'Millennium BCP',
    detect: (h) => h.some((x) => x.includes('data movimento')) && h.some((x) => x.includes('saldo')),
    map: (row) => ({
      date: row['Data movimento'] || row['data movimento'],
      desc: row['Descrição'] || row['descricao'] || row['Descricao'],
      amount: row['Valor'] || row['valor'],
      balance: row['Saldo'] || row['saldo'],
    }),
  },
  {
    name: 'Caixa Geral de Depósitos',
    detect: (h) => h.some((x) => x.includes('data mov')) && h.some((x) => x.includes('debito')),
    map: (row) => {
      const debit = parseAmount(row['Débito'] || row['Debito'] || row['débito'] || '')
      const credit = parseAmount(row['Crédito'] || row['Credito'] || row['crédito'] || '')
      const amount = !isNaN(credit) && credit !== 0 ? credit : (!isNaN(debit) && debit !== 0 ? -debit : NaN)
      return {
        date: row['Data Mov.'] || row['Data mov.'] || row['data mov.'],
        desc: row['Descrição'] || row['Descricao'],
        rawAmount: amount,
        balance: row['Saldo'],
      }
    },
    debitCredit: true,
  },
  {
    name: 'Novobanco',
    detect: (h) => h.some((x) => x.includes('data lanc')) || h.some((x) => x.includes('descritivo')),
    map: (row) => ({
      date: row['Data Lanç.'] || row['Data Lanc.'] || row['data lanç.'],
      desc: row['Descritivo'] || row['descritivo'],
      amount: row['Montante'] || row['montante'],
      balance: row['Saldo'] || row['saldo'],
    }),
  },
  {
    name: 'Santander',
    detect: (h) => h.some((x) => x.includes('data operacao') || x.includes('data operação')),
    map: (row) => ({
      date: row['Data Operação'] || row['Data Operacao'] || row['data operação'],
      desc: row['Descrição'] || row['Descricao'],
      amount: row['Valor'] || row['valor'],
      balance: row['Saldo'],
    }),
  },
  {
    name: 'ActivoBank',
    detect: (h) => h.some((x) => x.includes('activobank') || x.includes('activo')),
    map: (row) => ({
      date: row['Data'] || row['data'],
      desc: row['Descrição'] || row['Descricao'],
      amount: row['Valor'] || row['valor'],
      balance: row['Saldo'],
    }),
  },
  {
    name: 'BPI',
    detect: (h) => h.some((x) => x.includes('data mov') && !x.includes('movim')),
    map: (row) => ({
      date: row['Data Mov'] || row['Data mov'] || row['data mov'],
      desc: row['Descrição'] || row['Descricao'],
      amount: row['Valor'] || row['valor'],
      balance: row['Saldo'],
    }),
  },
  {
    name: 'Revolut',
    detect: (h) => h.some((x) => x.includes('started date')) && h.some((x) => x.includes('currency')),
    map: (row) => ({
      date: row['Started Date'] || row['Completed Date'],
      desc: row['Description'] || row['description'],
      amount: row['Amount'] || row['amount'],
      balance: null,
    }),
  },
  {
    name: 'N26',
    detect: (h) => h.some((x) => x.includes('payee')) && h.some((x) => x.includes('transaction type')),
    map: (row) => ({
      date: row['Date'] || row['date'],
      desc: row['Payee'] || row['payee'] || row['Payment reference'] || '',
      amount: row['Amount (EUR)'] || row['Amount'] || row['amount'],
      balance: null,
    }),
  },
  {
    name: 'Genérico',
    detect: () => true,
    map: (row, headers) => {
      const dateCol = headers.find((h) => h.toLowerCase().includes('data') || h.toLowerCase() === 'date')
      const descCol = headers.find((h) =>
        ['descrição', 'descricao', 'descritivo', 'description', 'memo', 'referencia'].some((k) =>
          h.toLowerCase().includes(k)
        )
      )
      const amountCol = headers.find((h) =>
        ['valor', 'montante', 'amount', 'importe'].some((k) => h.toLowerCase().includes(k))
      )
      return {
        date: dateCol ? row[dateCol] : null,
        desc: descCol ? row[descCol] : Object.values(row)[1] || '',
        amount: amountCol ? row[amountCol] : null,
        balance: null,
      }
    },
  },
]

// ── CSV parser ─────────────────────────────────────────────────────────────

function buildTransaction(mapped, formatDef) {
  const date = parseDate(mapped.date)
  if (!date || isNaN(date)) return null

  const desc = String(mapped.desc || '').trim()
  if (!desc) return null

  const amount =
    mapped.rawAmount !== undefined
      ? mapped.rawAmount
      : parseAmount(mapped.amount)
  if (isNaN(amount)) return null

  const balance = mapped.balance != null ? parseAmount(mapped.balance) : null

  const cat = categorize(desc, amount)

  return {
    id: uid(),
    date,
    description: desc,
    amount: Math.round(amount * 100) / 100,
    balance: isNaN(balance) ? null : Math.round(balance * 100) / 100,
    category: cat,
    source: formatDef.name,
  }
}

export function parseCSV(fileContent) {
  const text = clean(fileContent)

  // Detect separator
  const firstLine = text.split('\n')[0]
  const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ','

  const result = Papa.parse(text, {
    header: true,
    separator: sep,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (!result.data || result.data.length === 0) {
    throw new Error('Ficheiro CSV vazio ou inválido.')
  }

  const headers = Object.keys(result.data[0]).map(normHeader)

  // Detect format (skip 'Genérico' until last)
  const nonGeneric = FORMATS.filter((f) => f.name !== 'Genérico')
  const detected = nonGeneric.find((f) => f.detect(headers)) || FORMATS[FORMATS.length - 1]

  const allHeaders = Object.keys(result.data[0])

  const transactions = result.data
    .map((row) => {
      const mapped = detected.map(row, allHeaders)
      return buildTransaction(mapped, detected)
    })
    .filter(Boolean)

  if (transactions.length === 0) {
    throw new Error('Não foi possível extrair transações do ficheiro. Verifica se o formato é suportado.')
  }

  return { transactions, bankName: detected.name }
}

// ── OFX parser ─────────────────────────────────────────────────────────────

export function parseOFX(fileContent) {
  const text = clean(fileContent)

  const getTag = (xml, tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)`, 'i'))
    return m ? m[1].trim() : null
  }

  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  const transactions = []
  let match

  while ((match = stmtTrnRegex.exec(text)) !== null) {
    const block = match[1]
    const dateRaw = getTag(block, 'DTPOSTED') || getTag(block, 'DTUSER')
    const amountRaw = getTag(block, 'TRNAMT')
    const memo = getTag(block, 'MEMO') || getTag(block, 'NAME') || ''

    const date = parseDate(dateRaw)
    const amount = parseFloat(amountRaw)

    if (!date || isNaN(amount)) continue

    const cat = categorize(memo, amount)
    transactions.push({
      id: uid(),
      date,
      description: memo,
      amount: Math.round(amount * 100) / 100,
      balance: null,
      category: cat,
      source: 'OFX',
    })
  }

  if (transactions.length === 0) {
    throw new Error('Não foi possível extrair transações do ficheiro OFX.')
  }

  return { transactions, bankName: 'OFX/QFX' }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        const ext = file.name.split('.').pop().toLowerCase()
        let result
        if (ext === 'ofx' || ext === 'qfx') {
          result = parseOFX(content)
        } else {
          result = parseCSV(content)
        }
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'))
    reader.readAsText(file, 'utf-8')
  })
}

// ── Analyze transactions into summary data ─────────────────────────────────

export function analyzeTransactions(transactions) {
  if (!transactions.length) return null

  const sorted = [...transactions].sort((a, b) => a.date - b.date)
  const start = sorted[0].date
  const end = sorted[sorted.length - 1].date
  const diffDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24))
  const months = Math.max(1, diffDays / 30.44)

  let totalIncome = 0
  let totalExpenses = 0
  const byCategory = {}
  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  const dailyMap = {}

  for (const t of sorted) {
    const { amount, category, date } = t
    if (amount > 0) {
      totalIncome += amount
    } else {
      totalExpenses += Math.abs(amount)
      byWeekday[date.getDay()] += Math.abs(amount)
    }

    // By category
    const cid = category.id
    if (!byCategory[cid]) {
      byCategory[cid] = {
        ...category,
        total: 0,
        count: 0,
        transactions: [],
      }
    }
    byCategory[cid].total += amount > 0 ? amount : Math.abs(amount)
    byCategory[cid].count += 1
    byCategory[cid].transactions.push(t)

    // Daily
    const dKey = date.toISOString().slice(0, 10)
    if (!dailyMap[dKey]) dailyMap[dKey] = { income: 0, expenses: 0 }
    if (amount > 0) dailyMap[dKey].income += amount
    else dailyMap[dKey].expenses += Math.abs(amount)
  }

  // Add percentage to categories
  const expenseCats = Object.values(byCategory).filter(
    (c) => !['income', 'transfers_out'].includes(c.id)
  )
  expenseCats.forEach((c) => {
    c.percentage = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
  })

  // Daily balances (running)
  const dailyBalances = []
  let runBalance = sorted[0].balance != null
    ? sorted[0].balance - sorted[0].amount
    : 0
  const allDays = Object.keys(dailyMap).sort()
  for (const day of allDays) {
    runBalance += dailyMap[day].income - dailyMap[day].expenses
    dailyBalances.push({ date: day, balance: Math.round(runBalance * 100) / 100 })
  }

  // Top 10 expenses
  const topExpenses = sorted
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10)

  // Leak detection
  const leaks = detectLeaks(sorted, months)

  const monthlyAvgIncome = totalIncome / months
  const monthlyAvgExpenses = totalExpenses / months
  const monthlyAvgSavings = monthlyAvgIncome - monthlyAvgExpenses

  return {
    transactions: sorted,
    period: { start, end, months },
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    byCategory,
    expensesByCategory: expenseCats.sort((a, b) => b.total - a.total),
    byWeekday,
    dailyBalances,
    topExpenses,
    leaks,
    monthlyAvgIncome,
    monthlyAvgExpenses,
    monthlyAvgSavings,
  }
}

function detectLeaks(transactions, months) {
  const leaks = []

  // 1. Recurring subscriptions (same desc + similar amount, ≥2 occurrences)
  const descGroups = {}
  for (const t of transactions) {
    if (t.amount >= 0) continue
    const key = t.description.toLowerCase().slice(0, 30)
    if (!descGroups[key]) descGroups[key] = []
    descGroups[key].push(t)
  }
  for (const [, txs] of Object.entries(descGroups)) {
    if (txs.length < 2) continue
    const amounts = txs.map((t) => Math.abs(t.amount))
    const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const allSimilar = amounts.every((a) => Math.abs(a - avgAmt) < 2)
    if (allSimilar && avgAmt > 3) {
      const monthly = avgAmt
      leaks.push({
        type: 'subscription',
        title: txs[0].description.slice(0, 40),
        description: `${txs.length}× cobrado${txs.length > 1 ? 's' : ''} — ${txs[0].category.icon} ${txs[0].category.name}`,
        monthlyImpact: monthly,
        annualImpact: monthly * 12,
        icon: txs[0].category.icon,
        transactions: txs,
      })
    }
  }

  // 2. Bank fees
  const fees = transactions.filter((t) => t.category.id === 'fees')
  if (fees.length > 0) {
    const total = fees.reduce((s, t) => s + Math.abs(t.amount), 0)
    leaks.push({
      type: 'fee',
      title: 'Comissões e taxas bancárias',
      description: `${fees.length} cobranças detetadas`,
      monthlyImpact: total / months,
      annualImpact: (total / months) * 12,
      icon: '🏦',
      transactions: fees,
    })
  }

  // 3. Small frequent purchases (< 25€, ≥ 5 occurrences of same merchant)
  const smallByDesc = {}
  for (const t of transactions) {
    if (t.amount >= -0.5 || Math.abs(t.amount) > 25) continue
    const key = t.description.toLowerCase().slice(0, 25)
    if (!smallByDesc[key]) smallByDesc[key] = []
    smallByDesc[key].push(t)
  }
  for (const [, txs] of Object.entries(smallByDesc)) {
    if (txs.length < 4) continue
    const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0)
    const avg = total / txs.length
    leaks.push({
      type: 'small_frequent',
      title: txs[0].description.slice(0, 40),
      description: `${txs.length} compras × ${fmtCurrencyLite(avg)} = ${fmtCurrencyLite(total)}`,
      monthlyImpact: total / months,
      annualImpact: (total / months) * 12,
      icon: '☕',
      transactions: txs,
    })
  }

  // 4. Duplicate transactions (same amount, same day)
  const dayAmtMap = {}
  for (const t of transactions) {
    if (t.amount >= 0) continue
    const key = `${t.date.toISOString().slice(0, 10)}_${t.amount}`
    if (!dayAmtMap[key]) dayAmtMap[key] = []
    dayAmtMap[key].push(t)
  }
  const dupes = Object.values(dayAmtMap).filter((arr) => arr.length > 1)
  if (dupes.length > 0) {
    const dupeTotal = dupes.flat().reduce((s, t) => s + Math.abs(t.amount), 0) / 2
    leaks.push({
      type: 'duplicate',
      title: 'Possíveis transações duplicadas',
      description: `${dupes.length} par(es) com mesmo valor e data`,
      monthlyImpact: dupeTotal / months,
      annualImpact: (dupeTotal / months) * 12,
      icon: '🔁',
      transactions: dupes.flat(),
    })
  }

  // Sort by annual impact
  return leaks.sort((a, b) => b.annualImpact - a.annualImpact).slice(0, 8)
}

function fmtCurrencyLite(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}
