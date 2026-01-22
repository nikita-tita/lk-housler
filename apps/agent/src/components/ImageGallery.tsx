'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OfferImage } from '@/types';

interface ImageGalleryProps {
  images: OfferImage[];
  complexName: string;
}

type ImageCategory = 'plan' | 'floorplan' | 'housemain' | 'complexscheme' | 'other';

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  plan: 'Планировка',
  floorplan: 'План этажа',
  housemain: 'Фото ЖК',
  complexscheme: 'Генплан',
  other: 'Фото',
};

const CATEGORY_ORDER: ImageCategory[] = ['plan', 'floorplan', 'housemain', 'complexscheme', 'other'];

export function ImageGallery({ images, complexName }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Группируем изображения по категориям
  const groupedImages = useMemo(() => images.reduce<Record<ImageCategory, OfferImage[]>>((acc, img) => {
    const category: ImageCategory = img.tag || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(img);
    return acc;
  }, {} as Record<ImageCategory, OfferImage[]>), [images]);

  // Доступные категории (которые имеют изображения)
  const availableCategories = useMemo(() => CATEGORY_ORDER.filter(cat => groupedImages[cat]?.length > 0), [groupedImages]);

  // Вычисляем начальную категорию на основе доступных
  const [activeCategory, setActiveCategory] = useState<ImageCategory>(() => {
    const available = CATEGORY_ORDER.filter(cat => {
      const grouped = images.reduce<Record<ImageCategory, OfferImage[]>>((acc, img) => {
        const category: ImageCategory = img.tag || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(img);
        return acc;
      }, {} as Record<ImageCategory, OfferImage[]>);
      return grouped[cat]?.length > 0;
    });
    return available.length > 0 ? available[0] : 'plan';
  });

  // Обновляем категорию только если текущая стала недоступной
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(activeCategory)) {
      // Используем setTimeout чтобы избежать setState во время рендера
      const timer = setTimeout(() => {
        setActiveCategory(availableCategories[0]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [availableCategories, activeCategory]);

  // Все изображения для lightbox (в порядке категорий)
  const allImages = CATEGORY_ORDER.flatMap(cat => groupedImages[cat] || []);

  const openLightbox = useCallback((categoryImage: OfferImage) => {
    const index = allImages.findIndex(img => img.url === categoryImage.url);
    setLightboxIndex(index >= 0 ? index : 0);
    setLightboxOpen(true);
  }, [allImages]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex(prev => (prev + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex(prev => (prev - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  // Prevent scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] bg-[var(--color-bg-gray)] rounded-lg flex items-center justify-center">
        <svg className="w-20 h-20 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  const currentCategoryImages = groupedImages[activeCategory] || [];

  return (
    <>
      {/* Category Tabs */}
      {availableCategories.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {availableCategories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === category
                  ? 'bg-black text-white'
                  : 'bg-[var(--color-bg-gray)] text-[var(--color-text)] hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[category]}
              <span className="ml-1.5 text-xs opacity-70">
                {groupedImages[category]?.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Image */}
      <div
        className="aspect-[4/3] bg-[var(--color-bg-gray)] rounded-lg overflow-hidden cursor-pointer mb-4 relative group"
        onClick={() => currentCategoryImages[0] && openLightbox(currentCategoryImages[0])}
      >
        {currentCategoryImages[0] && (
          <>
            <img
              src={currentCategoryImages[0].url}
              alt={`${CATEGORY_LABELS[activeCategory]} - ${complexName}`}
              className="w-full h-full object-contain bg-white"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white px-4 py-2 rounded-lg">
                <svg className="w-5 h-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Увеличить
              </div>
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {currentCategoryImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {currentCategoryImages.map((img) => (
            <button
              key={img.url}
              onClick={() => openLightbox(img)}
              className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-transparent hover:border-black transition-colors"
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
            onClick={closeLightbox}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/80 text-sm">
            {lightboxIndex + 1} / {allImages.length}
          </div>

          {/* Category badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/20 text-white px-3 py-1 rounded-full text-sm">
            {CATEGORY_LABELS[allImages[lightboxIndex]?.tag || 'other']}
          </div>

          {/* Navigation - Previous */}
          {allImages.length > 1 && (
            <button
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[lightboxIndex]?.url}
              alt={`${CATEGORY_LABELS[allImages[lightboxIndex]?.tag || 'other']} - ${complexName}`}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          {/* Navigation - Next */}
          {allImages.length > 1 && (
            <button
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Thumbnail strip */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-4 py-2">
            {allImages.map((img, idx) => (
              <button
                key={img.url}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                className={`flex-shrink-0 w-12 h-12 md:w-16 md:h-16 rounded overflow-hidden transition-all ${
                  idx === lightboxIndex
                    ? 'ring-2 ring-white scale-110'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
