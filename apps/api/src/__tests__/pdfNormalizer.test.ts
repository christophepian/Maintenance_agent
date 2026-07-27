/**
 * pdfNormalizer — splits a "contact-sheet" PDF (all pages tiled onto one giant
 * page) back into one-scan-per-page. Fixtures are built at runtime: sharp makes
 * real JPEGs, pdf-lib composes them into a tiled page or normal pages.
 */
import { PDFDocument } from "pdf-lib";
import { normalizeTiledPdf } from "../services/scanners/pdfNormalizer";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require("sharp") as typeof import("sharp");

async function jpeg(w: number, h: number, tint: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: tint, g: 128, b: 200 } } })
    .jpeg()
    .toBuffer();
}

/** One wide page with `count` page-sized JPEGs tiled left-to-right. */
async function tiledPdf(count: number, w = 800, h = 500): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([w * count, h]);
  for (let i = 0; i < count; i++) {
    const img = await doc.embedJpg(await jpeg(w, h, 40 + i * 30));
    page.drawImage(img, { x: i * w, y: 0, width: w, height: h });
  }
  return Buffer.from(await doc.save());
}

/** A normal, already-paginated PDF: one JPEG per page. */
async function normalPdf(count: number, w = 800, h = 1100): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const img = await doc.embedJpg(await jpeg(w, h, 40 + i * 30));
    const page = doc.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  return Buffer.from(await doc.save());
}

describe("normalizeTiledPdf", () => {
  it("splits a tiled contact-sheet page into one page per embedded scan", async () => {
    const tiled = await tiledPdf(5); // ratio 8:1 → tiled
    const out = await normalizeTiledPdf(tiled);
    expect(out).not.toBe(tiled);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(5);
    // each output page carries one full scan (portrait-ish, not the 8:1 strip)
    for (const p of doc.getPages()) {
      expect(Math.max(p.getWidth() / p.getHeight(), p.getHeight() / p.getWidth())).toBeLessThan(3);
    }
  });

  it("leaves an already-paginated PDF untouched", async () => {
    const normal = await normalPdf(4);
    const out = await normalizeTiledPdf(normal);
    expect(out).toBe(normal); // same buffer reference → not rebuilt
  });

  it("is idempotent — re-running on its own output is a no-op", async () => {
    const once = await normalizeTiledPdf(await tiledPdf(4));
    const twice = await normalizeTiledPdf(once);
    expect(twice).toBe(once);
  });

  it("does not split a wide page that carries too few scans", async () => {
    const tiled = await tiledPdf(2); // ratio 3.2:1 but only 2 scans (< MIN_PAGES_TO_SPLIT)
    const out = await normalizeTiledPdf(tiled);
    expect(out).toBe(tiled);
  });

  it("returns the input unchanged on a non-PDF / garbage buffer (never throws)", async () => {
    const junk = Buffer.from("not a pdf");
    await expect(normalizeTiledPdf(junk)).resolves.toBe(junk);
  });
});
