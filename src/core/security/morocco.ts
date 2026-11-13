/**
 * Validates and normalizes Moroccan phone numbers (06..., 07..., 05..., +2126..., 00212...)
 * while still allowing legitimate international E.164 phone numbers.
 */
export interface PhoneValidationResult {
  valid: boolean;
  normalized: string; // digits only e.g. 212612345678
  isMoroccan: boolean;
  formattedWhatsApp: string; // e.g. 212612345678
}

export function validateAndNormalizePhone(
  rawPhone: string,
  mode: 'MOROCCO_SMART' | 'INTERNATIONAL' = 'MOROCCO_SMART'
): PhoneValidationResult {
  const cleaned = rawPhone.replace(/[\s\-().]/g, '');
  if (!cleaned) {
    return { valid: false, normalized: '', isMoroccan: false, formattedWhatsApp: '' };
  }

  let digits = cleaned;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (!/^\d+$/.test(digits)) {
    return { valid: false, normalized: '', isMoroccan: false, formattedWhatsApp: '' };
  }

  // Local Moroccan format: 05/06/07XXXXXXXX (10 digits)
  if (/^0[567]\d{8}$/.test(digits)) {
    const normalized = `212${digits.slice(1)}`;
    return {
      valid: true,
      normalized,
      isMoroccan: true,
      formattedWhatsApp: normalized,
    };
  }

  // International Moroccan format: 2125/6/7XXXXXXXX (12 digits)
  if (/^212[567]\d{8}$/.test(digits)) {
    return {
      valid: true,
      normalized: digits,
      isMoroccan: true,
      formattedWhatsApp: digits,
    };
  }

  // Handle common user entry omitting leading 0 e.g. 612345678
  if (mode === 'MOROCCO_SMART' && /^[567]\d{8}$/.test(digits)) {
    const normalized = `212${digits}`;
    return {
      valid: true,
      normalized,
      isMoroccan: true,
      formattedWhatsApp: normalized,
    };
  }

  // Legitimate international E.164 numbers (between 8 and 15 digits)
  if (digits.length >= 8 && digits.length <= 15) {
    return {
      valid: true,
      normalized: digits,
      isMoroccan: false,
      formattedWhatsApp: digits,
    };
  }

  return { valid: false, normalized: '', isMoroccan: false, formattedWhatsApp: '' };
}

