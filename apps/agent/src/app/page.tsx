import Link from "next/link";
import { AuthRedirect } from "@/components/AuthRedirect";

export default function HomePage() {
  return (
    <>
      {/* Клиентский компонент для редиректа авторизованных пользователей */}
      <AuthRedirect to="/profile" />

      {/* Hero Section */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-6">
                Цифровая платформа
                <span className="block text-[var(--color-text-light)]">для агентов недвижимости</span>
              </h1>
              <p className="text-lg text-[var(--color-text-light)] mb-8 max-w-lg">
                Создавайте подборки новостроек для клиентов и отслеживайте их реакции в реальном времени
              </p>
              <div className="flex gap-4 flex-col sm:flex-row">
                <Link href="/login" className="btn btn-primary">
                  Зарегистрироваться
                </Link>
                <Link href="/login" className="btn btn-secondary">
                  Войти
                </Link>
              </div>
              <p className="text-sm text-[var(--color-text-light)] mt-4">
                2 минуты на регистрацию. Бесплатно навсегда.
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="card p-8">
                <div className="text-sm font-medium text-[var(--color-text-light)] mb-6">
                  Все инструменты в одном месте
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--color-bg-gray)] rounded-lg text-center">
                    <div className="text-sm font-medium">База новостроек</div>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-gray)] rounded-lg text-center">
                    <div className="text-sm font-medium">Подборки для клиентов</div>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-gray)] rounded-lg text-center">
                    <div className="text-sm font-medium">Аналитика просмотров</div>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-gray)] rounded-lg text-center">
                    <div className="text-sm font-medium">CRM клиентов</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section section-gray">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-4">
            Работайте с новостройками из любой точки России
          </h2>
          <p className="text-center text-[var(--color-text-light)] mb-12 max-w-2xl mx-auto">
            Актуальная база квартир с ежедневным обновлением данных
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="card p-6 text-center">
              <div className="text-3xl md:text-4xl font-semibold mb-2">90 000+</div>
              <div className="text-[var(--color-text-light)] text-sm">квартир в базе</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl md:text-4xl font-semibold mb-2">50+</div>
              <div className="text-[var(--color-text-light)] text-sm">жилых комплексов</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl md:text-4xl font-semibold mb-2">15</div>
              <div className="text-[var(--color-text-light)] text-sm">регионов России</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl md:text-4xl font-semibold mb-2">0 р.</div>
              <div className="text-[var(--color-text-light)] text-sm">стоимость навсегда</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Как это работает</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-gray)] flex items-center justify-center font-semibold mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Подбираете квартиры</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Используйте фильтры для поиска квартир под запрос клиента
              </p>
              <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[var(--color-border)] -translate-x-4" />
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-gray)] flex items-center justify-center font-semibold mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Создаёте подборку</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Добавляйте квартиры в подборку с комментариями для клиента
              </p>
              <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[var(--color-border)] -translate-x-4" />
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-gray)] flex items-center justify-center font-semibold mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Отправляете клиенту</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Клиент получает персональную ссылку на подборку
              </p>
              <div className="hidden md:block absolute top-5 left-full w-full h-px bg-[var(--color-border)] -translate-x-4" />
            </div>
            <div>
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-gray)] flex items-center justify-center font-semibold mb-4">
                4
              </div>
              <h3 className="font-semibold mb-2">Отслеживаете реакции</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Видите что клиент просмотрел и что ему понравилось
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature: Selections */}
      <section className="section section-gray">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Создавайте подборки как плейлисты
              </h2>
              <p className="text-[var(--color-text-light)] mb-6">
                Добавляйте квартиры в подборку одним кликом. Оставляйте комментарии к каждому объекту.
                Отправляйте клиенту персональную ссылку.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Неограниченное количество подборок</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Комментарии к каждой квартире</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Красивая страница для клиента</span>
                </li>
              </ul>
            </div>
            <div className="card p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-gray)] rounded-lg">
                  <div>
                    <div className="font-medium">Квартиры для Ивановых</div>
                    <div className="text-sm text-[var(--color-text-light)]">12 объектов</div>
                  </div>
                  <div className="text-sm text-[var(--color-text-light)]">5 просмотров</div>
                </div>
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-gray)] rounded-lg">
                  <div>
                    <div className="font-medium">Студии до 5 млн</div>
                    <div className="text-sm text-[var(--color-text-light)]">8 объектов</div>
                  </div>
                  <div className="text-sm text-[var(--color-text-light)]">12 просмотров</div>
                </div>
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-gray)] rounded-lg">
                  <div>
                    <div className="font-medium">Евротрёшки у метро</div>
                    <div className="text-sm text-[var(--color-text-light)]">6 объектов</div>
                  </div>
                  <div className="text-sm text-[var(--color-text-light)]">3 просмотра</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature: Analytics */}
      <section className="section">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 card p-6">
              <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                <div className="text-sm text-[var(--color-text-light)] mb-2">Активность клиента</div>
                <div className="font-medium">Иван Петров</div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Открыл подборку</span>
                  <span className="text-[var(--color-text-light)]">сегодня, 14:32</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Просмотрел 8 из 12 квартир</span>
                  <span className="text-[var(--color-text-light)]">сегодня, 14:45</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Отметил 3 понравившихся</span>
                  <span className="text-[var(--color-text-light)]">сегодня, 14:48</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Добавил квартиру в избранное</span>
                  <span className="text-[var(--color-text-light)]">сегодня, 15:02</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Видьте реакции клиента в реальном времени
              </h2>
              <p className="text-[var(--color-text-light)] mb-6">
                Узнавайте когда клиент открыл подборку, какие квартиры просмотрел и что отметил
                как понравившееся. Принимайте решения на основе данных.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Статистика просмотров каждой квартиры</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Лайки и комментарии от клиента</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>История всех действий</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature: CRM */}
      <section className="section section-gray">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
                Ведите всех клиентов в одном месте
              </h2>
              <p className="text-[var(--color-text-light)] mb-6">
                Встроенная CRM позволяет отслеживать статус каждого клиента: от первого контакта
                до сделки. Воронка продаж и история взаимодействий.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Воронка продаж по этапам</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Карточка клиента с историей</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-0.5" />
                  <span>Связь клиентов с подборками</span>
                </li>
              </ul>
            </div>
            <div className="card p-6">
              <div className="grid grid-cols-4 gap-2 mb-6">
                <div className="text-center p-3 bg-[var(--color-bg-gray)] rounded-lg">
                  <div className="text-2xl font-semibold">12</div>
                  <div className="text-xs text-[var(--color-text-light)]">Новые</div>
                </div>
                <div className="text-center p-3 bg-[var(--color-bg-gray)] rounded-lg">
                  <div className="text-2xl font-semibold">8</div>
                  <div className="text-xs text-[var(--color-text-light)]">В работе</div>
                </div>
                <div className="text-center p-3 bg-[var(--color-bg-gray)] rounded-lg">
                  <div className="text-2xl font-semibold">5</div>
                  <div className="text-xs text-[var(--color-text-light)]">Показ</div>
                </div>
                <div className="text-center p-3 bg-[var(--color-bg-gray)] rounded-lg">
                  <div className="text-2xl font-semibold">3</div>
                  <div className="text-xs text-[var(--color-text-light)]">Сделка</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
                  <div className="font-medium">Мария Сидорова</div>
                  <div className="text-xs px-2 py-1 bg-[var(--color-bg-gray)] rounded">В работе</div>
                </div>
                <div className="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
                  <div className="font-medium">Алексей Козлов</div>
                  <div className="text-xs px-2 py-1 bg-[var(--color-bg-gray)] rounded">Показ</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Почему агенты выбирают нас</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Полностью бесплатно</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Никаких платных тарифов и скрытых комиссий. Все функции доступны сразу после регистрации.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Актуальная база</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Данные обновляются ежедневно из официальных источников. Только реальные квартиры в продаже.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Работа из любой точки</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Веб-платформа работает в браузере. Создавайте подборки с любого устройства.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Аналитика в реальном времени</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Видьте когда клиент открыл подборку и какие квартиры ему понравились.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Удобно для клиента</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Клиент получает красивую страницу с квартирами. Работает на телефоне и компьютере.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Быстрая регистрация</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Регистрация за 2 минуты. Подтверждение по SMS. Начните работать сразу.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="section section-gray">
        <div className="container">
          <h2 className="section-title">Начните за 3 шага</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-lg mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Регистрация</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Email и пароль
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-lg mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Подтверждение</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                SMS-код на телефон
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-lg mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Готово</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                Начинайте работать
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section text-center">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
            Готовы начать?
          </h2>
          <p className="text-lg text-[var(--color-text-light)] mb-10 max-w-xl mx-auto">
            Присоединяйтесь к агентам, которые уже используют платформу для работы с клиентами
          </p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            <Link href="/login" className="btn btn-primary btn-lg">
              Зарегистрироваться бесплатно
            </Link>
            <Link href="/offers" className="btn btn-secondary btn-lg">
              Посмотреть каталог
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
