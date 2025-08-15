export async function generateXLSX(receipts: any[], filename: string) {
  const XLSX = await import('xlsx');
  const rows = receipts.map(r => ({
    ExternalId: `rct_${r.id}`,
    DocType: 'PRIJATA_FAKTURA',
    DocDate: normalizeDate(r.transactionDate || r.date),
    VatDate: normalizeDate(r.transactionDate || r.date),
    SupplierName: r.merchant || '',
    Currency: r.currency || 'EUR',
    Total: r.total || 0,
    VatAmount: r.tax || '',
    Net: Number(r.total || 0) - Number(r.tax || 0),
    PaymentMethod: r.paymentMethod || '',
    Category: r.category || '',
    Note: r.note || '',
    ImagePath: r.imageUrl || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Receipts');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeDate(d: any): string {
  const date = d?.toDate ? d.toDate() : (typeof d === 'string' ? new Date(d) : (d instanceof Date ? d : null));
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().slice(0,10);
}


