# План устранения багов (Prod Review)

## Краткая сводка

| # | Баг | Причина | Срочность |
|---|-----|---------|-----------|
| 1 | Email не доходит | `EMAIL_PROVIDER=mock` на проде | HIGH |
| 2 | Две формы сделок | Архитектурный долг (Bank-Split vs Standard) | MEDIUM |
| 3 | Адрес одной строкой vs по полям | Разные формы, разные схемы | MEDIUM |
| 4 | Адрес при покупке вторички | Бизнес-логика неверная | LOW |
| 5 | Нет форматирования цены | Только в bank-split форме | MEDIUM |
| 6 | Нет паспортных данных клиента | Не реализовано | HIGH |
| 7 | Internal Server Error | Необработанные исключения | HIGH |
| 8 | Нет выбора партнёра | В bank-split есть, в стандартной нет | MEDIUM |
| 9 | Профиль не редактируется | Только заглушки | HIGH |
| 10 | Нет ручного ввода процентов | Только ползунки | LOW |
| 11 | Нет выбора существующего партнёра | Только приглашение нового | MEDIUM |

---

## Детальный анализ и план

### 1. Email не доходит клиенту

**Причина:** В `.env.prod.bak` видно `EMAIL_PROVIDER=mock` - mock провайдер только логирует, не отправляет

**Файлы:**
- `backend/app/core/config.py:108` - дефолт `mock`
- `backend/app/services/email/provider.py:46-63` - MockEmailProvider

**Решение:**
1. Настроить SMTP (Yandex 360) или SendGrid
2. Изменить `EMAIL_PROVIDER=smtp` или `EMAIL_PROVIDER=sendgrid`
3. Заполнить `SMTP_PASSWORD` (пароль приложения Yandex 360)

**Действия:**
```bash
# На проде изменить в .env:
EMAIL_PROVIDER=smtp
SMTP_PASSWORD=<пароль_приложения_yandex>
```

---

### 2. Почему две формы сделок (Bank-Split vs Создать сделку)?

**Причина:** Архитектурное решение - две разные бизнес-модели:

| `/agent/deals/new` | `/agent/deals/bank-split/new` |
|-------------------|------------------------------|
| Стандартная сделка | T-Bank Мультирасчёты |
| Агент получает напрямую | Деньги через escrow T-Bank |
| Простой workflow | Hold period, milestone release |
| Нет интеграции с банком | Интеграция с T-Bank API |

**Файлы:**
- `frontend/app/agent/deals/new/page.tsx` (655 строк)
- `frontend/app/agent/deals/bank-split/new/page.tsx` (860 строк)

**Решение:**
1. Объединить в ОДНУ форму с переключателем типа оплаты
2. Шаг 1: Выбор режима (Standard / Bank-Split)
3. Условный рендеринг полей в зависимости от режима

**Оценка:** Рефакторинг средней сложности, ~2-3 дня

---

### 3. Адрес одной строкой vs по полям

**Причина:** Разные схемы данных:

**`/deals/new`** использует `AddressCreate`:
```typescript
interface AddressInput {
  city: string;
  street: string;
  house: string;
  building?: string;
  apartment?: string;
}
```

**`/deals/bank-split/new`** использует строку:
```typescript
property_address: string; // "Москва, ул. Ленина, д. 12"
```

**Файлы:**
- `frontend/app/agent/deals/new/page.tsx:514-565` - структурированная форма
- `frontend/app/agent/deals/bank-split/new/page.tsx:428-465` - одна строка
- `backend/app/schemas/deal.py:18-34` - AddressCreate
- `backend/app/schemas/bank_split.py` - строка property_address

**Решение:**
1. Использовать единую структурированную форму во всех местах
2. Добавить AddressInput в bank-split форму
3. На бэкенде собирать строку из полей: `address.to_full_address()`

---

### 4. Адрес при покупке вторички

**Вопрос:** Зачем запрашиваем адрес если его ещё не знаем?

**Текущее поведение:** Адрес обязателен для всех типов сделок

**Бизнес-логика:**
- **secondary_sell** (продажа) - адрес известен сразу
- **secondary_buy** (покупка) - адрес может быть неизвестен
- **newbuild_booking** - адрес ЖК известен

**Решение:**
1. Для `secondary_buy` сделать адрес опциональным
2. Добавить placeholder "Будет уточнён позже"
3. Разрешить редактирование адреса после создания сделки

**Файлы для изменения:**
- `frontend/app/agent/deals/bank-split/new/page.tsx` - валидация
- `backend/app/schemas/bank_split.py` - property_address Optional

---

### 5. Форматирование цены (100 000 vs 100000)

**Причина:** В `/deals/new` используется `type="number"`, в bank-split - `type="text"` с форматированием

**`/deals/new` (без форматирования):**
```tsx
<Input
  type="number"
  placeholder="5000000"
  value={formData.price || ''}
/>
```

**`/deals/bank-split/new` (с форматированием):**
```tsx
<Input
  type="text"
  inputMode="numeric"
  value={formatNumber(formData.price)}
  onChange={(e) => setFormData({ price: parseFormattedNumber(e.target.value) })}
/>
```

**Решение:**
1. Создать компонент `CurrencyInput` с автоформатированием
2. Использовать во всех формах
3. Добавить в `frontend/components/shared/`

---

### 6. Нет паспортных данных клиента

**Текущее состояние:** Запрашивается только:
- `client_name` (имя)
- `client_phone` (телефон)
- `client_email` (email, опционально в bank-split)

**Для договоров нужно:**
- ФИО полностью
- Серия и номер паспорта
- Кем выдан, дата выдачи
- Код подразделения
- Адрес регистрации
- Дата рождения

**Решение:**
1. Создать модель `ClientPassportData`:
```python
class ClientPassportData(BaseModel):
    full_name: str
    birth_date: date
    passport_series: str
    passport_number: str
    passport_issued_by: str
    passport_issued_date: date
    passport_department_code: str
    registration_address: str
```

2. Добавить шаг "Паспортные данные клиента" в форму сделки
3. Шифровать PII данные (152-ФЗ)
4. Хранить в отдельной таблице `client_passport_data`

**Файлы:**
- Новый: `backend/app/models/client_passport.py`
- Новый: `backend/app/schemas/client_passport.py`
- Изменить: `frontend/app/agent/deals/*/page.tsx`

---

### 7. Internal Server Error при создании сделки

**Причина:** Необработанные исключения в endpoint

**Текущий код** (`backend/app/api/v1/endpoints/deals.py:149-173`):
```python
try:
    deal = await deal_service.create_simple(deal_in, current_user)
    await db.commit()
    return DealSimpleResponse(...)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
# Все остальные исключения = 500
```

**Решение:**
1. Добавить общий exception handler
2. Логировать ошибки с traceback
3. Возвращать понятные сообщения

```python
try:
    deal = await deal_service.create_simple(deal_in, current_user)
    await db.commit()
    return DealSimpleResponse(...)
except ValueError as e:
    await db.rollback()
    raise HTTPException(status_code=400, detail=str(e))
except IntegrityError as e:
    await db.rollback()
    logger.error(f"DB integrity error: {e}")
    raise HTTPException(status_code=409, detail="Конфликт данных")
except Exception as e:
    await db.rollback()
    logger.exception(f"Unexpected error creating deal: {e}")
    raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
```

---

### 8. Нет выбора партнёра по сделке (в стандартной форме)

**Текущее состояние:**
- `/deals/bank-split/new` - ЕСТЬ Шаг 3 с SplitSlider и приглашением со-агента
- `/deals/new` - НЕТ такого функционала

**Решение:**
1. Добавить шаг "Партнёр по сделке" в стандартную форму
2. Портировать SplitSlider компонент
3. Унифицировать логику приглашений

---

### 9. Профиль агента не редактируется

**Текущее состояние** (`frontend/app/agent/profile/page.tsx`):
- Только просмотр: ID, email, телефон, роль, статус
- Заглушки: "KYC Верификация", "Реквизиты для выплат"

**Нужно добавить:**
1. Редактирование личных данных
2. Паспортные данные агента
3. Тип занятости: ИП / СМЗ / ООО / Физлицо
4. Реквизиты для выплат (расчётный счёт)
5. ИНН

**Модель данных:**
```python
class AgentProfile(BaseModel):
    # Личные данные
    full_name: str
    birth_date: date

    # Паспорт
    passport_series: str
    passport_number: str
    passport_issued_by: str
    passport_issued_date: date
    passport_department_code: str

    # Занятость
    employment_type: Literal["individual", "self_employed", "sole_proprietor", "llc"]
    inn: str

    # Реквизиты (для ИП/ООО)
    company_name: Optional[str]
    ogrn: Optional[str]
    bank_name: str
    bank_bik: str
    bank_account: str
    bank_corr_account: str
```

**Файлы:**
- Новый: `backend/app/models/agent_profile.py`
- Новый: `backend/app/api/v1/endpoints/profile.py`
- Изменить: `frontend/app/agent/profile/page.tsx` - добавить формы

---

### 10. Ручной ввод процентов в сплитовании

**Текущее состояние:** Только ползунки (SplitSlider)

**Решение:**
1. Добавить input поля рядом с ползунками
2. Синхронизировать: ползунок <-> input
3. Валидация: сумма = 100%

```tsx
<div className="flex items-center gap-4">
  <SplitSlider ... />
  <Input
    type="number"
    min={0}
    max={100}
    value={participant.percent}
    onChange={(e) => handlePercentChange(participant.id, Number(e.target.value))}
    className="w-20"
  />
  <span>%</span>
</div>
```

---

### 11. Выбор существующего партнёра (не только приглашение нового)

**Текущее состояние:** Только ввод телефона нового партнёра

**Нужно:**
1. Список предыдущих партнёров (из истории сделок)
2. Поиск по телефону/имени в базе
3. Если найден - выбрать из списка
4. Если не найден - отправить приглашение

**Решение:**
1. Endpoint `/api/v1/partners/search?phone=...`
2. Компонент `PartnerSelector` с автокомплитом
3. Сохранение формы при отправке приглашения (draft)

---

## Приоритеты реализации

### Phase 1 (Critical - 1-2 дня)
1. **Email провайдер** - настроить SMTP на проде
7. **Error handling** - обработка ошибок при создании сделки

### Phase 2 (High - 3-5 дней)
6. **Паспортные данные клиента** - модель + форма
9. **Профиль агента** - редактирование + реквизиты

### Phase 3 (Medium - 5-7 дней)
2. **Объединение форм** - одна форма с переключателем
3. **Унификация адреса** - структурированная форма везде
5. **Форматирование цены** - CurrencyInput компонент
8. **Партнёр в стандартной форме** - портировать из bank-split
11. **Выбор существующего партнёра** - PartnerSelector

### Phase 4 (Low - 2-3 дня)
4. **Опциональный адрес** - для покупки вторички
10. **Ручной ввод процентов** - input рядом с ползунком

---

## Нерешённые вопросы

1. **Авторизация клиента по email vs телефону:**
   - Текущее: агент по SMS, клиент по email
   - Почему? Email универсальнее для одноразовых ссылок
   - Нужно ли менять? Обсудить с product owner

2. **Нужны ли две формы или объединить?**
   - Bank-Split - сложный workflow с T-Bank
   - Стандартная - простой workflow
   - Возможно, лучше оставить раздельно но унифицировать UI

3. **Какие поля обязательны для договоров?**
   - Нужна спецификация от юристов
   - Шаблоны договоров в `backend/app/services/contract/`
