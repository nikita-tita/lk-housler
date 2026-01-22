'use client';

import { useState } from 'react';

interface ParsedDescription {
  summary: string | null;        // Первая строка с краткой информацией
  about: string | null;          // О комплексе
  infrastructure: string | null; // Инфраструктура
  apartments: string | null;     // Планировки квартир
  parking: string | null;        // Паркинг
  territory: string | null;      // Благоустройство территории
  transport: string | null;      // Транспорт
  education: string | null;      // Образование
  medicine: string | null;       // Медицина
  ecology: string | null;        // Экология
  sport: string | null;          // Спорт
  culture: string | null;        // Культура и досуг
  other: string[];               // Остальные параграфы
}

// Ключевые слова для определения категорий
const CATEGORY_PATTERNS: { key: keyof Omit<ParsedDescription, 'summary' | 'other'>; patterns: RegExp[] }[] = [
  {
    key: 'transport',
    patterns: [
      /транспорт/i,
      /метро/i,
      /остановк/i,
      /доехать/i,
      /автобус/i,
      /трамва/i,
      /троллейбус/i,
      /маршрут/i,
      /КАД|ЗСД/i,
      /аэропорт/i,
    ]
  },
  {
    key: 'parking',
    patterns: [
      /парк(инг|овк)/i,
      /машиномест/i,
      /гараж/i,
      /автостоянк/i,
      /подземн.*парк/i,
    ]
  },
  {
    key: 'education',
    patterns: [
      /школ[аы]/i,
      /гимназ/i,
      /лицей/i,
      /детск.*сад/i,
      /образован/i,
      /универс/i,
      /колледж/i,
    ]
  },
  {
    key: 'medicine',
    patterns: [
      /поликлиник/i,
      /больниц/i,
      /медицин/i,
      /аптек/i,
      /врач/i,
      /здоровь/i,
      /клиник/i,
    ]
  },
  {
    key: 'ecology',
    patterns: [
      /эколог/i,
      /парк[аи\s]/i,
      /зелен/i,
      /сквер/i,
      /сад[у|а|ы|\s]/i,
      /природ/i,
      /залив/i,
      /лес/i,
    ]
  },
  {
    key: 'sport',
    patterns: [
      /спорт/i,
      /фитнес/i,
      /бассейн/i,
      /тренаж/i,
      /стадион/i,
      /футбол/i,
      /площадк.*спорт/i,
    ]
  },
  {
    key: 'culture',
    patterns: [
      /театр/i,
      /музей/i,
      /кинотеатр/i,
      /библиотек/i,
      /культур/i,
      /досуг/i,
      /выставк/i,
      /клуб/i,
    ]
  },
  {
    key: 'territory',
    patterns: [
      /благоустр/i,
      /двор[аы\s]/i,
      /детск.*площадк/i,
      /озелен/i,
      /газон/i,
      /ландшафт/i,
      /прогулоч/i,
    ]
  },
  {
    key: 'apartments',
    patterns: [
      /квартир[аы]/i,
      /планиров/i,
      /студи[яи]/i,
      /комнатн/i,
      /апартамент/i,
      /отделк/i,
      /потолк/i,
    ]
  },
  {
    key: 'infrastructure',
    patterns: [
      /инфраструктур/i,
      /магазин/i,
      /супермаркет/i,
      /торгов/i,
      /ресторан/i,
      /кафе/i,
      /первы.*этаж.*коммерч/i,
    ]
  },
  {
    key: 'about',
    patterns: [
      /комплекс.*распол/i,
      /возвод/i,
      /строит/i,
      /фасад/i,
      /архитект/i,
      /корпус/i,
      /этаж.*здан/i,
      /монолит/i,
      /кирпич/i,
    ]
  },
];

function parseDescription(description: string): ParsedDescription {
  const result: ParsedDescription = {
    summary: null,
    about: null,
    infrastructure: null,
    apartments: null,
    parking: null,
    territory: null,
    transport: null,
    education: null,
    medicine: null,
    ecology: null,
    sport: null,
    culture: null,
    other: [],
  };

  // Разбиваем на параграфы
  const paragraphs = description
    .split(/\r?\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) return result;

  // Первый параграф - summary (если содержит характеристики квартиры)
  const firstParagraph = paragraphs[0];
  if (/кв\.м\.|этаж|комплекс|застройщик/i.test(firstParagraph)) {
    result.summary = firstParagraph;
    paragraphs.shift();
  }

  // Категоризируем остальные параграфы
  const usedCategories = new Set<string>();

  for (const paragraph of paragraphs) {
    let assigned = false;

    for (const { key, patterns } of CATEGORY_PATTERNS) {
      // Пропускаем если категория уже заполнена
      if (usedCategories.has(key)) continue;

      // Считаем сколько паттернов совпало
      const matchCount = patterns.filter(p => p.test(paragraph)).length;

      // Если совпало 2+ паттерна или 1 паттерн и текст короткий - присваиваем категорию
      if (matchCount >= 2 || (matchCount === 1 && paragraph.length < 300)) {
        result[key] = paragraph;
        usedCategories.add(key);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      result.other.push(paragraph);
    }
  }

  return result;
}

// Иконки для каждой категории
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  about: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  apartments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  infrastructure: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  parking: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h8m-8 4h4m-4 4h8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  ),
  territory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  transport: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  education: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5v-2l9 5 9-5v2l-9 5z" />
    </svg>
  ),
  medicine: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  ecology: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  sport: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  culture: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  ),
};

const CATEGORY_LABELS: Record<string, string> = {
  about: 'О комплексе',
  apartments: 'Планировки',
  infrastructure: 'Инфраструктура',
  parking: 'Паркинг',
  territory: 'Благоустройство',
  transport: 'Транспорт',
  education: 'Образование',
  medicine: 'Медицина',
  ecology: 'Экология',
  sport: 'Спорт',
  culture: 'Досуг',
};

interface DescriptionBlockProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  defaultExpanded?: boolean;
}

function DescriptionBlock({ icon, title, content, defaultExpanded = false }: DescriptionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isLong = content.length > 200;

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-bg-gray)] transition-colors"
      >
        <span className="text-[var(--color-text-light)]">{icon}</span>
        <span className="font-medium flex-1">{title}</span>
        <svg
          className={`w-5 h-5 text-[var(--color-text-light)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-sm text-[var(--color-text-light)] leading-relaxed">
            {content}
          </p>
        </div>
      )}

      {!isExpanded && isLong && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-sm text-[var(--color-text-light)] leading-relaxed line-clamp-2">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

interface OfferDescriptionProps {
  description: string | null;
}

export function OfferDescription({ description }: OfferDescriptionProps) {
  if (!description) return null;

  const parsed = parseDescription(description);

  // Категории для отображения в сетке
  const categories: { key: string; content: string | null }[] = [
    { key: 'about', content: parsed.about },
    { key: 'apartments', content: parsed.apartments },
    { key: 'infrastructure', content: parsed.infrastructure },
    { key: 'parking', content: parsed.parking },
    { key: 'territory', content: parsed.territory },
    { key: 'transport', content: parsed.transport },
    { key: 'education', content: parsed.education },
    { key: 'medicine', content: parsed.medicine },
    { key: 'ecology', content: parsed.ecology },
    { key: 'sport', content: parsed.sport },
    { key: 'culture', content: parsed.culture },
  ];

  const filledCategories = categories.filter(c => c.content);

  // Если ничего не распарсилось, показываем как есть
  if (filledCategories.length === 0 && parsed.other.length === 0) {
    return (
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Описание</h2>
        <div className="prose max-w-none text-[var(--color-text-light)]">
          {description}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold mb-6">О комплексе и районе</h2>

      {/* Summary - если есть */}
      {parsed.summary && (
        <div className="mb-6 p-4 bg-[var(--color-bg-gray)] rounded-lg">
          <p className="text-sm text-[var(--color-text-light)]">{parsed.summary}</p>
        </div>
      )}

      {/* Сетка категорий */}
      {filledCategories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {filledCategories.map(({ key, content }) => (
            <DescriptionBlock
              key={key}
              icon={CATEGORY_ICONS[key]}
              title={CATEGORY_LABELS[key]}
              content={content!}
              defaultExpanded={key === 'about'}
            />
          ))}
        </div>
      )}

      {/* Остальные параграфы */}
      {parsed.other.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Дополнительно</h3>
          {parsed.other.map((text, idx) => (
            <p key={idx} className="text-sm text-[var(--color-text-light)] leading-relaxed">
              {text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
