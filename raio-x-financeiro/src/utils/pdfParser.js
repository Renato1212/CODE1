/**
 * Parser de PDFs de extratos bancários portugueses.
 *
 * Estratégia:
 * 1. Extrai texto de cada página com PDF.js, agrupando por linha (coordenada Y)
 * 2. Reconstrói linhas ordenadas esquerda→direita
 * 3. Aplica regex para detetar datas + montantes em cada linha
 * 4. Usa heurística de variação de saldo para determinar débito vs crédito
 * 5. Categoriza cada transação
 *
 * Limitação: só funciona com PDFs com texto extraível (não imagens digitalizadas/scans).
 */

import { categorize } from './categorizer.js'

// ── Inicialização lazy do PDF.js ───────────────────────────────────────────

let _pdfjsLib = null

async function getPdfjsLib() {
  if (_pdfjsLib) return _pdfjsLib
  _pdfjsLib = await import('pdfjs-dist')

  // Worker: tenta bundle local (Vite ?url), cai para CDN se falhar
  if (!_pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const { default: workerUrl } = await import(
        /* @vite-ignore */
        'pdfjs-dist/build/pdf.worker.min.mjs?url'
      )
      _pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    } catch {
      _pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${_pdfjsLib.version}/build/pdf.worker.min.mjs`
    }
  }

  return _pdfjsLib
}

// ── Extração de texto estruturado ─────────────────────────────────────────

async function extractLines(file) {
  const pdfjsLib = await getPdfjsLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  const allLines = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Agrupa items pelo Y arredondado (tolerância 3px)
    const yMap = new Map()
    for (const item of content.items) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      const x = item.transform[4]
      if (!yMap.has(y)) yMap.set(y, [])
      yMap.get(y).push({ x, text: item.str.trim() })
    }

    // Ordena linhas de cima para baixo (Y decrescente em espaço PDF)
    const pageLines = [...yMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join(' ')
      )
      .filter((l) => l.length > 2)

    allLines.push(...pageLines)
  }

  return allLines
}

// ── Helpers de parsing ────────────────────────────────────────────────────

const DATE_RX = /(\d{2}[\/\-\.]\d{2}[\/\-\.](?:\d{4}|\d{2}))/g
// Montante em formato PT: 1.234,56 ou 1234,56 ou -1.234,56
const AMOUNT_RX = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g

function parseDate(str) {
  if (!str) return null
  const s = str.replace(/\./g, '/')
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + +m[3] : +m[3]
  const d = new Date(year, +m[2] - 1, +m[1])
  return isNaN(d) ? null : d
}

function parseAmountPT(str) {
  if (!str) return NaN
  // PT: 1.234,56  →  1234.56
  const s = str.replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s)
}

// ── Parser de transações ──────────────────────────────────────────────────

let _uid = 1
const uid = () => String(_uid++)

function parseTransactions(lines) {
  const transactions = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Deve ter pelo menos uma data e um montante
    const dates = [...line.matchAll(DATE_RX)]
    if (!dates.length) continue

    const date = parseDate(dates[0][1])
    if (!date) continue

    const rawAmounts = [...line.matchAll(AMOUNT_RX)]
    if (!rawAmounts.length) continue

    const amounts = rawAmounts.map((m) => parseAmountPT(m[0])).filter((a) => !isNaN(a))
    if (!amounts.length) continue

    // ── Extrai descrição ──────────────────────────────────────────────
    // Zona entre o fim da(s) data(s) e o primeiro montante
    const firstAmtIdx = line.search(AMOUNT_RX)
    const afterDates = line
      .slice(dates[dates.length - 1].index + dates[dates.length - 1][0].length)
    let desc = firstAmtIdx > 0
      ? line.slice(dates[dates.length - 1].index + dates[dates.length - 1][0].length, firstAmtIdx)
      : afterDates
    desc = desc.replace(DATE_RX, '').replace(/\s+/g, ' ').trim()

    // Continua na linha seguinte se não começa por data nem montante
    if (!desc && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next.match(DATE_RX) && !next.match(AMOUNT_RX) && next.length < 80) {
        desc = next.trim()
      }
    }
    if (!desc || desc.length < 2) desc = 'Transação PDF'

    // ── Determina montante e saldo ────────────────────────────────────
    let amount, balance

    if (amounts.length === 1) {
      amount = amounts[0]
      balance = null
    } else if (amounts.length === 2) {
      // Típico: montante + saldo
      amount = amounts[0]
      balance = amounts[1]
    } else {
      // 3+ valores: débito, crédito, saldo (ex: CGD, Millennium)
      const a = amounts[0]   // coluna débito
      const b = amounts[1]   // coluna crédito
      const c = amounts[amounts.length - 1]  // saldo

      if (a > 0 && b === 0) {
        amount = -a          // é débito
      } else if (b > 0 && a === 0) {
        amount = b           // é crédito
      } else if (a > 0 && b > 0) {
        // ambos não-zero — usa o menor como transação
        amount = a < b ? -a : b
      } else {
        amount = amounts[0]
      }
      balance = c
    }

    // ── Usa variação de saldo para confirmar sinal ────────────────────
    if (balance !== null && transactions.length > 0) {
      const prev = transactions[transactions.length - 1]
      if (prev.balance !== null) {
        const delta = balance - prev.balance
        if (Math.abs(delta) > 0.005 && Math.abs(Math.abs(delta) - Math.abs(amount)) < 1) {
          amount = Math.round(delta * 100) / 100
        }
      }
    }

    if (amount === 0) continue

    const cat = categorize(desc, amount)

    transactions.push({
      id: uid(),
      date,
      description: desc,
      amount: Math.round(amount * 100) / 100,
      balance: balance !== null ? Math.round(balance * 100) / 100 : null,
      category: cat,
      source: 'PDF',
    })
  }

  return transactions
}

// ── Exportação principal ──────────────────────────────────────────────────

export async function parsePDF(file) {
  let lines
  try {
    lines = await extractLines(file)
  } catch (err) {
    if (err?.message?.includes('Invalid PDF')) {
      throw new Error('Ficheiro PDF inválido ou corrompido.')
    }
    throw new Error(`Erro ao ler o PDF: ${err.message}`)
  }

  const transactions = parseTransactions(lines)

  if (transactions.length === 0) {
    throw new Error(
      'Não foi possível extrair transações do PDF. ' +
      'Verifica se o ficheiro contém texto extraível (não é um scan/imagem). ' +
      'Experimenta exportar o extrato em formato CSV no site do teu banco.'
    )
  }

  return { transactions, bankName: 'PDF' }
}
