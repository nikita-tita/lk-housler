# Frontend - lk.housler.ru

**Next.js 14 + TypeScript + Tailwind CSS**

---

## 🚀 Быстрый старт

```bash
# Установить зависимости
npm install

# Создать .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local

# Запустить dev сервер
npm run dev

# Открыть в браузере
# http://localhost:3000
```

---

## 📁 Структура

```
app/
├── (auth)/       # Авторизация (3 типа)
├── (agent)/      # Agent Console
├── (client)/     # Client Portal
└── (agency)/     # Agency Admin

components/
├── ui/           # UI компоненты
├── auth/         # Auth формы
└── layout/       # Layout компоненты

lib/
├── api/          # API клиенты
├── hooks/        # Custom hooks
├── store/        # Zustand stores
└── utils/        # Утилиты
```

---

## 🎨 Design System

- **Палитра**: только черно-белая
- **Шрифт**: Inter (cyrillic + latin)
- **Без эмоджи**: строго!
- **Минимализм**: меньше элементов

---

## 🔑 Features

### Auth (3 типа)
- SMS (агенты)
- Email (клиенты)
- Password (агентства)

### Agent Console
- Dashboard
- Deals (list, detail, create)
- Profile

### Client Portal
- My Deals
- Documents

### Agency Admin
- Dashboard
- Agents
- All Deals
- Finance
- Settings

---

## 📖 Документация

- [FRONTEND_COMPLETE.md](../FRONTEND_COMPLETE.md) - Полная документация
- [FRONTEND_PLAN.md](../FRONTEND_PLAN.md) - План разработки

---

## 🧪 Тестирование

### Agent (SMS)
1. http://localhost:3000/agent
2. Телефон: `79999123456`
3. Код: `111111`

### Client (Email)
1. http://localhost:3000/client
2. Email: `client@test.com`
3. Код из консоли Backend

### Agency (Password)
1. http://localhost:3000/agency
2. Email + Password (после регистрации)

---

## 🛠 Команды

```bash
npm run dev          # Dev сервер
npm run build        # Production build
npm run start        # Production сервер
npm run lint         # ESLint
```

---

**Made with Housler** ❤️  
**ООО "Сектор ИТ" (ИНН 5190237491)**
