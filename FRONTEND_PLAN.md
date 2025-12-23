# 🎨 Frontend Development Plan - lk.housler.ru

**Дата**: 23 декабря 2025  
**Статус**: Начало разработки

---

## 📋 Изученные требования

### ✅ Design System Housler (строго!)
- ✅ **Только черно-белая палитра** - никаких цветных акцентов
- ✅ **Без эмоджи** - ни в коде, ни в UI, ни в комментариях
- ✅ **Шрифт Inter** - единственный шрифт (Google Fonts)
- ✅ **Минимализм** - меньше элементов, больше пространства

### ✅ Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Font**: Inter (cyrillic + latin)
- **State**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **HTTP**: Axios
- **Icons**: Lucide React (черно-белые)

### ✅ Backend API
- **URL**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Auth**: JWT Bearer tokens (7 дней)
- **3 типа входа**: SMS (agents), Email (clients), Password (agencies)

---

## 🏗 Архитектура Frontend

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth layout (без sidebar)
│   │   ├── login/         # Выбор типа входа
│   │   ├── agent/         # SMS вход
│   │   ├── client/        # Email вход
│   │   └── agency/        # Password вход
│   │
│   ├── (agent)/           # Agent Console layout
│   │   ├── dashboard/     # Dashboard агента
│   │   ├── deals/         # Сделки
│   │   ├── profile/       # Профиль
│   │   └── layout.tsx     # Sidebar для агента
│   │
│   ├── (client)/          # Client Portal layout
│   │   ├── dashboard/     # Dashboard клиента
│   │   ├── deals/         # Мои сделки
│   │   ├── documents/     # Документы
│   │   └── layout.tsx     # Простой layout
│   │
│   ├── (agency)/          # Agency Admin layout
│   │   ├── dashboard/     # Dashboard агентства
│   │   ├── agents/        # Управление агентами
│   │   ├── deals/         # Все сделки
│   │   ├── finance/       # Финансы
│   │   └── layout.tsx     # Sidebar для агентства
│   │
│   ├── layout.tsx         # Root layout (Inter font)
│   └── page.tsx           # Landing/Redirect
│
├── components/            # React компоненты
│   ├── ui/               # UI компоненты (Design System)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   └── ...
│   │
│   ├── auth/             # Auth компоненты
│   │   ├── SMSAuthForm.tsx
│   │   ├── EmailAuthForm.tsx
│   │   ├── PasswordAuthForm.tsx
│   │   └── ConsentForm.tsx
│   │
│   ├── deals/            # Deal компоненты
│   │   ├── DealCard.tsx
│   │   ├── DealList.tsx
│   │   ├── DealForm.tsx
│   │   └── DealStatus.tsx
│   │
│   └── layout/           # Layout компоненты
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── Footer.tsx
│
├── lib/                  # Утилиты и конфиги
│   ├── api/             # API client
│   │   ├── client.ts    # Axios instance
│   │   ├── auth.ts      # Auth endpoints
│   │   ├── deals.ts     # Deals endpoints
│   │   └── ...
│   │
│   ├── hooks/           # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useDeals.ts
│   │   └── ...
│   │
│   ├── store/           # Zustand stores
│   │   ├── authStore.ts
│   │   └── dealStore.ts
│   │
│   └── utils/           # Утилиты
│       ├── format.ts
│       └── validation.ts
│
├── types/               # TypeScript types
│   ├── user.ts
│   ├── deal.ts
│   └── api.ts
│
├── styles/              # Стили
│   └── globals.css      # Tailwind + кастомные стили
│
├── public/              # Статика
│   └── favicon.ico
│
├── tailwind.config.ts   # Tailwind конфиг (черно-белый)
├── next.config.js       # Next.js конфиг
├── tsconfig.json        # TypeScript конфиг
└── package.json         # Dependencies
```

---

## 📝 Детальный план реализации

### Phase 1: Setup проекта (30 минут)

#### 1.1. Создать Next.js проект
```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

#### 1.2. Установить зависимости
```bash
cd frontend
npm install \
  axios \
  zustand \
  @tanstack/react-query \
  react-hook-form \
  zod \
  @hookform/resolvers \
  lucide-react \
  clsx \
  tailwind-merge
```

#### 1.3. Настроить Tailwind (черно-белый)
```typescript
// tailwind.config.ts
const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000000',
      white: '#FFFFFF',
      gray: {
        900: '#181A20',  // Основной текст
        800: '#333333',
        700: '#4A4A4A',
        600: '#6B7280',  // Вторичный текст
        500: '#9CA3AF',
        400: '#D1D5DB',
        300: '#E5E7EB',  // Границы
        200: '#F3F4F6',  // Hover фон
        100: '#F9FAFB',  // Фоны секций
      },
    },
    fontFamily: {
      sans: ['var(--font-inter)', 'sans-serif'],
    },
  },
};
```

#### 1.4. Настроить Inter font
```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});
```

---

### Phase 2: UI Components (1 день)

Создать базовые UI компоненты согласно Design System:

#### 2.1. Button Component
```typescript
// components/ui/Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}
```

Стили:
- **primary**: черный фон, белый текст
- **secondary**: прозрачный, серая граница
- **ghost**: прозрачный, без границы

#### 2.2. Input Component
```typescript
// components/ui/Input.tsx
interface InputProps {
  label?: string;
  type?: 'text' | 'email' | 'tel' | 'password';
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}
```

#### 2.3. Card Component
```typescript
// components/ui/Card.tsx
- Белый фон
- Серая граница
- Легкая тень
- Border radius: 8px
```

#### 2.4. Modal Component
```typescript
// components/ui/Modal.tsx
- Overlay с opacity
- Анимация появления
- Close button
```

#### 2.5. Другие компоненты
- Table
- Tabs
- Badge
- Spinner

---

### Phase 3: Auth System (1 день)

#### 3.1. API Client
```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (добавить JWT token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('housler_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle 401)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 3.2. Auth Endpoints
```typescript
// lib/api/auth.ts

// SMS Auth (Agent)
export async function sendSMS(phone: string) {
  return apiClient.post('/auth/agent/sms/send', { phone });
}

export async function verifySMS(phone: string, code: string) {
  const { data } = await apiClient.post('/auth/agent/sms/verify', {
    phone,
    code,
  });
  return data; // { access_token, refresh_token }
}

// Email Auth (Client)
export async function sendEmail(email: string) {
  return apiClient.post('/auth/client/email/send', { email });
}

export async function verifyEmail(email: string, code: string) {
  const { data } = await apiClient.post('/auth/client/email/verify', {
    email,
    code,
  });
  return data;
}

// Password Auth (Agency)
export async function loginAgency(email: string, password: string) {
  const { data } = await apiClient.post('/auth/agency/login', {
    email,
    password,
  });
  return data;
}

// Get current user
export async function getCurrentUser() {
  const { data } = await apiClient.get('/users/me');
  return data;
}
```

#### 3.3. Auth Store (Zustand)
```typescript
// lib/store/authStore.ts
import { create } from 'zustand';

interface User {
  id: string;
  email?: string;
  phone?: string;
  role: 'client' | 'agent' | 'agency_admin' | 'operator' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  
  setAuth: (token, user) => {
    localStorage.setItem('housler_token', token);
    set({ token, user, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('housler_token');
    set({ token: null, user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    const token = localStorage.getItem('housler_token');
    if (!token) return;
    
    try {
      const user = await getCurrentUser();
      set({ token, user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('housler_token');
    }
  },
}));
```

#### 3.4. Auth Components

**SMS Auth Form**:
```typescript
// components/auth/SMSAuthForm.tsx
1. Ввод телефона (+7 9XX XXX XX XX)
2. Отправка SMS
3. Ввод кода (6 цифр)
4. Verify
5. Redirect to /dashboard
```

**Email Auth Form**:
```typescript
// components/auth/EmailAuthForm.tsx
1. Ввод email
2. Отправка кода
3. Ввод кода (6 цифр)
4. Verify
5. Redirect to /dashboard
```

**Password Auth Form**:
```typescript
// components/auth/PasswordAuthForm.tsx
1. Ввод email
2. Ввод password
3. Login
4. Redirect to /dashboard
```

#### 3.5. Auth Pages
```typescript
// app/(auth)/login/page.tsx
- Выбор типа входа (3 кнопки)
- Redirect на /agent, /client, /agency

// app/(auth)/agent/page.tsx
- SMSAuthForm

// app/(auth)/client/page.tsx
- EmailAuthForm

// app/(auth)/agency/page.tsx
- PasswordAuthForm
```

#### 3.6. Auth Guard
```typescript
// lib/hooks/useRequireAuth.ts
export function useRequireAuth(requiredRole?: UserRole) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const router = useRouter();
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
    
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, requiredRole]);
  
  return { user, isAuthenticated };
}
```

---

### Phase 4: Agent Console MVP (3 дня)

#### 4.1. Layout
```typescript
// app/(agent)/layout.tsx
<Sidebar items={agentMenuItems} />
<main>{children}</main>
```

**Sidebar items**:
- Dashboard
- Сделки
- Профиль
- Выход

#### 4.2. Dashboard
```typescript
// app/(agent)/dashboard/page.tsx
- Статистика (сделки в работе, завершено, доход)
- Последние сделки (таблица)
- Быстрые действия (Создать сделку)
```

#### 4.3. Deals List
```typescript
// app/(agent)/deals/page.tsx
- Фильтры (статус, дата)
- Таблица сделок
- Пагинация
- Кнопка "Создать сделку"
```

#### 4.4. Deal Detail
```typescript
// app/(agent)/deals/[id]/page.tsx
- Информация о сделке
- Участники
- Документы
- Платежи
- Статус
```

#### 4.5. Create Deal
```typescript
// app/(agent)/deals/new/page.tsx
- Форма создания сделки
- Тип сделки (resale, newbuild)
- Адрес
- Цена
- Комиссия
- Участники
```

#### 4.6. Profile
```typescript
// app/(agent)/profile/page.tsx
- Личные данные
- КYC статус
- Реквизиты для выплат
- Редактирование
```

---

### Phase 5: Client Portal (1 день)

#### 5.1. Layout
```typescript
// app/(client)/layout.tsx
<Header />
<main>{children}</main>
```

#### 5.2. My Deals
```typescript
// app/(client)/dashboard/page.tsx
- Список моих сделок
- Статусы
- Переход к деталям
```

#### 5.3. Deal Detail
```typescript
// app/(client)/deals/[id]/page.tsx
- Информация о сделке
- Документы для подписи
- Статус платежа
- Кнопка "Подписать"
```

#### 5.4. Documents
```typescript
// app/(client)/documents/page.tsx
- Список документов
- Скачать PDF
- Подписать (ПЭП через SMS)
```

---

### Phase 6: Agency Admin (2 дня)

#### 6.1. Layout
```typescript
// app/(agency)/layout.tsx
<Sidebar items={agencyMenuItems} />
<main>{children}</main>
```

**Sidebar items**:
- Dashboard
- Агенты
- Сделки
- Финансы
- Настройки

#### 6.2. Dashboard
```typescript
// app/(agency)/dashboard/page.tsx
- Общая статистика
- Топ агенты
- Последние сделки
```

#### 6.3. Agents Management
```typescript
// app/(agency)/agents/page.tsx
- Список агентов
- Добавить агента
- Редактировать комиссии
- Статистика по агентам
```

#### 6.4. All Deals
```typescript
// app/(agency)/deals/page.tsx
- Все сделки агентства
- Фильтры (агент, статус)
- Финансовая информация
```

#### 6.5. Finance
```typescript
// app/(agency)/finance/page.tsx
- Бухгалтерия (ledger)
- Выплаты агентам
- Настройка сплитов
```

---

## 🎯 Приоритеты на сегодня

### Сейчас (1-2 часа):
1. ✅ **Setup Next.js проекта**
2. ✅ **Настроить Tailwind (черно-белый)**
3. ✅ **Настроить Inter font**
4. ✅ **Создать базовые UI компоненты** (Button, Input, Card)

### Завтра (1 день):
5. ✅ **Auth System** (API client, Auth store, Auth components)
6. ✅ **Auth Pages** (SMS, Email, Password)

### Послезавтра (3 дня):
7. ✅ **Agent Console MVP** (Dashboard, Deals, Profile)

---

## 📊 Timeline

| Phase | Задачи | Срок | Статус |
|-------|--------|------|--------|
| **Phase 1** | Setup проекта | 30 мин | ⏳ Next |
| **Phase 2** | UI Components | 1 день | ⏳ |
| **Phase 3** | Auth System | 1 день | ⏳ |
| **Phase 4** | Agent Console | 3 дня | ⏳ |
| **Phase 5** | Client Portal | 1 день | ⏳ |
| **Phase 6** | Agency Admin | 2 дня | ⏳ |
| **TOTAL** | | **8-9 дней** | |

---

## ✅ Готово к старту!

**Следующая команда:**
```bash
cd /Users/fatbookpro/Desktop/lk
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

**Приступаем!** 🚀

