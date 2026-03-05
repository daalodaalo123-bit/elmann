import type { Response } from 'express';
import PDFDocument from 'pdfkit';

export function sendPdf(
  res: Response,
  filename: string,
  build: (doc: any) => void
): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc: any = new (PDFDocument as any)({ size: 'A4', margin: 40 });
  doc.pipe(res);
  build(doc);
  doc.end();
}

export function title(doc: any, text: string) {
  doc.fontSize(18).font('Helvetica-Bold').text(text, { align: 'left' });
  doc.moveDown(0.6);
}

export function kv(doc: any, label: string, value: string) {
  doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text(label.toUpperCase());
  doc.fontSize(11).fillColor('#0f172a').font('Helvetica').text(value || 'â€”');
  doc.moveDown(0.5);
}

export function hr(doc: any) {
  doc.moveDown(0.2);
  const y = doc.y;
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  doc.moveDown(0.6);
}

export function tableHeader(doc: any, cols: string[], widths: number[]) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155');
  let x = doc.page.margins.left;
  const y = doc.y;
  cols.forEach((c, i) => {
    doc.text(c, x, y, { width: widths[i], continued: false });
    x += widths[i];
  });
  doc.moveDown(0.8);
  hr(doc);
}

export function tableRow(doc: any, vals: string[], widths: number[]) {
  doc.fontSize(10).font('Helvetica').fillColor('#0f172a');
  let x = doc.page.margins.left;
  const y = doc.y;
  vals.forEach((v, i) => {
    doc.text(v, x, y, { width: widths[i], continued: false });
    x += widths[i];
  });
  doc.moveDown(0.6);
}

export function money(n: any): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(x);
}