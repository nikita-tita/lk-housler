import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Согласие на использование cookie — Housler',
  description: 'Согласие на использование cookie-файлов и сервисов веб-аналитики',
};

export default function CookieConsentPage() {
  return (
    <div className="container py-12 max-w-4xl">
      <nav className="text-sm text-[var(--color-text-light)] mb-6">
        <Link href="/doc" className="hover:text-[var(--color-accent)]">Документы</Link>
        <span className="mx-2">/</span>
        <Link href="/doc/clients" className="hover:text-[var(--color-accent)]">Для клиентов</Link>
        <span className="mx-2">/</span>
        <span>Согласие на cookie</span>
      </nav>

      <article className="prose prose-neutral max-w-none">
        <h1>Согласие на использование cookie-файлов</h1>
        <p className="text-[var(--color-text-light)]">
          Редакция от 01.12.2024 | Версия 1.0
        </p>

        <h2>1. Что такое cookie-файлы</h2>
        <p>
          Cookie-файлы — это небольшие текстовые файлы, которые сохраняются на вашем устройстве
          при посещении веб-сайтов. Они позволяют сайту запоминать ваши действия и предпочтения
          (логин, язык, размер шрифта и другие настройки отображения).
        </p>

        <h2>2. Какие cookie мы используем</h2>

        <h3>2.1. Функциональные cookie (обязательные)</h3>
        <p>
          Эти файлы необходимы для работы сайта и не могут быть отключены:
        </p>
        <ul>
          <li><code>housler_token</code> — токен авторизации пользователя</li>
          <li><code>cookie_consent</code> — статус согласия на использование cookie</li>
        </ul>

        <h3>2.2. Аналитические cookie</h3>
        <p>
          Эти файлы помогают нам понимать, как пользователи взаимодействуют с сайтом:
        </p>
        <ul>
          <li><strong>Яндекс.Метрика</strong> — сбор статистики посещений, анализ поведения</li>
        </ul>

        <h2>3. Цели использования cookie</h2>
        <ul>
          <li>Обеспечение работы сайта и авторизации пользователей</li>
          <li>Сохранение пользовательских настроек и предпочтений</li>
          <li>Анализ посещаемости и улучшение качества сервиса</li>
          <li>Персонализация контента и рекомендаций</li>
        </ul>

        <h2>4. Срок хранения cookie</h2>
        <table>
          <thead>
            <tr>
              <th>Тип cookie</th>
              <th>Срок хранения</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>housler_token</td>
              <td>7 дней</td>
            </tr>
            <tr>
              <td>cookie_consent</td>
              <td>1 год</td>
            </tr>
            <tr>
              <td>Яндекс.Метрика</td>
              <td>До 2 лет</td>
            </tr>
          </tbody>
        </table>

        <h2>5. Управление cookie</h2>
        <p>
          Вы можете управлять cookie-файлами через настройки вашего браузера:
        </p>
        <ul>
          <li>
            <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
              Google Chrome
            </a>
          </li>
          <li>
            <a href="https://support.mozilla.org/ru/kb/cookies-informaciya-kotoruyu-veb-sajty-hranyat-na-v" target="_blank" rel="noopener noreferrer">
              Mozilla Firefox
            </a>
          </li>
          <li>
            <a href="https://support.apple.com/ru-ru/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
              Safari
            </a>
          </li>
          <li>
            <a href="https://browser.yandex.ru/help/personal-data-protection/cookies.html" target="_blank" rel="noopener noreferrer">
              Яндекс.Браузер
            </a>
          </li>
        </ul>
        <p>
          Обратите внимание: отключение cookie может повлиять на функциональность сайта.
        </p>

        <h2>6. Отказ от аналитических cookie</h2>
        <p>
          Чтобы отказаться от сбора данных Яндекс.Метрикой, вы можете:
        </p>
        <ul>
          <li>
            Установить расширение{' '}
            <a href="https://yandex.ru/support/metrica/general/opt-out.html" target="_blank" rel="noopener noreferrer">
              Яндекс.Метрика Opt-Out
            </a>
          </li>
          <li>Нажать кнопку &laquo;Отклонить все&raquo; в баннере cookie</li>
        </ul>

        <h2>7. Согласие</h2>
        <p>
          Нажимая &laquo;Принять все&raquo; в баннере cookie, вы даёте согласие{' '}
          <strong>ООО &laquo;Сектор ИТ&raquo;</strong> (ИНН 5190237491) на обработку
          cookie-файлов в соответствии с настоящим документом и{' '}
          <Link href="/doc/clients/politiki/privacy" className="text-[var(--color-accent)]">
            Политикой конфиденциальности
          </Link>.
        </p>
        <p>
          Нажимая &laquo;Отклонить все&raquo; или продолжая использовать сайт без
          активного согласия, вы соглашаетесь только с использованием функциональных
          cookie, необходимых для работы сайта.
        </p>

        <h2>8. Контакты</h2>
        <p>
          По вопросам использования cookie обращайтесь:{' '}
          <a href="mailto:hello@housler.ru">hello@housler.ru</a>
        </p>
      </article>
    </div>
  );
}
