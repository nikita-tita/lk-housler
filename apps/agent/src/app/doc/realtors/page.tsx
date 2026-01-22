import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Документы для риелторов — Housler',
  description: 'Оферта и условия работы для частных риелторов на платформе Housler',
};

const documents = [
  {
    category: 'Оферты',
    items: [
      {
        title: 'Договор-оферта для частных риелторов',
        href: '/doc/realtors/oferti/main',
        description: 'Условия работы для самозанятых и частных агентов',
      },
    ],
  },
  {
    category: 'Согласия',
    items: [
      {
        title: 'Согласие на обработку персональных данных',
        href: '/doc/clients/soglasiya/personal-data',
        description: 'Общее согласие на обработку ПД',
      },
    ],
  },
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
];

export default function RealtorDocumentsPage() {
  return (
    <div className="container py-12">
      <nav className="text-sm text-[var(--color-text-light)] mb-6">
        <Link href="/doc" className="hover:text-[var(--color-accent)]">Документы</Link>
        <span className="mx-2">/</span>
        <span>Для частных риелторов</span>
      </nav>

      <h1 className="text-3xl font-semibold mb-8">Документы для частных риелторов</h1>

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
