/**
 * Phone normalization utilities for E.164 format
 * E.164 format: +[country code][area code][number]
 * Example: +41793123456
 */

/**
 * Normalize a phone number to E.164 format
 * Accepts various formats and converts to standardized E.164
 * 
 * @param phone - Raw phone input (with or without +, spaces, dashes)
 * @param defaultCountryCode - Country code to use if not specified (default: "41" for Switzerland)
 * @returns E.164 formatted phone or null if invalid
 */
export function normalizePhoneToE164(
  phone: string,
  defaultCountryCode: string = "41"
): string | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  // Remove common separators and spaces
  let cleaned = phone.replace(/[\s\-().]/g, "");

  // Remove leading + if present
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // If doesn't start with country code, prepend default
  if (!cleaned.match(/^\d+$/)) {
    return null; // Contains invalid characters
  }

  if (cleaned.length > 0 && !cleaned.startsWith("0") && !cleaned.match(/^\d{2}/)) {
    // Appears to be missing country code
    cleaned = defaultCountryCode + cleaned;
  } else if (cleaned.startsWith("0")) {
    // Remove leading 0 and prepend country code (Swiss format)
    cleaned = defaultCountryCode + cleaned.substring(1);
  } else if (cleaned.match(/^\d{2,3}/) && !cleaned.startsWith(defaultCountryCode)) {
    // Has country code but not the default one - keep as-is
  } else if (!cleaned.match(/^\d{2,3}/)) {
    // Doesn't start with country code, prepend default
    cleaned = defaultCountryCode + cleaned;
  }

  // Validate length (min 10 digits, max 15 per E.164)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  // Return E.164 formatted
  return "+" + cleaned;
}

/**
 * Validate an E.164 formatted phone number
 * 
 * @param phone - Phone number in E.164 format
 * @returns true if valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }
  // E.164 format: +[1-3 digit country code][up to 12 digits]
  return /^\+[1-9]\d{1,14}$/.test(phone);
}
