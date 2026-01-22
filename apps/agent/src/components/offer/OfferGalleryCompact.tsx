'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OfferImage } from '@/types';

interface OfferGalleryCompactProps {
  images: OfferImage[];
  complexName?: string;
}

type ImageCategory = 'plan' | 'floorplan' | 'housemain' | 'complexscheme' | 'other';

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  plan: 'Планировка',
  floorplan: 'План этажа',
  housemain: 'Фото',
  complexscheme: 'Генплан',
  other: 'Фото',
};

const CATEGORY_ORDER: ImageCategory[] = ['plan', 'floorplan', 'housemain', 'complexscheme', 'other'];

export function OfferGalleryCompact({ images, complexName = '' }: OfferGalleryCompactProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Группируем изображения по категориям
  const groupedImages = useMemo(() => images.reduce<Record<ImageCategory, OfferImage[]>>((acc, img) => {
    const category: ImageCategory = img.tag || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(img);
    return acc;
  }, {} as Record<ImageCategory, OfferImage[]>), [images]);

  // Все изображения в порядке приоритета (plan первая)
  const allImages = useMemo(() =>
    CATEGORY_ORDER.flatMap(cat => groupedImages[cat] || []),
    [groupedImages]
  );

  // Доступные категории
  const availableCategories = useMemo(() =>
    CATEGORY_ORDER.filter(cat => groupedImages[cat]?.length > 0),
    [groupedImages]
  );

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + allImages.length) % allImages.length);
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
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-[var(--color-bg-gray)] rounded-xl flex items-center justify-center">
        <svg className="w-16 h-16 text-[var(--color-text-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  const currentImage = allImages[currentIndex];

  return (
    <>
      {/* Gallery Container */}
      <div className="relative aspect-square bg-[var(--color-bg-gray)] rounded-xl overflow-hidden group">
        {/* Main Image */}
        <img
          src={currentImage?.url}
          alt={`${CATEGORY_LABELS[currentImage?.tag || 'other']} - ${complexName}`}
          className="w-full h-full object-contain bg-white cursor-pointer"
          onClick={() => openLightbox(currentIndex)}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

        {/* Category chips (inside gallery) */}
        {availableCategories.length > 1 && (
          <div className="absolute top-3 left-3 right-3 flex gap-1.5 overflow-x-auto">
            {availableCategories.map(category => {
              const catImages = groupedImages[category] || [];
              const firstCatIndex = allImages.findIndex(img => img.tag === category || (!img.tag && category === 'other'));
              const isActive = currentImage?.tag === category || (!currentImage?.tag && category === 'other');

              return (
                <button
                  key={category}
                  onClick={() => setCurrentIndex(firstCatIndex >= 0 ? firstCatIndex : 0)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[var(--gray-900)] text-white'
                      : 'bg-white/90 text-[var(--color-text)] hover:bg-white'
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                  {catImages.length > 1 && (
                    <span className="ml-1 opacity-70">{catImages.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dots indicator */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.slice(0, 7).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all rounded-full ${
                  idx === currentIndex
                    ? 'w-5 h-1.5 bg-[var(--gray-900)]'
                    : 'w-1.5 h-1.5 bg-[var(--gray-900)]/30 hover:bg-[var(--gray-900)]/50'
                }`}
              />
            ))}
            {allImages.length > 7 && (
              <span className="text-xs text-[var(--color-text-light)] ml-1">
                +{allImages.length - 7}
              </span>
            )}
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Увеличить
          </div>
        </div>
      </div>

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
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/80 text-sm">
            {currentIndex + 1} / {allImages.length}
          </div>

          {/* Category badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/20 text-white px-3 py-1 rounded-full text-sm">
            {CATEGORY_LABELS[allImages[currentIndex]?.tag || 'other']}
          </div>

          {/* Navigation */}
          {allImages.length > 1 && (
            <>
              <button
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[currentIndex]?.url}
              alt={`${CATEGORY_LABELS[allImages[currentIndex]?.tag || 'other']} - ${complexName}`}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          {/* Thumbnail strip */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-4 py-2">
            {allImages.map((img, idx) => (
              <button
                key={img.url}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded overflow-hidden transition-all ${
                  idx === currentIndex
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
