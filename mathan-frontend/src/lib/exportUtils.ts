import { Voucher, Ledger } from '../types';

/**
 * Escape a field for safe CSV output (handles quotes, commas, and newlines)
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Download a CSV string as a file
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export Voucher/Journal Entries to Excel (CSV)
 */
export function exportVouchersToExcel(vouchers: Voucher[], ledgers: Ledger[], currencyCode: string) {
  const headers = [
    'Date',
    'Voucher No',
    'Type',
    'Particulars (Ledger Account)',
    `Debit (${currencyCode})`,
    `Credit (${currencyCode})`,
    'Narration',
    'Status'
  ];

  const rows: string[][] = [headers];

  vouchers.forEach(v => {
    if (!v.lines || v.lines.length === 0) {
      // Stock-only or empty voucher
      rows.push([
        v.date,
        v.number,
        v.type,
        'N/A',
        '0.00',
        '0.00',
        v.narration || '',
        v.status
      ]);
      return;
    }

    v.lines.forEach((line, index) => {
      const ledgerName = ledgers.find(l => l.id === line.ledgerId)?.name || `Account (${line.ledgerId})`;
      rows.push([
        index === 0 ? v.date : '', // only show date on first row of voucher
        index === 0 ? v.number : '',
        index === 0 ? v.type : '',
        ledgerName,
        (line.debit || 0).toFixed(2),
        (line.credit || 0).toFixed(2),
        index === 0 ? (v.narration || '') : '',
        index === 0 ? v.status : ''
      ]);
    });
  });

  const csvContent = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  downloadCSV(csvContent, `journal_entries_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Export Inventory Stock Summary to Excel (CSV)
 */
export function exportInventoryToExcel(summary: any[], currencySymbol: string) {
  const headers = [
    'Product Name',
    'Warehouse Name',
    'Balance Quantity',
    `Unit Price (${currencySymbol})`,
    `Total Valuation (${currencySymbol})`
  ];

  const rows: string[][] = [headers];

  summary.forEach(item => {
    rows.push([
      item.productName || 'Unknown',
      item.warehouseName || 'Unknown',
      String(item.qty || 0),
      (item.price || 0).toFixed(2),
      (item.totalValue || 0).toFixed(2)
    ]);
  });

  const csvContent = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  downloadCSV(csvContent, `inventory_summary_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Export trial balance, profit and loss, or any generic tabular summary report to CSV
 */
export function exportReportToExcel(title: string, headers: string[], dataRows: any[][]) {
  const rows: string[][] = [
    [title],
    [], // empty spacer
    headers,
    ...dataRows.map(row => row.map(v => (typeof v === 'number' ? v.toFixed(2) : String(v))))
  ];

  const csvContent = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  downloadCSV(csvContent, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`);
}
