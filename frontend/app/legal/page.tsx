import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Юридические документы | LK Housler',
  description: 'Юридические документы и политики сервиса LK Housler',
};

const documents = [
  {
    href: '/legal/privacy',
    title: 'Политика обработки персональных данных',
    description: 'Порядок обработки и защиты персональных данных пользователей',
  },
  {
    href: '/legal/terms',
    title: 'Пользовательское соглашение',
    description: 'Условия использования сервиса LK Housler',
  },
  {
    href: '/legal/security',
    title: 'Сведения о реализуемых требованиях к защите ПД',
    description: 'Организационные и технические меры защиты персональных данных',
  },
  {
    href: '/legal/cookies',
    title: 'Политика использования cookie',
    description: 'Информация об использовании cookie и аналогичных технологий',
  },
  {
    href: '/legal/support',
    title: 'Политика рассмотрения обращений и претензий',
    description: 'Каналы связи, сроки рассмотрения, порядок подачи претензий',
  },
  {
    href: '/legal/requisites',
    title: 'Контакты и реквизиты',
    description: 'Реквизиты компании и контактная информация',
  },
  {
    href: '/legal/ip',
    title: 'Политика по интеллектуальной собственности',
    description: 'Права на контент и интеллектуальную собственность',
  },
  {
    href: '/legal/consent',
    title: 'Согласие на обработку персональных данных',
    description: 'Текст согласия для форм и регистрации',
  },
];

export default function LegalIndexPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Юридические документы</h1>
      <p className="text-[var(--color-text-light)] mb-8">
        Правовая информация и политики сервиса LK Housler
      </p>

      <div className="grid gap-4">
        {documents.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="block p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <h2 className="text-lg font-medium mb-1">{doc.title}</h2>
            <p className="text-sm text-[var(--color-text-light)] mb-0">{doc.description}</p>
          </Link>
        ))}
      </div>

      {/* B2B Section */}
      <div className="mt-12 pt-8 border-t border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-2">Для исполнителей и агентств (B2B)</h2>
        <p className="text-[var(--color-text-light)] mb-6">
          Документы для онбординга самозанятых, ИП и агентств
        </p>
        <Link
          href="/legal/b2b"
          className="block p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">B2B документы</h3>
              <p className="text-sm text-[var(--color-text-light)] mb-0">
                Оферта, поручение на удержание, KYC, DPA, правила ЭДО
              </p>
            </div>
            <span className="badge">6 документов</span>
          </div>
        </Link>
      </div>

      {/* Deal Documents Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Документы по сделкам</h2>
        <p className="text-[var(--color-text-light)] mb-6">
          Правила расчетов, претензии, электронная подпись
        </p>
        <Link
          href="/legal/deal"
          className="block p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">Правила и согласия</h3>
              <p className="text-sm text-[var(--color-text-light)] mb-0">
                Безопасные расчеты, регламент претензий, ПЭП, уведомления
              </p>
            </div>
            <span className="badge">4 документа</span>
          </div>
        </Link>
      </div>

      {/* Company Info */}
      <div className="mt-12 pt-8 border-t border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-4">Оператор сервиса</h2>
        <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
          <p className="mb-2"><strong>ООО «СЕКТОР ИТ»</strong></p>
          <p className="text-sm text-[var(--color-text-light)] mb-0">
            ИНН: 5190237491 | ОГРН: 1255100001496<br />
            183038, Мурманская обл., г. Мурманск, ул. Олега Кошевого, д. 6, к. 1, помещ. 1<br />
            Email: support@housler.ru | Телефон: +7 (995) 590-55-20
          </p>
        </div>
      </div>
    </div>
  );
}
