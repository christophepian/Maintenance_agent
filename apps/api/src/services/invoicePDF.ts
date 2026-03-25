import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import prisma from './prismaClient';
import { generateInvoiceQRBill, getInvoiceQRCodePNG } from './invoiceQRBill';

export interface InvoicePDFOptions {
  includeQRBill?: boolean;
}

/**
 * Generate a PDF invoice with optional embedded QR-bill
 */
export async function generateInvoicePDF(
  invoiceId: string,
  orgId: string,
  options: InvoicePDFOptions = { includeQRBill: true }
): Promise<Buffer> {
  // Fetch invoice with all related data
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      issuer: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Verify org ownership
  if (invoice.orgId !== orgId) {
    throw new Error('Unauthorized: Invoice does not belong to this org');
  }

  // Generate QR-bill if requested
  let qrCodePNG: Buffer | null = null;
  let qrPayload: string | null = null;
  if (options.includeQRBill && invoice.iban) {
    try {
      const qrBillData = await generateInvoiceQRBill(invoiceId, orgId);
      qrCodePNG = await getInvoiceQRCodePNG(invoiceId, orgId);
      qrPayload = qrBillData.qrPayload;
    } catch (e) {
      // QR-bill generation failed, continue without it
      console.warn(`Failed to generate QR-bill for invoice ${invoiceId}:`, e);
    }
  }

  // Create PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
  });

  // Convert PDF stream to buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', (err) => {
      reject(err);
    });

    try {
      // Header: Issuer info
      if (invoice.issuer) {
        doc.fontSize(14).font('Helvetica-Bold').text(invoice.issuer.name, { underline: true });
        doc.fontSize(10).font('Helvetica');
        if (invoice.issuer.addressLine1) doc.text(invoice.issuer.addressLine1);
        if (invoice.issuer.postalCode || invoice.issuer.city) {
          doc.text(`${invoice.issuer.postalCode || ''} ${invoice.issuer.city || ''}`.trim());
        }
      }

      // Title
      doc.moveDown(1);
      doc.fontSize(18).font('Helvetica-Bold').text('INVOICE');
      doc.moveDown(0.5);

      // Invoice details grid
      doc.fontSize(10).font('Helvetica');
      const col1X = 40;
      const col2X = 280;
      let y = doc.y;

      doc.text('Invoice Number:', col1X, y);
      doc.text(invoice.invoiceNumber || '(draft)', col2X, y);
      y += 20;

      doc.text('Invoice Date:', col1X, y);
      const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-CH') : '';
      doc.text(issueDate, col2X, y);
      y += 20;

      if (invoice.dueDate) {
        doc.text('Due Date:', col1X, y);
        const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-CH');
        doc.text(dueDate, col2X, y);
        y += 20;
      }

      // Recipient info
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica');
      doc.text(invoice.recipientName || 'N/A');
      if (invoice.recipientAddressLine1) doc.text(invoice.recipientAddressLine1);
      if (invoice.recipientAddressLine2) doc.text(invoice.recipientAddressLine2);
      const recipientCity = [invoice.recipientPostalCode, invoice.recipientCity]
        .filter(Boolean)
        .join(' ');
      if (recipientCity) doc.text(recipientCity);
      if (invoice.recipientCountry) doc.text(invoice.recipientCountry);

      // Line items table
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold');

      const tableTop = doc.y;
      const col1 = 40;
      const col2 = 200;
      const col3 = 350;
      const col4 = 450;

      doc.text('Description', col1, tableTop);
      doc.text('Qty', col2, tableTop);
      doc.text('Unit Price', col3, tableTop);
      doc.text('Amount', col4, tableTop);

      // Horizontal line
      doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      doc.fontSize(10).font('Helvetica');
      let itemY = tableTop + 25;

      invoice.lineItems.forEach((item) => {
        doc.text(item.description || '', col1, itemY, { width: 150 });
        doc.text(String(item.quantity || 1), col2, itemY);
        doc.text(`CHF ${(item.unitPrice / 100).toFixed(2)}`, col3, itemY);
        doc.text(`CHF ${(item.lineTotal / 100).toFixed(2)}`, col4, itemY);
        itemY += 30;
      });

      // Bottom line
      doc.moveTo(col1, itemY).lineTo(550, itemY).stroke();

      // Totals
      itemY += 20;
      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', col3, itemY);
      doc.text(`CHF ${(invoice.subtotalAmount / 100).toFixed(2)}`, col4, itemY);

      itemY += 20;
      if (invoice.vatRate && invoice.vatRate > 0) {
        doc.text(`VAT (${invoice.vatRate}%):`, col3, itemY);
        doc.text(`CHF ${(invoice.vatAmount / 100).toFixed(2)}`, col4, itemY);
        itemY += 20;
      }

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total:', col3, itemY);
      doc.text(`CHF ${(invoice.totalAmount / 100).toFixed(2)}`, col4, itemY);

      // Payment info
      if (invoice.iban || invoice.paymentReference) {
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Bold').text('Payment Details:');
        doc.fontSize(9).font('Helvetica');
        if (invoice.iban) {
          doc.text(`IBAN: ${invoice.iban}`);
        }
        if (invoice.paymentReference) {
          doc.text(`Reference: ${invoice.paymentReference}`);
        }
      }

      // QR-Bill section
      if (qrCodePNG && qrPayload) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('QR-Bill Payment Slip');
        doc.moveDown(0.5);

        // Add QR code image
        doc.image(qrCodePNG, 50, doc.y, { width: 200, height: 200 });

        // QR bill details
        const qrDetailY = doc.y - 200;
        doc.fontSize(9).font('Helvetica');
        doc.text('Creditor IBAN:', 260, qrDetailY);
        doc.text(invoice.iban || 'N/A', 260, qrDetailY + 12);

        doc.text('Creditor Name:', 260, qrDetailY + 35);
        doc.text(invoice.issuer?.name || 'N/A', 260, qrDetailY + 47, { width: 280 });

        doc.text('Amount:', 260, qrDetailY + 75);
        doc.text(`CHF ${(invoice.totalAmount / 100).toFixed(2)}`, 260, qrDetailY + 87);

        if (invoice.paymentReference) {
          doc.text('Payment Reference:', 260, qrDetailY + 110);
          doc.text(invoice.paymentReference, 260, qrDetailY + 122, { width: 280 });
        }
      }

      // Finalize PDF
      doc.end();
    } catch (err) {
      doc.end();
      reject(err);
    }
  });
}

/**
 * Get invoice PDF as stream
 */
export async function getInvoicePDFStream(
  invoiceId: string,
  orgId: string,
  options: InvoicePDFOptions = { includeQRBill: true }
): Promise<Readable> {
  const buffer = await generateInvoicePDF(invoiceId, orgId, options);
  
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  
  return stream;
}
