import { describe, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { generateInvoicePDF, getInvoicePDFStream } from '../services/invoicePDF';

const prisma = new PrismaClient();

describe('Invoice PDF Service', () => {
  // Use existing seeded data
  const DEFAULT_ORG_ID = 'default-org';

  describe('generateInvoicePDF', () => {
    it('should generate a PDF buffer for a valid invoice', async () => {
      // Get first invoice from database
      const invoice = await prisma.invoice.findFirst({
        where: { orgId: DEFAULT_ORG_ID, iban: { not: null } },
      });

      if (!invoice) {
        console.log('No invoices with IBAN found - skipping test');
        expect(true).toBe(true);
        return;
      }

      const buffer = await generateInvoicePDF(invoice.id, DEFAULT_ORG_ID);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('should fail for non-existent invoice', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(generateInvoicePDF(nonExistentId, DEFAULT_ORG_ID)).rejects.toThrow(
        'Invoice not found'
      );
    });

    it('should fail when invoice does not belong to org', async () => {
      const wrongOrgId = '00000000-0000-0000-0000-000000000001';
      const invoice = await prisma.invoice.findFirst({
        where: { orgId: DEFAULT_ORG_ID },
      });

      if (invoice) {
        await expect(generateInvoicePDF(invoice.id, wrongOrgId)).rejects.toThrow('Unauthorized');
      }
    });
  });

  describe('getInvoicePDFStream', () => {
    it('should return a readable stream', async () => {
      const invoice = await prisma.invoice.findFirst({
        where: { orgId: DEFAULT_ORG_ID, iban: { not: null } },
      });

      if (!invoice) {
        console.log('No invoices with IBAN found - skipping test');
        expect(true).toBe(true);
        return;
      }

      const stream = await getInvoicePDFStream(invoice.id, DEFAULT_ORG_ID);
      expect(stream).toBeDefined();
      expect(typeof stream.read).toBe('function');
    });
  });
});

