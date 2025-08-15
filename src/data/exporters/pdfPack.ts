export async function generatePDFPack(receipts: any[], filename: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let first = true;
  for (const r of receipts) {
    if (!first) doc.addPage();
    first = false;
    doc.setFontSize(14);
    doc.text(`Merchant: ${r.merchant || '-'}`, 40, 60);
    doc.text(`Date: ${normalizeDate(r.transactionDate || r.date)}`, 40, 80);
    doc.text(`Total: ${r.total ?? ''} ${r.currency || ''}`, 40, 100);
    doc.text(`VAT: ${r.tax ?? ''}`, 40, 120);
    doc.text(`Category: ${r.category || ''}`, 40, 140);
    doc.text(`Payment: ${r.paymentMethod || ''}`, 40, 160);
    if (r.imageUrl) {
      try {
        const imgData = await fetch(r.imageUrl).then(res => res.blob()).then(blob => toDataURL(blob));
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - 80;
        doc.addImage(imgData, 'JPEG', 40, 190, maxWidth, 0);
      } catch {}
    }
  }
  doc.save(filename);
}

function normalizeDate(d: any): string {
  const date = d?.toDate ? d.toDate() : (typeof d === 'string' ? new Date(d) : (d instanceof Date ? d : null));
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().slice(0,10);
}

function toDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


