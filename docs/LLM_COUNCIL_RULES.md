# LLM Council - Правила проведения ревью

## Обзор

LLM Council — параллельный запуск специализированных агентов для code review.
Каждый агент фокусируется на своей области и выдаёт структурированный отчёт.

---

## Агенты

| Агент | Фокус | Файлы |
|-------|-------|-------|
| **Security** | Auth, crypto, secrets, injection | `**/auth/*`, `**/security.*`, `.env*` |
| **Backend** | API design, DB, performance | `backend/**/*.py` |
| **Frontend** | UX, a11y, state management | `apps/**/*.tsx`, `packages/**/*.ts` |
| **Docs** | Актуальность документации, ADR | `*.md`, `docs/**` |

---

## ОБЯЗАТЕЛЬНО перед ревью

Каждый агент ДОЛЖЕН:

1. **Прочитать CLAUDE.md** — особенно секции:
   - КРИТИЧНЫЕ ПРАВИЛА
   - ARCHITECTURE DECISIONS
   - TECH DEBT

2. **Игнорировать**:
   - `_archive/` — устаревшие файлы
   - `_agent_backend_tmp/` — временные файлы
   - `team/TASKS_*.md` — рабочие задачи
   - Файлы в `.gitignore`

3. **Проверить перед репортом**:
   - Это не задокументированное ADR?
   - Это не известный tech debt?
   - Код реально существует? (не удалён)

---

## Формат отчёта

```markdown
## [Agent Name] Review

### Summary
- Issues found: X (Y critical, Z high, W medium)
- Files reviewed: N
- False positive rate target: <10%

### Critical Issues
| # | Issue | File:Line | Evidence | Not in ADR? |
|---|-------|-----------|----------|-------------|

### High Issues
...

### Medium Issues
...

### Low Issues
...

### Skipped (Known/Intentional)
| Item | Reason (from CLAUDE.md) |
|------|-------------------------|
```

---

## Docs Agent (новый)

Проверяет:

1. **CLAUDE.md актуален?**
   - Структура проекта соответствует реальности?
   - Tech stack описан верно?
   - ADR покрывают странные решения?

2. **README.md**
   - Инструкции по запуску работают?
   - Примеры актуальны?

3. **Inline docs**
   - Docstrings в критичных функциях?
   - Комментарии к неочевидному коду?

4. **API docs**
   - OpenAPI schema актуальна?
   - Примеры запросов/ответов?

---

## Пост-обработка

После получения отчётов от всех агентов:

1. **Дедупликация** — объединить одинаковые issues
2. **Фильтрация** — убрать false positives (сверить с ADR)
3. **Приоритизация** — CRITICAL → HIGH → MEDIUM → LOW
4. **Создать задачи** — только для реальных issues

---

## Метрики качества

| Метрика | Цель |
|---------|------|
| False positive rate | <10% |
| Coverage (files reviewed) | >80% |
| Duplicate rate | <5% |
| ADR compliance | 100% (не репортить ADR) |

---

## Пример запуска

```
Запусти LLM Council review:

1. Security Agent — проверь auth, secrets, injection
2. Backend Agent — проверь API, DB, performance
3. Frontend Agent — проверь UX, state, a11y
4. Docs Agent — проверь актуальность документации

ВАЖНО: Сначала прочитай CLAUDE.md!
Игнорируй _archive/, _agent_backend_tmp/
Формат: таблицы с severity, file:line, evidence
```

---

## Lessons Learned (2026-01-25)

### Что работало:
- Параллельные агенты = быстрый охват
- Специализация = глубокий анализ в своей области
- Структурированные таблицы = легко создавать задачи

### Что улучшили:
- Добавили ADR секцию в CLAUDE.md
- Агенты должны читать CLAUDE.md первым
- Добавили Docs Agent для проверки документации
- Явный список игнорируемых директорий
