/**
 * Document scanning / OCR service.
 *
 * MVP: heuristic extraction from PDF text + OCR for scanned docs.
 * Architecture is ready for a real provider (OpenAI Vision, Google Document AI, etc.)
 * by swapping the implementation of `extractFromBuffer`.
 *
 * Each scan returns:
 *   { docType, confidence, fields: Record<string, string|number|boolean> }
 */

export type DetectedDocType =
  | "IDENTITY"        // passport / ID card
  | "SALARY_PROOF"    // pay-slip
  | "DEBT_ENFORCEMENT_EXTRACT"
  | "PERMIT"          // residence permit
  | "HOUSEHOLD_INSURANCE"
  | "UNKNOWN";

export interface ScanResult {
  /** Detected document type */
  docType: DetectedDocType;
  /** 0-100 confidence that this doc type detection is correct */
  confidence: number;
  /** Extracted key-value fields relevant to this doc type */
  fields: Record<string, string | number | boolean | null>;
  /** Human-readable description of what was extracted */
  summary: string;
}

/* ──────────────────────────────────────────────────────────
   Main entry point
   ────────────────────────────────────────────────────────── */

export async function scanDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  /** Optional hint from the user about what they're uploading */
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
];

function detectDocType(fileName: string, hint?: string): DetectedDocType {
  // Prefer explicit hint
  if (hint) {
    const upper = hint.toUpperCase();
    if (upper === "IDENTITY" || upper === "SALARY_PROOF" || upper === "DEBT_ENFORCEMENT_EXTRACT" || upper === "PERMIT" || upper === "HOUSEHOLD_INSURANCE") {
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
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer, verbosity: 0 });
      const result = await parser.getText();
      const text = (result.text || "").trim();
      await parser.destroy();
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
      let pipe = pipelineFn(sharp(buffer));
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
      const { data } = await Tesseract.recognize(buf, "fra+deu+eng", { logger: () => {} });
      return (data.text || "").trim();
    }

    // Score OCR text: more alphabetic words + MRZ-like lines → higher score
    function scoreText(text: string): number {
      const words = text.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
      const mrzLines = text.split(/\n/).filter(l => /^[A-Z0-9<]{20,}$/.test(l.trim().replace(/\s/g, "")));
      const dates = text.match(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/g) || [];
      return words.length + mrzLines.length * 20 + dates.length * 10;
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
        // If first strategy is great, skip the rest
        if (score >= 40) break;
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
};

/**
 * Search for a labeled value. Tries:
 *  1. "Label: Value" or "Label Value" on the same line
 *  2. Label on one line, value on the next line
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

    // 2. Label-only on one line, value on the next
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

/** Find all dates in text (dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd, etc.) */
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
    // Avoid duplicates with euro matches
    if (!results.some(r => r.index === m!.index)) {
      results.push({ raw: m[0], normalized: m[0], index: m.index });
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : "";

    // Extract value: either after : on same line, or on next line
    const afterColon = line.match(/[:\-]\s*(.+)$/);
    const sameLineValue = afterColon ? afterColon[1].trim() : "";
    const nextLineValue = nextLine.trim();

    // Pick the most likely value: prefer same-line, fall back to next line
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
      if (v) result.lastName = cleanName(v);
    }
    if (!result.firstName && firstNameHints.test(line)) {
      const v = pickValue(firstNameHints);
      if (v) result.firstName = cleanName(v);
    }
    if (!result.dateOfBirth && dobHints.test(line)) {
      // Look for date pattern on same line or next
      const dateInLine = line.match(/(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/);
      const dateInNext = nextLine.match(/(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/);
      const d = dateInLine?.[1] || dateInNext?.[1];
      if (d) result.dateOfBirth = normalizeDate(d);
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
  const dataLine = mrzLines.find(l => l !== nameLine && /\d{6,}/.test(l));
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

    // Document number: first alphanumeric block (usually 9 chars)
    const docMatch = dataLine.match(/^([A-Z0-9]{6,9})\d/);
    if (docMatch) result.documentNumber = docMatch[1].replace(/</g, "");
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

  // ── Step 1: Detect explicit "clean" / "no debt" signals ──
  // These phrases unambiguously mean the person has NO enforcement entries.
  // Covers: French, German, English, and common Swiss official formats.
  const cleanPatterns = [
    // French
    /aucune\s*poursuite/i,
    /aucune\s*inscription/i,
    /aucun\s*acte\s*de\s*d[ée]faut/i,
    /n[ée]ant/i,
    /pas\s*de\s*poursuite/i,
    /aucune\s*proc[ée]dure/i,
    // German
    /keine\s*betreibung/i,
    /keine\s*eintr[aä]ge/i,
    /keine\s*verl[uü]stschein/i,
    /keine\s*offenen/i,
    /nichts\s*zu\s*verzeichnen/i,
    // English
    /no\s*(?:open\s*)?enforcement\s*cases?/i,
    /no\s*entries/i,
    /no\s*outstanding/i,
    /no\s*proceedings/i,
    /(?:open\s*)?enforcement\s*cases?\s*:\s*none/i,
    /entries\s*:\s*none/i,
    /cases?\s*:\s*none/i,
    /result\s*:\s*(?:clean|clear|none|nil)/i,
    /status\s*:\s*(?:clean|clear|none|nil)/i,
    /:\s*none\b/i,
  ];

  const isClean = cleanPatterns.some((p) => p.test(text));

  // ── Step 2: Detect positive "has debt" signals ──
  // These indicate ACTUAL enforcement entries — amounts, case numbers, creditor references.
  // Generic words like "enforcement" or "poursuite" in the document title do NOT count,
  // since every debt-extract document contains those words in its header.
  const positivePatterns = [
    // Amounts owed (CHF xxx, Fr. xxx)
    /(?:montant|betrag|amount|total|solde)\s*:?\s*(?:CHF|Fr\.?|SFr\.?)\s*[\d',]+/i,
    /(?:CHF|Fr\.?|SFr\.?)\s*[\d',]+\.\d{2}/,
    // Case numbers / file references
    /(?:n[°o]\s*de?\s*(?:poursuite|dossier)|(?:betreibungs|fall)[-\s]?(?:nr|nummer))\s*:?\s*\d+/i,
    // Creditor / Gläubiger present (suggests active debt)
    /(?:cr[ée]ancier|gl[aä]ubiger|creditor)\s*:?\s+[A-Z]/i,
    // Explicit statements of active enforcement
    /poursuite\s*en\s*cours/i,
    /laufende\s*betreibung/i,
    /active\s*enforcement/i,
    /pending\s*enforcement/i,
    /acte\s*de\s*d[ée]faut\s*de\s*bien/i,
    /verl[uü]stschein/i,
    /pfändung\s*(?:vom|am|du)\s*\d/i,
    /saisie\s*(?:du|le|en)\s*\d/i,
  ];

  const hasPositiveSignal = positivePatterns.some((p) => p.test(text));

  // ── Step 3: Decide ──
  if (isClean) {
    fields.hasDebtEnforcement = false;
    fields.extractStatus = "CLEAN";
    confidence += 20;
  } else if (hasPositiveSignal) {
    fields.hasDebtEnforcement = true;
    fields.extractStatus = "HAS_ENTRIES";
    confidence += 10;
  } else {
    // Document recognized as debt extract but no definitive signal either way.
    // Default to false (no enforcement) — the document IS a debt extract, 
    // so generic words like "enforcement" in the header are expected and NOT indicators.
    fields.hasDebtEnforcement = false;
    fields.extractStatus = "UNCLEAR_ASSUMED_CLEAN";
    confidence = Math.max(confidence - 10, 30);
  }

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
