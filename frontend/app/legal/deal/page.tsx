import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Документы по сделкам | LK Housler',
  description: 'Правила безопасных расчетов, претензии, электронная подпись',
};

const documents = [
  {
    href: '/legal/deal/safe-settlement',
    title: 'Правила безопасных расчетов',
    description: 'Удержание средств банковским посредником, релиз, возвраты',
  },
  {
    href: '/legal/deal/dispute-rules',
    title: 'Регламент рассмотрения претензий',
    description: 'Порядок и сроки рассмотрения претензий по сделке',
  },
  {
    href: '/legal/deal/pep',
    title: 'Согласие на использование ПЭП',
    description: 'Простая электронная подпись и правила электронного взаимодействия',
  },
  {
    href: '/legal/deal/notices',
    title: 'Согласие на уведомления',
    description: 'Получение юридически значимых уведомлений (SMS/email)',
  },
];

export default function DealDocsIndexPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Документы по сделкам</h1>
      <p className="text-[var(--color-text-light)] mb-8">
        Правила и согласия, применяемые к сделкам в LK Housler
      </p>

      <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg mb-8">
        <p className="text-sm mb-0">
          <strong>Важно:</strong> Платформа не является стороной договора «Исполнитель — Клиент»
          и не оказывает риелторские услуги. Платформа предоставляет ИТ-функциональность
          (документы, статусы, подтверждения) и инициирует расчеты через независимого
          банковского посредника.
        </p>
      </div>

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

      <div className="mt-12 pt-8 border-t border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-4">Оператор платформы</h2>
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
