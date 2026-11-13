'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock,
  Copy,
  ExternalLink,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useStore } from '@/components/providers/StoreContextProvider';
import { LandingPageRenderer } from '@/components/storefront/LandingPageRenderer';
import type { I18nMap, LandingPageSection, LandingSectionType } from '@/db/schema/types';

interface AdminLandingPage {
  id: string;
  productId: string | null;
  slug: string;
  titleI18n: I18nMap;
  isPublished: boolean;
  showHeader: boolean;
  showFooter: boolean;
  sections: LandingPageSection[];
  seoI18n: Record<string, { metaTitle?: string; metaDescription?: string; ogImage?: string }>;
  customPixels: {
    metaPixelId?: string;
    tiktokPixelId?: string;
    ga4MeasurementId?: string;
    gtmContainerId?: string;
  };
  viewsCount: number;
  ordersCount: number;
}

interface SimpleProduct {
  id: string;
  slug: string;
  productType: string;
  requiresShipping: boolean;
  titleI18n: I18nMap;
  regularPrice: string;
  salePrice: string | null;
  discountType: string | null;
  discountValue: string | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  shippingConfig: { freeShipping?: boolean; extraShippingFee?: number };
  media: Array<{ url: string; mediaType: string }>;
  variants: Array<{ id: string; titleI18n: I18nMap; regularPrice: string; salePrice: string | null }>;
}

const SECTION_TYPES: LandingSectionType[] = [
  'HERO',
  'IMAGE_BANNER',
  'PRODUCT_PRESENTATION',
  'BENEFITS',
  'GALLERY_VIDEO',
  'TESTIMONIALS',
  'FAQ',
  'PROMO_OFFER',
  'COUNTDOWN',
  'PRICING_BUNDLES',
  'QUICK_ORDER_FORM',
];

function SortableSectionCard({
  sec,
  selected,
  onSelect,
  onToggle,
  onDelete,
  pick,
}: {
  sec: LandingPageSection;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  pick: (m?: I18nMap, fallback?: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: sec.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${
        selected
          ? 'border-emerald-800 bg-emerald-50/70'
          : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-stone-400 hover:text-stone-700"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-start"
        >
          <p className="font-extrabold text-stone-900 truncate">{sec.type}</p>
          <p className="truncate text-[11px] text-stone-500">
            {pick(sec.titleI18n, sec.id)}
          </p>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={sec.enabled}
          onChange={onToggle}
          title="Enable/Disable"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-stone-400 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AdminLandingPagesPage() {
  const { locale, pick } = useStore();
  const ar = locale === 'ar';

  const [pages, setPages] = useState<AdminLandingPage[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminLandingPage | null>(null);
  const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('mobile');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lpRes, pRes] = await Promise.all([
        fetch('/api/admin/landing-pages'),
        fetch('/api/admin/products'),
      ]);
      if (lpRes.ok) {
        const d = await lpRes.json();
        setPages(d.landingPages || []);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        setProducts(pd.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [uploadingSectionImage, setUploadingSectionImage] = useState(false);

  async function handleSectionFileUpload(file: File, callback: (url: string) => void) {
    setUploadingSectionImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'landing-pages');
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const d = await res.json();
        const url = d.url || d.publicUrl;
        if (url) callback(url);
      } else {
        alert('Failed to upload image');
      }
    } catch {
      alert('Network error while uploading image');
    } finally {
      setUploadingSectionImage(false);
    }
  }

  function applyPresetTemplate(
    template: 'IMAGE_CANVA' | 'FLASH_SALE' | 'BOTANICAL_LUXURY' | 'MINIMAL_DIRECT'
  ) {
    const firstProd = products[0];
    const firstProdId = firstProd?.id || null;
    const now = Date.now();

    if (template === 'IMAGE_CANVA') {
      setEditing({
        id: '',
        productId: firstProdId,
        slug: `banner-offer-${now.toString().slice(-4)}`,
        titleI18n: {
          ar: 'صفحة هبوط كصورة (كانفا / فوتوشوب)',
          fr: 'Landing Page Image / Canva',
          en: 'Full Image / Canva Landing Page',
        },
        isPublished: true,
        showHeader: false,
        showFooter: true,
        sections: [
          {
            id: `sec-img-${now}`,
            type: 'IMAGE_BANNER',
            enabled: true,
            sortOrder: 0,
            titleI18n: { ar: 'بنر العرض الترويجي', fr: 'Bannière de l’offre', en: 'Promotional Banner' },
            content: {
              imageUrl: firstProd?.media?.[0]?.url || '',
              stickyCta: true,
              ctaTextI18n: {
                ar: 'اضغط هنا للطلب الآن — الدفع عند الاستلام',
                fr: 'Commander maintenant — Paiement à la livraison',
                en: 'Order Now — Cash on Delivery',
              },
            },
          },
          {
            id: `sec-order-${now + 1}`,
            type: 'QUICK_ORDER_FORM',
            enabled: true,
            sortOrder: 1,
            titleI18n: {
              ar: 'املأ الاستمارة لإتمام طلبك',
              fr: 'Complétez votre commande',
              en: 'Fill in your details to order',
            },
            content: {},
          },
        ],
        seoI18n: {},
        customPixels: {},
        viewsCount: 0,
        ordersCount: 0,
      });
      setSelectedSecId(`sec-img-${now}`);
      return;
    }

    if (template === 'FLASH_SALE') {
      setEditing({
        id: '',
        productId: firstProdId,
        slug: `flash-sale-${now.toString().slice(-4)}`,
        titleI18n: {
          ar: 'عرض ترويجي حارق — خصم حصري',
          fr: 'Vente Flash — Offre Limitée',
          en: 'Flash Sale — Limited Time Offer',
        },
        isPublished: true,
        showHeader: false,
        showFooter: true,
        sections: [
          {
            id: `sec-hero-${now}`,
            type: 'HERO',
            enabled: true,
            sortOrder: 0,
            titleI18n: {
              ar: 'عرض استثنائي ومحدود — استفد من التخفيض الآن',
              fr: 'Offre exclusive — Profitez de la réduction',
              en: 'Exclusive Offer — Claim Your Discount Now',
            },
            subtitleI18n: {
              ar: 'توصيل سريع مجاني لكافة المدن المغربية مع ضمان الجودة 100%',
              fr: 'Livraison gratuite partout au Maroc avec garantie 100%',
              en: 'Free fast delivery across Morocco with 100% guarantee',
            },
            content: {
              imageUrl: firstProd?.media?.[0]?.url || '',
              badgeI18n: { ar: '🔥 تخفيض حصري 40%', fr: '🔥 Réduction 40%', en: '🔥 40% Off' },
            },
          },
          {
            id: `sec-count-${now + 1}`,
            type: 'COUNTDOWN',
            enabled: true,
            sortOrder: 1,
            titleI18n: { ar: 'ينتهي هذا العرض الترويجي قريباً:', fr: 'Cette offre se termine dans :', en: 'This offer ends in:' },
            content: { endsAt: new Date(Date.now() + 86400000 * 2).toISOString() },
          },
          {
            id: `sec-ben-${now + 2}`,
            type: 'BENEFITS',
            enabled: true,
            sortOrder: 2,
            titleI18n: { ar: 'لماذا يختارنا أكثر من 10,000 زبون؟', fr: 'Pourquoi nous choisir ?', en: 'Why Choose Us?' },
            content: {
              items: [
                {
                  titleI18n: { ar: 'توصيل مجاني وسريع', fr: 'Livraison gratuite', en: 'Fast Free Delivery' },
                  descI18n: { ar: 'توصيل إلى باب منزلك في 24 إلى 48 ساعة لكافة المدن.', fr: 'À votre porte en 24-48h.', en: 'To your doorstep in 24-48 hours.' },
                },
                {
                  titleI18n: { ar: 'الدفع عند الاستلام', fr: 'Paiement à la livraison', en: 'Cash on Delivery' },
                  descI18n: { ar: 'لا تدفع أي درهم حتى تستلم طلبك وتتفحصه بنفسك.', fr: 'Payez uniquement à réception.', en: 'Pay only upon receipt and inspection.' },
                },
                {
                  titleI18n: { ar: 'ضمان الاسترجاع والرضا', fr: 'Garantie satisfaction', en: 'Satisfaction Guaranteed' },
                  descI18n: { ar: 'ضمان استبدال أو استرجاع في حال وجود أي عيب.', fr: 'Échange ou remboursement garanti.', en: 'Hassle-free replacement guarantee.' },
                },
              ],
            },
          },
          {
            id: `sec-bundles-${now + 3}`,
            type: 'PRICING_BUNDLES',
            enabled: true,
            sortOrder: 3,
            titleI18n: { ar: 'اختر باقتك المفضلة واستفد من الخصم', fr: 'Choisissez votre pack', en: 'Choose Your Bundle' },
            content: {
              tiers: [
                { qty: 1, labelI18n: { ar: 'علبة واحدة', fr: '1 Pièce', en: '1 Piece' } },
                { qty: 2, labelI18n: { ar: 'علبتين (خصم 20%) الأكثر طلباً ⭐', fr: '2 Pièces (-20%) Populaire', en: '2 Pieces (-20%) Most Popular' } },
                { qty: 3, labelI18n: { ar: '3 علب (توصيل مجاني + هدية)', fr: '3 Pièces (Gratuit + Cadeau)', en: '3 Pieces (Free + Gift)' } },
              ],
            },
          },
          {
            id: `sec-order-${now + 4}`,
            type: 'QUICK_ORDER_FORM',
            enabled: true,
            sortOrder: 4,
            titleI18n: { ar: 'أدخل معلوماتك وسنتصل بك فوراً للتأكيد', fr: 'Commander maintenant', en: 'Quick Order' },
            content: {},
          },
          {
            id: `sec-reviews-${now + 5}`,
            type: 'TESTIMONIALS',
            enabled: true,
            sortOrder: 5,
            titleI18n: { ar: 'آراء وتقييمات زبنائنا الكرام', fr: 'Avis de nos clients', en: 'Customer Reviews' },
            content: {
              items: [
                { name: 'فاطمة الزهراء — الدار البيضاء', rating: 5, text: 'جودة ممتازة والتوصيل كان سريع جداً في 24 ساعة، شكراً لكم!' },
                { name: 'يوسف — الرباط', rating: 5, text: 'المنتج أصلي ومطابق للوصف تماماً والمعاملة في الواتساب احترافية.' },
                { name: 'سناء — مراكش', rating: 5, text: 'التغليف أنيق والمنتج فاق توقعاتي، سأطلب منكم مرة أخرى إن شاء الله.' },
              ],
            },
          },
        ],
        seoI18n: {},
        customPixels: {},
        viewsCount: 0,
        ordersCount: 0,
      });
      setSelectedSecId(`sec-hero-${now}`);
      return;
    }

    if (template === 'BOTANICAL_LUXURY') {
      setEditing({
        id: '',
        productId: firstProdId,
        slug: `luxury-${now.toString().slice(-4)}`,
        titleI18n: {
          ar: 'سرد القصة والفخامة المغربية الطبيعية',
          fr: 'Luxe Botanique & Histoire',
          en: 'Botanical Luxury Storytelling',
        },
        isPublished: true,
        showHeader: true,
        showFooter: true,
        sections: [
          {
            id: `sec-hero-${now}`,
            type: 'HERO',
            enabled: true,
            sortOrder: 0,
            titleI18n: { ar: 'أسرار الطبيعة المغربية الأصيلة', fr: 'Secrets de la nature marocaine', en: 'Authentic Moroccan Nature Secrets' },
            subtitleI18n: { ar: 'مستحضرات طبيعية نقية 100% مستوحاة من جبال الأطلس الشامخة', fr: '100% naturel pur issu de l’Atlas', en: '100% pure natural heritage from the Atlas mountains' },
            content: {
              imageUrl: firstProd?.media?.[0]?.url || '',
              badgeI18n: { ar: '🌿 منتج عضوي فاخر', fr: '🌿 Bio de luxe', en: '🌿 Pure Organic' },
            },
          },
          {
            id: `sec-prod-${now + 1}`,
            type: 'PRODUCT_PRESENTATION',
            enabled: true,
            sortOrder: 1,
            titleI18n: { ar: 'قصة هذا المنتج الفريد', fr: 'L’histoire du produit', en: 'The Product Story' },
            content: {
              bodyI18n: {
                ar: 'تم قطف واختيار كل عنصر بعناية فائقة من تعاونيات مغربية أصيلة لضمان أعلى مستويات الفعالية والنقاء دون أي إضافات كيميائية.',
                fr: 'Sélection rigoureuse d’ingrédients purs issus de coopératives marocaines authentiques.',
                en: 'Carefully hand-harvested ingredients from Moroccan cooperatives for purity and efficacy.',
              },
            },
          },
          {
            id: `sec-ben-${now + 2}`,
            type: 'BENEFITS',
            enabled: true,
            sortOrder: 2,
            titleI18n: { ar: 'المميزات والفوائد الأساسية', fr: 'Bienfaits essentiels', en: 'Key Benefits' },
            content: {
              items: [
                { titleI18n: { ar: 'نتائج ملحوظة من أول أسبوع', fr: 'Résultats visibles dès 7 jours' }, descI18n: { ar: 'تركيبة مركزة تمنحك النتائج المنشودة بسرعة وأمان.' } },
                { titleI18n: { ar: 'معتمد ومختبر مخبرياً', fr: 'Testé en laboratoire' }, descI18n: { ar: 'خاضع لاختبارات الجودة والسلامة الصحية.' } },
                { titleI18n: { ar: 'خالٍ من المواد الحافظة', fr: 'Sans conservateurs' }, descI18n: { ar: 'نقي 100% بدون أي مواد كيميائية ضارة.' } },
              ],
            },
          },
          {
            id: `sec-faq-${now + 3}`,
            type: 'FAQ',
            enabled: true,
            sortOrder: 3,
            titleI18n: { ar: 'الأسئلة الشائعة والأجوبة', fr: 'Foire Aux Questions', en: 'Frequently Asked Questions' },
            content: {
              items: [
                { qI18n: { ar: 'كيف يتم استخدام المنتج؟' }, aI18n: { ar: 'يوضع يومياً بانتظام وفق التعليمات المرفقة مع العلبة.' } },
                { qI18n: { ar: 'كم يستغرق التوصيل؟' }, aI18n: { ar: 'يصلكم الطلب خلال 24-48 ساعة والدفع يكون عند الاستلام.' } },
              ],
            },
          },
          {
            id: `sec-order-${now + 4}`,
            type: 'QUICK_ORDER_FORM',
            enabled: true,
            sortOrder: 4,
            titleI18n: { ar: 'احصل على باقتك الآن واستفد من العرض', fr: 'Commandez votre pack', en: 'Order Now' },
            content: {},
          },
        ],
        seoI18n: {},
        customPixels: {},
        viewsCount: 0,
        ordersCount: 0,
      });
      setSelectedSecId(`sec-hero-${now}`);
      return;
    }

    // MINIMAL_DIRECT
    startNew();
  }

  function startNew() {
    const firstProdId = products[0]?.id || null;
    setEditing({
      id: '',
      productId: firstProdId,
      slug: `offer-${Date.now().toString().slice(-4)}`,
      titleI18n: { ar: 'عرض خاص جديد', fr: 'Nouvelle Offre', en: 'New Special Offer' },
      isPublished: true,
      showHeader: false,
      showFooter: true,
      sections: [
        {
          id: `sec-hero-${Date.now()}`,
          type: 'HERO',
          enabled: true,
          sortOrder: 0,
          titleI18n: { ar: 'عنوان العرض الرئيسي', fr: 'Titre de l’offre', en: 'Hero Offer Title' },
          subtitleI18n: { ar: 'توصيل سريع والدفع عند الاستلام', fr: 'Livraison rapide COD', en: 'Fast COD shipping' },
          content: {},
        },
        {
          id: `sec-order-${Date.now() + 1}`,
          type: 'QUICK_ORDER_FORM',
          enabled: true,
          sortOrder: 1,
          titleI18n: { ar: 'اطلب الآن', fr: 'Commander', en: 'Order Now' },
          content: {},
        },
      ],
      seoI18n: {},
      customPixels: {},
      viewsCount: 0,
      ordersCount: 0,
    });
    setSelectedSecId(null);
  }

  function handleDragEnd(ev: DragEndEvent) {
    if (!editing || !ev.over || ev.active.id === ev.over.id) return;
    const activeId = ev.active.id;
    const overId = ev.over.id;
    const oldIdx = editing.sections.findIndex((s) => s.id === activeId);
    const newIdx = editing.sections.findIndex((s) => s.id === overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(editing.sections, oldIdx, newIdx).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));
    setEditing({ ...editing, sections: reordered });
  }

  function updateActiveSectionContent(partial: Record<string, unknown>) {
    if (!editing || !selectedSecId) return;
    setEditing({
      ...editing,
      sections: editing.sections.map((s) =>
        s.id === selectedSecId
          ? { ...s, content: { ...((s.content as Record<string, unknown>) || {}), ...partial } }
          : s
      ),
    });
  }

  function addSection(type: LandingSectionType) {
    if (!editing) return;
    const id = `sec-${type.toLowerCase()}-${Date.now()}`;
    const newSec: LandingPageSection = {
      id,
      type,
      enabled: true,
      sortOrder: editing.sections.length,
      titleI18n: { ar: type, fr: type, en: type },
      subtitleI18n: { ar: '', fr: '', en: '' },
      content:
        type === 'IMAGE_BANNER'
          ? {
              imageUrl: '',
              stickyCta: true,
              ctaTextI18n: {
                ar: 'اضغط هنا للطلب الآن — الدفع عند الاستلام',
                fr: 'Commander maintenant — Paiement à la livraison',
                en: 'Order Now — Cash on Delivery',
              },
            }
          : type === 'FAQ'
            ? { items: [{ qI18n: { ar: 'سؤال؟' }, aI18n: { ar: 'جواب' } }] }
            : type === 'BENEFITS'
              ? { items: [{ titleI18n: { ar: 'ميزة 1' }, descI18n: { ar: 'وصف' } }] }
              : type === 'COUNTDOWN'
                ? { endsAt: new Date(Date.now() + 86400000 * 3).toISOString() }
                : {},
    };
    setEditing({ ...editing, sections: [...editing.sections, newSec] });
    setSelectedSecId(id);
  }

  async function savePage() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...(editing.id ? { id: editing.id } : {}),
        productId: editing.productId || null,
        slug: editing.slug,
        titleI18n: editing.titleI18n,
        isPublished: editing.isPublished,
        showHeader: editing.showHeader,
        showFooter: editing.showFooter,
        sections: editing.sections,
        seoI18n: editing.seoI18n,
        customPixels: editing.customPixels,
      };
      const res = await fetch('/api/admin/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditing(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function duplicatePage(id: string) {
    const res = await fetch('/api/admin/landing-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DUPLICATE', sourceId: id }),
    });
    if (res.ok) await load();
  }

  async function deletePage(id: string) {
    if (!confirm(ar ? 'حذف صفحة الهبوط؟' : 'Delete landing page?')) return;
    const res = await fetch(`/api/admin/landing-pages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  const activeSection = editing?.sections.find((s) => s.id === selectedSecId) || null;
  const linkedProduct = products.find((p) => p.id === editing?.productId) || null;

  function renderActiveSectionContent() {
    if (!activeSection) return null;
    const content = (activeSection.content || {}) as Record<string, unknown>;

    switch (activeSection.type) {
      case 'IMAGE_BANNER': {
        const imgUrl = String(content.imageUrl || '');
        const stickyCta = Boolean(content.stickyCta ?? true);
        const ctaText = (content.ctaTextI18n as I18nMap) || {};

        return (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-amber-950 flex items-center gap-1.5 text-xs">
                <ImageIcon className="h-4 w-4 text-amber-700" />
                {ar ? 'صورة البنر (Canva / فوتوشوب)' : 'Banner Image (Canva / PS)'}
              </span>
            </div>

            {/* Upload Button */}
            <div>
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-amber-400 bg-white p-3 text-xs font-bold text-amber-950 hover:bg-amber-50 transition-colors">
                <Upload className="h-4 w-4 text-amber-600" />
                <span>
                  {uploadingSectionImage
                    ? ar ? 'جار رفع الصورة...' : 'Uploading...'
                    : ar ? 'رفع صورة البنر من جهازك' : 'Upload Banner Image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingSectionImage}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleSectionFileUpload(f, (url) => {
                        updateActiveSectionContent({ imageUrl: url });
                      });
                    }
                  }}
                />
              </label>
            </div>

            {/* Direct Image URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-600">
                {ar ? 'أو أدخل رابط الصورة المباشر:' : 'Or enter direct image URL:'}
              </label>
              <input
                dir="ltr"
                value={imgUrl}
                onChange={(e) => updateActiveSectionContent({ imageUrl: e.target.value })}
                placeholder="https://... /uploads/..."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-start"
              />
            </div>

            {/* Preview */}
            {imgUrl && (
              <div className="relative overflow-hidden rounded-xl border border-stone-200">
                <img
                  src={imgUrl}
                  alt="Banner preview"
                  className="max-h-48 w-full object-contain bg-stone-100"
                />
                <button
                  type="button"
                  onClick={() => updateActiveSectionContent({ imageUrl: '' })}
                  className="absolute top-2 right-2 rounded-lg bg-red-600 p-1 text-white shadow hover:bg-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Sticky CTA option */}
            <div className="pt-2 border-t border-amber-200/70 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stickyCta}
                  onChange={(e) => updateActiveSectionContent({ stickyCta: e.target.checked })}
                  className="rounded border-amber-400 text-amber-600"
                />
                <span>
                  {ar
                    ? 'إظهار زر طلب عائم أسفل الشاشة (Sticky Mobile CTA)'
                    : 'Show floating sticky CTA button on mobile'}
                </span>
              </label>

              {stickyCta && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-stone-600">
                    {ar ? 'نص زر الطلب العائم:' : 'Sticky CTA Button Text:'}
                  </label>
                  <input
                    value={ctaText.ar || ''}
                    onChange={(e) =>
                      updateActiveSectionContent({
                        ctaTextI18n: { ...ctaText, ar: e.target.value },
                      })
                    }
                    placeholder="نص الزر بالعربية (مثال: اضغط هنا للطلب الآن — الدفع عند الاستلام)"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <input
                    value={ctaText.fr || ''}
                    onChange={(e) =>
                      updateActiveSectionContent({
                        ctaTextI18n: { ...ctaText, fr: e.target.value },
                      })
                    }
                    placeholder="Texte du bouton (FR)"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'HERO': {
        const imgUrl = String(content.imageUrl || '');
        const badge = (content.badgeI18n as I18nMap) || {};

        return (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <span className="font-extrabold text-stone-800 flex items-center gap-1.5 text-xs">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {ar ? 'محتوى البانر الرئيسي (Hero)' : 'Hero Banner Details'}
            </span>

            {/* Hero Image upload */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-600">
                {ar ? 'صورة المنتج في الهيرو:' : 'Hero Product Image:'}
              </label>
              <div className="flex gap-2">
                <input
                  dir="ltr"
                  value={imgUrl}
                  onChange={(e) => updateActiveSectionContent({ imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-start"
                />
                <label className="cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50">
                  <Upload className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingSectionImage}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        handleSectionFileUpload(f, (url) => {
                          updateActiveSectionContent({ imageUrl: url });
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Badge */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-600">
                {ar ? 'شارة أعلى العنوان (Badge):' : 'Top Badge:'}
              </label>
              <input
                value={badge.ar || ''}
                onChange={(e) =>
                  updateActiveSectionContent({
                    badgeI18n: { ...badge, ar: e.target.value },
                  })
                }
                placeholder="مثال: 🔥 تخفيض حصري 40%"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs"
              />
            </div>
          </div>
        );
      }

      case 'COUNTDOWN': {
        const endsAt = content.endsAt ? String(content.endsAt) : '';
        const dtVal = endsAt ? new Date(endsAt).toISOString().slice(0, 16) : '';

        return (
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <span className="font-extrabold text-stone-800 flex items-center gap-1.5 text-xs">
              <Clock className="h-4 w-4 text-red-500" />
              {ar ? 'العداد التنازلي' : 'Countdown Timer'}
            </span>
            <label className="text-[11px] font-bold text-stone-600">
              {ar ? 'تاريخ ووقت انتهاء العرض:' : 'Offer Ends At:'}
            </label>
            <input
              type="datetime-local"
              value={dtVal}
              onChange={(e) => {
                if (e.target.value) {
                  updateActiveSectionContent({ endsAt: new Date(e.target.value).toISOString() });
                }
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs"
            />
          </div>
        );
      }

      case 'BENEFITS': {
        const rawItems = Array.isArray(content.items) ? (content.items as Array<{ titleI18n?: I18nMap; descI18n?: I18nMap }>) : [];

        return (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-stone-800 text-xs">
                {ar ? 'عناصر المميزات والفوائد' : 'Benefits List'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newItems = [
                    ...rawItems,
                    {
                      titleI18n: { ar: 'ميزة جديدة', fr: 'Nouvel avantage', en: 'New Benefit' },
                      descI18n: { ar: 'وصف مختصر للميزة', fr: 'Description', en: 'Description' },
                    },
                  ];
                  updateActiveSectionContent({ items: newItems });
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
              >
                <Plus className="h-3 w-3" />
                {ar ? 'إضافة ميزة' : 'Add Item'}
              </button>
            </div>

            <div className="space-y-2">
              {rawItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-stone-200 bg-white p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-400">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = rawItems.filter((_, i) => i !== idx);
                        updateActiveSectionContent({ items: newItems });
                      }}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    value={item.titleI18n?.ar || ''}
                    onChange={(e) => {
                      const newItems = [...rawItems];
                      newItems[idx] = {
                        ...newItems[idx],
                        titleI18n: { ...(newItems[idx].titleI18n || {}), ar: e.target.value },
                      };
                      updateActiveSectionContent({ items: newItems });
                    }}
                    placeholder="عنوان الميزة (عربي)"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
                  />
                  <input
                    value={item.descI18n?.ar || ''}
                    onChange={(e) => {
                      const newItems = [...rawItems];
                      newItems[idx] = {
                        ...newItems[idx],
                        descI18n: { ...(newItems[idx].descI18n || {}), ar: e.target.value },
                      };
                      updateActiveSectionContent({ items: newItems });
                    }}
                    placeholder="وصف الميزة (عربي)"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'FAQ': {
        const rawItems = Array.isArray(content.items) ? (content.items as Array<{ qI18n?: I18nMap; aI18n?: I18nMap }>) : [];

        return (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-stone-800 flex items-center gap-1.5 text-xs">
                <HelpCircle className="h-4 w-4 text-blue-500" />
                {ar ? 'الأسئلة الشائعة والأجوبة' : 'FAQ Items'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newItems = [
                    ...rawItems,
                    {
                      qI18n: { ar: 'سؤال جديد؟', fr: 'Nouvelle question ?' },
                      aI18n: { ar: 'جواب السؤال هنا.', fr: 'Réponse ici.' },
                    },
                  ];
                  updateActiveSectionContent({ items: newItems });
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
              >
                <Plus className="h-3 w-3" />
                {ar ? 'إضافة سؤال' : 'Add FAQ'}
              </button>
            </div>

            <div className="space-y-2">
              {rawItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-stone-200 bg-white p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-400">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = rawItems.filter((_, i) => i !== idx);
                        updateActiveSectionContent({ items: newItems });
                      }}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    value={item.qI18n?.ar || ''}
                    onChange={(e) => {
                      const newItems = [...rawItems];
                      newItems[idx] = {
                        ...newItems[idx],
                        qI18n: { ...(newItems[idx].qI18n || {}), ar: e.target.value },
                      };
                      updateActiveSectionContent({ items: newItems });
                    }}
                    placeholder="السؤال (عربي)"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs font-bold"
                  />
                  <textarea
                    rows={2}
                    value={item.aI18n?.ar || ''}
                    onChange={(e) => {
                      const newItems = [...rawItems];
                      newItems[idx] = {
                        ...newItems[idx],
                        aI18n: { ...(newItems[idx].aI18n || {}), ar: e.target.value },
                      };
                      updateActiveSectionContent({ items: newItems });
                    }}
                    placeholder="الجواب (عربي)"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'PRICING_BUNDLES': {
        const rawTiers = Array.isArray(content.tiers) ? (content.tiers as Array<{ qty?: number; labelI18n?: I18nMap }>) : [];

        return (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-stone-800 text-xs">
                {ar ? 'باقات العروض (Bundles)' : 'Bundle Pricing Tiers'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newTiers = [
                    ...rawTiers,
                    {
                      qty: (rawTiers.length || 0) + 1,
                      labelI18n: { ar: 'باقة جديدة', fr: 'Nouveau pack' },
                    },
                  ];
                  updateActiveSectionContent({ tiers: newTiers });
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
              >
                <Plus className="h-3 w-3" />
                {ar ? 'إضافة باقة' : 'Add Tier'}
              </button>
            </div>

            <div className="space-y-2">
              {rawTiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white p-2">
                  <div className="w-16">
                    <span className="text-[10px] text-stone-400 block">{ar ? 'الكمية' : 'Qty'}</span>
                    <input
                      type="number"
                      min={1}
                      value={tier.qty || 1}
                      onChange={(e) => {
                        const newTiers = [...rawTiers];
                        newTiers[idx] = { ...newTiers[idx], qty: Number(e.target.value) || 1 };
                        updateActiveSectionContent({ tiers: newTiers });
                      }}
                      className="w-full rounded border border-stone-200 px-1.5 py-1 text-xs text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-stone-400 block">{ar ? 'العنوان' : 'Label'}</span>
                    <input
                      value={tier.labelI18n?.ar || ''}
                      onChange={(e) => {
                        const newTiers = [...rawTiers];
                        newTiers[idx] = {
                          ...newTiers[idx],
                          labelI18n: { ...(newTiers[idx].labelI18n || {}), ar: e.target.value },
                        };
                        updateActiveSectionContent({ tiers: newTiers });
                      }}
                      placeholder="مثال: علبتين (خصم 20%)"
                      className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newTiers = rawTiers.filter((_, i) => i !== idx);
                      updateActiveSectionContent({ tiers: newTiers });
                    }}
                    className="p-1 text-stone-400 hover:text-red-600 self-end"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'PRODUCT_PRESENTATION': {
        const body = (content.bodyI18n as I18nMap) || {};

        return (
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <span className="font-extrabold text-stone-800 text-xs">
              {ar ? 'نص قصة المنتج / الشرح المفصل' : 'Product Story / Presentation'}
            </span>
            <textarea
              rows={4}
              value={body.ar || ''}
              onChange={(e) =>
                updateActiveSectionContent({
                  bodyI18n: { ...body, ar: e.target.value },
                })
              }
              placeholder="اكتب قصة المنتج أو تفاصيل المكونات الطبيعية هنا..."
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs"
            />
          </div>
        );
      }

      case 'GALLERY_VIDEO': {
        const videoUrl = String(content.videoUrl || '');

        return (
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <span className="font-extrabold text-stone-800 flex items-center gap-1.5 text-xs">
              <Video className="h-4 w-4 text-emerald-600" />
              {ar ? 'رابط الفيديو (YouTube / MP4)' : 'Video URL'}
            </span>
            <input
              dir="ltr"
              value={videoUrl}
              onChange={(e) => updateActiveSectionContent({ videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-start"
            />
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <AdminShell>
      {!editing ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-black text-stone-900">
                  {ar ? 'منشئ صفحات الهبوط (Landing Pages)' : 'Landing Page Builder'}
                </h1>
                <p className="text-xs text-stone-500">
                  {ar
                    ? 'اختر قالباً جاهزاً بضغطة واحدة، أو ابنِ صفحتك المخصصة خطوة بخطوة'
                    : 'Choose a ready preset template or build your custom landing page'}
                </p>
              </div>
              <button
                type="button"
                onClick={startNew}
                className="btn-store-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold"
              >
                <Plus className="h-4 w-4" />
                <span>{ar ? 'صفحة فارغة' : 'Blank Page'}</span>
              </button>
            </div>

            {/* Quick Template Presets */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => applyPresetTemplate('IMAGE_CANVA')}
                className="group flex flex-col items-start gap-1.5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-start transition-all hover:border-amber-400 hover:bg-amber-50 hover:shadow-sm"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                    {ar ? 'الأكثر طلباً' : 'Popular'}
                  </span>
                </div>
                <div className="font-extrabold text-stone-900 text-xs">
                  {ar ? '🖼️ صفحة كصورة (Canva / بنر)' : '🖼️ Full Image / Canva'}
                </div>
                <p className="text-[11px] text-stone-600 line-clamp-2">
                  {ar
                    ? 'صمم صفحتك في كانفا أو فوتوشوب وارفعها مباشرة كصورة طويلة مع زر طلب عائم.'
                    : 'Upload tall Canva/Photoshop infographics with sticky floating COD button.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPresetTemplate('FLASH_SALE')}
                className="group flex flex-col items-start gap-1.5 rounded-2xl border border-red-200 bg-red-50/50 p-4 text-start transition-all hover:border-red-400 hover:bg-red-50 hover:shadow-sm"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-lg bg-red-100 p-2 text-red-800">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-black uppercase text-red-800 bg-red-200/60 px-2 py-0.5 rounded-full">
                    {ar ? 'تحويل عالٍ' : 'High Conv'}
                  </span>
                </div>
                <div className="font-extrabold text-stone-900 text-xs">
                  {ar ? '🔥 عرض ترويجي (Flash Sale)' : '🔥 Flash Sale Urgency'}
                </div>
                <p className="text-[11px] text-stone-600 line-clamp-2">
                  {ar
                    ? 'عداد تنازلي للخصم، باقات أسعار متعددة (Bundles)، وآراء وتقييمات زبناء حقيقية.'
                    : 'Countdown timer, bundle pricing discounts, and customer testimonials.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPresetTemplate('BOTANICAL_LUXURY')}
                className="group flex flex-col items-start gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-start transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
                    <LayoutTemplate className="h-4 w-4" />
                  </span>
                </div>
                <div className="font-extrabold text-stone-900 text-xs">
                  {ar ? '🌿 فخامة وسرد قصة (Storytelling)' : '🌿 Botanical Luxury'}
                </div>
                <p className="text-[11px] text-stone-600 line-clamp-2">
                  {ar
                    ? 'هوية بصرية فاخرة، قصة المنتج الأصيل، بطاقات الفوائد والأسئلة الشائعة.'
                    : 'Modern luxury aesthetic, authentic product story, benefits and FAQ.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPresetTemplate('MINIMAL_DIRECT')}
                className="group flex flex-col items-start gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-start transition-all hover:border-stone-400 hover:bg-white hover:shadow-sm"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-lg bg-stone-200 p-2 text-stone-800">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
                <div className="font-extrabold text-stone-900 text-xs">
                  {ar ? '⚡ مباشر وسريع (Minimal Direct)' : '⚡ Minimal Direct Form'}
                </div>
                <p className="text-[11px] text-stone-600 line-clamp-2">
                  {ar
                    ? 'عنوان رئيسي مع استمارة طلب فوري بدون تشتيت، مثالية للإعلانات المركزة.'
                    : 'Hero headline with instant order form without distraction.'}
                </p>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-store-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pages.map((lp) => (
                <div
                  key={lp.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-stone-900">{pick(lp.titleI18n)}</h2>
                      <p dir="ltr" className="text-xs text-stone-400">
                        /lp/{lp.slug}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        lp.isPublished
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {lp.isPublished ? (ar ? 'منشورة' : 'Live') : ar ? 'مسودة' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex gap-4 text-xs text-stone-500">
                    <span>{lp.viewsCount} views</span>
                    <span>{lp.ordersCount} orders</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(lp);
                        setSelectedSecId(lp.sections[0]?.id || null);
                      }}
                      className="btn-store-primary flex-1 py-2 text-xs font-bold"
                    >
                      {ar ? 'فتح المحرر' : 'Open Builder'}
                    </button>
                    <Link
                      href={`/lp/${lp.slug}`}
                      target="_blank"
                      className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => duplicatePage(lp.id)}
                      className="rounded-xl border border-stone-200 p-2 text-stone-700 hover:bg-stone-50"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePage(lp.id)}
                      className="rounded-xl border border-stone-200 p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Builder Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
              >
                <X className="h-4 w-4" />
              </button>
              <input
                value={editing.titleI18n.ar || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    titleI18n: { ...editing.titleI18n, ar: e.target.value },
                  })
                }
                placeholder="Title AR"
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold"
              />
              <input
                dir="ltr"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="slug"
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-start"
              />
              <select
                value={editing.productId || ''}
                onChange={(e) => setEditing({ ...editing, productId: e.target.value || null })}
                className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs"
              >
                <option value="">{ar ? 'بدون منتج مرتبط' : 'No Product'}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pick(p.titleI18n)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={editing.isPublished}
                  onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
                />
                {ar ? 'منشورة' : 'Published'}
              </label>

              {/* Template selector in builder header */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    if (
                      confirm(
                        ar
                          ? 'هل أنت متأكد من تطبيق هذا القالب؟ سيتم استبدال أقسام الصفحة الحالية.'
                          : 'Are you sure? This will replace current sections with the template.'
                      )
                    ) {
                      applyPresetTemplate(
                        e.target.value as
                          | 'IMAGE_CANVA'
                          | 'FLASH_SALE'
                          | 'BOTANICAL_LUXURY'
                          | 'MINIMAL_DIRECT'
                      );
                    }
                  }
                }}
                value=""
                className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 cursor-pointer hover:bg-amber-100"
              >
                <option value="">{ar ? '⚡ تطبيق قالب جاهز...' : '⚡ Apply Preset Template...'}</option>
                <option value="IMAGE_CANVA">{ar ? '🖼️ صفحة كصورة (Canva / بنر)' : '🖼️ Full Image / Canva'}</option>
                <option value="FLASH_SALE">{ar ? '🔥 عرض ترويجي (Flash Sale)' : '🔥 Flash Sale Urgency'}</option>
                <option value="BOTANICAL_LUXURY">{ar ? '🌿 فخامة وسرد قصة (Luxury)' : '🌿 Botanical Luxury'}</option>
                <option value="MINIMAL_DIRECT">{ar ? '⚡ مباشر وسريع (Minimal)' : '⚡ Minimal Direct'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-stone-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`rounded-lg p-1.5 ${
                    previewMode === 'mobile' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`rounded-lg p-1.5 ${
                    previewMode === 'desktop' ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={savePage}
                className="btn-store-primary px-5 py-2 text-xs font-extrabold"
              >
                {saving ? '...' : ar ? 'حفظ الصفحة' : 'Save Page'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Sidebar: Drag-and-drop Section Tree + Pixels */}
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 lg:col-span-4 h-fit">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase text-stone-500">
                  {ar ? 'أقسام الصفحة (سحب وإفلات)' : 'Sections (Drag & Drop)'}
                </h3>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addSection(e.target.value as LandingSectionType);
                  }}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-[11px] font-bold"
                >
                  <option value="">+ {ar ? 'إضافة قسم' : 'Add Section'}</option>
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={editing.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {editing.sections.map((sec) => (
                      <SortableSectionCard
                        key={sec.id}
                        sec={sec}
                        selected={sec.id === selectedSecId}
                        onSelect={() => setSelectedSecId(sec.id)}
                        onToggle={() =>
                          setEditing({
                            ...editing,
                            sections: editing.sections.map((s) =>
                              s.id === sec.id ? { ...s, enabled: !s.enabled } : s
                            ),
                          })
                        }
                        onDelete={() =>
                          setEditing({
                            ...editing,
                            sections: editing.sections.filter((s) => s.id !== sec.id),
                          })
                        }
                        pick={pick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {activeSection && (
                <div className="border-t border-stone-200 pt-3 space-y-2 text-xs">
                  <p className="font-extrabold text-emerald-900">
                    {ar ? 'تعديل القسم:' : 'Edit Section:'} {activeSection.type}
                  </p>
                  <input
                    value={activeSection.titleI18n?.ar || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? { ...s, titleI18n: { ...(s.titleI18n || {}), ar: e.target.value } }
                            : s
                        ),
                      })
                    }
                    placeholder="Title AR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                  <input
                    value={activeSection.titleI18n?.fr || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? { ...s, titleI18n: { ...(s.titleI18n || {}), fr: e.target.value } }
                            : s
                        ),
                      })
                    }
                    placeholder="Title FR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                  <textarea
                    rows={2}
                    value={activeSection.subtitleI18n?.ar || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sections: editing.sections.map((s) =>
                          s.id === activeSection.id
                            ? {
                                ...s,
                                subtitleI18n: { ...(s.subtitleI18n || {}), ar: e.target.value },
                              }
                            : s
                        ),
                      })
                    }
                    placeholder="Subtitle AR"
                    className="w-full rounded-xl border border-stone-300 px-3 py-1.5"
                  />
                  {/* Dynamic Section Content Editor */}
                  {renderActiveSectionContent()}
                </div>
              )}

              {/* Per-page custom pixels */}
              <div className="border-t border-stone-200 pt-3 space-y-2 text-xs">
                <p className="font-extrabold text-stone-700">
                  {ar ? 'بيكسلات مخصصة لهذه الصفحة' : 'Custom Page Pixels'}
                </p>
                <input
                  dir="ltr"
                  value={editing.customPixels?.metaPixelId || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      customPixels: { ...editing.customPixels, metaPixelId: e.target.value },
                    })
                  }
                  placeholder="Meta Pixel ID"
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-start"
                />
                <input
                  dir="ltr"
                  value={editing.customPixels?.tiktokPixelId || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      customPixels: { ...editing.customPixels, tiktokPixelId: e.target.value },
                    })
                  }
                  placeholder="TikTok Pixel ID"
                  className="w-full rounded-xl border border-stone-300 px-3 py-1.5 text-start"
                />
              </div>
            </div>

            {/* Right Live Preview Pane */}
            <div className="rounded-2xl border border-stone-200 bg-stone-200/70 p-4 lg:col-span-8 flex justify-center overflow-x-auto">
              <div
                className={`overflow-hidden rounded-3xl border border-stone-300 bg-[#FAF9F6] shadow-xl transition-all ${
                  previewMode === 'mobile' ? 'w-[390px]' : 'w-full'
                }`}
              >
                <LandingPageRenderer
                  landingPageId={editing.id || 'preview'}
                  sections={editing.sections}
                  product={
                    linkedProduct
                      ? {
                          id: linkedProduct.id,
                          productType: linkedProduct.productType,
                          requiresShipping: linkedProduct.requiresShipping,
                          titleI18n: linkedProduct.titleI18n,
                          regularPrice: linkedProduct.regularPrice,
                          salePrice: linkedProduct.salePrice,
                          discountType: linkedProduct.discountType,
                          discountValue: linkedProduct.discountValue,
                          promoStartsAt: linkedProduct.promoStartsAt,
                          promoEndsAt: linkedProduct.promoEndsAt,
                          shippingConfig: linkedProduct.shippingConfig,
                          imageUrl: linkedProduct.media?.[0]?.url || null,
                        }
                      : null
                  }
                  variants={linkedProduct?.variants || []}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
