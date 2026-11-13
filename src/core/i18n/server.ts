import { cookies } from 'next/headers';

export const LOCALE_COOKIE = 'nabat_locale';

export async function getActiveLocale(defaultLocale = 'ar'): Promise<string> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get(LOCALE_COOKIE)?.value;
    if (val && /^[a-z]{2,5}$/i.test(val)) {
      return val.toLowerCase();
    }
  } catch {
    // Fallback when headers/cookies unavailable
  }
  return defaultLocale;
}

export function getLocaleDirection(locale: string, activeLanguages?: Array<{ locale: string; direction: string }>): 'rtl' | 'ltr' {
  const matched = activeLanguages?.find((l) => l.locale === locale);
  if (matched) return matched.direction === 'rtl' ? 'rtl' : 'ltr';
  return locale === 'ar' ? 'rtl' : 'ltr';
}

