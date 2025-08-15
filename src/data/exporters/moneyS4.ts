import type { Receipt as AppReceipt } from '@/data/models';

const normalizeDate = (d: any): string => {
  const date = d?.toDate ? d.toDate() : (typeof d === 'string' ? new Date(d) : (d instanceof Date ? d : null));
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().slice(0,10);
};

export function generateMoneyS4CSV(receipts: AppReceipt[]): string {
  const header = [
    'ExternalId','DocType','DocDate','DueDate','VatDate','SupplierName','SupplierICO','SupplierICDPH','SupplierAddress','SupplierCity','SupplierZIP','SupplierCountry','VariableSymbol','Currency','Total','VatRate','VatAmount','Net','PaymentMethod','Category','CostCenter','Project','Note','ImagePath'
  ].join(';');

  const rows = receipts.map(r => {
    const docDate = normalizeDate(r.date);
    const vatDate = docDate;
    const total = r.total ?? 0;
    const vatAmount = r.vatAmount ?? '';
    const net = (Number(total || 0) - Number(vatAmount || 0)).toFixed(2);
    const vatRate = '';
    const safe = (v: any) => (v === undefined || v === null) ? '' : String(v).replace(/\n|\r|;/g, ' ');
    const fields = [
      `rct_${r.id}`,'PRIJATA_FAKTURA',docDate,'',vatDate,safe(r.merchant),'','','','','','',
      '',safe(r.currency || 'EUR'),safe(total),safe(vatRate),safe(vatAmount),safe(net),safe(r.paymentMethod || ''),safe(r.category || ''),'','',safe(r.note || ''),safe(r.imagePath || '')
    ];
    return fields.join(';');
  });

  return [header, ...rows].join('\n');
}


