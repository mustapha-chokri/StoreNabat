import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AdminAuthError } from '@/core/auth/admin-session';
import { verifySameOrigin } from '@/core/security/csrf';

const LOCALIZED_DOMAIN_ERRORS: Record<string, { ar: string; fr: string; en: string; status: number }> = {
  ORDER_EMPTY_ITEMS: {
    ar: 'الرجاء اختيار منتج واحد على الأقل لإتمام الطلب.',
    fr: 'Veuillez sélectionner au moins un produit.',
    en: 'Please select at least one product.',
    status: 400,
  },
  INVALID_PHONE_NUMBER: {
    ar: 'رقم الهاتف غير صالح. المرجو إدخال رقم مغربي صحيح (مثال: 0612345678) أو رقم دولي.',
    fr: 'Numéro de téléphone invalide. Veuillez entrer un numéro valide.',
    en: 'Invalid phone number.',
    status: 400,
  },
  CUSTOMER_BLACKLISTED: {
    ar: 'عذراً، تعذر إتمام الطلب. المرجو التواصل مع خدمة الزبناء عبر واتساب.',
    fr: 'Désolé, impossible de valider cette commande. Contactez le support.',
    en: 'Unable to complete order. Please contact support.',
    status: 403,
  },
  INVALID_COUPON: {
    ar: 'كود الخصم غير صحيح أو غير مفعل.',
    fr: 'Code promo invalide ou inactif.',
    en: 'Invalid or inactive coupon code.',
    status: 400,
  },
  COUPON_EXPIRED: {
    ar: 'انتهت صلاحية كود الخصم.',
    fr: 'Ce code promo a expiré.',
    en: 'Coupon code has expired.',
    status: 400,
  },
  COUPON_NOT_STARTED: {
    ar: 'كود الخصم لم يبدأ تفعيله بعد.',
    fr: "Ce code promo n'est pas encore actif.",
    en: 'Coupon code is not active yet.',
    status: 400,
  },
  COUPON_USAGE_LIMIT: {
    ar: 'تم استنفاد الحد الأقصى لاستخدام كود الخصم.',
    fr: 'Ce code promo a atteint sa limite d’utilisation.',
    en: 'Coupon usage limit reached.',
    status: 400,
  },
  COUPON_MIN_ORDER: {
    ar: 'مجموع الطلب أقل من الحد الأدنى المطلوب لتطبيق هذا الكوبون.',
    fr: 'Le montant de la commande est inférieur au minimum requis pour ce code.',
    en: 'Order amount does not meet minimum required for this coupon.',
    status: 400,
  },
  COD_NOT_AVAILABLE_FOR_CITY: {
    ar: 'الدفع عند الاستلام غير متاح حالياً لهذه المدينة. يمكنك الدفع بالبطاقة أو PayPal.',
    fr: 'Le paiement à la livraison est indisponible pour cette ville.',
    en: 'Cash on Delivery is unavailable for this city.',
    status: 400,
  },
  PRODUCT_NOT_FOUND: {
    ar: 'المنتج المطلوب غير موجود أو غير متاح حالياً.',
    fr: 'Produit introuvable ou indisponible.',
    en: 'Product not found.',
    status: 404,
  },
  VARIANT_NOT_FOUND: {
    ar: 'الخيار المحدد لهذا المنتج غير متوفر.',
    fr: 'Variante introuvable.',
    en: 'Selected variant not found.',
    status: 404,
  },
  ORDER_NOT_FOUND: {
    ar: 'الطلب غير موجود.',
    fr: 'Commande introuvable.',
    en: 'Order not found.',
    status: 404,
  },
  INVALID_QUANTITY: {
    ar: 'الكمية المطلوبة غير صالحة.',
    fr: 'Quantité invalide.',
    en: 'Invalid quantity.',
    status: 400,
  },
};

export function localizeError(
  error: unknown,
  locale = 'ar'
): { message: string; status: number; code?: string } {
  const lang = locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : 'ar';

  if (error instanceof AdminAuthError) {
    return {
      message:
        error.statusCode === 401
          ? lang === 'ar'
            ? 'يرجى تسجيل الدخول للمتابعة.'
            : lang === 'fr'
              ? 'Authentification requise.'
              : 'Authentication required.'
          : lang === 'ar'
            ? 'ليس لديك صلاحية تنفيذ هذا الإجراء.'
            : lang === 'fr'
              ? 'Permissions insuffisantes.'
              : 'Insufficient permissions.',
      status: error.statusCode,
    };
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const fieldPath = firstIssue?.path?.length ? firstIssue.path.join('.') : '';
    let msg = firstIssue?.message || (lang === 'ar' ? 'بيانات غير مكتملة أو غير صحيحة.' : 'Invalid input.');
    if (msg === 'Required') {
      msg = lang === 'ar' ? `الحقل مطلوب: ${fieldPath || 'بيانات ناقصة'}` : `Required field: ${fieldPath || 'missing'}`;
    } else if (fieldPath) {
      msg = `${msg} (${fieldPath})`;
    }
    return {
      message: msg,
      status: 400,
      code: 'VALIDATION_ERROR',
    };
  }

  if (error instanceof Error) {
    if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const productName = error.message.slice('INSUFFICIENT_STOCK:'.length);
      return {
        message:
          lang === 'ar'
            ? `الكمية المطلوبة غير متوفرة حالياً في المخزون للمنتج: ${productName}`
            : lang === 'fr'
              ? `Stock insuffisant pour le produit : ${productName}`
              : `Insufficient stock for: ${productName}`,
        status: 409,
        code: 'INSUFFICIENT_STOCK',
      };
    }

    const mapped = LOCALIZED_DOMAIN_ERRORS[error.message];
    if (mapped) {
      return { message: mapped[lang], status: mapped.status, code: error.message };
    }

    return { message: error.message, status: 400 };
  }

  return {
    message: lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'Unexpected error occurred.',
    status: 500,
  };
}

export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: 'CSRF validation failed (origin mismatch).' }, { status: 403 });
  }
  return null;
}

export function errorResponse(error: unknown, locale = 'ar'): NextResponse {
  const info = localizeError(error, locale);
  return NextResponse.json(
    { error: info.message, code: info.code },
    { status: info.status }
  );
}

