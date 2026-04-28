export const currencyOptions = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
]

export const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(Number(value || 0))

export const formatMonthLabel = (month) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00`))

export const formatShortDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))

export const getCurrentMonth = () => new Date().toISOString().slice(0, 7)

export const shiftMonth = (month, delta) => {
  const base = new Date(`${month}-01T00:00:00`)
  base.setMonth(base.getMonth() + delta)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

export const getMonthWindow = (selectedMonth, count = 6) => {
  const months = []
  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(shiftMonth(selectedMonth, -index))
  }
  return months
}

export const sumBy = (items, key) =>
  items.reduce((total, item) => total + Number(item[key] || 0), 0)

export const groupTotals = (items, key, amountKey = 'amount') =>
  items.reduce((map, item) => {
    const label = item[key] || 'Uncategorized'
    map[label] = (map[label] || 0) + Number(item[amountKey] || 0)
    return map
  }, {})
