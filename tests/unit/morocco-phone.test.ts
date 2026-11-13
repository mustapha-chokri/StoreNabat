import { describe, expect, it } from 'vitest';
import { validateAndNormalizePhone } from '@/core/security/morocco';

describe('validateAndNormalizePhone', () => {
  it('normalizes local Moroccan mobile & landline numbers (06/07/05)', () => {
    const mobile06 = validateAndNormalizePhone('06 12 34 56 78');
    expect(mobile06).toEqual({
      valid: true,
      normalized: '212612345678',
      isMoroccan: true,
      formattedWhatsApp: '212612345678',
    });

    const mobile07 = validateAndNormalizePhone('07-01-02-03-04');
    expect(mobile07.valid).toBe(true);
    expect(mobile07.isMoroccan).toBe(true);
    expect(mobile07.normalized).toBe('212701020304');

    const landline05 = validateAndNormalizePhone('0522-45-67-89');
    expect(landline05.valid).toBe(true);
    expect(landline05.isMoroccan).toBe(true);
    expect(landline05.normalized).toBe('212522456789');
  });

  it('normalizes international +212 and 00212 Moroccan formats', () => {
    const plus212 = validateAndNormalizePhone('+212 6 61-22-33-44');
    expect(plus212).toEqual({
      valid: true,
      normalized: '212661223344',
      isMoroccan: true,
      formattedWhatsApp: '212661223344',
    });

    const zeroZero212 = validateAndNormalizePhone('00212.7.77.88.99.00');
    expect(zeroZero212.valid).toBe(true);
    expect(zeroZero212.isMoroccan).toBe(true);
    expect(zeroZero212.normalized).toBe('212777889900');
  });

  it('handles 9-digit Moroccan numbers missing leading 0 in MOROCCO_SMART mode', () => {
    const smart = validateAndNormalizePhone('612345678', 'MOROCCO_SMART');
    expect(smart.valid).toBe(true);
    expect(smart.isMoroccan).toBe(true);
    expect(smart.normalized).toBe('212612345678');

    const intlMode = validateAndNormalizePhone('612345678', 'INTERNATIONAL');
    expect(intlMode.valid).toBe(true);
    expect(intlMode.isMoroccan).toBe(false);
    expect(intlMode.normalized).toBe('612345678');
  });

  it('accepts valid international E.164 phone numbers', () => {
    const fr = validateAndNormalizePhone('+33 6 12 34 56 78');
    expect(fr.valid).toBe(true);
    expect(fr.isMoroccan).toBe(false);
    expect(fr.normalized).toBe('33612345678');
  });

  it('rejects empty, non-numeric, too short, or oversized inputs', () => {
    expect(validateAndNormalizePhone('').valid).toBe(false);
    expect(validateAndNormalizePhone('   ').valid).toBe(false);
    expect(validateAndNormalizePhone('0612abc678').valid).toBe(false);
    expect(validateAndNormalizePhone('12345').valid).toBe(false);
    expect(validateAndNormalizePhone('1234567890123456').valid).toBe(false);
  });
});

