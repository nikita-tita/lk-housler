import Link from 'next/link';

const publicPages = [
  { href: '/legal/privacy', label: 'Политика ПД' },
  { href: '/legal/terms', label: 'Пользовательское соглашение' },
  { href: '/legal/security', label: 'Сведения о защите ПД' },
  { href: '/legal/cookies', label: 'Политика cookie' },
  { href: '/legal/support', label: 'Обращения и претензии' },
  { href: '/legal/requisites', label: 'Контакты и реквизиты' },
  { href: '/legal/ip', label: 'Интеллектуальная собственность' },
];

const b2bPages = [
  { href: '/legal/b2b', label: 'Все B2B документы' },
  { href: '/legal/b2b/offer', label: 'Публичная оферта' },
  { href: '/legal/b2b/assignment', label: 'Поручение на удержание' },
  { href: '/legal/b2b/kyc', label: 'Регламент KYC' },
  { href: '/legal/b2b/dpa', label: 'DPA (для агентств)' },
  { href: '/legal/b2b/retention', label: 'Политика хранения' },
  { href: '/legal/b2b/audit-trail', label: 'Соглашение об ЭДО' },
];

const dealPages = [
  { href: '/legal/deal', label: 'Все документы по сделкам' },
  { href: '/legal/deal/safe-settlement', label: 'Правила расчетов' },
  { href: '/legal/deal/dispute-rules', label: 'Регламент претензий' },
  { href: '/legal/deal/pep', label: 'Согласие на ПЭП' },
  { href: '/legal/deal/notices', label: 'Согласие на уведомления' },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 border-b border-[var(--color-border)]">
        <div className="container">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              HOUSLER
            </Link>
            <Link
              href="/"
              className="text-[15px] font-medium hover:text-[var(--color-text-light)] transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 py-12">
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Sidebar navigation */}
            <aside className="lg:w-64 flex-shrink-0">
              <nav className="sticky top-8">
                {/* Public documents */}
                <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-4">
                  Публичные документы
                </div>
                <ul className="space-y-2 mb-8">
                  {publicPages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block text-[15px] py-1.5 hover:text-[var(--color-text-light)] transition-colors"
                      >
                        {page.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* B2B documents */}
                <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-4">
                  Для исполнителей / B2B
                </div>
                <ul className="space-y-2 mb-8">
                  {b2bPages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block text-[15px] py-1.5 hover:text-[var(--color-text-light)] transition-colors"
                      >
                        {page.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* Deal documents */}
                <div className="text-xs font-semibold text-[var(--color-text-light)] uppercase tracking-wider mb-4">
                  По сделкам
                </div>
                <ul className="space-y-2">
                  {dealPages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block text-[15px] py-1.5 hover:text-[var(--color-text-light)] transition-colors"
                      >
                        {page.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Content */}
            <article className="flex-1 min-w-0 prose prose-neutral max-w-none">
              {children}
            </article>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-[var(--color-border)]">
        <div className="container">
          <p className="text-[13px] text-[var(--color-text-light)] text-center">
            {new Date().getFullYear()} Housler - Все права защищены
          </p>
        </div>
      </footer>
    </div>
  );
}
