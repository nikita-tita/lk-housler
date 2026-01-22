'use client';

import Link from 'next/link';

interface ConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  type: 'personal_data' | 'terms' | 'marketing' | 'realtor_offer' | 'agency_offer';
  required?: boolean;
  error?: boolean;
}

const consentConfig = {
  personal_data: {
    label: 'Даю согласие на обработку персональных данных',
    link: '/doc/clients/soglasiya/personal-data',
    linkText: 'Согласие на обработку ПД',
  },
  terms: {
    label: 'Принимаю условия',
    link: '/doc/clients/soglasiya/terms',
    linkText: 'Пользовательского соглашения',
  },
  marketing: {
    label: 'Согласен получать рекламные и информационные материалы',
    link: null,
    linkText: null,
  },
  realtor_offer: {
    label: 'Принимаю условия',
    link: '/doc/realtors/oferti/main',
    linkText: 'Договора-оферты для риелторов',
  },
  agency_offer: {
    label: 'Принимаю условия',
    link: '/doc/agents/oferti/main',
    linkText: 'Договора-оферты для агентств',
  },
};

export function ConsentCheckbox({
  id,
  checked,
  onChange,
  type,
  required = false,
  error = false,
}: ConsentCheckboxProps) {
  const config = consentConfig[type];

  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-1 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] ${
          error ? 'border-[var(--gray-900)]' : ''
        }`}
      />
      <label htmlFor={id} className={`text-sm ${error ? 'text-[var(--color-text)] font-medium' : 'text-[var(--color-text)]'}`}>
        {config.label}
        {config.link && (
          <>
            {' '}
            <Link
              href={config.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--color-accent)] hover:underline"
            >
              {config.linkText}
            </Link>
          </>
        )}
        {required && <span className="text-[var(--color-text)] ml-1">*</span>}
      </label>
    </div>
  );
}
