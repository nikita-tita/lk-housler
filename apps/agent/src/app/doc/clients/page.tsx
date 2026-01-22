import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Документы для клиентов — Housler',
  description: 'Политики, согласия и пользовательское соглашение для клиентов Housler',
};

const documents = [
  {
    category: 'Политики',
    items: [
      {
        title: 'Политика конфиденциальности',
        href: '/doc/clients/politiki/privacy',
        description: 'Как мы обрабатываем ваши персональные данные',
      },
    ],
  },
  {
    category: 'Согласия',
    items: [
      {
        title: 'Согласие на обработку персональных данных',
        href: '/doc/clients/soglasiya/personal-data',
        description: 'Согласие на сбор и обработку ПД',
      },
      {
        title: 'Согласие на использование cookie',
        href: '/doc/clients/soglasiya/cookie',
        description: 'Использование cookie-файлов и веб-аналитики',
      },
      {
        title: 'Пользовательское соглашение',
        href: '/doc/clients/soglasiya/terms',
        description: 'Условия использования сервиса',
      },
    ],
  },
];

export default function ClientDocumentsPage() {
  return (
    <div className="container py-12">
      <nav className="text-sm text-[var(--color-text-light)] mb-6">
        <Link href="/doc" className="hover:text-[var(--color-accent)]">Документы</Link>
        <span className="mx-2">/</span>
        <span>Для клиентов</span>
      </nav>

      <h1 className="text-3xl font-semibold mb-8">Документы для клиентов</h1>

      {documents.map((section) => (
        <div key={section.category} className="mb-10">
          <h2 className="text-lg font-medium mb-4 text-[var(--color-text-light)]">
            {section.category}
          </h2>
          <div className="space-y-3">
            {section.items.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="block p-4 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors"
              >
                <h3 className="font-medium mb-1">{doc.title}</h3>
                <p className="text-sm text-[var(--color-text-light)]">{doc.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
