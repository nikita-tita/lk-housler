# Документы внутри сделки (B2C/B2B2C) — LK Housler

**Сформировано:** 19.01.2026  
**Оператор платформы:** ООО «Сектор ИТ»  
**URL:** https://lk.housler.ru

## Что внутри

contracts/
- contract_purchase.md
- contract_sale.md
- contract_rent_tenant.md
- contract_rent_landlord.md

appendices/
- safe_settlement_rules.md
- acceptance_act_template.md
- dispute_rules.md
- pep_consent.md
- legal_notices_consent.md
- payment_ui_short.md

## Где должны лежать

1) Внутри сделки (обязательно)
- карточка сделки → «Документы»:
  - Договор + Приложение №1
  - Акт (на финале)
  - Регламент претензий (ссылка из интерфейса претензии)
  - Согласие на ПЭП (перед первым подписанием)
  - Согласие на уведомления (регистрация и/или перед первым юридически значимым событием)

2) Публично (опционально)
- /legal/deal/safe-settlement
- /legal/deal/dispute-rules
- /legal/deal/pep
- /legal/deal/notices

## Как подтверждать (акцепт) и что логировать

A) Подписание договора
- чекбокс «Согласен с договором и приложениями»
- (если первыи раз) чекбокс «Согласен с ПЭП»
- OTP → ввод → «Подписать»

B) Перед оплатой
- показать payment_ui_short.md
- чекбокс «Понимаю механику удержания средств банком»

C) Подписание акта
- подпись обеих сторон ПЭП → релиз в банк

D) Претензия до релиза
- кнопка «Открыть претензию» до релиза
- форма + evidence + ссылка на dispute_rules.md

Минимальныи audit trail:
- deal_id, doc_id, doc_type, doc_version, doc_hash
- signer_id, signer_role
- accepted_at, ip, user_agent
- otp_channel, otp_verified
- event_type
