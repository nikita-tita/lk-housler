import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Документы — Housler',
  description: 'Юридические документы, политики и согласия сервиса Housler',
};

const documentSections = [
  {
    title: 'Для клиентов',
    href: '/doc/clients',
    description: 'Политика конфиденциальности, согласия, пользовательское соглашение',
  },
  {
    title: 'Для частных риелторов',
    href: '/doc/realtors',
    description: 'Оферта, условия работы, согласия для самозанятых',
  },
  {
    title: 'Для агентств недвижимости',
    href: '/doc/agents',
    description: 'Договор-оферта, условия партнёрства',
  },
];

export default function DocumentsPage() {
  return (
    <div className="container py-12">
      <h1 className="text-3xl font-semibold mb-2">Документы</h1>
      <p className="text-[var(--color-text-light)] mb-8">
        Юридические документы ООО &laquo;Сектор ИТ&raquo;
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {documentSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block p-6 border border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent)] transition-colors"
          >
            <h2 className="text-lg font-medium mb-2">{section.title}</h2>
            <p className="text-sm text-[var(--color-text-light)]">{section.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-6 bg-[var(--color-bg-secondary)] rounded-xl">
        <h3 className="font-medium mb-3">Реквизиты</h3>
        <div className="text-sm text-[var(--color-text-light)] space-y-1">
          <p><strong>ООО &laquo;Сектор ИТ&raquo;</strong></p>
          <p>ИНН: 5190237491 / КПП: 519001001</p>
          <p>ОГРН: 1255100001496</p>
          <p>Адрес: 183008, Мурманская область, г. Мурманск, ул. Олега Кошевого, д. 6 к. 1, помещ. 1</p>
          <p>Email: <a href="mailto:hello@housler.ru" className="text-[var(--color-accent)]">hello@housler.ru</a></p>
        </div>
      </div>
    </div>
  );
}
