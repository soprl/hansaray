import { formatCurrencyTRY } from './formatters'
import { formatMonthLabel } from './financeUtils'

export function printFinancePdf({ monthDate, summary }) {
  const monthLabel = formatMonthLabel(monthDate)
  const rows = [
    ['Konaklama geliri', formatCurrencyTRY(summary.lodgingIncome)],
    ['Gider', formatCurrencyTRY(summary.expense)],
    ['Ek gelir', formatCurrencyTRY(summary.extraIncome)],
    ['Net', formatCurrencyTRY(summary.net)],
    ['Bekleyen tahsilat', formatCurrencyTRY(summary.pendingCollection)],
  ]

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Özet - ${monthLabel}</title>
  <style>
    @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #0f172a;
      font-size: 13px;
      margin: 0;
      padding: 18mm;
      max-width: 210mm;
      min-height: 297mm;
    }
    h1 { font-size: 22px; margin: 0 0 6px; font-weight: 700; }
    .subtitle { color: #64748b; margin: 0 0 28px; font-size: 14px; text-transform: capitalize; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { width: 55%; font-weight: 500; color: #475569; font-size: 14px; }
    td { font-weight: 600; font-size: 16px; text-align: right; }
    tr:last-child td, tr:last-child th { border-bottom: none; }
    tr.net th, tr.net td { padding-top: 18px; border-top: 2px solid #0f172a; font-size: 15px; }
    tr.net td { font-size: 18px; color: #1d4ed8; }
    tr.pending th, tr.pending td { color: #b45309; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>Aylık Özet</h1>
  <p class="subtitle">${monthLabel}</p>
  <table>
    <tbody>
      ${rows
        .map(([label, value]) => {
          const rowClass =
            label === 'Net' ? ' class="net"' : label === 'Bekleyen tahsilat' ? ' class="pending"' : ''
          return `<tr${rowClass}><th>${label}</th><td>${value}</td></tr>`
        })
        .join('')}
    </tbody>
  </table>
  <p class="footer">Otel Paneli · Konaklama geliri rezervasyonlardan hesaplanır.</p>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) return false
  printWindow.document.write(html)
  printWindow.document.close()
  return true
}
