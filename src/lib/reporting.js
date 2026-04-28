import { formatCurrency, formatMonthLabel } from './format'

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportCsvReport = ({ contextLabel, rangeLabel, summary, expenses, contributions, categoryTotals, currency }) => {
  const lines = [
    ['Report', contextLabel],
    ['Range', rangeLabel],
    ['Currency', currency],
    [],
    ['Summary'],
    ['Contributions', formatCurrency(summary.contributions, currency)],
    ['Expenses', formatCurrency(summary.expenses, currency)],
    ['Balance', formatCurrency(summary.balance, currency)],
    [],
    ['Contributions Breakdown'],
    ['User', 'Month', 'Amount'],
    ...contributions.map((item) => [
      item.users?.name || item.users?.email || 'Member',
      item.month,
      formatCurrency(item.amount, currency),
    ]),
    [],
    ['Expenses'],
    ['Title', 'Category', 'Paid By', 'Date', 'Amount'],
    ...expenses.map((item) => [
      item.title,
      item.category,
      item.paid_by_user?.name || item.paid_by_user?.email || 'Member',
      item.date,
      formatCurrency(item.amount, currency),
    ]),
    [],
    ['Category Totals'],
    ['Category', 'Amount'],
    ...Object.entries(categoryTotals).map(([category, amount]) => [category, formatCurrency(amount, currency)]),
  ]

  const csv = lines
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')

  downloadFile(csv, `expense-report-${rangeLabel}.csv`, 'text/csv;charset=utf-8')
}

export const exportPdfReport = async ({ contextLabel, rangeLabel, summary, expenses, contributions, categoryTotals, currency }) => {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  const margin = 16
  let y = 18

  const writeLine = (text, size = 11, tone = 'normal') => {
    if (y > 276) {
      pdf.addPage()
      y = 18
    }
    pdf.setFont('helvetica', tone)
    pdf.setFontSize(size)
    pdf.text(text, margin, y)
    y += size === 16 ? 10 : 7
  }

  writeLine('Personal + Group Expense Report', 16, 'bold')
  writeLine(contextLabel)
  writeLine(rangeLabel)
  y += 4
  writeLine(`Contributions: ${formatCurrency(summary.contributions, currency)}`)
  writeLine(`Expenses: ${formatCurrency(summary.expenses, currency)}`)
  writeLine(`Balance: ${formatCurrency(summary.balance, currency)}`)
  y += 4

  writeLine('Contributions Breakdown', 13, 'bold')
  contributions.forEach((item) => {
    writeLine(
      `${item.users?.name || item.users?.email || 'Member'} | ${formatMonthLabel(item.month)} | ${formatCurrency(item.amount, currency)}`,
    )
  })
  y += 4

  writeLine('Expense List', 13, 'bold')
  expenses.forEach((item) => {
    writeLine(
      `${item.date} | ${item.title} | ${item.category} | ${item.paid_by_user?.name || item.paid_by_user?.email || 'Member'} | ${formatCurrency(item.amount, currency)}`,
    )
  })
  y += 4

  writeLine('Category Totals', 13, 'bold')
  Object.entries(categoryTotals).forEach(([category, amount]) => {
    writeLine(`${category}: ${formatCurrency(amount, currency)}`)
  })

  pdf.save(`expense-report-${rangeLabel}.pdf`)
}
