'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OfferImage } from '@/types';

interface OfferGalleryV2Props {
  images: OfferImage[];
  complexName?: string;
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

export function OfferGalleryV2({ images, complexName = '' }: OfferGalleryV2Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Group images by category
  const groupedImages = useMemo(() => images.reduce<Record<ImageCategory, OfferImage[]>>((acc, img) => {
    const category: ImageCategory = img.tag || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(img);
    return acc;
  }, {} as Record<ImageCategory, OfferImage[]>), [images]);

  // All images in priority order
  const allImages = useMemo(() =>
    CATEGORY_ORDER.flatMap(cat => groupedImages[cat] || []),
    [groupedImages]
  );

  // Available categories with images
  const availableCategories = useMemo(() =>
    CATEGORY_ORDER.filter(cat => groupedImages[cat]?.length > 0),
    [groupedImages]
  );

  // Active category based on current image
  const activeCategory = useMemo(() => {
    const currentImage = allImages[currentIndex];
    return currentImage?.tag || 'other';
  }, [allImages, currentIndex]);

  // Navigate to first image of category
  const goToCategory = useCallback((category: ImageCategory) => {
    const firstIndex = allImages.findIndex(img => (img.tag || 'other') === category);
    if (firstIndex >= 0) setCurrentIndex(firstIndex);
  }, [allImages]);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

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

  // Prevent scroll when lightbox open
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
      <div className="space-y-4">
        <div className="aspect-[4/3] bg-[var(--color-bg-gray)] rounded-xl flex items-center justify-center">
          <div className="text-center text-[var(--color-text-light)]">
            <svg className="w-16 h-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Фото пока нет</span>
          </div>
        </div>
      </div>
    );
  }

  const currentImage = allImages[currentIndex];

  return (
    <>
      <div className="space-y-4">
        {/* Category Tabs */}
        {availableCategories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableCategories.map(category => (
              <button
                key={category}
                onClick={() => goToCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === category
                    ? 'bg-[var(--gray-900)] text-white'
                    : 'bg-[var(--color-bg-gray)] text-[var(--color-text)] hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABELS[category]}
                <span className="ml-1.5 opacity-70">
                  {groupedImages[category]?.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Main Image Container */}
        <div className="relative aspect-[4/3] bg-white rounded-xl overflow-hidden border border-[var(--color-border)]">
          {/* Image */}
          <img
            src={currentImage?.url}
            alt={`${CATEGORY_LABELS[activeCategory]} - ${complexName}`}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => openLightbox(currentIndex)}
          />

          {/* Navigation Arrows - Always Visible */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                aria-label="Предыдущее фото"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                aria-label="Следующее фото"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Dots Indicator - Contrasting */}
          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-2">
              {allImages.slice(0, 7).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`rounded-full transition-all ${
                    idx === currentIndex
                      ? 'w-6 h-2.5 bg-white'
                      : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Фото ${idx + 1}`}
                />
              ))}
              {allImages.length > 7 && (
                <span className="text-white text-xs font-medium ml-1">
                  +{allImages.length - 7}
                </span>
              )}
            </div>
          )}

          {/* Zoom Hint */}
          <div className="absolute top-3 right-3">
            <div className="bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              {currentIndex + 1}/{allImages.length}
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allImages.map((img, idx) => (
              <button
                key={img.url}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? 'border-[var(--gray-900)] ring-1 ring-[var(--gray-900)]'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
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

          {/* Category Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/20 text-white px-3 py-1 rounded-full text-sm">
            {CATEGORY_LABELS[allImages[currentIndex]?.tag || 'other']}
          </div>

          {/* Navigation */}
          {allImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[currentIndex]?.url}
              alt={`${CATEGORY_LABELS[allImages[currentIndex]?.tag || 'other']} - ${complexName}`}
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>

          {/* Thumbnail Strip */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-4 py-2">
            {allImages.map((img, idx) => (
              <button
                key={img.url}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden transition-all ${
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
