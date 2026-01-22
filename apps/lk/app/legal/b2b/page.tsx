import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'B2B документы для исполнителей и агентств | LK Housler',
  description: 'Юридические документы для исполнителей и агентств: оферта, KYC, DPA, правила ЭДО',
};

const b2bDocuments = [
  {
    href: '/legal/b2b/offer',
    title: 'Публичная оферта (B2B)',
    description: 'Договор оказания информационно-технологических услуг для исполнителей и агентств',
    badge: 'Основной',
  },
  {
    href: '/legal/b2b/assignment',
    title: 'Поручение на удержание вознаграждения',
    description: 'Согласие на удержание и перечисление вознаграждения Платформы',
    badge: 'Обязательный',
  },
  {
    href: '/legal/b2b/kyc',
    title: 'Регламент KYC/допуска',
    description: 'Требования к исполнителям, проверки, блокировки',
    badge: null,
  },
  {
    href: '/legal/b2b/dpa',
    title: 'DPA (поручение на обработку ПД)',
    description: 'Для агентств: обработка персональных данных клиентов',
    badge: 'Для агентств',
  },
  {
    href: '/legal/b2b/retention',
    title: 'Политика хранения данных',
    description: 'Сроки хранения документов, логов и данных по сделкам',
    badge: null,
  },
  {
    href: '/legal/b2b/audit-trail',
    title: 'Соглашение об ЭДО и audit trail',
    description: 'Правила электронного документооборота и юридически значимых логов',
    badge: null,
  },
];

export default function B2BIndexPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">B2B документы</h1>
      <p className="text-[var(--color-text-light)] mb-8">
        Документы для исполнителей (самозанятых, ИП) и агентств (ООО)
      </p>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-4 mb-8">
        <p className="text-sm mb-0">
          <strong>Онбординг исполнителя/агентства:</strong> при подключении к платежному функционалу необходимо принять B2B оферту и поручение на удержание вознаграждения. Для агентств дополнительно — DPA.
        </p>
      </div>

      <div className="grid gap-4">
        {b2bDocuments.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="block p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium mb-1">{doc.title}</h2>
                <p className="text-sm text-[var(--color-text-light)] mb-0">{doc.description}</p>
              </div>
              {doc.badge && (
                <span className="badge flex-shrink-0">{doc.badge}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 pt-8 border-t border-[var(--color-border)]">
        <Link href="/legal" className="text-sm hover:text-[var(--color-text-light)]">
          Все юридические документы
        </Link>
      </div>
    </div>
  );
}
