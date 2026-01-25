'use client';

import { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/contexts/ToastContext';
import type { OfferDetail } from '@/types';
import { formatPrice, formatArea, formatRooms, formatFloor } from '@/services/api';
import { isValidDeveloperName } from '@/utils/developer';

interface OfferPdfButtonProps {
  offer: OfferDetail;
  className?: string;
  variant?: 'default' | 'compact';
}

export function OfferPdfButton({ offer, className = '', variant = 'default' }: OfferPdfButtonProps) {
  const { showToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Группируем изображения по типу
  const planImage = offer.images?.find(img => img.tag === 'plan')?.url || null;
  const floorplanImage = offer.images?.find(img => img.tag === 'floorplan')?.url || null;
  const mainImage = offer.images?.find(img => img.tag === 'housemain')?.url || offer.images?.[0]?.url || null;
  const complexScheme = offer.images?.find(img => img.tag === 'complexscheme')?.url || null;

  // URL для статической карты Yandex
  const mapImageUrl = offer.latitude && offer.longitude
    ? `https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=${offer.longitude},${offer.latitude}&z=15&l=map&size=650,200&pt=${offer.longitude},${offer.latitude},pm2rdm`
    : null;

  const showDeveloper = isValidDeveloperName(offer.developer_name);

  const generatePdf = async () => {
    if (!contentRef.current) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      let page = 0;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        page++;
        position = margin - (pdfHeight - margin * 2) * page;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      const fileName = `${offer.complex_name?.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_') || 'offer'}_${offer.id}.pdf`;
      pdf.save(fileName);
    } catch {
      showToast('Не удалось сгенерировать PDF', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Скрытый контент для рендеринга в PDF */}
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '800px',
          padding: '28px',
          backgroundColor: '#fff',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#9CA3AF', fontSize: '12px' }}>
          <span>agent.housler.ru</span>
          <span>{new Date().toLocaleDateString('ru-RU')}</span>
        </div>

        {/* Title + Price row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 4px 0', color: '#181A20' }}>
              {formatRooms(offer.rooms, offer.is_studio)}, {formatArea(offer.area_total)}
            </h1>
            <p style={{ fontSize: '15px', color: '#6B7280', margin: 0 }}>
              {offer.complex_name} • {formatFloor(offer.floor, offer.floors_total)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#181A20' }}>{formatPrice(offer.price)}</div>
            <div style={{ fontSize: '13px', color: '#6B7280' }}>{formatPrice(offer.price_per_sqm)}/м²</div>
          </div>
        </div>

        {/* Main layout: Photo left, Info right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
          {/* Left column: Photo + Description */}
          <div>
            {mainImage && (
              <img
                src={mainImage}
                alt="Фото"
                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }}
                crossOrigin="anonymous"
              />
            )}
            {offer.description && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#181A20', marginBottom: '6px' }}>Описание</div>
                <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#4B5563' }}>
                  {offer.description.length > 400 ? offer.description.slice(0, 400) + '...' : offer.description}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Characteristics + Complex */}
          <div>
            {/* Характеристики */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#181A20', marginBottom: '8px' }}>Характеристики</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Площадь</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{formatArea(offer.area_total)}</div>
              </div>
              {offer.area_kitchen && (
                <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>Кухня</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{formatArea(offer.area_kitchen)}</div>
                </div>
              )}
              <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Этаж</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{formatFloor(offer.floor, offer.floors_total)}</div>
              </div>
              {offer.ceiling_height && (
                <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>Потолки</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{offer.ceiling_height} м</div>
                </div>
              )}
              {offer.balcony && (
                <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#6B7280' }}>Балкон</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{offer.balcony}</div>
                </div>
              )}
              <div style={{ padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: '#6B7280' }}>Отделка</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#181A20' }}>{offer.has_finishing ? 'С отделкой' : 'Без отделки'}</div>
              </div>
            </div>

            {/* ЖК */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#181A20', marginBottom: '8px' }}>Жилой комплекс</div>
            <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#374151' }}>
              <div><span style={{ color: '#6B7280' }}>Название:</span> {offer.complex_name}</div>
              {showDeveloper && <div><span style={{ color: '#6B7280' }}>Застройщик:</span> {offer.developer_name}</div>}
              <div><span style={{ color: '#6B7280' }}>Адрес:</span> {offer.complex_address}</div>
              <div><span style={{ color: '#6B7280' }}>Район:</span> {offer.district_name}</div>
              {offer.metro_station && (
                <div><span style={{ color: '#6B7280' }}>Метро:</span> {offer.metro_station}{offer.metro_distance ? ` (${offer.metro_distance} мин)` : ''}</div>
              )}
              {offer.completion_date && (
                <div><span style={{ color: '#6B7280' }}>Сдача:</span> {offer.completion_date}</div>
              )}
            </div>
          </div>
        </div>

        {/* Планировки в ряд */}
        {(planImage || floorplanImage) && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#181A20', marginBottom: '8px' }}>Планировка</div>
            <div style={{ display: 'grid', gridTemplateColumns: planImage && floorplanImage ? '1fr 1fr' : '1fr', gap: '12px' }}>
              {planImage && (
                <div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Планировка квартиры</div>
                  <img
                    src={planImage}
                    alt="Планировка"
                    style={{ width: '100%', height: '160px', objectFit: 'contain', borderRadius: '6px', backgroundColor: '#F9FAFB' }}
                    crossOrigin="anonymous"
                  />
                </div>
              )}
              {floorplanImage && (
                <div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>План этажа</div>
                  <img
                    src={floorplanImage}
                    alt="План этажа"
                    style={{ width: '100%', height: '160px', objectFit: 'contain', borderRadius: '6px', backgroundColor: '#F9FAFB' }}
                    crossOrigin="anonymous"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Генплан если есть */}
        {complexScheme && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Генплан комплекса</div>
            <img
              src={complexScheme}
              alt="Генплан"
              style={{ width: '100%', height: '140px', objectFit: 'contain', borderRadius: '6px', backgroundColor: '#F9FAFB' }}
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* Карта внизу */}
        {mapImageUrl && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#181A20', marginBottom: '8px' }}>Расположение</div>
            <img
              src={mapImageUrl}
              alt="Карта"
              style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '6px' }}
              crossOrigin="anonymous"
            />
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{offer.complex_address}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px', color: '#9CA3AF', fontSize: '10px', textAlign: 'center' }}>
          ID: {offer.id} • agent.housler.ru
        </div>
      </div>

      {/* Кнопка */}
      <button
        onClick={generatePdf}
        disabled={isGenerating}
        className={variant === 'compact'
          ? `w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-bg-gray)] hover:bg-gray-200 transition-colors ${className}`
          : `btn btn-secondary inline-flex items-center gap-2 ${className}`
        }
        aria-label={isGenerating ? 'Генерация PDF...' : 'Скачать PDF'}
        title="Скачать PDF"
      >
        {isGenerating ? (
          <svg className={variant === 'compact' ? 'w-5 h-5 animate-spin' : 'w-5 h-5 animate-spin'} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className={variant === 'compact' ? 'w-5 h-5 text-[var(--color-text-light)]' : 'w-5 h-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {variant !== 'compact' && (isGenerating ? 'Генерация...' : 'Скачать PDF')}
      </button>
    </>
  );
}
