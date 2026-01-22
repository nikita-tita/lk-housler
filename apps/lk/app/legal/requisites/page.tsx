import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Контакты и реквизиты | LK Housler',
  description: 'Контакты и реквизиты владельца сервиса LK Housler',
};

export default function RequisitesPage() {
  return (
    <div className="legal-content">
      <h1>Контакты и реквизиты владельца сервиса</h1>

      <p className="text-[var(--color-text-light)]">
        <strong>Дата актуализации:</strong> 19.01.2026
      </p>

      <p>
        <strong>Сервис:</strong> LK Housler (https://lk.housler.ru)<br />
        <strong>Владелец/оператор:</strong> ООО «Сектор ИТ»
      </p>

      <h2>Реквизиты</h2>
      <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg mb-6">
        <ul className="list-none p-0 m-0 space-y-1">
          <li><strong>Полное наименование:</strong> ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «СЕКТОР ИНФОРМАЦИОННЫХ ТЕХНОЛОГИЙ»</li>
          <li><strong>Сокращенное наименование:</strong> ООО «СЕКТОР ИТ»</li>
          <li><strong>ИНН:</strong> 5190237491</li>
          <li><strong>КПП:</strong> 519001001</li>
          <li><strong>ОГРН:</strong> 1255100001496</li>
          <li><strong>Юридический адрес:</strong> 183038, Мурманская обл., г. Мурманск, ул. Олега Кошевого, д. 6, к. 1, помещ. 1</li>
          <li><strong>Почтовый адрес:</strong> 183038, Мурманская обл., г. Мурманск, ул. Олега Кошевого, д. 6, к. 1, помещ. 1</li>
          <li><strong>Генеральный директор:</strong> Михеев Иван Михайлович</li>
        </ul>
      </div>

      <h2>Контакты</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--color-text-light)] mb-1">Поддержка</div>
          <a href="mailto:support@housler.ru" className="font-medium hover:text-[var(--color-text-light)]">support@housler.ru</a>
        </div>
        <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--color-text-light)] mb-1">Вопросы по персональным данным</div>
          <a href="mailto:pd@housler.ru" className="font-medium hover:text-[var(--color-text-light)]">pd@housler.ru</a>
        </div>
        <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--color-text-light)] mb-1">Безопасность/уязвимости</div>
          <a href="mailto:security@housler.ru" className="font-medium hover:text-[var(--color-text-light)]">security@housler.ru</a>
        </div>
        <div className="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
          <div className="text-sm text-[var(--color-text-light)] mb-1">Телефон</div>
          <a href="tel:+79955905520" className="font-medium hover:text-[var(--color-text-light)]">+7 (995) 590-55-20</a>
        </div>
      </div>

      <h2>График работы поддержки</h2>
      <p>Пн-Пт 10:00-18:00 (МСК)</p>
    </div>
  );
}
