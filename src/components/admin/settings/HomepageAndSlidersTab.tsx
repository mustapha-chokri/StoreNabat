'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { I18nMap } from '@/db/schema/types';

export interface HomepageSectionItem {
  id: string;
  sectionType: string;
  titleI18n: I18nMap;
  subtitleI18n: I18nMap;
  sortOrder: number;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface HeroSliderItem {
  id?: string;
  badgeI18n: I18nMap;
  titleI18n: I18nMap;
  subtitleI18n: I18nMap;
  ctaTextI18n: I18nMap;
  ctaUrl: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

function SortableHomeRow({
  sec,
  onChange,
  ar,
}: {
  sec: HomepageSectionItem;
  onChange: (next: HomepageSectionItem) => void;
  ar: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: sec.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-xs"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-stone-400 hover:text-stone-700"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-bold">
        {sec.sectionType}
      </span>

      <input
        value={sec.titleI18n?.ar || ''}
        onChange={(e) =>
          onChange({ ...sec, titleI18n: { ...sec.titleI18n, ar: e.target.value } })
        }
        placeholder="Title AR"
        className="min-w-[160px] flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5"
      />
      <input
        value={sec.titleI18n?.fr || ''}
        onChange={(e) =>
          onChange({ ...sec, titleI18n: { ...sec.titleI18n, fr: e.target.value } })
        }
        placeholder="Title FR"
        className="min-w-[160px] flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5"
      />

      <label className="inline-flex items-center gap-1.5 font-bold">
        <input
          type="checkbox"
          checked={sec.isEnabled}
          onChange={(e) => onChange({ ...sec, isEnabled: e.target.checked })}
        />
        {ar ? 'مفعل' : 'Enabled'}
      </label>
    </div>
  );
}

export function HomepageAndSlidersTab({
  ar,
  sections,
  setSections,
  sliders,
  onSaveSections,
  onSaveSlider,
  onDeleteSlider,
  onUploadImage,
  saving,
}: {
  ar: boolean;
  sections: HomepageSectionItem[];
  setSections: (next: HomepageSectionItem[]) => void;
  sliders: HeroSliderItem[];
  onSaveSections: () => Promise<void>;
  onSaveSlider: (slider: HeroSliderItem) => Promise<void>;
  onDeleteSlider: (id: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string | null>;
  saving: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [newSlider, setNewSlider] = useState<HeroSliderItem>({
    badgeI18n: { ar: 'عرض مميز', fr: 'Offre Spéciale', en: 'Special Offer' },
    titleI18n: { ar: '', fr: '', en: '' },
    subtitleI18n: { ar: '', fr: '', en: '' },
    ctaTextI18n: { ar: 'تسوق الآن', fr: 'Découvrir', en: 'Shop Now' },
    ctaUrl: '/shop',
    desktopImageUrl: '/images/seed/hero-atlas-1.svg',
    mobileImageUrl: null,
    sortOrder: sliders.length,
    isActive: true,
  });

  function handleDragEnd(ev: DragEndEvent) {
    if (!ev.over || ev.active.id === ev.over.id) return;
    const activeId = ev.active.id;
    const overId = ev.over.id;
    const oldIdx = sections.findIndex((s) => s.id === activeId);
    const newIdx = sections.findIndex((s) => s.id === overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({
      ...s,
      sortOrder: i,
    }));
    setSections(next);
  }

  return (
    <div className="space-y-6">
      {/* Drag & Drop Homepage Sections */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-stone-900">
              {ar ? 'ترتيب وتفعيل أقسام الصفحة الرئيسية (سحب وإفلات)' : 'Homepage Sections Order'}
            </h3>
            <p className="text-xs text-stone-500">
              {ar ? 'اسحب الأقسام لإعادة الترتيب ثم اضغط حفظ' : 'Drag sections to reorder, then save.'}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onSaveSections}
            className="btn-store-primary px-5 py-2 text-xs font-extrabold"
          >
            {ar ? 'حفظ الترتيب' : 'Save Order'}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map((sec) => (
                <SortableHomeRow
                  key={sec.id}
                  sec={sec}
                  ar={ar}
                  onChange={(updated) =>
                    setSections(sections.map((x) => (x.id === updated.id ? updated : x)))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Hero Sliders Management */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-stone-900">
          {ar ? 'إدارة السلايدر الرئيسي (Hero Sliders)' : 'Hero Sliders'}
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sliders.map((sl) => (
            <div
              key={sl.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 text-xs"
            >
              <img
                src={sl.desktopImageUrl}
                alt=""
                className="h-16 w-24 shrink-0 rounded-lg object-cover bg-stone-100"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{sl.titleI18n.ar || sl.titleI18n.fr}</p>
                <p dir="ltr" className="text-stone-400 truncate">
                  {sl.ctaUrl}
                </p>
              </div>
              {sl.id && (
                <button
                  type="button"
                  onClick={() => onDeleteSlider(sl.id!)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Slider Form */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3 text-xs">
          <p className="font-bold">{ar ? 'إضافة شريحة جديدة' : 'Add New Slide'}</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input
              value={newSlider.titleI18n.ar || ''}
              onChange={(e) =>
                setNewSlider({
                  ...newSlider,
                  titleI18n: { ...newSlider.titleI18n, ar: e.target.value },
                })
              }
              placeholder={ar ? 'العنوان الرئيسي (عربية)' : 'Title AR'}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2"
            />
            <input
              value={newSlider.titleI18n.fr || ''}
              onChange={(e) =>
                setNewSlider({
                  ...newSlider,
                  titleI18n: { ...newSlider.titleI18n, fr: e.target.value },
                })
              }
              placeholder="Title FR"
              className="rounded-xl border border-stone-300 bg-white px-3 py-2"
            />
            <input
              value={newSlider.subtitleI18n.ar || ''}
              onChange={(e) =>
                setNewSlider({
                  ...newSlider,
                  subtitleI18n: { ...newSlider.subtitleI18n, ar: e.target.value },
                })
              }
              placeholder={ar ? 'الوصف (عربية)' : 'Subtitle AR'}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2"
            />
            <input
              dir="ltr"
              value={newSlider.ctaUrl}
              onChange={(e) => setNewSlider({ ...newSlider, ctaUrl: e.target.value })}
              placeholder="/shop"
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-start"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 font-bold">
              <ImagePlus className="h-4 w-4" />
              <span>{ar ? 'صورة الحاسوب' : 'Desktop Image'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const url = await onUploadImage(f);
                    if (url) setNewSlider((p) => ({ ...p, desktopImageUrl: url }));
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                await onSaveSlider(newSlider);
                setNewSlider({
                  ...newSlider,
                  titleI18n: { ar: '', fr: '', en: '' },
                  subtitleI18n: { ar: '', fr: '', en: '' },
                });
              }}
              className="btn-store-primary inline-flex items-center gap-1.5 px-4 py-2 font-extrabold"
            >
              <Plus className="h-4 w-4" />
              {ar ? 'إضافة الشريحة' : 'Add Slide'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
