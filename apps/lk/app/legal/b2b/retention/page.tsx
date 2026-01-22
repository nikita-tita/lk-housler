import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика хранения и удаления данных | LK Housler',
  description: 'Сроки хранения документов, логов и данных по сделкам',
};

export default function RetentionPolicyPage() {
  return (
    <div className="legal-content">
      <h1>Политика хранения и удаления документов и логов</h1>

      <p className="text-[var(--color-text-light)]">
        <strong>Версия:</strong> 1.0<br />
        <strong>Дата последнего обновления:</strong> 19.01.2026
      </p>

      <p>
        <strong>Правообладатель/оператор сервиса:</strong> ООО «Сектор ИТ»<br />
        <strong>Сервис:</strong> LK Housler (https://lk.housler.ru)
      </p>

      <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg mb-6">
        <p className="mb-0">
          <strong>Реквизиты правообладателя:</strong><br />
          ИНН: 5190237491<br />
          ОГРН: 1255100001496<br />
          Юридический адрес: 183038, Мурманская обл., г. Мурманск, ул. Олега Кошевого, д. 6, к. 1, помещ. 1<br />
          Email поддержки: support@housler.ru<br />
          Email для юридических уведомлений: legal@housler.ru
        </p>
      </div>

      <h2>1. Назначение</h2>
      <p>Документ определяет сроки хранения и порядок удаления:</p>
      <ul>
        <li>документов по сделкам (договоры, акты, evidence);</li>
        <li>юридически значимых логов (audit trail);</li>
        <li>журналов статусов платежей и технических логов;</li>
        <li>обращений в поддержку.</li>
      </ul>

      <h2>2. Сроки хранения</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr>
              <th className="text-left p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">Категория данных</th>
              <th className="text-left p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">Срок хранения</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Данные учетной записи пользователя</td>
              <td className="p-3 border border-[var(--color-border)]">Срок действия аккаунта + 5 лет после удаления</td>
            </tr>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Документы по сделкам (договор/акт/evidence)</td>
              <td className="p-3 border border-[var(--color-border)]">5 лет с даты закрытия сделки</td>
            </tr>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Audit trail (IP/время/user agent/версии документов)</td>
              <td className="p-3 border border-[var(--color-border)]">5 лет с даты подписания</td>
            </tr>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Платежные статусы и идентификаторы операций</td>
              <td className="p-3 border border-[var(--color-border)]">5 лет с даты закрытия сделки</td>
            </tr>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Обращения в поддержку</td>
              <td className="p-3 border border-[var(--color-border)]">3 года с даты закрытия тикета</td>
            </tr>
            <tr>
              <td className="p-3 border border-[var(--color-border)]">Технические логи безопасности</td>
              <td className="p-3 border border-[var(--color-border)]">12 месяцев</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3. Удаление и архивирование</h2>
      <p>3.1. По истечении сроков данные удаляются или обезличиваются.</p>
      <p>3.2. Удаление аккаунта пользователем не означает немедленного удаления всех данных, если сохранение требуется для законных целей (доказуемость подписания/споры/комплаенс).</p>
      <p>3.3. <strong>Выгрузка документов:</strong> в кабинете агентства предусмотрена выгрузка по запросу (например, zip по закрытым сделкам).</p>
    </div>
  );
}
