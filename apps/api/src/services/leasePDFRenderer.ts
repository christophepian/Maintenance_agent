import * as PDFKit from 'pdfkit';
import * as crypto from 'crypto';
import prisma from './prismaClient';
const PDFDocument = PDFKit as any;

/**
 * Generate a lease draft PDF matching the Swiss ImmoScout24 rental contract template.
 * Sections follow the standard numbering (§1–§15).
 */
export async function generateLeasePDF(
  leaseId: string,
  orgId: string,
): Promise<{ buffer: Buffer; sha256: string }> {
  // Load lease with relations
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { unit: { include: { building: true } } },
  });

  if (!lease) throw new Error(`Lease not found: ${leaseId}`);
  if (lease.orgId !== orgId) throw new Error('Unauthorized: Lease does not belong to this org');

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      resolve({ buffer, sha256 });
    });
    doc.on('error', (err: Error) => reject(err));

    try {
      const col1 = 40;
      const col2 = 300;
      const pageWidth = 515;

      // ──────────────────────────────────────────
      // Title
      // ──────────────────────────────────────────
      doc.fontSize(16).font('Helvetica-Bold')
        .text('CONTRAT DE BAIL À LOYER', { align: 'center' });
      doc.fontSize(10).font('Helvetica')
        .text('(Bail pour appartements et maisons individuelles)', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica')
        .text(`Réf. bail : ${lease.id.slice(0, 8).toUpperCase()}`, { align: 'center' });
      doc.fontSize(8).font('Helvetica')
        .text(`Statut : ${lease.status}`, { align: 'center' });
      doc.moveDown(1);

      // ──────────────────────────────────────────
      // §1.1 — Bailleresse / Bailleur
      // ──────────────────────────────────────────
      sectionHeader(doc, '1.1', 'Bailleresse / Bailleur');
      labelValue(doc, 'Nom / Raison sociale', lease.landlordName, col1, pageWidth);
      labelValue(doc, 'Adresse', lease.landlordAddress, col1, pageWidth);
      labelValue(doc, 'NPA / Localité', lease.landlordZipCity, col1, pageWidth);
      if (lease.landlordPhone) labelValue(doc, 'Téléphone', lease.landlordPhone, col1, pageWidth);
      if (lease.landlordEmail) labelValue(doc, 'E-mail', lease.landlordEmail, col1, pageWidth);
      if (lease.landlordRepresentedBy) labelValue(doc, 'Représenté(e) par', lease.landlordRepresentedBy, col1, pageWidth);
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §1.2 — Locataire
      // ──────────────────────────────────────────
      sectionHeader(doc, '1.2', 'Locataire');
      labelValue(doc, 'Nom / Raison sociale', lease.tenantName, col1, pageWidth);
      if (lease.tenantAddress) labelValue(doc, 'Adresse', lease.tenantAddress, col1, pageWidth);
      if (lease.tenantZipCity) labelValue(doc, 'NPA / Localité', lease.tenantZipCity, col1, pageWidth);
      if (lease.tenantPhone) labelValue(doc, 'Téléphone', lease.tenantPhone, col1, pageWidth);
      if (lease.tenantEmail) labelValue(doc, 'E-mail', lease.tenantEmail, col1, pageWidth);
      if (lease.coTenantName) {
        doc.moveDown(0.3);
        labelValue(doc, 'Co-locataire', lease.coTenantName, col1, pageWidth);
      }
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §2 — Objet du bail
      // ──────────────────────────────────────────
      sectionHeader(doc, '2', 'Objet du bail');
      labelValue(doc, 'Type d\'objet', lease.objectType, col1, pageWidth);
      if (lease.roomsCount) labelValue(doc, 'Nombre de pièces', lease.roomsCount, col1, pageWidth);
      if (lease.floor) labelValue(doc, 'Étage', lease.floor, col1, pageWidth);

      // Building address
      const addressLines = (lease.buildingAddressLines as string[]) || [];
      if (addressLines.length > 0) {
        labelValue(doc, 'Adresse', addressLines.join(', '), col1, pageWidth);
      }
      if (lease.unit) {
        labelValue(doc, 'N° d\'unité', lease.unit.unitNumber, col1, pageWidth);
      }

      // Usage flags
      const usage = lease.usageFlags as Record<string, boolean> | null;
      if (usage) {
        const usageLabels: Record<string, string> = {
          apartment: 'Appartement',
          family: 'Appartement familial',
          secondary: 'Résidence secondaire',
          holiday: 'Appartement de vacances',
          furnished_room: 'Chambre meublée',
          furnished_apartment: 'Appartement meublé',
        };
        const active = Object.entries(usage)
          .filter(([, v]) => v)
          .map(([k]) => usageLabels[k] || k);
        if (active.length) labelValue(doc, 'Usage', active.join(', '), col1, pageWidth);
      }

      // Service spaces
      const spaces = lease.serviceSpaces as Record<string, any> | null;
      if (spaces) {
        const spaceLabels: Record<string, string> = {
          cave: 'Cave', grenier: 'Grenier', debarras: 'Débarras',
          emplacement: 'Emplacement', garage: 'Garage', other: 'Autre',
        };
        const active = Object.entries(spaces).filter(([, v]) => v);
        if (active.length) {
          const text = active.map(([k, v]) =>
            typeof v === 'number' ? `${spaceLabels[k] || k} (${v})` : spaceLabels[k] || k
          ).join(', ');
          labelValue(doc, 'Locaux de service', text, col1, pageWidth);
        }
      }

      // Common installations
      const common = lease.commonInstallations as Record<string, any> | null;
      if (common) {
        const labels: Record<string, string> = {
          jardin: 'Jardin', buanderie: 'Buanderie', sechoir: 'Séchoir', other: 'Autre',
        };
        const active = Object.entries(common).filter(([, v]) => v);
        if (active.length) {
          labelValue(doc, 'Installations communes', active.map(([k]) => labels[k] || k).join(', '), col1, pageWidth);
        }
      }
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §3 — Durée du bail
      // ──────────────────────────────────────────
      sectionHeader(doc, '3', 'Durée du bail');
      labelValue(doc, 'Début du bail', formatDate(lease.startDate), col1, pageWidth);
      labelValue(doc, 'Durée', lease.isFixedTerm ? 'Déterminée' : 'Indéterminée', col1, pageWidth);
      if (lease.isFixedTerm && lease.endDate) {
        labelValue(doc, 'Fin du bail', formatDate(lease.endDate), col1, pageWidth);
      }
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §4 — Résiliation
      // ──────────────────────────────────────────
      sectionHeader(doc, '4', 'Résiliation');
      const noticeLabels: Record<string, string> = {
        '3_MONTHS': '3 mois',
        'EXTENDED': 'Prolongé (voir ci-dessous)',
        '2_WEEKS': '2 semaines',
      };
      labelValue(doc, 'Délai de résiliation', noticeLabels[lease.noticeRule] || lease.noticeRule, col1, pageWidth);
      if (lease.extendedNoticeText) labelValue(doc, 'Détails', lease.extendedNoticeText, col1, pageWidth);
      if (lease.firstTerminationDate) {
        labelValue(doc, 'Premier terme de résiliation', formatDate(lease.firstTerminationDate), col1, pageWidth);
      }

      const termLabels: Record<string, string> = {
        'END_OF_MONTH_EXCEPT_31_12': 'Fin de mois, sauf le 31 décembre',
        'CUSTOM': 'Dates locales (voir ci-dessous)',
      };
      labelValue(doc, 'Termes de résiliation', termLabels[lease.terminationDatesRule] || lease.terminationDatesRule, col1, pageWidth);
      if (lease.terminationDatesCustomText) labelValue(doc, 'Dates personnalisées', lease.terminationDatesCustomText, col1, pageWidth);
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §5 — Loyer et charges
      // ──────────────────────────────────────────
      sectionHeader(doc, '5', 'Loyer et charges');
      labelValue(doc, 'Loyer net', `CHF ${lease.netRentChf}.-/mois`, col1, pageWidth);
      if (lease.garageRentChf) labelValue(doc, 'Loyer garage', `CHF ${lease.garageRentChf}.-/mois`, col1, pageWidth);
      if (lease.otherServiceRentChf) labelValue(doc, 'Autres prestations', `CHF ${lease.otherServiceRentChf}.-/mois`, col1, pageWidth);

      // Charges line items
      const items = lease.chargesItems as Array<{ label: string; mode: string; amountChf: number }> | null;
      if (items && items.length > 0) {
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica-Bold').text('Charges accessoires :');
        doc.fontSize(9).font('Helvetica');
        items.forEach(item => {
          doc.text(`  • ${item.label}: CHF ${item.amountChf}.- (${item.mode === 'ACOMPTE' ? 'acompte' : 'forfait'})`);
        });
      }
      if (lease.chargesTotalChf !== null && lease.chargesTotalChf !== undefined) {
        labelValue(doc, 'Total charges', `CHF ${lease.chargesTotalChf}.-/mois`, col1, pageWidth);
      }
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Loyer total : CHF ${lease.rentTotalChf ?? 0}.-/mois`);
      doc.font('Helvetica');

      if (lease.chargesSettlementDate) {
        doc.moveDown(0.3);
        labelValue(doc, 'Décompte des charges au', lease.chargesSettlementDate, col1, pageWidth);
      }
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §6 — Paiement
      // ──────────────────────────────────────────
      sectionHeader(doc, '6', 'Paiement');
      if (lease.paymentDueDayOfMonth) labelValue(doc, 'Échéance', `Le ${lease.paymentDueDayOfMonth} du mois`, col1, pageWidth);
      if (lease.paymentRecipient) labelValue(doc, 'Bénéficiaire', lease.paymentRecipient, col1, pageWidth);
      if (lease.paymentInstitution) labelValue(doc, 'Institut financier', lease.paymentInstitution, col1, pageWidth);
      if (lease.paymentAccountNumber) labelValue(doc, 'N° de compte', lease.paymentAccountNumber, col1, pageWidth);
      if (lease.paymentIban) labelValue(doc, 'IBAN', lease.paymentIban, col1, pageWidth);
      if (lease.referenceRatePercent) labelValue(doc, 'Taux de référence', `${lease.referenceRatePercent}%`, col1, pageWidth);
      if (lease.referenceRateDate) labelValue(doc, 'Date du taux', lease.referenceRateDate, col1, pageWidth);
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §7 — Garantie
      // ──────────────────────────────────────────
      sectionHeader(doc, '7', 'Garantie');
      if (lease.depositChf !== null && lease.depositChf !== undefined) {
        labelValue(doc, 'Montant de la garantie', `CHF ${lease.depositChf}.-`, col1, pageWidth);
      }
      const dueLabels: Record<string, string> = {
        'AT_SIGNATURE': 'À la signature',
        'BY_START': 'Au début du bail',
        'BY_DATE': lease.depositDueDate ? `Au ${formatDate(lease.depositDueDate)}` : 'À une date précise',
      };
      labelValue(doc, 'Exigibilité', dueLabels[lease.depositDueRule] || lease.depositDueRule, col1, pageWidth);
      doc.moveDown(0.5);

      // ──────────────────────────────────────────
      // §15 — Dispositions particulières / Annexes
      // ──────────────────────────────────────────
      sectionHeader(doc, '15', 'Dispositions particulières et annexes');
      if (lease.includesHouseRules) {
        doc.fontSize(9).font('Helvetica').text('☑ Règlement de la maison joint en annexe');
      }
      if (lease.otherAnnexesText) {
        labelValue(doc, 'Annexes', lease.otherAnnexesText, col1, pageWidth);
      }
      if (lease.otherStipulations) {
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').text(lease.otherStipulations, { width: pageWidth });
      }
      doc.moveDown(1);

      // ──────────────────────────────────────────
      // Signatures
      // ──────────────────────────────────────────
      sectionHeader(doc, '', 'Signatures');
      const sigY = doc.y + 10;
      doc.fontSize(9).font('Helvetica');

      // Landlord
      doc.text('Lieu et date :', col1, sigY);
      doc.text('_____________________', col1, sigY + 15);
      doc.text('Bailleresse / Bailleur :', col1, sigY + 45);
      doc.text('_____________________', col1, sigY + 60);

      // Tenant
      doc.text('Lieu et date :', col2, sigY);
      doc.text('_____________________', col2, sigY + 15);
      doc.text('Locataire :', col2, sigY + 45);
      doc.text('_____________________', col2, sigY + 60);

      // Footer
      doc.moveDown(4);
      doc.fontSize(7).font('Helvetica')
        .text(`Généré le ${new Date().toLocaleDateString('fr-CH')} — Document provisoire (${lease.status})`, { align: 'center' });

      doc.end();
    } catch (err) {
      doc.end();
      reject(err);
    }
  });
}

// ==========================================
// Helpers
// ==========================================
function sectionHeader(doc: any, number: string, title: string) {
  doc.fontSize(11).font('Helvetica-Bold');
  if (number) {
    doc.text(`§${number} — ${title}`);
  } else {
    doc.text(title);
  }
  doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(0.5).stroke();
  doc.moveDown(0.3);
}

function labelValue(doc: any, label: string, value: string | null | undefined, x: number, width: number) {
  if (!value) return;
  doc.fontSize(9).font('Helvetica-Bold').text(`${label} : `, x, doc.y, { continued: true });
  doc.font('Helvetica').text(value, { width });
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
