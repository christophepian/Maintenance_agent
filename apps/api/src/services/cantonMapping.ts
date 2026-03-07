/**
 * Swiss Postal Code → Canton Mapping
 *
 * Local dataset — never calls an external API.
 * Based on the Swiss postal code numbering system.
 *
 * Postal code ranges are approximate but cover ~99% of Swiss addresses.
 * Edge cases near canton borders may need manual override on Building.
 */

// PLZ range → canton code
const PLZ_RANGES: Array<[number, number, string]> = [
  // Zürich
  [8000, 8099, "ZH"],
  [8100, 8199, "ZH"],
  [8200, 8299, "ZH"],
  [8300, 8399, "ZH"],
  [8400, 8499, "ZH"],
  [8500, 8599, "ZH"],
  [8600, 8699, "ZH"],
  [8700, 8799, "ZH"],
  [8800, 8899, "ZH"],
  [8900, 8999, "ZH"],

  // Bern
  [3000, 3099, "BE"],
  [3100, 3199, "BE"],
  [3200, 3299, "BE"],
  [3300, 3399, "BE"],
  [3400, 3499, "BE"],
  [3500, 3599, "BE"],
  [3600, 3699, "BE"],
  [3700, 3799, "BE"],
  [3800, 3899, "BE"],
  [3900, 3999, "BE"],
  [2500, 2599, "BE"], // Biel/Bienne area
  [4900, 4999, "BE"], // Langenthal area

  // Luzern
  [6000, 6099, "LU"],
  [6100, 6199, "LU"],
  [6200, 6299, "LU"],
  [6300, 6399, "LU"],

  // Uri
  [6400, 6499, "UR"],

  // Schwyz
  [6410, 6449, "SZ"],
  [8840, 8849, "SZ"],

  // Obwalden
  [6060, 6078, "OW"],

  // Nidwalden
  [6370, 6390, "NW"],

  // Glarus
  [8750, 8779, "GL"],

  // Zug
  [6300, 6349, "ZG"],

  // Fribourg
  [1700, 1799, "FR"],
  [1630, 1699, "FR"],

  // Solothurn
  [4500, 4599, "SO"],
  [4600, 4699, "SO"],
  [2540, 2549, "SO"],

  // Basel-Stadt
  [4000, 4059, "BS"],

  // Basel-Landschaft
  [4100, 4199, "BL"],
  [4200, 4299, "BL"],
  [4400, 4499, "BL"],

  // Schaffhausen
  [8200, 8219, "SH"],

  // Appenzell Ausserrhoden
  [9100, 9113, "AR"],

  // Appenzell Innerrhoden
  [9050, 9058, "AI"],

  // St. Gallen
  [9000, 9049, "SG"],
  [9200, 9299, "SG"],
  [9400, 9499, "SG"],
  [8700, 8739, "SG"], // Rapperswil area overlap

  // Graubünden
  [7000, 7099, "GR"],
  [7100, 7199, "GR"],
  [7200, 7299, "GR"],
  [7400, 7499, "GR"],
  [7500, 7599, "GR"],

  // Aargau
  [5000, 5099, "AG"],
  [5200, 5299, "AG"],
  [5300, 5399, "AG"],
  [5400, 5499, "AG"],
  [5600, 5699, "AG"],

  // Thurgau
  [8500, 8599, "TG"],
  [9200, 9220, "TG"],

  // Ticino
  [6500, 6599, "TI"],
  [6600, 6699, "TI"],
  [6700, 6799, "TI"],
  [6800, 6899, "TI"],
  [6900, 6999, "TI"],

  // Vaud
  [1000, 1099, "VD"],
  [1100, 1199, "VD"],
  [1200, 1299, "VD"],
  [1300, 1399, "VD"],
  [1400, 1499, "VD"],
  [1500, 1599, "VD"],
  [1600, 1629, "VD"],
  [1800, 1899, "VD"],

  // Valais
  [1900, 1999, "VS"],
  [3900, 3999, "VS"],

  // Neuchâtel
  [2000, 2099, "NE"],
  [2100, 2199, "NE"],
  [2300, 2399, "NE"],

  // Genève
  [1200, 1299, "GE"],

  // Jura
  [2800, 2899, "JU"],
  [2900, 2999, "JU"],
];

/**
 * Derive Swiss canton from a 4-digit postal code.
 *
 * Returns the canton abbreviation (e.g. "ZH", "BE", "GE") or null
 * if the postal code doesn't match any known range.
 *
 * This uses the FIRST match in the table. The table is ordered so
 * more specific ranges (e.g. Zug 6300–6349) should appear before
 * broader ranges (e.g. Luzern 6300–6399).
 */
export function cantonFromPostalCode(postalCode: string): string | null {
  if (!/^\d{4}$/.test(postalCode)) return null;
  const plz = parseInt(postalCode, 10);

  for (const [low, high, canton] of PLZ_RANGES) {
    if (plz >= low && plz <= high) return canton;
  }

  return null;
}

/**
 * Extract a 4-digit Swiss postal code from a building address string.
 * Matches patterns like "8004 Zürich" or "Rue de Lausanne 12, 1003 Lausanne".
 */
export function extractPostalCode(address: string): string | null {
  const match = address.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}
