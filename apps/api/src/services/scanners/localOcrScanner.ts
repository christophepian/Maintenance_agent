/**
 * Local OCR Scanner — tesseract.js + sharp + pdf-parse implementation.
 *
 * This is the original monolith logic from documentScan.ts, wrapped in a
 * class that implements the DocumentScanner interface. All heuristic
 * extraction, MRZ parsing, multilingual regex dictionaries, and OCR
 * strategies are preserved exactly.
 *
 * Dependencies (all dynamically imported):
 *   - pdf-parse      — PDF text extraction
 *   - pdfjs-dist     — scanned-PDF image extraction
 *   - tesseract.js   — OCR
 *   - sharp          — image preprocessing
 */

import type { DocumentScanner, DetectedDocType, ScanResult } from "../documentScanner";
import { verifyDebtEnforcement } from "./debtEnforcementVerifier";

/* ══════════════════════════════════════════════════════════════
   LocalOcrScanner
   ══════════════════════════════════════════════════════════════ */

export class LocalOcrScanner implements DocumentScanner {
  async scan(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    hintDocType?: string,
  ): Promise<ScanResult> {
    // 1. Detect document type from filename + hint
    const docType = detectDocType(fileName, hintDocType);

    // 2. Extract text content
    const textContent = await extractText(buffer, mimeType, fileName);

    console.log(`[DOC-SCAN] docType=${docType}, textLen=${textContent.length}, file=${fileName}`);
    if (textContent.length > 0 && textContent.length < 2000) {
      console.log(`[DOC-SCAN] text:\n${textContent}`);
    } else if (textContent.length >= 2000) {
      console.log(`[DOC-SCAN] text (first 2000 chars):\n${textContent.substring(0, 2000)}`);
    }

    // 3. Parse fields based on detected doc type
    const result = parseFields(docType, textContent, fileName);

    // Include raw text snippet for debugging
    if (textContent.length > 0 && textContent.length <= 2000) {
      result.fields._rawTextPreview = textContent;
    } else if (textContent.length > 2000) {
      result.fields._rawTextPreview = textContent.substring(0, 2000) + "…";
    }

    return result;
  }
}

/* ══════════════════════════════════════════════════════════════
   Everything below is the original documentScan.ts internal logic,
   moved here verbatim. Nothing has changed except the removal of the
   `scanDocument` entry-point (now `LocalOcrScanner.scan`) and the
   type exports (now in documentScanner.ts).
   ══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────
   Document type detection
   ────────────────────────────────────────────────────────── */

const DOC_PATTERNS: { type: DetectedDocType; patterns: RegExp[] }[] = [
  {
    type: "IDENTITY",
    patterns: [
      /pass(port|eport)/i, /identity|identit[eé]/i, /\bID\b/i, /carte.*identit/i,
      /personalausweis/i, /ausländerausweis/i,
    ],
  },
  {
    type: "SALARY_PROOF",
    patterns: [
      /salary|salaire|lohn|gehalt/i, /pay\s*slip|payslip|fiche.*paie|bulletin.*paie/i,
      /d[eé]compte.*salaire/i, /income|revenu/i, /lohnausweis/i, /lohnabrechnung/i,
    ],
  },
  {
    type: "DEBT_ENFORCEMENT_EXTRACT",
    patterns: [
      /debt.*enforce|betreibung/i, /extrait.*poursuite/i, /poursuites/i,
      /schuld|schuldner/i, /office.*poursuite/i,
    ],
  },
  {
    type: "PERMIT",
    patterns: [
      /permit|permis/i, /aufenthalt/i, /s[eé]jour/i, /livret.*[eé]tranger/i,
      /bewilligung/i, /residence/i,
    ],
  },
  {
    type: "HOUSEHOLD_INSURANCE",
    patterns: [
      /insurance|assurance|versicherung/i, /household|m[eé]nage|haushalt/i,
      /\bRC\b|responsabilit[eé].*civil/i, /police.*assurance/i, /haftpflicht/i,
    ],
  },
  {
    type: "INVOICE",
    patterns: [
      /invoice/i, /facture/i, /rechnung/i, /\bbill\b/i,
      /quittung/i, /devis/i, /offerte/i, /gutschrift/i,
    ],
  },
];

/** Also detect doc type from the extracted text itself */
const TEXT_DETECT_PATTERNS: { type: DetectedDocType; patterns: RegExp[] }[] = [
  {
    type: "IDENTITY",
    patterns: [
      /carte\s*d.identit[eé]/i, /passport|passeport|reisepass/i,
      /identit[eé]|identity\s*card/i, /personalausweis/i,
      // MRZ marker
      /^[A-Z<]{2}[A-Z<]{3}[A-Z<]+/m,
    ],
  },
  {
    type: "SALARY_PROOF",
    patterns: [
      /fiche\s*de\s*salaire/i, /bulletin\s*de\s*(paie|salaire)/i,
      /d[eé]compte\s*(de\s*)?salaire/i, /lohnabrechnung/i, /lohnausweis/i,
      /pay\s*slip/i, /salaire\s*(net|brut)/i, /nettolohn|bruttolohn/i,
    ],
  },
  {
    type: "DEBT_ENFORCEMENT_EXTRACT",
    patterns: [
      /extrait.*poursuite/i, /betreibungsauskunft/i,
      /office\s*(des?\s*)?poursuite/i, /betreibungsamt/i,
    ],
  },
  {
    type: "PERMIT",
    patterns: [
      /permis\s*[a-z]?\s*(de\s*)?s[eé]jour/i, /aufenthaltsbewilligung/i,
      /titre\s*de\s*s[eé]jour/i, /livret\s*(pour\s*)?[eé]tranger/i,
    ],
  },
  {
    type: "HOUSEHOLD_INSURANCE",
    patterns: [
      /assurance\s*(m[eé]nage|RC|responsabilit)/i, /hausrat/i,
      /haftpflichtversicherung/i, /police\s*d.assurance/i,
    ],
  },
  {
    type: "INVOICE",
    patterns: [
      /facture\s*(n[°o.]?|num|nr)?/i, /rechnung\s*(nr|nummer|no)?/i,
      /invoice\s*(no|number|nr|#|n°)?/i, /\btotal\s*(amount|due|chf|eur)/i,
      /montant\s*(total|d[ûu])/i, /gesamtbetrag/i,
    ],
  },
];

function detectDocType(fileName: string, hint?: string): DetectedDocType {
  // Prefer explicit hint
  if (hint) {
    const upper = hint.toUpperCase();
    if (upper === "IDENTITY" || upper === "SALARY_PROOF" || upper === "DEBT_ENFORCEMENT_EXTRACT" || upper === "PERMIT" || upper === "HOUSEHOLD_INSURANCE" || upper === "INVOICE") {
      return upper as DetectedDocType;
    }
  }

  const lower = fileName.toLowerCase();
  for (const { type, patterns } of DOC_PATTERNS) {
    if (patterns.some((p) => p.test(lower))) return type;
  }

  return "UNKNOWN";
}

/** Re-detect type from actual text content if initial detection was UNKNOWN */
function redetectDocType(text: string): DetectedDocType {
  for (const { type, patterns } of TEXT_DETECT_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return type;
  }
  return "UNKNOWN";
}

/* ──────────────────────────────────────────────────────────
   Text extraction — pdf-parse for PDFs, tesseract.js for images
   ────────────────────────────────────────────────────────── */

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lower = (mimeType + " " + fileName).toLowerCase();
  const isPdf = lower.includes("pdf");
  const isImage = /\.(jpe?g|png|tiff?|bmp|webp)$/i.test(fileName) ||
    mimeType.startsWith("image/");

  // 1. Try PDF text extraction
  if (isPdf) {
    try {
      // pdf-parse v2+ exports a class-based API: { PDFParse }
      // Older versions exported a plain function as .default.
      // Support both shapes.
      const pdfParseMod: any = await import("pdf-parse");
      let text = "";
      if (pdfParseMod.PDFParse) {
        // New class-based API (pdf-parse v2+)
        const instance = new pdfParseMod.PDFParse({ data: buffer, verbosity: 0 });
        const result = await instance.getText();
        text = (result.text || "").trim();
      } else {
        // Legacy function API (pdf-parse v1)
        const pdfParse = (pdfParseMod.default || pdfParseMod) as (buf: Buffer, opts?: any) => Promise<{ text: string }>;
        const result = await pdfParse(buffer, { verbosity: 0 });
        text = (result.text || "").trim();
      }
      if (text.length > 10) {
        console.log(`[DOC-SCAN] pdf-parse extracted ${text.length} chars from ${fileName}`);
        return text;
      }
      console.log(`[DOC-SCAN] pdf-parse got no text from ${fileName}, trying scanned PDF OCR…`);
    } catch (e: any) {
      console.warn(`[DOC-SCAN] pdf-parse failed for ${fileName}:`, e.message);
    }

    // For scanned PDFs (image-only, no text layer), extract embedded images and OCR them
    try {
      const imageBuffers = await extractImagesFromPdf(buffer);
      if (imageBuffers.length > 0) {
        console.log(`[DOC-SCAN] Extracted ${imageBuffers.length} image(s) from scanned PDF ${fileName}`);
        const texts: string[] = [];
        for (const imgBuf of imageBuffers) {
          const t = await ocrImage(imgBuf, fileName);
          if (t.length > 5) texts.push(t);
        }
        const combined = texts.join("\n");
        if (combined.length > 10) return combined;
      }
    } catch (e: any) {
      console.warn(`[DOC-SCAN] Scanned PDF OCR failed for ${fileName}:`, e.message);
    }

    const fallback = extractRawText(buffer);
    if (fallback.length > 30) return fallback;
  }

  // 2. Try image OCR with tesseract.js (with sharp preprocessing)
  if (isImage) {
    const ocrText = await ocrImage(buffer, fileName);
    if (ocrText.length > 10) return ocrText;
  }

  // 3. Final fallback: raw UTF-8 scan
  const raw = extractRawText(buffer);
  if (raw.length > 10) return raw;

  console.warn(`[DOC-SCAN] Could not extract any text from ${fileName}`);
  return "";
}

/* ──────────────────────────────────────────────────────────
   Image preprocessing + OCR
   ────────────────────────────────────────────────────────── */

/**
 * Preprocess an image with sharp, then run Tesseract OCR.
 *
 * Tries multiple preprocessing strategies and picks the one that yields
 * the most usable text. Real phone photos of passports often have glare,
 * perspective distortion, and low contrast — a single strategy doesn't
 * work for all lighting conditions.
 */
async function ocrImage(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const sharpMod = await import("sharp") as any;
    const sharp = sharpMod.default || sharpMod;

    const meta = await sharp(buffer).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    console.log(`[DOC-SCAN] Image ${fileName}: ${width}×${height}, ${meta.format}`);

    // Load Tesseract once
    const tessMod = await import("tesseract.js") as any;
    const Tesseract = tessMod.default || tessMod;

    // Helper: build a preprocessed PNG buffer from a sharp pipeline
    async function preprocess(name: string, pipelineFn: (s: any) => any): Promise<Buffer> {
      // .rotate() with no args applies EXIF orientation before any other op —
      // without this, portrait-mode phone photos arrive sideways to Tesseract.
      let pipe = pipelineFn(sharp(buffer).rotate());
      // Upscale small images for better Tesseract accuracy
      if (width > 0 && width < 2000) {
        const scale = Math.min(Math.ceil(2000 / width), 4);
        pipe = pipe.resize(width * scale, height * scale, { kernel: "lanczos3", fit: "fill" });
      }
      const buf = await pipe.png().toBuffer();
      console.log(`[DOC-SCAN] Preprocessed ${name}: ${buffer.length} → ${buf.length} bytes`);
      return buf;
    }

    // Helper: run Tesseract on a buffer
    async function runOcr(buf: Buffer): Promise<string> {
      const { data } = await Tesseract.recognize(buf, "fra+deu+eng+ita", { logger: () => {} });
      return (data.text || "").trim();
    }

    // Score OCR text: more alphabetic words + MRZ-like lines → higher score.
    // Also rewards structured "Label: Value" lines (critical for field parsers)
    // and penalises garbage lines produced by over-aggressive binarization.
    function scoreText(text: string): number {
      const lines = text.split(/\n/);
      const words = text.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
      const mrzLines = lines.filter(l => /^[A-Z0-9<]{20,}$/.test(l.trim().replace(/\s/g, "")));
      const dates = text.match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/g) || [];
      // Bonus: lines containing "LabelWord: Value" — exactly what field parsers need
      const structuredLines = lines.filter(l => /[A-Za-zÀ-ÿ]{3,}.*:\s+[A-Za-zÀ-ÿ0-9]/.test(l));
      // Penalty: garbage lines from background noise / binarization artefacts
      const garbageCount = lines.filter(l => isGarbageLine(l)).length;
      return words.length
        + mrzLines.length * 20
        + dates.length * 10
        + structuredLines.length * 15
        - garbageCount * 5;
    }

    // ── Strategy 1: Grayscale + normalize + sharpen (general purpose) ──
    const strategies: { name: string; fn: (s: any) => any }[] = [
      {
        name: "grayscale+normalize+sharpen",
        fn: (s: any) => s.grayscale().normalize().sharpen({ sigma: 1.5 }),
      },
      // ── Strategy 2: High contrast (good for faded/laminated text) ──
      {
        name: "high-contrast",
        fn: (s: any) => s.grayscale().normalize().linear(1.8, -50).sharpen({ sigma: 2 }),
      },
      // ── Strategy 3: Threshold (binarize — best for clean text on backgrounds) ──
      {
        name: "threshold",
        fn: (s: any) => s.grayscale().normalize().threshold(140),
      },
    ];

    let bestText = "";
    let bestScore = -1;
    let bestStrategy = "";

    for (const strat of strategies) {
      try {
        const buf = await preprocess(strat.name, strat.fn);
        console.log(`[DOC-SCAN] Running Tesseract [${strat.name}] on ${fileName}…`);
        const text = await runOcr(buf);
        const score = scoreText(text);
        console.log(`[DOC-SCAN]   → ${text.length} chars, score=${score} (words=${(text.match(/[A-Za-zÀ-ÿ]{2,}/g)||[]).length})`);
        if (score > bestScore) {
          bestScore = score;
          bestText = text;
          bestStrategy = strat.name;
        }
        // Only short-circuit if the strategy is clearly excellent.
        // 40 was too low — background noise in phone photos hits it easily,
        // causing strategies 2/3 (which score higher) to be skipped.
        if (score >= 120) break;
      } catch (e: any) {
        console.warn(`[DOC-SCAN]   [${strat.name}] failed:`, e.message);
      }
    }

    if (bestText.length > 0) {
      console.log(`[DOC-SCAN] Best OCR [${bestStrategy}]: ${bestText.length} chars, score=${bestScore}`);
    } else {
      console.log(`[DOC-SCAN] All OCR strategies returned no text for ${fileName}`);
    }
    return bestText;
  } catch (e: any) {
    console.warn(`[DOC-SCAN] OCR failed for ${fileName}:`, e.message);
    return "";
  }
}

/* ──────────────────────────────────────────────────────────
   Scanned PDF → extract embedded images via pdfjs-dist
   ────────────────────────────────────────────────────────── */

/**
 * For scanned PDFs (no text layer), extract the main image from each page.
 * Uses pdfjs-dist operator list to find paintImageXObject ops,
 * then converts raw pixel data to PNG via sharp.
 */
async function extractImagesFromPdf(buffer: Buffer): Promise<Buffer[]> {
  try {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosityLevel: 0,
    }).promise;

    const images: Buffer[] = [];
    const maxPages = Math.min(doc.numPages, 3); // OCR first 3 pages max

    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const ops = await page.getOperatorList();

      for (let j = 0; j < ops.fnArray.length; j++) {
        // paintImageXObject = 85, paintXObject = 84 in pdfjs OPS
        if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject ||
            ops.fnArray[j] === pdfjsLib.OPS.paintXObject) {
          const imgName = ops.argsArray[j][0];
          try {
            const imgObj: any = await new Promise((resolve, reject) => {
              page.objs.get(imgName, (obj: any) => {
                if (obj) resolve(obj);
                else reject(new Error("image not found"));
              });
            });

            if (imgObj && imgObj.data && imgObj.width > 100 && imgObj.height > 100) {
              const sharpMod2 = await import("sharp") as any;
              const sharp2 = sharpMod2.default || sharpMod2;
              // pdfjs image data: RGBA (kind=2) or RGB (kind=1)
              const channels = imgObj.kind === 2 ? 4 : 3;
              const pngBuf = await sharp2(Buffer.from(imgObj.data.buffer || imgObj.data), {
                raw: { width: imgObj.width, height: imgObj.height, channels },
              }).png().toBuffer();
              console.log(`[DOC-SCAN] PDF page ${i}: extracted ${imgObj.width}×${imgObj.height} image (${pngBuf.length} bytes)`);
              images.push(pngBuf);
              break; // one image per page is enough
            }
          } catch { /* skip this image object */ }
        }
      }
    }
    return images;
  } catch (e: any) {
    console.warn(`[DOC-SCAN] PDF image extraction error:`, e.message);
    return [];
  }
}

/** Fallback: read buffer as UTF-8 and strip binary garbage */
function extractRawText(buffer: Buffer): string {
  try {
    const raw = buffer.toString("utf8");
    const cleaned = raw.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ").replace(/\s{3,}/g, " ");
    return cleaned.trim();
  } catch { return ""; }
}

/* ──────────────────────────────────────────────────────────
   Field parsing by document type
   ────────────────────────────────────────────────────────── */

function parseFields(docType: DetectedDocType, text: string, fileName: string): ScanResult {
  let effectiveDocType = docType;
  if (effectiveDocType === "UNKNOWN" && text.length > 20) {
    effectiveDocType = redetectDocType(text);
    if (effectiveDocType !== "UNKNOWN") {
      console.log(`[DOC-SCAN] Re-detected docType from text content: ${effectiveDocType}`);
    }
  }

  switch (effectiveDocType) {
    case "IDENTITY":
      return parseIdentityDocument(text, fileName);
    case "SALARY_PROOF":
      return parseSalaryProof(text, fileName);
    case "DEBT_ENFORCEMENT_EXTRACT":
      return parseDebtExtract(text, fileName);
    case "PERMIT":
      return parsePermit(text, fileName);
    case "HOUSEHOLD_INSURANCE":
      return parseInsurance(text, fileName);
    case "INVOICE":
      return parseInvoice(text, fileName);
    default:
      return {
        docType: "UNKNOWN",
        confidence: 10,
        fields: {},
        summary: "Could not determine document type. Please classify it manually.",
      };
  }
}

/* ──────────────────────────────────────────────────────────
   Shared helpers for flexible field extraction
   ────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────
   Centralized label aliases (FR / DE / EN / IT / ES / PT)
   Each entry is an array of regex patterns that capture the value.
   ────────────────────────────────────────────────────────── */

const NAME_VALUE = `([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF '-]+)`;
const DATE_VALUE = `(\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{2,4})`;
const DATE_VALUE_ISO = `(\\d{4}-\\d{2}-\\d{2})`;
const DATE_VALUE_TEXT = `(\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{2,4})`;
const DOC_NUM_VALUE = `([A-Z0-9][A-Z0-9 \\-]{4,20})`;
const AMOUNT_VALUE = `([0-9][0-9\u2019'\u2018., ]+)`;

/** Build regex array from label alternatives + a value capture pattern */
function lbl(labels: string[], valuePat: string = NAME_VALUE): RegExp[] {
  // Join all label alternatives into one regex with alternation
  const alts = labels.join('|');
  return [
    // Same-line: "Label: Value" or "Label Value"
    new RegExp(`(?:${alts})[:\\s]+${valuePat}`, 'i'),
  ];
}

/** Pre-built label pattern sets for each field concept */
const LABELS = {
  // ── Identity fields ──
  lastName: lbl([
    'surname', 'family\\s*name', 'last\\s*name',
    'nom\\s*(?:de\\s*famille)?', 'nom\\s*patronymique', 'noms?',
    'nachname', 'familienname', 'name(?!\\s*line)',
    'cognome', 'apellido', 'apelido',
  ]),
  firstName: lbl([
    'given\\s*name(?:s)?', 'first\\s*name(?:s)?', 'forename(?:s)?', 'christian\\s*name',
    'pr[e\u00E9]nom(?:\\(s\\)|s)?', 'pr[e\u00E9]noms?',
    'vorname(?:n)?', 'vornamen',
    'nome', 'nombre', 'prenome',
  ]),
  dateOfBirth: [
    // Text-month dates first (e.g. "21 Jun 1993") — must precede numeric patterns
    // so same-line capture fires before the two-line fallback grabs the next line
    ...lbl([
      'date\\s*(?:of|de)\\s*(?:birth|naissance)',
      'birth\\s*date', 'born\\s*(?:on)?', 'DOB',
      'geburtsdatum', 'geb(?:oren)?(?:\\.)?\\s*(?:am)?',
    ], DATE_VALUE_TEXT),
    ...lbl([
      'date\\s*(?:of|de)\\s*(?:birth|naissance)',
      'birth\\s*date', 'born\\s*(?:on)?', 'DOB',
      'n[e\u00E9]e?\\s*le', 'date\\s*de\\s*naissance',
      'geburtsdatum', 'geb(?:oren)?(?:\\.)?\\s*(?:am)?',
      'data\\s*di\\s*nascita', 'fecha\\s*de\\s*nacimiento',
      'data\\s*de\\s*nascimento',
    ], DATE_VALUE),
    ...lbl([
      'date\\s*(?:of|de)\\s*(?:birth|naissance)',
      'birth\\s*date', 'DOB',
      'geburtsdatum', 'geb(?:oren)?(?:\\.)?',
      'n[e\u00E9]e?\\s*le',
    ], DATE_VALUE_ISO),
  ],
  nationality: lbl([
    'nationality', 'citizenship',
    'nationalit[e\u00E9]', 'citoyennet[e\u00E9]',
    'staatsangeh[\u00F6o]rigkeit', 'nationalit[\u00E4a]t',
    'cittadinanza', 'nacionalidad', 'nacionalidade',
  ]),
  documentNumber: lbl([
    'passport\\s*n[\u00B0o.]?', 'document\\s*n[\u00B0o.]?',
    'n[\u00B0o.]\\s*(?:du\\s*)?(?:document|passport|carte)',
    'ausweis[\\s-]*(?:nr|nummer)', 'card\\s*n[\u00B0o.]?',
    'num[e\u00E9]ro\\s*(?:de\\s*)?(?:document|carte|passeport)?',
    'document\\s*(?:number|no\\.?)',
    'pass(?:port)?\\s*(?:number|no\\.?|nr)',
    'ID\\s*(?:number|no\\.?|nr)',
  ], DOC_NUM_VALUE),
  sex: lbl([
    'sex[e]?', 'gender', 'genre',
    'geschlecht', 'sesso', 'sexo',
  ], '([MFmf]|male|female|masculin|f[e\u00E9]minin|m[\u00E4a]nnlich|weiblich|homme|femme)'),

  // ── Salary fields ──
  employer: lbl([
    'employer', 'company', 'firm',
    'employeur', 'soci[e\u00E9]t[e\u00E9]', 'entreprise', 'raison\\s*sociale',
    'arbeitgeber', 'firma', 'unternehmen', 'betrieb',
    'datore\\s*di\\s*lavoro', 'azienda',
    'empleador', 'empresa',
  ], `([A-Za-z\\u00C0-\\u00FF][A-Za-z\\u00C0-\\u00FF0-9 &.,\'()\\-]+)`),
  jobTitle: lbl([
    'function', 'job\\s*title', 'position', 'occupation', 'role', 'title',
    'fonction', 'poste', 'activit[e\u00E9]', 't[\u00E2a]che', 'm[e\u00E9]tier', 'emploi',
    'beruf', 'funktion', 'stelle', 't[\u00E4a]tigkeit',
    'qualifica', 'mansione', 'incarico',
    'puesto', 'cargo',
  ]),
  employeeName_de: lbl([
    'mitarbeiter(?:in)?', 'angestellt(?:e|er)?',
    'arbeitnehmer(?:in)?', 'personal',
  ]),
  employeeName_fr_en: lbl([
    'employee\\s*name', 'employee', 'collaborat(?:eur|rice)',
    'employ[e\u00E9]e?(?!ur)\\b', 'salari[e\u00E9]e?',
    'worker', 'staff\\s*(?:member|name)',
    'name\\s*(?:of\\s*)?employee',
    'dipendente', 'empleado',
  ]),
  salaryPeriod: lbl([
    'p[e\u00E9]riode', 'period', 'monat', 'mois', 'month',
    'zeitraum', 'abrechnungsmonat', 'mese',
  ]),

  // ── Permit fields ──
  permitType: lbl([
    'permit\\s*(?:type)?', 'permis(?:\\s*type)?',
    'bewilligung(?:\\s*typ)?', 'aufenthalts(?:bewilligung|titel)',
    'titre\\s*(?:de\\s*)?s[e\u00E9]jour', 'cat[e\u00E9]gorie',
    'category', 'type',
  ], '([A-Z])'),

  // ── Insurance fields ──
  insuranceCompany: lbl([
    'insurance\\s*(?:company|provider|firm)',
    'insured\\s*(?:by|with|through)',
    'insurer', 'compagnie\\s*(?:d.assurance)?',
    'assureur', 'soci[e\u00E9]t[e\u00E9]\\s*d.assurance',
    'gesellschaft', 'versicherer', 'versicherung(?:sgesellschaft)?',
  ]),
  policyNumber: lbl([
    'policy\\s*(?:number|no?\\.?|nr\\.?)',
    'police\\s*(?:n[\u00B0o.]?\\.?|nr\\.?|num[e\u00E9]ro)?',
    'n[\u00B0o.]?\\s*(?:de\\s*)?(?:police|contrat|vertrag)',
    'contrat\\s*(?:n[\u00B0o.]?\\.?|nr\\.?|num[e\u00E9]ro)?',
    'vertrag\\s*(?:nr?\\.?|nummer)?',
    'contract\\s*(?:number|no?\\.?|nr\\.?)',
    'police\\s*no?\\.?',
  ], `([A-Z0-9][A-Z0-9 .\\-\\/]+)`),

  // ── Debt fields ──
  debtPerson: lbl([
    'concernant', 'betreffend', 'regarding', 'pour',
    'nom', 'name', 'schuldner(?:in)?', 'debtor',
  ]),

  // ── Invoice fields ──
  vendorName: lbl([
    'vendor', 'supplier', 'from', 'seller',
    'fournisseur', 'lieferant', 'firma',
    'company', 'soci[eé]t[eé]', 'raison\\s*sociale',
    'Absender', 'de\\s*la\\s*part\\s*de',
  ], `([A-Za-z\\u00C0-\\u00FF][A-Za-z\\u00C0-\\u00FF0-9 &.,\\'()\\-]+)`),
  invoiceNumber: lbl([
    'invoice\\s*(?:no|number|nr|#|n[°o.])',
    'facture\\s*(?:no|num|n[°o.]|nr)',
    'rechnung\\s*(?:nr|nummer|no)',
    'bill\\s*(?:no|number|nr)',
    'beleg\\s*(?:nr|nummer)',
    'n[°o.]\\s*(?:de\\s*)?(?:facture|rechnung)',
  ], DOC_NUM_VALUE),
  invoiceDate: [
    ...lbl([
      'invoice\\s*date', 'date\\s*(?:de\\s*)?facture',
      'rechnungsdatum', 'datum', 'date',
    ], DATE_VALUE),
    ...lbl([
      'invoice\\s*date', 'date\\s*(?:de\\s*)?facture',
      'rechnungsdatum',
    ], DATE_VALUE_ISO),
  ],
  dueDate: [
    ...lbl([
      'due\\s*date', '[eé]ch[eé]ance', 'payable\\s*(?:by|before|until)',
      'f[aä]lligkeits?datum', 'zahlbar\\s*bis', 'date\\s*limite',
    ], DATE_VALUE),
    ...lbl([
      'due\\s*date', '[eé]ch[eé]ance',
      'f[aä]lligkeits?datum',
    ], DATE_VALUE_ISO),
  ],
  totalAmount: lbl([
    'total\\s*(?:amount|due|ttc)?', 'montant\\s*(?:total|ttc|d[ûu])',
    'gesamtbetrag', 'endbetrag', 'amount\\s*due',
    'total\\s*[aà]\\s*payer', 'zu\\s*zahlen',
  ], AMOUNT_VALUE),
  vatAmount: lbl([
    'vat', 'tva', 'mwst', 'mehrwertsteuer', 'tax',
    'taxe', 'imp[oô]t',
  ], AMOUNT_VALUE),
  subtotalAmount: lbl([
    'sub\\s*total', 'sous[\\s-]*total', 'netto', 'zwischensumme',
    'montant\\s*ht', 'total\\s*ht', 'amount\\s*excl',
  ], AMOUNT_VALUE),
};

/**
 * Detect OCR garbage lines — noisy output from background patterns,
 * holograms, watermarks, security features on ID cards.
 * Returns true if the line is likely noise, not real content.
 */
function isGarbageLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;
  // Count alpha chars vs special/noise chars
  const alphaCount = (trimmed.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const specialCount = (trimmed.match(/[{}()+<>£§°@#&|;!?=*^~`]/g) || []).length;
  // If more special chars than alpha, or very low alpha ratio, it's garbage
  if (specialCount > alphaCount && trimmed.length > 3) return true;
  if (alphaCount < trimmed.length * 0.3 && trimmed.length > 5) return true;
  // Lines of mostly single characters separated by spaces (OCR noise)
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    const singleCharWords = words.filter(w => w.length === 1).length;
    if (singleCharWords > words.length * 0.5) return true;
  }
  return false;
}

/**
 * Strip OCR noise prefix from a value line.
 * On ID cards, actual values often have leading garbage from the photo background,
 * e.g. "fA = A Schweizer Samples" → "Schweizer Samples"
 * e.g. "gs du 8° Helvetiaa" → "Helvetiaa"
 */
function stripOcrPrefix(value: string): string {
  // Try to find the start of actual name content:
  // Look for a title-case word (uppercase followed by lowercase) at least 3 chars,
  // preceded by noise characters
  const nameStart = value.match(/(?:^|[^A-Za-zÀ-ÿ])([A-ZÀ-Ý][a-zà-ÿ]{2,}(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*\s*)$/);
  if (nameStart && nameStart.index !== undefined) {
    return nameStart[1].trim();
  }
  // Try: everything after the last "= " or "= A " noise prefix
  const afterEquals = value.match(/=\s*(?:[A-Z]\s+)*([A-ZÀ-Ý][a-zà-ÿ]{2,}.*)$/);
  if (afterEquals) {
    return afterEquals[1].trim();
  }
  // Try: strip leading non-alpha characters and short words
  const stripped = value.replace(/^[^A-Za-zÀ-ÿ]+/, "").replace(/^([a-zà-ÿ]{1,2}\s+)+/, "");
  return stripped.trim() || value.trim();
}

/**
 * Search for a labeled value. Tries:
 *  1. "Label: Value" or "Label Value" on the same line
 *  2. Label on one line, value on the next non-garbage line (skips up to 2 noise lines)
 * Returns the captured group from the first matching pattern.
 */
function findLabeledValue(text: string, labelPatterns: RegExp[], valuePattern?: RegExp): string | null {
  const lines = text.split(/\n/);

  for (const labelRx of labelPatterns) {
    // 1. Same-line match (the regex itself captures the value)
    for (const line of lines) {
      const m = line.match(labelRx);
      if (m && m[1] !== undefined) {
        const val = m[1].trim();
        if (val.length > 0) return val;
      }
    }

    // 2. Label-only on one line, value on the next line
    // Build a label-only regex by removing the capture group + trailing [:\s]+
    const stripped = labelRx.source
      .replace(/\((?!\?)[^)]*\)/, "")   // remove value capture group
      .replace(/\[:[^]*$/, "")          // remove trailing char class remnants
      .replace(/\[:\\\\s\]\+\s*$/, "")  // remove trailing [:\s]+
      .replace(/\s*$/, "");             // trim
    const labelOnly = new RegExp(stripped, "i");
    for (let i = 0; i < lines.length - 1; i++) {
      const lineTrimmed = lines[i].trim();
      if (labelOnly.test(lineTrimmed) && lines[i + 1].trim().length > 0) {
        const nextVal = lines[i + 1].trim();
        if (nextVal.length > 0 && nextVal.length < 80 && !/^[A-ZÀ-Ý][a-zà-ÿ(]{1,}[A-Za-zÀ-ÿ() ]*\s*:/.test(nextVal)) {
          if (!valuePattern || valuePattern.test(nextVal)) {
            return nextVal;
          }
        }
      }
    }
  }
  return null;
}

/** Find all dates in text (dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd, dd mm yyyy, etc.) */
function findDates(text: string): { raw: string; normalized: string; index: number }[] {
  const results: { raw: string; normalized: string; index: number }[] = [];
  const euroRe = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g;
  let m;
  while ((m = euroRe.exec(text)) !== null) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    const day = parseInt(d), month = parseInt(mo);
    if (month > 12 || day > 31) continue;
    results.push({
      raw: m[0],
      normalized: `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
      index: m.index,
    });
  }
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = isoRe.exec(text)) !== null) {
    if (!results.some(r => r.index === m!.index)) {
      results.push({ raw: m[0], normalized: m[0], index: m.index });
    }
  }
  // Space-separated dates: "01 08 1995" (common on Swiss ID cards)
  const spaceRe = /\b(\d{2})\s+(\d{2})\s+(\d{4})\b/g;
  while ((m = spaceRe.exec(text)) !== null) {
    if (!results.some(r => Math.abs(r.index - m!.index) < 5)) {
      const [, d, mo, y] = m;
      const day = parseInt(d), month = parseInt(mo);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        results.push({
          raw: m[0],
          normalized: `${y}-${mo}-${d}`,
          index: m.index,
        });
      }
    }
  }
  return results;
}

/** Find all CHF amounts in text */
function findAmounts(text: string): { raw: string; value: number; index: number }[] {
  const results: { raw: string; value: number; index: number }[] = [];
  // CHF prefix: "CHF 1'234.56" or "CHF1234" or "Fr. 1234"
  const chfRe = /(?:CHF|Fr\.?)\s*([0-9][0-9'''., ]*[0-9](?:\.\d{1,2})?)/gi;
  let m;
  while ((m = chfRe.exec(text)) !== null) {
    const val = parseSwissAmount(m[1]);
    if (val > 0) results.push({ raw: m[0], value: val, index: m.index });
  }
  // Standalone Swiss-style amounts: 6'450.00 or 12'350
  const swissRe = /\b(\d{1,3}'(?:\d{3}'?)*(?:\.\d{1,2})?)\b/g;
  while ((m = swissRe.exec(text)) !== null) {
    const val = parseSwissAmount(m[1]);
    if (val > 100 && !results.some(r => Math.abs(r.index - m!.index) < 10 && r.value === val)) {
      results.push({ raw: m[0], value: val, index: m.index });
    }
  }
  return results;
}

/** Try to parse "DUPONT Jean-Pierre" or "Jean-Pierre Dupont" from a line */
function extractNameFromLine(line: string): { firstName: string; lastName: string } | null {
  const trimmed = line.trim();

  // "UPPERCASE Mixed" pattern (DUPONT Jean-Pierre)
  const upperFirst = trimmed.match(/^([A-ZÀ-Ý][A-ZÀ-Ý '-]+)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:[-\s]+[A-ZÀ-ÿ][a-zà-ÿ]+)*)$/);
  if (upperFirst && upperFirst[1].length >= 2 && upperFirst[2].length >= 2) {
    return { lastName: titleCase(upperFirst[1].trim()), firstName: upperFirst[2].trim() };
  }

  // "Mixed UPPERCASE" pattern (Jean-Pierre DUPONT)
  const upperLast = trimmed.match(/^([A-ZÀ-ÿ][a-zà-ÿ]+(?:[-\s]+[A-ZÀ-ÿ][a-zà-ÿ]+)*)\s+([A-ZÀ-Ý][A-ZÀ-Ý '-]+)$/);
  if (upperLast && upperLast[2].length >= 2 && upperLast[1].length >= 2) {
    return { firstName: upperLast[1].trim(), lastName: titleCase(upperLast[2].trim()) };
  }

  // "Last, First" with comma
  const commaPat = trimmed.match(/^([A-ZÀ-ÿ][A-Za-zÀ-ÿ '-]+)\s*,\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ '-]+)$/);
  if (commaPat && commaPat[1].length >= 2 && commaPat[2].length >= 2) {
    return { lastName: cleanName(commaPat[1]), firstName: cleanName(commaPat[2]) };
  }

  return null;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (_, sep, c) => sep + c.toUpperCase());
}

/* ──────────────────────────────────────────────────────────
   OCR-tolerant fuzzy field extraction for identity documents
   ────────────────────────────────────────────────────────── */

/**
 * When exact-label regex parsing fails (OCR garbles labels),
 * use structural heuristics on the text to extract fields.
 *
 * Strategy:
 * 1. Find lines that look like passport labels (even garbled)
 * 2. The value is on the same line after : or / or on the next line
 * 3. Look for standalone ALL-CAPS words (names), dates, M/F markers
 */
function extractFieldsFromOcrText(text: string): Partial<MRZResult> {
  const result: Partial<MRZResult> = {};
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  // ── Find lines near passport-like keywords (fuzzy) ──
  // These patterns tolerate 1-2 char OCR errors in labels
  const lastNameHints = /s[uü]rn|fam.{0,3}n|nom\b|nach.?n|cogn|l.{0,2}st\s*n|ape/i;
  const firstNameHints = /gi?v.{0,3}n.{0,3}n|[fp]r[eéè]n|vorn|first\s*n|given|nomi\b|nombre/i;
  const dobHints = /birth|naiss|geburt|nascit|geb[.\s]|d[.\s]?o[.\s]?b|n[eéè]+?\s*le/i;
  const natHints = /nat.{0,5}lit|citiz|citoy|staats|citt/i;
  const sexHints = /^se[xk]|gender|genre|geschl|sesso/i;
  const docNumHints = /pass.{0,5}n|doc.{0,5}n|ausweis|carte|num[eé]ro/i;

  /** Find the next non-garbage line value starting from index j */
  function findNextGoodLine(startIdx: number, maxLookAhead: number = 3): string {
    for (let j = startIdx; j < Math.min(startIdx + maxLookAhead, lines.length); j++) {
      const candidate = lines[j].trim();
      if (candidate.length === 0) continue;
      if (isGarbageLine(candidate)) continue;
      return candidate;
    }
    return "";
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract value: either after : on same line, or on next non-garbage line
    const afterColon = line.match(/[:\-]\s*(.+)$/);
    const sameLineValue = afterColon ? afterColon[1].trim() : "";
    const nextLineValue = findNextGoodLine(i + 1);

    // Pick the most likely value: prefer same-line, fall back to next non-garbage line
    // A "good" value for a name is 2+ alpha chars, not a label itself
    function pickValue(hint: RegExp): string {
      if (sameLineValue.length >= 2 && !hint.test(sameLineValue) && /[A-Za-zÀ-ÿ]{2,}/.test(sameLineValue)) {
        return sameLineValue;
      }
      if (nextLineValue.length >= 2 && !hint.test(nextLineValue) && /[A-Za-zÀ-ÿ]{2,}/.test(nextLineValue)) {
        return nextLineValue;
      }
      return "";
    }

    if (!result.lastName && lastNameHints.test(line)) {
      const v = pickValue(lastNameHints);
      if (v) result.lastName = cleanName(stripOcrPrefix(v));
    }
    if (!result.firstName && firstNameHints.test(line)) {
      const v = pickValue(firstNameHints);
      if (v) result.firstName = cleanName(stripOcrPrefix(v));
    }
    if (!result.dateOfBirth && dobHints.test(line)) {
      // Look for date pattern on same line or next few non-garbage lines (with space-separated support)
      const dateRe = /(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})|(\d{2}\s+\d{2}\s+\d{4})/;
      const dateInLine = line.match(dateRe);
      let dateFound = dateInLine?.[0];
      if (!dateFound) {
        // Search up to 3 lines ahead for a date
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          const dMatch = lines[i + j].match(dateRe);
          if (dMatch) { dateFound = dMatch[0]; break; }
        }
      }
      if (dateFound) {
        // Space-separated date: "01 08 1995" → "01.08.1995"
        const spaceDateM = dateFound.match(/^(\d{2})\s+(\d{2})\s+(\d{4})$/);
        if (spaceDateM) {
          dateFound = `${spaceDateM[1]}.${spaceDateM[2]}.${spaceDateM[3]}`;
        }
        result.dateOfBirth = normalizeDate(dateFound);
      }
    }
    if (!result.nationality && natHints.test(line)) {
      const v = pickValue(natHints);
      if (v) result.nationality = mapNationality(v.substring(0, 40));
    }
    if (!result.sex && sexHints.test(line)) {
      const sexM = (sameLineValue + " " + nextLineValue).match(/\b([MFmf])\b|male|female|masculin|f[eé]minin|m[äa]nnlich|weiblich|homme|femme/i);
      if (sexM) {
        const s = sexM[1] || sexM[0].charAt(0);
        result.sex = s.toUpperCase() === "F" || /^(f|w)/i.test(sexM[0]) ? "F" : "M";
      }
    }
    if (!result.documentNumber && docNumHints.test(line)) {
      // Document number: alphanumeric 6-10 chars
      const numMatch = (sameLineValue + " " + nextLineValue).match(/\b([A-Z0-9]{6,10})\b/);
      if (numMatch) result.documentNumber = numMatch[1];
    }
  }

  // ── Swiss ID card: compact sex + nationality line: "= F CHE" or "F CHE" ──
  if (!result.sex || !result.nationality) {
    for (const line of lines) {
      const compact = line.match(/^\s*=?\s*([MF])\s+([A-Z]{2,3})\s*$/);
      if (compact) {
        if (!result.sex) result.sex = compact[1];
        if (!result.nationality) result.nationality = mapNationality(compact[2]);
      }
    }
  }

  // ── Fallback: find ALL-CAPS names near the top (passport layout) ──
  if (!result.lastName) {
    // On passports, the surname is typically in ALL CAPS near the top
    const topLines = lines.slice(0, Math.min(lines.length, 15));
    for (const line of topLines) {
      // ALL-CAPS line with only letters, hyphens, spaces, 2-30 chars
      if (/^[A-ZÀ-Ý][A-ZÀ-Ý\s\-']{1,29}$/.test(line) && line.length >= 2 && line.length <= 30) {
        // Skip known header words
        if (/^(PASS|PASSPORT|PASSEPORT|REISE|SCHWEIZ|SUISSE|SVIZZERA|CONFED|EIDGEN|IDENTITY|CARTE)/i.test(line)) continue;
        if (!result.lastName) {
          result.lastName = titleCase(line.trim());
          break;
        }
      }
    }
  }

  // ── Fallback: standalone date in birth-year range ──
  if (!result.dateOfBirth) {
    const dates = findDates(text);
    for (const d of dates) {
      const year = parseInt(d.normalized.substring(0, 4));
      if (year >= 1940 && year <= 2010) {
        result.dateOfBirth = d.normalized;
        break;
      }
    }
  }

  if (Object.keys(result).length > 0) {
    console.log(`[DOC-SCAN] OCR fuzzy extraction found: ${Object.entries(result).map(([k,v]) => `${k}=${v}`).join(", ")}`);
  }
  return result;
}

/* ──────────────────────────────────────────────────────────
   Identity document parser
   ────────────────────────────────────────────────────────── */

function parseIdentityDocument(text: string, fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 50;

  // ──── 1. Try MRZ parsing first (most reliable) ────
  const mrz = parseMRZ(text);
  if (mrz) {
    if (mrz.lastName) { fields.lastName = mrz.lastName; confidence += 15; }
    if (mrz.firstName) { fields.firstName = mrz.firstName; confidence += 10; }
    if (mrz.dateOfBirth) { fields.dateOfBirth = mrz.dateOfBirth; confidence += 10; }
    if (mrz.nationality) { fields.nationality = mrz.nationality; confidence += 5; }
    if (mrz.documentNumber) { fields.documentNumber = mrz.documentNumber; confidence += 5; }
    if (mrz.sex) { fields.sex = mrz.sex; }
  }

  // ──── 2. Labeled field extraction (FR/DE/EN/IT) ────

  if (!fields.lastName) {
    const v = findLabeledValue(text, LABELS.lastName);
    if (v) { fields.lastName = cleanName(v); confidence += 10; }
  }

  if (!fields.firstName) {
    const v = findLabeledValue(text, LABELS.firstName);
    if (v) { fields.firstName = cleanName(v); confidence += 10; }
  }

  if (!fields.dateOfBirth) {
    const v = findLabeledValue(text, LABELS.dateOfBirth);
    if (v) { fields.dateOfBirth = normalizeDate(v); confidence += 10; }
  }

  if (!fields.nationality) {
    const v = findLabeledValue(text, LABELS.nationality);
    if (v) {
      fields.nationality = mapNationality(v.trim().substring(0, 40));
      confidence += 5;
    }
  }

  if (!fields.documentNumber) {
    const v = findLabeledValue(text, LABELS.documentNumber);
    if (v) { fields.documentNumber = v.replace(/\s/g, ""); confidence += 5; }
  }

  // ──── 2b. OCR-tolerant fuzzy field extraction ────
  // When exact regex labels fail (garbled OCR), look for patterns
  // near words that resemble labels even with OCR errors
  if (!fields.lastName || !fields.firstName || !fields.dateOfBirth) {
    const ocrFields = extractFieldsFromOcrText(text);
    if (ocrFields.lastName && !fields.lastName) {
      fields.lastName = ocrFields.lastName; confidence += 8;
    }
    if (ocrFields.firstName && !fields.firstName) {
      fields.firstName = ocrFields.firstName; confidence += 8;
    }
    if (ocrFields.dateOfBirth && !fields.dateOfBirth) {
      fields.dateOfBirth = ocrFields.dateOfBirth; confidence += 6;
    }
    if (ocrFields.nationality && !fields.nationality) {
      fields.nationality = ocrFields.nationality; confidence += 4;
    }
    if (ocrFields.sex && !fields.sex) {
      fields.sex = ocrFields.sex;
    }
    if (ocrFields.documentNumber && !fields.documentNumber) {
      fields.documentNumber = ocrFields.documentNumber; confidence += 4;
    }
  }

  // ──── 2c. Swiss ID card structural extraction ────
  // Swiss ID cards (front) have no MRZ and a unique layout where multilingual
  // labels are on one line, followed by noise lines from the photo background,
  // then the actual value. Standard label→next-line matching picks up garbage.
  // Detect: look for IDENTITÄTSKARTE / CARTE D'IDENTITÉ / IDENTITY CARD in text
  const isSwissIdCard = /IDENTIT[ÄA]TSKARTE|CARTE\s*D.IDENTIT[ÉE]|IDENTITY\s*CARD/i.test(text);
  if (isSwissIdCard) {
    const idLines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    console.log(`[DOC-SCAN] Swiss ID card detected — running structural extraction`);

    // Validate existing values — if they look like garbage, clear them
    function looksLikeName(v: unknown): boolean {
      if (typeof v !== "string") return false;
      // A good name has at least one word of 3+ alpha chars with title-case or all-caps
      return /[A-ZÀ-Ý][a-zà-ÿ]{2,}|^[A-ZÀ-Ý]{3,}$/.test(v);
    }
    if (fields.lastName && !looksLikeName(fields.lastName)) {
      delete fields.lastName; confidence -= 10;
    }
    if (fields.firstName && !looksLikeName(fields.firstName)) {
      delete fields.firstName; confidence -= 10;
    }
    // Validate dateOfBirth — must be a proper date format
    if (fields.dateOfBirth && typeof fields.dateOfBirth === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(fields.dateOfBirth as string)) {
      delete fields.dateOfBirth; confidence -= 10;
    }
    // Validate nationality — must be 2-3 uppercase letters or a known nationality word
    if (fields.nationality && typeof fields.nationality === "string" && !/^[A-Z]{2,3}$/.test(fields.nationality as string)) {
      delete fields.nationality; confidence -= 5;
    }

    // Strategy: find multilingual label lines, then scan nearby for actual values
    for (let i = 0; i < idLines.length; i++) {
      const line = idLines[i];

      // --- Name extraction ---
      // Label: "Name = Nom = Cognome = Num = Surname"
      if (!fields.lastName && /\bName\b.*\bNom\b|\bSurname\b.*\bCognome\b|\bNom\b.*\bSurname\b/i.test(line)) {
        // Search next 3 lines for a title-case name
        for (let j = 1; j <= 3 && i + j < idLines.length; j++) {
          const candidate = idLines[i + j];
          const nameMatch = candidate.match(/([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)\s*$/);
          if (nameMatch && nameMatch[1].length >= 3) {
            fields.lastName = cleanName(nameMatch[1]);
            confidence += 10;
            break;
          }
        }
      }

      // --- First name extraction ---
      // Label: "Vorname(n) « Prénom(s) = Nome(i) = Given name(s)"
      if (!fields.firstName && /Vorname|Pr[eéè]nom|Given\s*name/i.test(line)) {
        for (let j = 1; j <= 3 && i + j < idLines.length; j++) {
          const candidate = idLines[i + j];
          const nameMatch = candidate.match(/([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)*)\s*$/);
          if (nameMatch && nameMatch[1].length >= 3) {
            // Clean trailing OCR artifacts (e.g. "Helvetiaa" → "Helvetia")
            let firstName = nameMatch[1];
            // If last letter is duplicated (OCR stutter), remove it
            if (firstName.length >= 4 && firstName.charAt(firstName.length - 1) === firstName.charAt(firstName.length - 2)) {
              firstName = firstName.substring(0, firstName.length - 1);
            }
            fields.firstName = cleanName(firstName);
            confidence += 10;
            break;
          }
        }
      }

      // --- Sex + Nationality from compact line: "= F CHE" or "F CHE" ---
      if ((!fields.sex || !fields.nationality) && /^\s*=?\s*[MF]\s+[A-Z]{2,3}\s*$/.test(line)) {
        const compact = line.match(/([MF])\s+([A-Z]{2,3})/);
        if (compact) {
          if (!fields.sex) fields.sex = compact[1];
          if (!fields.nationality) { fields.nationality = mapNationality(compact[2]); confidence += 5; }
        }
      }

      // --- DOB from space-separated date: "| 01 08 1995 : 22 05 2055" ---
      if (!fields.dateOfBirth && /Geburtsdatum|Date\s*de\s*naissance|Date\s*of\s*birth/i.test(line)) {
        for (let j = 1; j <= 4 && i + j < idLines.length; j++) {
          const candidate = idLines[i + j];
          const spaceDate = candidate.match(/\b(\d{2})\s+(\d{2})\s+(\d{4})\b/);
          if (spaceDate) {
            const [, d, mo, y] = spaceDate;
            const day = parseInt(d), month = parseInt(mo), year = parseInt(y);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1930 && year <= 2010) {
              fields.dateOfBirth = `${y}-${mo}-${d}`;
              confidence += 10;
              break;
            }
          }
          // Also try standard date formats
          const stdDate = candidate.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
          if (stdDate) {
            const normalized = normalizeDate(stdDate[0]);
            const year = parseInt(normalized.substring(0, 4));
            if (year >= 1930 && year <= 2010) {
              fields.dateOfBirth = normalized;
              confidence += 10;
              break;
            }
          }
        }
      }
    }
  }

  // ──── 3. Date fallback: find plausible birth dates ────
  if (!fields.dateOfBirth) {
    const dates = findDates(text);
    // Prefer date near birth keyword
    for (const d of dates) {
      const year = parseInt(d.normalized.substring(0, 4));
      if (year >= 1930 && year <= 2010) {
        const nearby = text.substring(Math.max(0, d.index - 80), d.index + 30).toLowerCase();
        if (/birth|naissance|geburt|nascita|n[eé]e?(\s|$)/.test(nearby)) {
          fields.dateOfBirth = d.normalized;
          confidence += 8;
          break;
        }
      }
    }
    // Fallback: first date in birth-year range
    if (!fields.dateOfBirth) {
      for (const d of dates) {
        const year = parseInt(d.normalized.substring(0, 4));
        if (year >= 1930 && year <= 2010) {
          fields.dateOfBirth = d.normalized;
          confidence += 4;
          break;
        }
      }
    }
  }

  // ──── 4. Name fallback: look for standalone name lines ────
  if (!fields.lastName || !fields.firstName) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 3 && l.length < 50);
    for (const line of lines) {
      if (/\d{3,}|CHF|www\.|@|http|--/i.test(line)) continue;
      const name = extractNameFromLine(line);
      if (name) {
        if (!fields.lastName) fields.lastName = name.lastName;
        if (!fields.firstName) fields.firstName = name.firstName;
        confidence += 5;
        break;
      }
    }
  }

  // ──── 5. Sex / Gender ────
  if (!fields.sex) {
    const v = findLabeledValue(text, LABELS.sex);
    if (v) {
      const s = v.charAt(0).toUpperCase();
      if (s === "M" || s === "F" || s === "W" || s === "H") {
        fields.sex = (s === "W" || s === "F") ? "F" : "M";
      }
    }
  }

  if (Object.keys(fields).length === 0) confidence = 30;

  return {
    docType: "IDENTITY",
    confidence: Math.min(confidence, 95),
    fields,
    summary: buildSummary("identity document", fields),
  };
}

/* ── MRZ (Machine Readable Zone) parsing ───────────────── */

interface MRZResult {
  lastName?: string;
  firstName?: string;
  dateOfBirth?: string;
  nationality?: string;
  documentNumber?: string;
  sex?: string;
}

/**
 * Clean a line to recover MRZ characters from OCR noise.
 * Tesseract commonly misreads < as «, (, c, {, [, or adds spaces.
 */
function cleanMrzLine(line: string): string {
  return line
    .replace(/\s/g, "")                 // strip all whitespace
    .replace(/[«»(){}[\]|¢©®]/g, "<")   // OCR misreads of <
    .replace(/[,;.!?]/g, "<")           // punctuation → <
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .toUpperCase();
}

/**
 * Clean a name extracted from MRZ. Strips OCR artifacts where
 * Tesseract read the `<<<` padding as garbled letters.
 * e.g., "HANS PETER   Zzzzezllellllllllll" → "HANS PETER"
 */
function cleanMrzName(raw: string): string {
  let name = raw.trim();
  // Strip trailing runs of repeated/garbled characters (OCR artifacts from <<< padding)
  // Pattern: 3+ consecutive chars where most are the same letter, or mixed z/l/e/i junk
  name = name.replace(/\s+[zleio0]{3,}$/i, "");
  // Strip trailing whitespace + single lowercase gibberish words
  name = name.replace(/\s+[a-z]{1,3}$/g, "").trim();
  // More aggressive: strip anything after 3+ consecutive spaces
  name = name.replace(/\s{3,}.*$/, "").trim();
  // Strip trailing non-alpha characters
  name = name.replace(/[^A-Za-zÀ-ÿ\s-]+$/, "").trim();
  return name;
}

function parseMRZ(text: string): MRZResult | null {
  // ── 1. Try to find clean MRZ lines ──
  const lines = text.split(/\n/).map(l => l.trim());

  // First pass: try exact MRZ detection (clean OCR)
  // MRZ lines MUST contain < characters (they're the defining feature)
  let mrzLines = lines
    .map(l => l.replace(/\s/g, ""))
    .filter(l => {
      const ascii = l.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return /^[A-Z0-9<]{28,45}$/.test(ascii) && l.length >= 28 && ascii.includes("<");
    });

  // Second pass: OCR-tolerant MRZ detection
  // Tesseract often reads < as «, (, c, {, [, or inserts spaces
  if (mrzLines.length < 2) {
    mrzLines = lines
      .map(l => cleanMrzLine(l))
      .filter(l => /^[A-Z0-9<]{28,45}$/.test(l) && l.length >= 28 && l.includes("<") &&
        // Must have at least 3 < chars to be a real MRZ line (not just a long word)
        (l.match(/</g) || []).length >= 3);
  }

  // Third pass: look for MRZ-shaped segments in the full text
  // Only used when first two passes found nothing or partial results
  if (mrzLines.length < 2) {
    // Search line by line for P< prefix (most reliable MRZ indicator)
    for (const line of lines) {
      const cleaned = cleanMrzLine(line);
      // P< name line: P<CCCNAME<<GIVEN<<<...
      if (/^P<[A-Z]{3}[A-Z<]{20,}$/.test(cleaned) && cleaned.length >= 28 && !mrzLines.includes(cleaned)) {
        mrzLines.push(cleaned);
      }
      // Data line: alphanumeric with digits and < padding, must have 6+ consecutive digits
      if (/^[A-Z0-9][A-Z0-9<]{27,}$/.test(cleaned) && /\d{6}/.test(cleaned) &&
          (cleaned.match(/</g) || []).length >= 3 && !mrzLines.includes(cleaned) &&
          !/^P</.test(cleaned)) {
        mrzLines.push(cleaned);
      }
    }
  }

  // Fourth pass: extract MRZ fragments embedded within noisy lines
  // Real passport photos often produce OCR where MRZ characters are
  // concatenated with surrounding noise (holograms, watermarks, security patterns)
  // e.g. "Ey Ea A PMCHESCHWEIZER<SAMPLE<<HELVETIA<<<<<<<<<<<<<"
  if (mrzLines.length < 2) {
    for (const line of lines) {
      const cleaned = cleanMrzLine(line);
      // Look for P<CCC pattern embedded anywhere in the line (name line)
      if (!mrzLines.some(l => /^P[<CIACV]/.test(l))) {
        const pIdx = cleaned.indexOf("P<");
        // Also try PM, PI — OCR commonly misreads P< as PM, PI, etc.
        const pmIdx = /PM[A-Z]{3}[A-Z<]{5,}<</.test(cleaned) ? cleaned.search(/PM[A-Z]{3}/) : -1;
        const bestIdx = pIdx >= 0 ? pIdx : pmIdx;
        if (bestIdx >= 0) {
          let candidate = cleaned.substring(bestIdx);
          // Fix PM→P< at start (OCR misread)
          if (candidate.startsWith("PM") && !candidate.startsWith("P<")) {
            candidate = "P<" + candidate.substring(2);
          }
          // Trim trailing non-MRZ garbage (anything after valid MRZ chars)
          candidate = candidate.replace(/[^A-Z0-9<]+.*$/, "");
          if (candidate.length >= 28 && candidate.length <= 50 &&
              (candidate.match(/</g) || []).length >= 3 &&
              /^P<[A-Z]{2,3}/.test(candidate) && !mrzLines.includes(candidate)) {
            mrzLines.push(candidate);
          }
        }
      }
      // Look for data line fragment: starts with alphanumeric doc number, contains digits
      if (!mrzLines.some(l => !/^P</.test(l) && /\d{6}/.test(l))) {
        // Strategy: find country code (3 uppercase letters) followed by 6-digit DOB
        // then walk backwards to find doc number start (9 chars + 1 check before country)
        const countryDobMatch = cleaned.match(/([A-Z]{3})(\d{6})/);
        if (countryDobMatch && countryDobMatch.index !== undefined) {
          const countryIdx = countryDobMatch.index;
          // MRZ data line: pos 0-8=docNum, 9=check, 10-12=country, 13-18=DOB
          // So country code should be at offset 10 from line start
          const lineStart = Math.max(0, countryIdx - 10);
          let candidate = cleaned.substring(lineStart);
          candidate = candidate.replace(/[^A-Z0-9<]+.*$/, "");
          if (candidate.length >= 28 && candidate.length <= 50 &&
              /\d{6}/.test(candidate) && !mrzLines.includes(candidate)) {
            mrzLines.push(candidate);
          }
        }
        // Fallback: original pattern match
        if (!mrzLines.some(l => !/^P</.test(l) && /\d{6}/.test(l))) {
          const dataMatch = cleaned.match(/[A-Z0-9]{6,9}<*\d[A-Z]{2,3}\d{6}/);
          if (dataMatch) {
            const startIdx = cleaned.indexOf(dataMatch[0]);
            let candidate = cleaned.substring(startIdx);
            candidate = candidate.replace(/[^A-Z0-9<]+.*$/, "");
            if (candidate.length >= 28 && candidate.length <= 50 &&
                /\d{6}/.test(candidate) && !mrzLines.includes(candidate)) {
              mrzLines.push(candidate);
            }
          }
        }
      }
    }
  }

  // Fifth pass: look for << clusters that indicate MRZ padding/separators
  // MRZ name lines always have << as name separator and <<<+ as padding
  if (mrzLines.length < 2) {
    for (const line of lines) {
      // Skip short lines — MRZ requires substantial content
      if (line.length < 25) continue;
      // Look for any segment that contains << (the MRZ separator)
      const cleaned = cleanMrzLine(line);
      const ddIdx = cleaned.indexOf("<<");
      if (ddIdx < 0) continue;
      // Walk backward to find start of MRZ-like segment
      let start = ddIdx;
      while (start > 0 && /[A-Z0-9<]/.test(cleaned.charAt(start - 1))) start--;
      let end = ddIdx;
      while (end < cleaned.length && /[A-Z0-9<]/.test(cleaned.charAt(end))) end++;
      const candidate = cleaned.substring(start, end);
      if (candidate.length >= 28 && candidate.length <= 50 &&
          (candidate.match(/</g) || []).length >= 3 &&
          !mrzLines.includes(candidate)) {
        // Classify: does it look like a name line or data line?
        if (/^P<[A-Z]{2,3}/.test(candidate) || /^[PIACV][A-Z<]/.test(candidate)) {
          mrzLines.push(candidate);
        } else if (/\d{6}/.test(candidate)) {
          mrzLines.push(candidate);
        }
      }
    }
  }

  if (mrzLines.length < 2) return null;

  console.log(`[DOC-SCAN] Found ${mrzLines.length} MRZ line(s): ${mrzLines.map(l => l.substring(0, 20) + "…").join(", ")}`);

  const result: MRZResult = {};

  // Find name line (starts with P< or I< or A< or V<)
  const nameLine = mrzLines.find(l => {
    const ascii = l.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return /^[PIACV][A-Z<]/.test(ascii);
  });
  if (nameLine) {
    // Normalize to ASCII for MRZ parsing (Ü→U, É→E, etc.)
    const nLine = nameLine.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Format: P<FRASMITH<<JOHN<PAUL<<<<...
    // Country code is chars 2-5 (before first <<)
    const natCode = nLine.substring(2, 5).replace(/</g, "");
    if (natCode.length >= 2) result.nationality = mapNationality(natCode);

    const namesPart = nLine.substring(5);
    const parts = namesPart.split("<<");
    if (parts.length >= 1) {
      const last = parts[0].replace(/</g, " ").trim();
      if (last) result.lastName = titleCase(cleanMrzName(last));
    }
    if (parts.length >= 2) {
      const first = parts.slice(1).join(" ").replace(/</g, " ").trim();
      if (first) result.firstName = titleCase(cleanMrzName(first));
    }
  }

  // Find data line (the one with numbers — doc number, DOB, etc.)
  // First try: exact match; Second try: apply OCR digit correction
  let dataLine = mrzLines.find(l => l !== nameLine && /\d{6,}/.test(l));
  if (!dataLine) {
    // OCR commonly misreads digits: O→0, G→6, B→8, S→5, I→1, Z→2
    dataLine = mrzLines.find(l => {
      if (l === nameLine) return false;
      const corrected = l.replace(/O/g, "0").replace(/G/g, "6").replace(/B/g, "8")
        .replace(/S(?=\d)/g, "5").replace(/I(?=\d)/g, "1").replace(/Z(?=\d)/g, "2");
      return /\d{6,}/.test(corrected);
    });
    if (dataLine) {
      dataLine = dataLine.replace(/O/g, "0").replace(/G/g, "6").replace(/B/g, "8")
        .replace(/S(?=\d)/g, "5").replace(/I(?=\d)/g, "1").replace(/Z(?=\d)/g, "2");
    }
  }
  if (dataLine && dataLine.length >= 28) {
    // Extract 6-digit YYMMDD sequences
    const dateMatches: string[] = [];
    for (let i = 0; i <= dataLine.length - 6; i++) {
      const chunk = dataLine.substring(i, i + 6);
      if (/^\d{6}$/.test(chunk)) {
        const mm = parseInt(chunk.substring(2, 4));
        const dd = parseInt(chunk.substring(4, 6));
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          dateMatches.push(chunk);
          i += 5; // skip past this match
        }
      }
    }

    if (dateMatches.length > 0) {
      const dob = dateMatches[0];
      const yy = parseInt(dob.substring(0, 2));
      const year = yy > 30 ? 1900 + yy : 2000 + yy;
      result.dateOfBirth = `${year}-${dob.substring(2, 4)}-${dob.substring(4, 6)}`;
    }

    // Sex: M or F typically after DOB+check digit
    const sexIdx = dataLine.search(/[MF<](?=\d{6})/);
    if (sexIdx >= 0) {
      const s = dataLine.charAt(sexIdx);
      if (s === "M" || s === "F") result.sex = s;
    } else {
      // Simpler: find any M or F that's between two digit sequences
      const sexMatch = dataLine.match(/\d([MF])\d/);
      if (sexMatch) result.sex = sexMatch[1];
    }

    // Document number: use country code position as landmark
    // MRZ data line: pos 0-8=docNum, 9=check, 10-12=country, 13-18=DOB
    const countryMatch = dataLine.match(/([A-Z]{3})\d{6}/);
    if (countryMatch && countryMatch.index !== undefined && countryMatch.index >= 10) {
      const docNumEnd = countryMatch.index - 1; // skip check digit
      const docNumStart = Math.max(0, countryMatch.index - 10);
      let rawDocNum = dataLine.substring(docNumStart, docNumEnd).replace(/</g, "");
      // Apply OCR digit correction: letters that are surrounded by digits are likely misread
      // Common: O→0, G→6, B→8, S→5, I→1, Z→2
      rawDocNum = rawDocNum.replace(/(?<=\d)O/g, "0").replace(/(?<=\d)G/g, "6")
        .replace(/(?<=\d)B/g, "8").replace(/(?<=\d)S/g, "5")
        .replace(/(?<=\d)I/g, "1").replace(/(?<=\d)Z/g, "2")
        .replace(/O(?=\d)/g, "0").replace(/G(?=\d)/g, "6")
        .replace(/B(?=\d)/g, "8").replace(/S(?=\d)/g, "5")
        .replace(/I(?=\d)/g, "1").replace(/Z(?=\d)/g, "2");
      if (rawDocNum.length >= 5) result.documentNumber = rawDocNum;
    }
    // Fallback: first alphanumeric block (usually 9 chars)
    if (!result.documentNumber) {
      const docMatch = dataLine.match(/^([A-Z0-9]{6,9})\d/);
      if (docMatch) result.documentNumber = docMatch[1].replace(/</g, "");
    }
  }

  if (result.lastName || result.firstName) return result;
  return null;
}

/* ──────────────────────────────────────────────────────────
   Salary proof parser
   ────────────────────────────────────────────────────────── */

function parseSalaryProof(text: string, fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 50;

  // ──── 1. Employer name ────
  const employer = findLabeledValue(text, LABELS.employer);
  if (employer) {
    fields.employer = employer.substring(0, 80);
    confidence += 10;
  }

  // Employer fallback: first line often IS the company name on payslips
  if (!fields.employer) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 2);
    // Company suffixes common in Switzerland
    const companySuffixes = /\b(?:SA|S\.?A\.?|Sàrl|S\.?à\.?r\.?l\.?|AG|GmbH|Sagl|Ltd|Inc|Srl|SNC|SE|plc|Corp)\b/i;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      // Skip lines that are clearly NOT company names
      if (/^\d|salaire|lohn|bulletin|fiche|d[eé]compte|pay\s*slip/i.test(line)) continue;
      if (companySuffixes.test(line)) {
        fields.employer = line.substring(0, 80);
        confidence += 6;
        break;
      }
    }
  }

  // ──── 2. Net salary — labeled patterns ────
  const netLabels = [
    /(?:salaire\s*net|net\s*(?:pay|salary|amount|income)|nettolohn|netto|net\s*[àa]\s*payer|versement\s*net|montant\s*net|virement|take[\s-]*home\s*(?:pay)?)[:\s]*(?:CHF|Fr\.?|EUR|€|GBP|£)?\s*([0-9][0-9'''., ]+)/i,
    /(?:net\b)[:\s]*(?:CHF|Fr\.?|EUR|€|GBP|£)?\s*([0-9][0-9'''., ]+)/i,
    /(?:CHF|Fr\.?|EUR|€|GBP|£)\s*([0-9][0-9'''., ]+)\s*(?:net)/i,
  ];
  for (const rx of netLabels) {
    const m = text.match(rx);
    if (m) {
      const amount = parseSwissAmount(m[1]);
      if (amount >= 500 && amount <= 80000) {
        fields.netMonthlyIncome = amount;
        confidence += 15;
        break;
      }
    }
  }

  // ──── 3. Gross salary fallback ────
  if (!fields.netMonthlyIncome) {
    const grossLabels = [
      /(?:salaire\s*brut|gross\s*(?:pay|salary|amount|income)|bruttolohn|brutto|brut)[:\s]*(?:CHF|Fr\.?|EUR|€|GBP|£)?\s*([0-9][0-9'''., ]+)/i,
      /(?:CHF|Fr\.?|EUR|€|GBP|£)\s*([0-9][0-9'''., ]+)\s*(?:brut|gross)/i,
    ];
    for (const rx of grossLabels) {
      const m = text.match(rx);
      if (m) {
        const amount = parseSwissAmount(m[1]);
        if (amount >= 500 && amount <= 100000) {
          fields.netMonthlyIncome = Math.round(amount * 0.78);
          fields._grossAmount = amount;
          confidence += 10;
          break;
        }
      }
    }
  }

  // ──── 4. Amount fallback: scan for CHF amounts ────
  if (!fields.netMonthlyIncome) {
    const amounts = findAmounts(text);
    const salaryRange = amounts.filter(a => a.value >= 1000 && a.value <= 50000);
    if (salaryRange.length > 0) {
      // Prefer amount near "net" keyword
      for (const a of salaryRange) {
        const nearby = text.substring(Math.max(0, a.index - 50), a.index + a.raw.length + 30).toLowerCase();
        if (/net|virement|versement|[àa]\s*payer/.test(nearby)) {
          fields.netMonthlyIncome = a.value;
          confidence += 8;
          break;
        }
      }
      // Otherwise pick a reasonable amount
      if (!fields.netMonthlyIncome) {
        const sorted = [...salaryRange].sort((a, b) => b.value - a.value);
        // Second-largest is often net (largest is gross)
        if (sorted.length >= 2 && sorted[1].value >= 2000) {
          fields.netMonthlyIncome = sorted[1].value;
        } else {
          fields.netMonthlyIncome = sorted[0].value;
        }
        confidence += 4;
      }
    }
  }

  // ──── 5. Employee name ────
  // Detect which label matched so we can figure out name order
  let empName: string | null = null;
  let empLabelLang: "de" | "fr" | "en" | "title" = "en";

  // German labels: Angestellter, Mitarbeiter — typically "LastName FirstName"
  empName = findLabeledValue(text, LABELS.employeeName_de);
  if (empName) empLabelLang = "de";

  // French/English labels — typically "FirstName LastName"
  if (!empName) {
    empName = findLabeledValue(text, LABELS.employeeName_fr_en);
    if (empName) empLabelLang = "fr";
  }

  // Title prefixes (Mme, Herr, etc.) — name order follows the title language
  if (!empName) {
    empName = findLabeledValue(text, [
      /(?:Herr|Frau)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '-]+)/i,
    ]);
    if (empName) empLabelLang = "de";
  }
  if (!empName) {
    empName = findLabeledValue(text, [
      /(?:Monsieur|Madame|M[mr]e?\.?|Mrs?\.?|Ms\.?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '-]+)/i,
    ]);
    if (empName) empLabelLang = "title";
  }

  if (empName) {
    // Strip title prefixes that may have been captured
    empName = empName.replace(/^(?:Mr|Mrs|Ms|Miss|Mme|Mlle|M\.|Herr|Frau|Dr|Prof)\.?\s+/i, "").trim();
    const parts = empName.split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      const firstIsUpper = parts[0] === parts[0].toUpperCase() && parts[0].length > 1;
      const lastIsUpper = parts[parts.length - 1] === parts[parts.length - 1].toUpperCase() && parts[parts.length - 1].length > 1;

      if (firstIsUpper && !lastIsUpper) {
        // DUPONT Jean-Pierre → lastName DUPONT, firstName Jean-Pierre
        fields.lastName = titleCase(parts[0]);
        fields.firstName = parts.slice(1).join(" ");
      } else if (lastIsUpper && !firstIsUpper) {
        // Jean-Pierre DUPONT → firstName Jean-Pierre, lastName DUPONT
        fields.firstName = parts.slice(0, -1).join(" ");
        fields.lastName = titleCase(parts[parts.length - 1]);
      } else if (empLabelLang === "de") {
        // German convention: "Angestellter: Weber Thomas" = LastName FirstName
        fields.lastName = parts[0];
        fields.firstName = parts.slice(1).join(" ");
      } else {
        // French/English/title: "Employee: Sophie Müller" = FirstName LastName
        fields.firstName = parts[0];
        fields.lastName = parts.slice(1).join(" ");
      }
      confidence += 5;
    }
  }

  // ──── 6. Period / month ────
  const period = findLabeledValue(text, [
    ...LABELS.salaryPeriod,
    // Also match numeric period format
    ...lbl(['p[e\u00E9]riode', 'period', 'monat', 'mois', 'month', 'zeitraum', 'abrechnungsmonat'], `(\\d{1,2}[.\\/-]\\d{4})`),
  ]);
  if (period) {
    fields.salaryPeriod = period.trim();
    confidence += 5;
  } else {
    // Find month name + year anywhere in text
    const monthRe = /\b(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|m[aä]rz|juni|juli|oktober|dezember)\s+(\d{4})\b/i;
    const mMatch = text.match(monthRe);
    if (mMatch) {
      fields.salaryPeriod = `${mMatch[1]} ${mMatch[2]}`;
      confidence += 3;
    }
  }

  // ──── 7. Job title ────
  const jobTitle = findLabeledValue(text, LABELS.jobTitle);
  if (jobTitle) {
    fields.jobTitle = jobTitle.substring(0, 60);
    confidence += 5;
  }

  if (Object.keys(fields).length === 0) confidence = 30;

  return {
    docType: "SALARY_PROOF",
    confidence: Math.min(confidence, 95),
    fields,
    summary: buildSummary("salary proof", fields),
  };
}

/* ──────────────────────────────────────────────────────────
   Debt enforcement extract parser
   ────────────────────────────────────────────────────────── */

function parseDebtExtract(text: string, fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 55;

  // ── Debt-enforcement classification (shared verifier) ──
  const verification = verifyDebtEnforcement(text);
  fields.hasDebtEnforcement = verification.hasDebtEnforcement;
  fields.extractStatus = verification.extractStatus;
  confidence += verification.confidenceDelta;

  const dateVal = findLabeledValue(text, [
    /(?:date|datum|du|vom)[:\s]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
  ]);
  if (dateVal) {
    fields.extractDate = normalizeDate(dateVal);
    confidence += 5;
  }

  const personVal = findLabeledValue(text, LABELS.debtPerson);
  if (personVal) {
    const parts = personVal.trim().split(/\s+/);
    if (parts.length >= 2) {
      fields.firstName = parts[0];
      fields.lastName = parts.slice(1).join(" ");
      confidence += 5;
    }
  }

  if (Object.keys(fields).length === 0) confidence = 30;

  return {
    docType: "DEBT_ENFORCEMENT_EXTRACT",
    confidence: Math.min(confidence, 95),
    fields,
    summary: buildSummary("debt enforcement extract", fields),
  };
}

/* ──────────────────────────────────────────────────────────
   Residence permit parser
   ────────────────────────────────────────────────────────── */

function parsePermit(text: string, fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 50;

  // Permit type
  const typeMatch = text.match(/(?:permit|permis|bewilligung|titre)\s*(?:type\s*)?[:\s]*([A-Z])\b/i)
    || text.match(/\bcateg(?:ory|orie)\s*[:\s]*([A-Z])\b/i)
    || text.match(/\b(?:type|cat[eé]gorie)\s*[:\s]*([BCLSFGN])\b/i)
    || text.match(/(?:permis|bewilligung|permit)\s+([BCLSFGN])\b/i);
  if (typeMatch) {
    fields.permitType = typeMatch[1].toUpperCase();
    confidence += 15;
  }

  const nameVal = findLabeledValue(text, LABELS.lastName);
  if (nameVal) { fields.lastName = cleanName(nameVal); confidence += 5; }

  const firstVal = findLabeledValue(text, LABELS.firstName);
  if (firstVal) { fields.firstName = cleanName(firstVal); confidence += 5; }

  const natVal = findLabeledValue(text, LABELS.nationality);
  if (natVal) {
    fields.nationality = mapNationality(natVal.trim().substring(0, 40));
    confidence += 5;
  }

  const validMatch = text.match(/(?:valid|valable|g[üu]ltig|expire|[eé]ch[eé]ance).*?(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i);
  if (validMatch) {
    fields.permitValidUntil = normalizeDate(validMatch[1]);
    confidence += 5;
  }

  // MRZ fallback (some permits include MRZ)
  if (!fields.lastName || !fields.firstName) {
    const mrz = parseMRZ(text);
    if (mrz) {
      if (!fields.lastName && mrz.lastName) fields.lastName = mrz.lastName;
      if (!fields.firstName && mrz.firstName) fields.firstName = mrz.firstName;
      if (!fields.nationality && mrz.nationality) fields.nationality = mrz.nationality;
      confidence += 5;
    }
  }

  if (Object.keys(fields).length === 0) confidence = 30;

  return {
    docType: "PERMIT",
    confidence: Math.min(confidence, 90),
    fields,
    summary: buildSummary("residence permit", fields),
  };
}

/* ──────────────────────────────────────────────────────────
   Household insurance parser
   ────────────────────────────────────────────────────────── */

function parseInsurance(text: string, fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 50;

  fields.hasRcInsurance = true;

  const company = findLabeledValue(text, LABELS.insuranceCompany);
  if (company) {
    fields.rcInsuranceCompany = company.substring(0, 60);
    confidence += 15;
  }

  const policyVal = findLabeledValue(text, LABELS.policyNumber);
  if (policyVal) {
    fields.policyNumber = policyVal.trim();
    confidence += 5;
  }

  // Well-known Swiss insurers
  const knownInsurers = [
    "mobiliar", "mobilière", "zurich", "axa", "helvetia", "baloise", "bâloise",
    "generali", "vaudoise", "allianz", "css", "swica", "groupe mutuel",
    "helsana", "visana", "concordia", "sanitas", "sympany", "elvia",
    "nationale suisse", "swiss life", "swisslife", "la bâloise",
    "die mobiliar", "basilese", "pax", "smile", "wefox", "simpego",
  ];
  const combined = (fileName + " " + text).toLowerCase();
  for (const ins of knownInsurers) {
    if (combined.includes(ins)) {
      fields.rcInsuranceCompany = fields.rcInsuranceCompany || titleCase(ins);
      confidence += 10;
      break;
    }
  }

  if (Object.keys(fields).length <= 1) confidence = 35;

  return {
    docType: "HOUSEHOLD_INSURANCE",
    confidence: Math.min(confidence, 90),
    fields,
    summary: buildSummary("household insurance", fields),
  };
}

/* ──────────────────────────────────────────────────────────
   Invoice parser
   ────────────────────────────────────────────────────────── */

function parseInvoice(text: string, _fileName: string): ScanResult {
  const fields: Record<string, string | number | boolean | null> = {};
  let confidence = 50;

  // ──── 1. Vendor / company name ────
  const vendor = findLabeledValue(text, LABELS.vendorName);
  if (vendor) {
    fields.vendorName = vendor.substring(0, 80);
    confidence += 8;
  }

  // Vendor fallback: first line with company suffix
  if (!fields.vendorName) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 2);
    const companySuffixes = /\b(?:SA|S\.?A\.?|Sàrl|S\.?à\.?r\.?l\.?|AG|GmbH|Sagl|Ltd|Inc|Srl|SNC|SE|plc|Corp)\b/i;
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      if (/^\d|total|facture|rechnung|invoice|bill/i.test(line)) continue;
      if (companySuffixes.test(line)) {
        fields.vendorName = line.substring(0, 80);
        confidence += 5;
        break;
      }
    }
  }

  // ──── 2. Invoice number ────
  const invNum = findLabeledValue(text, LABELS.invoiceNumber);
  if (invNum) {
    fields.invoiceNumber = invNum.trim();
    confidence += 8;
  }

  // ──── 3. Invoice date ────
  const invDate = findLabeledValue(text, LABELS.invoiceDate);
  if (invDate) {
    fields.invoiceDate = invDate.trim();
    confidence += 5;
  }

  // ──── 4. Due date ────
  const dueDateVal = findLabeledValue(text, LABELS.dueDate);
  if (dueDateVal) {
    fields.dueDate = dueDateVal.trim();
    confidence += 5;
  }

  // ──── 5. Total amount — labeled patterns ────
  const totalLabels = [
    /(?:total\s*(?:amount|due|ttc)?|montant\s*(?:total|ttc|d[ûu])|gesamtbetrag|endbetrag|total\s*[àa]\s*payer|zu\s*zahlen|amount\s*due)[:\s]*(?:CHF|Fr\.?|EUR|€)?\s*([0-9][0-9'''., ]+)/i,
    /(?:CHF|Fr\.?|EUR|€)\s*([0-9][0-9'''., ]+)\s*(?:total|ttc)/i,
  ];
  for (const rx of totalLabels) {
    const m = text.match(rx);
    if (m) {
      const amount = parseSwissAmount(m[1]);
      if (amount > 0) {
        fields.totalAmount = amount;
        confidence += 12;
        break;
      }
    }
  }

  // Total amount fallback: largest CHF amount in document
  if (!fields.totalAmount) {
    const amounts = findAmounts(text);
    if (amounts.length > 0) {
      // Prefer amount near "total" keyword
      for (const a of amounts) {
        const nearby = text.substring(Math.max(0, a.index - 60), a.index + a.raw.length + 30).toLowerCase();
        if (/total|gesamt|montant|amount|summe|betrag/.test(nearby)) {
          fields.totalAmount = a.value;
          confidence += 6;
          break;
        }
      }
      // Otherwise use the largest amount
      if (!fields.totalAmount) {
        const sorted = [...amounts].sort((a, b) => b.value - a.value);
        fields.totalAmount = sorted[0].value;
        confidence += 3;
      }
    }
  }

  // ──── 6. VAT amount ────
  const vatLabels = [
    /(?:vat|tva|mwst|mehrwertsteuer|tax|taxe)[:\s]*(?:CHF|Fr\.?|EUR|€)?\s*([0-9][0-9'''., ]+)/i,
    /(?:CHF|Fr\.?|EUR|€)\s*([0-9][0-9'''., ]+)\s*(?:vat|tva|mwst)/i,
  ];
  for (const rx of vatLabels) {
    const m = text.match(rx);
    if (m) {
      const amount = parseSwissAmount(m[1]);
      if (amount > 0) {
        fields.vatAmount = amount;
        confidence += 4;
        break;
      }
    }
  }

  // ──── 7. Subtotal ────
  const subLabels = [
    /(?:sub\s*total|sous[\s-]*total|netto|zwischensumme|montant\s*ht|total\s*ht|amount\s*excl)[:\s]*(?:CHF|Fr\.?|EUR|€)?\s*([0-9][0-9'''., ]+)/i,
  ];
  for (const rx of subLabels) {
    const m = text.match(rx);
    if (m) {
      fields.subtotal = parseSwissAmount(m[1]);
      break;
    }
  }

  // ──── 8. Currency ────
  if (/\bCHF\b/i.test(text)) fields.currency = "CHF";
  else if (/\bEUR\b/i.test(text)) fields.currency = "EUR";

  // ──── 9. IBAN ────
  const ibanMatch = text.match(/\b([A-Z]{2}\d{2}\s?[A-Z0-9\s]{10,30})\b/);
  if (ibanMatch) {
    fields.iban = ibanMatch[1].replace(/\s/g, "");
    confidence += 4;
  }

  // ──── 10. Date fallback — pick first/last dates ────
  if (!fields.invoiceDate || !fields.dueDate) {
    const dates = findDates(text);
    if (dates.length > 0 && !fields.invoiceDate) {
      fields.invoiceDate = dates[0].normalized;
      confidence += 3;
    }
    if (dates.length > 1 && !fields.dueDate) {
      fields.dueDate = dates[dates.length - 1].normalized;
      confidence += 2;
    }
  }

  // Low confidence if very few fields extracted
  if (Object.keys(fields).length <= 1) confidence = 30;

  const vendorLabel = fields.vendorName ?? "unknown vendor";
  const totalLabel = fields.totalAmount ? ` — total: ${fields.totalAmount}` : "";
  return {
    docType: "INVOICE",
    confidence: Math.min(confidence, 92),
    fields,
    summary: `Invoice from ${vendorLabel}${totalLabel}. Extracted ${Object.keys(fields).length} fields via local OCR.`,
  };
}

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

const MONTH_NAMES: Record<string, string> = {
  // EN
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06",
  jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
  // FR
  janvier: "01", "février": "02", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", "août": "08", aout: "08", septembre: "09", octobre: "10", novembre: "11", "décembre": "12", decembre: "12",
  // DE
  januar: "01", februar: "02", "märz": "03", marz: "03", juni: "06", juli: "07",
  oktober: "10", dezember: "12",
  // IT
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04", maggio: "05", giugno: "06",
  luglio: "07", agosto: "08", settembre: "09", ottobre: "10", dicembre: "12",
};

function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Handle text month: "15 JUN 1992", "03 March 2001", etc.
  const textMonthMatch = raw.match(/^(\d{1,2})\s+([A-Za-z\u00C0-\u00FF]+)\s+(\d{2,4})$/);
  if (textMonthMatch) {
    const [, d, mName, y] = textMonthMatch;
    const mm = MONTH_NAMES[mName.toLowerCase()];
    if (mm) {
      const year = y.length === 2 ? (parseInt(y) > 50 ? "19" : "20") + y : y;
      return `${year}-${mm}-${d.padStart(2, "0")}`;
    }
  }

  const parts = raw.split(/[.\/-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return raw;
}

function parseSwissAmount(raw: string): number {
  let cleaned = raw.replace(/['''\u2019\u2018\s]/g, "");
  // Detect format: "7,050.00" (comma=thousands, dot=decimal)
  // vs "7.050,00" (dot=thousands, comma=decimal) vs "7'050.00" (already stripped)
  if (/,\d{3}/.test(cleaned) && cleaned.includes(".")) {
    // Comma is thousands separator (e.g. 7,050.00) — remove commas, keep dot
    cleaned = cleaned.replace(/,/g, "");
  } else if (/\.\d{3}/.test(cleaned) && cleaned.includes(",")) {
    // Dot is thousands separator (e.g. 7.050,00) — remove dots, comma→dot
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // Simple case: treat comma as decimal
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

function cleanName(raw: string): string {
  let name = raw
    .replace(/[,:;.]+$/, "")              // trailing punctuation
    .replace(/\s+/g, " ")                  // normalize whitespace
    .trim();
  // Strip document/passport numbers that may appear on the same OCR line
  // e.g., "MUELLER X1234567" → "MUELLER"
  name = name.replace(/\s+[A-Z]?\d{5,}\b.*$/, "").trim();
  // Strip "Passport No." type suffixes
  name = name.replace(/\s+(Pass\w*|Doc\w*|No\.?|Nr\.?|Num.*)$/i, "").trim();
  return name;
}

/** Map common nationality labels to ISO country codes */
function mapNationality(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const map: Record<string, string> = {
    "suisse": "CH", "schweizer": "CH", "schweizerisch": "CH", "svizzera": "CH", "swiss": "CH", "svizzero": "CH",
    "française": "FR", "français": "FR", "french": "FR", "frankreich": "FR", "franzose": "FR", "französisch": "FR",
    "allemande": "DE", "deutsch": "DE", "german": "DE", "deutsche": "DE", "deutscher": "DE",
    "italienne": "IT", "italiano": "IT", "italian": "IT", "italienisch": "IT", "italiana": "IT",
    "portugaise": "PT", "portuguese": "PT", "portugiesisch": "PT", "portuguesa": "PT", "português": "PT",
    "espagnole": "ES", "spanish": "ES", "spanisch": "ES", "española": "ES", "español": "ES",
    "britannique": "GB", "british": "GB", "british citizen": "GB", "british subject": "GB",
    "américaine": "US", "american": "US", "americana": "US",
    "kosovar": "XK", "kosovare": "XK",
    "turque": "TR", "turkish": "TR", "türkisch": "TR",
    "serbe": "RS", "serbian": "RS", "serbisch": "RS",
    "albanaise": "AL", "albanian": "AL", "albanisch": "AL",
    "bosniaque": "BA", "bosnisch": "BA",
    "nord-macédonienne": "MK", "macédonienne": "MK",
    "erythréenne": "ER", "érythréenne": "ER",
    "syrienne": "SY", "syrian": "SY",
    "afghane": "AF", "afghan": "AF",
    "congolaise": "CD",
    "marocaine": "MA", "moroccan": "MA",
    "tunisienne": "TN", "tunisian": "TN",
    "algérienne": "DZ", "algerian": "DZ",
    "brésilienne": "BR", "brazilian": "BR",
    "indienne": "IN", "indian": "IN",
    "chinoise": "CN", "chinese": "CN",
    "roumaine": "RO", "romanian": "RO",
    "polonaise": "PL", "polish": "PL",
    "croate": "HR", "croatian": "HR",
    "ukrainienne": "UA", "ukrainian": "UA",
    "russe": "RU", "russian": "RU",
    "sri-lankaise": "LK",
    "somalienne": "SO",
    "irakienne": "IQ",
    "iranienne": "IR",
    "colombienne": "CO",
    "chilienne": "CL",
    "péruvienne": "PE",
    "mexicaine": "MX",
    "camerounaise": "CM",
    "ivoirienne": "CI",
    "sénégalaise": "SN",
  };
  // If already a 2-letter code, return as-is
  if (/^[A-Z]{2}$/.test(raw.trim())) return raw.trim();

  // Map ISO-3 codes (from MRZ) to ISO-2
  const iso3to2: Record<string, string> = {
    "CHE": "CH", "FRA": "FR", "DEU": "DE", "ITA": "IT", "GBR": "GB", "USA": "US",
    "ESP": "ES", "PRT": "PT", "AUT": "AT", "BEL": "BE", "NLD": "NL", "LUX": "LU",
    "TUR": "TR", "SRB": "RS", "ALB": "AL", "BIH": "BA", "MKD": "MK", "XKX": "XK",
    "HRV": "HR", "ROU": "RO", "POL": "PL", "UKR": "UA", "RUS": "RU", "BRA": "BR",
    "IND": "IN", "CHN": "CN", "MAR": "MA", "TUN": "TN", "DZA": "DZ", "SYR": "SY",
    "AFG": "AF", "ERI": "ER", "SOM": "SO", "IRQ": "IQ", "IRN": "IR", "COL": "CO",
    "CHL": "CL", "PER": "PE", "MEX": "MX", "CMR": "CM", "CIV": "CI", "SEN": "SN",
    "COD": "CD", "LKA": "LK", "KOS": "XK",
  };
  if (/^[A-Z]{3}$/.test(raw.trim()) && iso3to2[raw.trim()]) {
    return iso3to2[raw.trim()];
  }

  return map[lower] || raw.trim();
}

function buildSummary(docLabel: string, fields: Record<string, any>): string {
  const count = Object.keys(fields).filter((k) => !k.startsWith("_")).length;
  if (count === 0) {
    return `Detected as ${docLabel} but could not extract specific fields. You can fill them manually.`;
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith("_")) continue;
    parts.push(`${k}: ${v}`);
  }
  return `Extracted ${count} field(s) from ${docLabel}: ${parts.join(", ")}`;
}
