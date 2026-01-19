# Пакет публичных юридических документов для LK Housler

**Сформировано:** 19.01.2026  
**Оператор:** ООО «Сектор ИТ»  
**URL сервиса:** https://lk.housler.ru

## 0) Что внутри

- privacy_policy.md — Политика обработки персональных данных
- security_disclosure.md — Сведения о реализуемых требованиях к защите ПД
- consent_pd.md — Текст согласия на ПД (для форм/регистрации)
- cookie_policy.md — Политика cookie (если есть аналитика/пиксели)
- terms_of_use.md — Пользовательское соглашение
- support_policy.md — Политика обращений/претензий
- requisites_contacts.md — Контакты и реквизиты
- ip_policy.md — Политика по интеллектуальной собственности

## 1) Где должны лежать на сайте (рекомендуемая карта URL)

Публичные страницы (доступ без авторизации):
- /legal/privacy      → privacy_policy.md
- /legal/security     → security_disclosure.md
- /legal/consent      → consent_pd.md (опционально)
- /legal/cookies      → cookie_policy.md
- /legal/terms        → terms_of_use.md
- /legal/support      → support_policy.md
- /legal/requisites   → requisites_contacts.md
- /legal/ip           → ip_policy.md

Минимум в футере:
- Политика ПД
- Сведения о защите ПД
- Пользовательское соглашение
- Политика cookie (если применимо)
- Поддержка/претензии
- Контакты и реквизиты

## 2) Как подтверждаются пользователями (акцепт) и как логировать

### 2.1 Регистрация (обязательно)

Чекбоксы:
1) «Я принимаю Пользовательское соглашение» (link /legal/terms) — обязательный
2) «Я ознакомлен(а) с Политикой ПД» (link /legal/privacy) — обязательный
3) «Я согласен(на) на маркетинговые рассылки» — только если есть рассылки, опционально

Лог (хранить в БД):
- user_id
- doc_type: terms/privacy/(marketing_opt_in)
- doc_version (из шапки документа)
- doc_url
- accepted_at (UTC)
- ip
- user_agent
- channel (web/mobile)
- consent_flags (terms=true, privacy=true, marketing=bool)

### 2.2 Любая форма сбора данных (лид-формы, заявки)

Под кнопкой:
- чекбокс согласия ПД (можно объединить с “ознакомлен с политикой”), ссылка на /legal/privacy

Логировать:
- form_id
- user_id/anon_id
- doc_version/privacy_version
- accepted_at, ip, user_agent
- payload_hash (хеш полей формы, чтобы не хранить лишнее)

### 2.3 Cookie-баннер (если есть аналитика/пиксели)

Кнопки: «Принять все», «Только необходимые», «Настроить»

Логировать:
- user_id/anon_id
- choices (essential/analytics/marketing)
- timestamp, ip, user_agent
- cookie_policy_version

## 3) Что нужно заполнить перед публикацией

Во всех документах есть поля [УКАЗАТЬ]. Их нужно заполнить реальными реквизитами:
- ИНН/ОГРН/адрес
- emails (support, pd requests, security)
- список субпроцессоров + URL страницы (если делаете отдельную)

## 4) Нормативные ссылки (для внутреннего комплаенса)

152-ФЗ ст. 18.1 (публикация политики и сведений о защите ПД):
https://www.consultant.ru/document/cons_doc_LAW_61801/eeeebe22bf738fd65bb66b95cc278911ae2525ee/
