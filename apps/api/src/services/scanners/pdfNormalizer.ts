/**
 * PDF normalizer — repaginate a "contact-sheet" export before extraction.
 *
 * Some régie tools export a whole annual report as ONE giant page with every
 * report page tiled side-by-side (e.g. a 11'911 × 842 pt page holding 14 A4
 * scans). Sent to a vision model (which caps the long edge at ~1'568 px) or to
 * page-by-page OCR, that single page downscales until each sub-page is ~100 px
 * wide — illegible, so nothing extracts.
 *
 * When we detect that shape (a very wide/tall page carrying several large image
 * XObjects), we pull the embedded page scans back out and rebuild a normal
 * one-scan-per-page PDF. The scans are stored as discrete JPEG (DCTDecode)
 * streams, so this is lossless re-embedding, not a re-render. Anything that
 * doesn't match the pattern is returned untouched.
 */

import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from "pdf-lib";

/** A page this many times wider than tall (or taller than wide) is a tiled strip. */
const TILED_ASPECT_RATIO = 3;
/** Ignore small decorations (logos, rules); real page scans are large. */
const MIN_IMAGE_WIDTH = 700;
const MIN_IMAGE_HEIGHT = 400;
/** Don't bother rebuilding unless we recover at least this many page scans. */
const MIN_PAGES_TO_SPLIT = 3;

interface EmbeddedImage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

function dictName(obj: PDFRawStream, key: string): string | null {
  const v = obj.dict.get(PDFName.of(key));
  return v ? v.toString() : null;
}
function dictNum(obj: PDFRawStream, key: string): number | null {
  const v = obj.dict.get(PDFName.of(key));
  return v instanceof PDFNumber ? v.asNumber() : null;
}

/** Collect the large JPEG page-scan streams from the document, in object order. */
function collectPageScans(doc: PDFDocument): EmbeddedImage[] {
  const images: EmbeddedImage[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (dictName(obj, "Subtype") !== "/Image") continue;
    const filter = dictName(obj, "Filter") ?? "";
    if (!filter.includes("DCTDecode")) continue; // only baseline JPEG is re-embeddable
    const width = dictNum(obj, "Width");
    const height = dictNum(obj, "Height");
    if (width == null || height == null) continue;
    if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) continue;
    // Copy into a fresh array: obj.contents is a view with a non-zero byteOffset
    // into the source PDF buffer, and embedJpg reads from the buffer start —
    // passing the view directly yields "SOI not found".
    images.push({ jpeg: Uint8Array.from(obj.contents), width, height });
  }
  return images;
}

/** True when the document is a contact-sheet strip (few pages, extreme aspect ratio). */
function looksTiled(doc: PDFDocument): boolean {
  if (doc.getPageCount() > 2) return false; // already paginated
  return doc.getPages().some((p) => {
    const w = p.getWidth();
    const h = p.getHeight();
    if (w <= 0 || h <= 0) return false;
    const ratio = Math.max(w / h, h / w);
    return ratio >= TILED_ASPECT_RATIO;
  });
}

/**
 * If `buffer` is a tiled contact-sheet PDF, return a rebuilt one-scan-per-page
 * PDF; otherwise return the original buffer unchanged. Never throws — on any
 * failure it falls back to the original so extraction still runs.
 */
export async function normalizeTiledPdf(buffer: Buffer): Promise<Buffer> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    if (!looksTiled(doc)) return buffer;

    const scans = collectPageScans(doc);
    if (scans.length < MIN_PAGES_TO_SPLIT) return buffer;

    const out = await PDFDocument.create();
    let embedded = 0;
    for (const scan of scans) {
      try {
        const img = await out.embedJpg(scan.jpeg);
        const page = out.addPage([scan.width, scan.height]);
        page.drawImage(img, { x: 0, y: 0, width: scan.width, height: scan.height });
        embedded += 1;
      } catch {
        // A non-baseline/oddly-encoded JPEG can fail to embed — skip that scan.
      }
    }
    if (embedded < MIN_PAGES_TO_SPLIT) return buffer;

    const bytes = await out.save();
    console.log(
      `[DOC-SCAN] Normalized tiled PDF: 1 contact-sheet page → ${embedded} page(s)`,
    );
    return Buffer.from(bytes);
  } catch (e) {
    console.warn("[DOC-SCAN] PDF normalization skipped:", e instanceof Error ? e.message : e);
    return buffer;
  }
}
