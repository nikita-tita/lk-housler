'use client';

import { useState } from 'react';
import type { ComplexDetail } from '@/types';

interface ComplexHeroProps {
  complex: ComplexDetail;
}

export function ComplexHero({ complex }: ComplexHeroProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // Use images array if available, otherwise create from main_image
  const images = complex.images?.length
    ? complex.images
    : complex.main_image
      ? [complex.main_image]
      : [];

  const hasImages = images.length > 0;

  return (
    <>
      {/* Hero Section */}
      <div className="relative">
        {/* Main Image */}
        <div className="aspect-[21/9] bg-[var(--color-bg-gray)] rounded-xl overflow-hidden">
          {hasImages ? (
            <img
              src={images[activeImage]}
              alt={complex.name}
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
              onClick={() => setShowLightbox(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-light)]">
              <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="absolute top-4 left-4">
          <span
            className={`
              px-3 py-1.5 rounded-full text-sm font-medium
              ${complex.building_state === 'hand-over'
                ? 'bg-[var(--gray-900)] text-white'
                : 'bg-white text-[var(--color-text)] border border-[var(--color-border)]'
              }
            `}
          >
            {complex.building_state === 'hand-over' ? 'Сдан' : 'Строится'}
          </span>
        </div>

        {/* Gallery Thumbnails */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 justify-center">
            {images.slice(0, 5).map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`
                  w-16 h-12 rounded-lg overflow-hidden border-2 transition-all
                  ${idx === activeImage
                    ? 'border-white shadow-lg scale-105'
                    : 'border-white/50 opacity-75 hover:opacity-100'
                  }
                `}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            {images.length > 5 && (
              <button
                onClick={() => setShowLightbox(true)}
                className="w-16 h-12 rounded-lg bg-black/50 text-white flex items-center justify-center text-sm font-medium hover:bg-black/70 transition-colors"
              >
                +{images.length - 5}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Title & Location */}
      <div className="mt-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
          {complex.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--color-text-light)]">
          {complex.district && (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {complex.district}
            </span>
          )}
          {complex.address && (
            <span>{complex.address}</span>
          )}
          {complex.metro_station && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--gray-900)]" />
              {complex.metro_station}
              {complex.metro_distance && (
                <span className="text-sm">• {complex.metro_distance} мин</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && hasImages && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage(prev => (prev - 1 + images.length) % images.length)}
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setActiveImage(prev => (prev + 1) % images.length)}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Main Image */}
          <img
            src={images[activeImage]}
            alt={`${complex.name} - ${activeImage + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain"
          />

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {activeImage + 1} / {images.length}
          </div>

          {/* Thumbnails */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((img: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`
                  w-12 h-12 rounded overflow-hidden border-2 transition-all
                  ${idx === activeImage ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'}
                `}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
