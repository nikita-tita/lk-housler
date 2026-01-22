'use client';

import { useGuest } from '@/contexts/GuestContext';

export function FooterGuest() {
  const { context } = useGuest();

  const agencyName = context?.agency?.name || 'Агентство недвижимости';
  const agentName = context?.agent?.name;
  const agentPhone = context?.agent?.phone;
  const agentEmail = context?.agent?.email;
  const agencyPhone = context?.agency?.phone;
  const agencyEmail = context?.agency?.email;

  const phone = agentPhone || agencyPhone;
  const email = agentEmail || agencyEmail;

  return (
    <footer className="py-12 border-t border-[var(--color-border)] bg-[var(--color-bg-gray)]">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-6">
          <div>
            <div className="text-lg font-semibold tracking-tight mb-1">{agencyName}</div>
            {agentName && (
              <div className="text-sm text-[var(--color-text-light)]">
                Ваш персональный агент: {agentName}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-8">
            {phone && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-2">
                  Телефон
                </div>
                <a
                  href={`tel:${phone}`}
                  className="text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {phone}
                </a>
              </div>
            )}

            {email && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-2">
                  Email
                </div>
                <a
                  href={`mailto:${email}`}
                  className="text-sm font-medium hover:text-[var(--color-accent)]"
                >
                  {email}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-light)]">
            Подборка подготовлена специально для вас. По всем вопросам обращайтесь к вашему агенту.
          </p>
        </div>
      </div>
    </footer>
  );
}
