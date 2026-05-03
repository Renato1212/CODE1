export const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(v)

export const fmtCurrencyShort = (v) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)

export const fmtNumber = (v, decimals = 0) =>
  new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(v)

export const fmtPercent = (v, decimals = 1) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    maximumFractionDigits: decimals,
  }).format(v / 100)

export const fmtDate = (date) =>
  new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date instanceof Date ? date : new Date(date))

export const fmtDateShort = (date) =>
  new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
  }).format(date instanceof Date ? date : new Date(date))

export const fmtMonth = (date) =>
  new Intl.DateTimeFormat('pt-PT', {
    month: 'long',
    year: 'numeric',
  }).format(date instanceof Date ? date : new Date(date))

export const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
