"""Document generator - HTML to PDF"""

import hashlib
from typing import Dict, Any

# WeasyPrint requires system libraries, make it optional
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    HTML = None
    WEASYPRINT_AVAILABLE = False


class DocumentGenerator:
    """Document generator service"""

    @staticmethod
    def render_template(template_html: str, context: Dict[str, Any]) -> str:
        """Render template with context"""
        rendered = template_html
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            rendered = rendered.replace(placeholder, str(value))
        return rendered

    @staticmethod
    def html_to_pdf(html_content: str) -> bytes:
        """Convert HTML to PDF"""
        if not WEASYPRINT_AVAILABLE:
            raise RuntimeError("WeasyPrint not installed. PDF generation unavailable.")
        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes

    @staticmethod
    def compute_hash(content: bytes) -> str:
        """Compute SHA-256 hash"""
        return hashlib.sha256(content).hexdigest()


class ContractTemplates:
    """Contract template library

    Шаблоны соответствуют требованиям:
    - ГК РФ глава 39 (возмездное оказание услуг)
    - 63-ФЗ "Об электронной подписи" (использование ПЭП)
    - 152-ФЗ "О персональных данных"
    """

    # =========================================================================
    # БАЗОВЫЕ СТИЛИ (общие для всех шаблонов)
    # =========================================================================
    BASE_STYLES = """
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
        }
        h1 {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 20px;
        }
        h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .header-left { text-align: left; }
        .header-right { text-align: right; }
        .section { margin-bottom: 15px; }
        .section p { margin: 5px 0; text-align: justify; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        table th, table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }
        table th {
            background: #f0f0f0;
            font-weight: bold;
        }
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            page-break-inside: avoid;
        }
        .signature-block {
            width: 45%;
        }
        .signature-block p {
            margin: 3px 0;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            height: 30px;
            margin: 20px 0 5px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            font-size: 9pt;
            color: #666;
        }
        .highlight {
            font-weight: bold;
        }
    """

    # =========================================================================
    # ДОГОВОР НА ПОДБОР ОБЪЕКТА (ПОКУПКА ВТОРИЧНОЙ НЕДВИЖИМОСТИ)
    # =========================================================================
    SECONDARY_BUY_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>Договор на оказание услуг</title>
    <style>""" + BASE_STYLES + """</style>
</head>
<body>
    <h1>ДОГОВОР N {{contract_number}}<br>НА ОКАЗАНИЕ УСЛУГ ПО ПОДБОРУ ОБЪЕКТА НЕДВИЖИМОСТИ</h1>

    <div class="header">
        <div class="header-left">г. Москва</div>
        <div class="header-right">{{contract_date}}</div>
    </div>

    <div class="section">
        <p><strong>{{executor_name}}</strong>, ИНН {{executor_inn}}, именуемый в дальнейшем "Исполнитель", с одной стороны, и</p>
        <p><strong>{{client_name}}</strong>, именуемый в дальнейшем "Заказчик", с другой стороны,</p>
        <p>совместно именуемые "Стороны", заключили настоящий Договор о нижеследующем:</p>
    </div>

    <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
    <div class="section">
        <p>1.1. Исполнитель обязуется оказать Заказчику комплекс услуг по подбору объекта недвижимости для приобретения, а Заказчик обязуется оплатить эти услуги в порядке и на условиях, предусмотренных настоящим Договором.</p>
        <p>1.2. Характеристики искомого объекта:</p>
        <p>Адрес/район поиска: <strong>{{property_address}}</strong></p>
        <p>1.3. Перечень услуг Исполнителя:</p>
        <p>- анализ рынка недвижимости и подбор вариантов;</p>
        <p>- организация и сопровождение просмотров объектов;</p>
        <p>- проверка юридической чистоты объекта;</p>
        <p>- подготовка и согласование условий сделки;</p>
        <p>- сопровождение сделки до момента государственной регистрации права собственности.</p>
    </div>

    <h2>2. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЕТОВ</h2>
    <div class="section">
        <p>2.1. Стоимость услуг Исполнителя составляет: <strong>{{commission_total}} ({{commission_words}}) рублей</strong>.</p>
        <p>2.2. Оплата производится в следующем порядке:</p>
        <table>
            <tr>
                <th>Этап</th>
                <th>Сумма, руб.</th>
                <th>Условие оплаты</th>
            </tr>
            {{payment_plan_rows}}
        </table>
        <p>2.3. Оплата производится путем безналичного перевода на реквизиты Исполнителя или через систему быстрых платежей (СБП).</p>
    </div>

    <h2>3. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
    <div class="section">
        <p><strong>3.1. Исполнитель обязуется:</strong></p>
        <p>3.1.1. Оказать услуги качественно и в разумные сроки;</p>
        <p>3.1.2. Информировать Заказчика о ходе оказания услуг;</p>
        <p>3.1.3. Сохранять конфиденциальность информации о Заказчике.</p>
        <p><strong>3.2. Заказчик обязуется:</strong></p>
        <p>3.2.1. Своевременно оплачивать услуги Исполнителя;</p>
        <p>3.2.2. Предоставлять необходимые документы и информацию;</p>
        <p>3.2.3. Не заключать договоры с третьими лицами на аналогичные услуги в период действия настоящего Договора.</p>
    </div>

    <h2>4. СРОК ДЕЙСТВИЯ ДОГОВОРА</h2>
    <div class="section">
        <p>4.1. Настоящий Договор вступает в силу с момента его подписания и действует до полного исполнения Сторонами своих обязательств.</p>
        <p>4.2. Срок оказания услуг: 6 (шесть) месяцев с даты подписания Договора.</p>
    </div>

    <h2>5. ПОРЯДОК РАСТОРЖЕНИЯ</h2>
    <div class="section">
        <p>5.1. Договор может быть расторгнут по соглашению Сторон.</p>
        <p>5.2. При расторжении Договора по инициативе Заказчика до начала оказания услуг — возврат 100% оплаченных средств.</p>
        <p>5.3. При расторжении после начала оказания услуг — возврат за вычетом стоимости фактически оказанных услуг.</p>
    </div>

    <h2>6. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
    <div class="section">
        <p>6.1. За неисполнение или ненадлежащее исполнение обязательств Стороны несут ответственность в соответствии с законодательством Российской Федерации.</p>
        <p>6.2. Споры разрешаются путем переговоров, при недостижении согласия — в суде по месту нахождения ответчика.</p>
    </div>

    <h2>7. ЭЛЕКТРОННАЯ ПОДПИСЬ</h2>
    <div class="section">
        <p>7.1. В соответствии со статьей 6 Федерального закона от 06.04.2011 N 63-ФЗ "Об электронной подписи" Стороны признают юридическую силу документов, подписанных простой электронной подписью (ПЭП).</p>
        <p>7.2. Ключом простой электронной подписи является одноразовый код, направляемый на номер телефона Стороны.</p>
        <p>7.3. Документ, подписанный ПЭП, признается равнозначным документу на бумажном носителе, подписанному собственноручной подписью.</p>
    </div>

    <h2>8. СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ</h2>
    <div class="section">
        <p>8.1. Подписывая настоящий Договор, Заказчик дает согласие на обработку персональных данных в соответствии с Федеральным законом от 27.07.2006 N 152-ФЗ "О персональных данных".</p>
    </div>

    <h2>9. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</h2>
    <div class="signatures">
        <div class="signature-block">
            <p><strong>ИСПОЛНИТЕЛЬ:</strong></p>
            <p>{{executor_name}}</p>
            <p>ИНН: {{executor_inn}}</p>
            <p>Тел: {{executor_phone}}</p>
            <div class="signature-line"></div>
            <p>Подпись / ПЭП</p>
        </div>
        <div class="signature-block">
            <p><strong>ЗАКАЗЧИК:</strong></p>
            <p>{{client_name}}</p>
            <p>Тел: {{client_phone}}</p>
            <div class="signature-line"></div>
            <p>Подпись / ПЭП</p>
        </div>
    </div>

    <div class="footer">
        <p>Документ подписан простой электронной подписью (ПЭП) в соответствии с 63-ФЗ.</p>
        <p>Идентификатор документа: {{document_hash}}</p>
    </div>
</body>
</html>
"""

    # =========================================================================
    # ДОГОВОР НА ПРОДАЖУ ОБЪЕКТА (ПРОДАЖА ВТОРИЧНОЙ НЕДВИЖИМОСТИ)
    # =========================================================================
    SECONDARY_SELL_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>Договор на оказание услуг по продаже</title>
    <style>""" + BASE_STYLES + """</style>
</head>
<body>
    <h1>ДОГОВОР N {{contract_number}}<br>НА ОКАЗАНИЕ УСЛУГ ПО ПРОДАЖЕ ОБЪЕКТА НЕДВИЖИМОСТИ</h1>

    <div class="header">
        <div class="header-left">г. Москва</div>
        <div class="header-right">{{contract_date}}</div>
    </div>

    <div class="section">
        <p><strong>{{executor_name}}</strong>, ИНН {{executor_inn}}, именуемый в дальнейшем "Исполнитель", с одной стороны, и</p>
        <p><strong>{{client_name}}</strong>, именуемый в дальнейшем "Заказчик" (Продавец), с другой стороны,</p>
        <p>совместно именуемые "Стороны", заключили настоящий Договор о нижеследующем:</p>
    </div>

    <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
    <div class="section">
        <p>1.1. Исполнитель обязуется оказать Заказчику комплекс услуг по продаже объекта недвижимости, а Заказчик обязуется оплатить эти услуги.</p>
        <p>1.2. Объект недвижимости:</p>
        <p>Адрес: <strong>{{property_address}}</strong></p>
        <p>1.3. Перечень услуг Исполнителя:</p>
        <p>- оценка рыночной стоимости объекта;</p>
        <p>- подготовка рекламных материалов и размещение объявлений;</p>
        <p>- организация показов объекта потенциальным покупателям;</p>
        <p>- ведение переговоров с покупателями;</p>
        <p>- подготовка и согласование условий сделки;</p>
        <p>- сопровождение сделки до момента государственной регистрации перехода права собственности.</p>
    </div>

    <h2>2. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЕТОВ</h2>
    <div class="section">
        <p>2.1. Стоимость услуг Исполнителя составляет: <strong>{{commission_total}} ({{commission_words}}) рублей</strong>.</p>
        <p>2.2. Оплата производится в следующем порядке:</p>
        <table>
            <tr>
                <th>Этап</th>
                <th>Сумма, руб.</th>
                <th>Условие оплаты</th>
            </tr>
            {{payment_plan_rows}}
        </table>
        <p>2.3. Оплата производится путем безналичного перевода или через СБП.</p>
    </div>

    <h2>3. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
    <div class="section">
        <p><strong>3.1. Исполнитель обязуется:</strong></p>
        <p>3.1.1. Приложить максимальные усилия для продажи объекта по оптимальной цене;</p>
        <p>3.1.2. Регулярно информировать Заказчика о ходе работ;</p>
        <p>3.1.3. Обеспечить конфиденциальность информации.</p>
        <p><strong>3.2. Заказчик обязуется:</strong></p>
        <p>3.2.1. Предоставить достоверную информацию об объекте;</p>
        <p>3.2.2. Обеспечить доступ для показов;</p>
        <p>3.2.3. Не заключать договоры с другими агентами на продажу данного объекта (эксклюзив);</p>
        <p>3.2.4. Своевременно оплачивать услуги Исполнителя.</p>
    </div>

    <h2>4. СРОК ДЕЙСТВИЯ ДОГОВОРА</h2>
    <div class="section">
        <p>4.1. Договор действует с момента подписания до полного исполнения обязательств.</p>
        <p>4.2. Эксклюзивный срок: 3 (три) месяца с даты подписания.</p>
    </div>

    <h2>5. ПОРЯДОК РАСТОРЖЕНИЯ</h2>
    <div class="section">
        <p>5.1. Договор может быть расторгнут по соглашению Сторон.</p>
        <p>5.2. При досрочном расторжении по инициативе Заказчика в эксклюзивный период — компенсация фактически понесенных расходов Исполнителя.</p>
    </div>

    <h2>6. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
    <div class="section">
        <p>6.1. Стороны несут ответственность за неисполнение обязательств в соответствии с законодательством РФ.</p>
    </div>

    <h2>7. ЭЛЕКТРОННАЯ ПОДПИСЬ</h2>
    <div class="section">
        <p>7.1. Стороны признают юридическую силу документов, подписанных простой электронной подписью (ПЭП) в соответствии с 63-ФЗ.</p>
        <p>7.2. Ключом ПЭП является одноразовый код, направляемый по SMS.</p>
    </div>

    <h2>8. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</h2>
    <div class="signatures">
        <div class="signature-block">
            <p><strong>ИСПОЛНИТЕЛЬ:</strong></p>
            <p>{{executor_name}}</p>
            <p>ИНН: {{executor_inn}}</p>
            <p>Тел: {{executor_phone}}</p>
            <div class="signature-line"></div>
            <p>Подпись / ПЭП</p>
        </div>
        <div class="signature-block">
            <p><strong>ЗАКАЗЧИК:</strong></p>
            <p>{{client_name}}</p>
            <p>Тел: {{client_phone}}</p>
            <div class="signature-line"></div>
            <p>Подпись / ПЭП</p>
        </div>
    </div>

    <div class="footer">
        <p>Документ подписан простой электронной подписью (ПЭП).</p>
        <p>Идентификатор: {{document_hash}}</p>
    </div>
</body>
</html>
"""

    # =========================================================================
    # ДОГОВОР НА БРОНИРОВАНИЕ НОВОСТРОЙКИ
    # =========================================================================
    NEWBUILD_BOOKING_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>Договор на услуги по бронированию</title>
    <style>""" + BASE_STYLES + """</style>
</head>
<body>
    <h1>ДОГОВОР N {{contract_number}}<br>НА ОКАЗАНИЕ УСЛУГ ПО БРОНИРОВАНИЮ КВАРТИРЫ В НОВОСТРОЙКЕ</h1>

    <div class="header">
        <div class="header-left">г. Москва</div>
        <div class="header-right">{{contract_date}}</div>
    </div>

    <div class="section">
        <p><strong>{{executor_name}}</strong>, ИНН {{executor_inn}}, именуемый в дальнейшем "Исполнитель", с одной стороны, и</p>
        <p><strong>{{client_name}}</strong>, именуемый в дальнейшем "Заказчик", с другой стороны,</p>
        <p>заключили настоящий Договор о нижеследующем:</p>
    </div>

    <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
    <div class="section">
        <p>1.1. Исполнитель обязуется оказать Заказчику услуги по подбору и бронированию квартиры в строящемся жилом комплексе.</p>
        <p>1.2. Параметры объекта:</p>
        <p>ЖК / Адрес: <strong>{{property_address}}</strong></p>
        <p>1.3. Перечень услуг:</p>
        <p>- консультирование по выбору жилого комплекса и застройщика;</p>
        <p>- подбор квартиры согласно требованиям Заказчика;</p>
        <p>- проверка надежности застройщика и проектной документации;</p>
        <p>- организация бронирования квартиры у застройщика;</p>
        <p>- сопровождение заключения ДДУ/договора купли-продажи;</p>
        <p>- содействие в получении ипотечного кредита (при необходимости).</p>
    </div>

    <h2>2. СТОИМОСТЬ УСЛУГ</h2>
    <div class="section">
        <p>2.1. Стоимость услуг: <strong>{{commission_total}} ({{commission_words}}) рублей</strong>.</p>
        <p>2.2. Порядок оплаты:</p>
        <table>
            <tr>
                <th>Этап</th>
                <th>Сумма, руб.</th>
                <th>Условие</th>
            </tr>
            {{payment_plan_rows}}
        </table>
        <p>2.3. Комиссия застройщика (при наличии) не входит в стоимость услуг и оплачивается отдельно.</p>
    </div>

    <h2>3. ОБЯЗАННОСТИ СТОРОН</h2>
    <div class="section">
        <p><strong>3.1. Исполнитель:</strong></p>
        <p>- предоставляет актуальную информацию о ЖК и ценах;</p>
        <p>- организует посещение офисов продаж и шоу-румов;</p>
        <p>- контролирует процесс бронирования.</p>
        <p><strong>3.2. Заказчик:</strong></p>
        <p>- предоставляет достоверные данные о себе;</p>
        <p>- своевременно принимает решения;</p>
        <p>- оплачивает услуги согласно графику.</p>
    </div>

    <h2>4. СРОК ОКАЗАНИЯ УСЛУГ</h2>
    <div class="section">
        <p>4.1. Услуги оказываются в течение 30 (тридцати) календарных дней с даты подписания Договора.</p>
        <p>4.2. Срок может быть продлен по соглашению Сторон.</p>
    </div>

    <h2>5. РАСТОРЖЕНИЕ ДОГОВОРА</h2>
    <div class="section">
        <p>5.1. Договор может быть расторгнут по соглашению Сторон.</p>
        <p>5.2. При отказе Заказчика от бронирования после его оформления — возврат за вычетом фактических расходов.</p>
    </div>

    <h2>6. ЭЛЕКТРОННАЯ ПОДПИСЬ</h2>
    <div class="section">
        <p>6.1. Договор подписывается простой электронной подписью (ПЭП) в соответствии с 63-ФЗ.</p>
        <p>6.2. Ключ ПЭП — одноразовый SMS-код.</p>
    </div>

    <h2>7. РЕКВИЗИТЫ И ПОДПИСИ</h2>
    <div class="signatures">
        <div class="signature-block">
            <p><strong>ИСПОЛНИТЕЛЬ:</strong></p>
            <p>{{executor_name}}</p>
            <p>ИНН: {{executor_inn}}</p>
            <p>Тел: {{executor_phone}}</p>
            <div class="signature-line"></div>
            <p>ПЭП</p>
        </div>
        <div class="signature-block">
            <p><strong>ЗАКАЗЧИК:</strong></p>
            <p>{{client_name}}</p>
            <p>Тел: {{client_phone}}</p>
            <div class="signature-line"></div>
            <p>ПЭП</p>
        </div>
    </div>

    <div class="footer">
        <p>Подписано ПЭП. ID: {{document_hash}}</p>
    </div>
</body>
</html>
"""

    # =========================================================================
    # АКТ ОКАЗАННЫХ УСЛУГ
    # =========================================================================
    ACT_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>Акт оказанных услуг</title>
    <style>""" + BASE_STYLES + """</style>
</head>
<body>
    <h1>АКТ N {{act_number}}<br>СДАЧИ-ПРИЕМКИ ОКАЗАННЫХ УСЛУГ</h1>

    <div class="header">
        <div class="header-left">г. Москва</div>
        <div class="header-right">{{act_date}}</div>
    </div>

    <div class="section">
        <p>К Договору N {{contract_number}} от {{contract_date}}</p>
    </div>

    <div class="section">
        <p><strong>{{executor_name}}</strong>, ИНН {{executor_inn}}, именуемый "Исполнитель", с одной стороны, и</p>
        <p><strong>{{client_name}}</strong>, именуемый "Заказчик", с другой стороны,</p>
        <p>составили настоящий Акт о нижеследующем:</p>
    </div>

    <h2>1. ОКАЗАННЫЕ УСЛУГИ</h2>
    <div class="section">
        <p>1.1. Исполнитель оказал, а Заказчик принял следующие услуги:</p>
        <table>
            <tr>
                <th>N</th>
                <th>Наименование услуги</th>
                <th>Стоимость, руб.</th>
            </tr>
            <tr>
                <td>1</td>
                <td>{{service_description}}</td>
                <td>{{commission_total}}</td>
            </tr>
        </table>
        <p><strong>Итого: {{commission_total}} ({{commission_words}}) рублей.</strong></p>
    </div>

    <h2>2. РЕЗУЛЬТАТ ОКАЗАНИЯ УСЛУГ</h2>
    <div class="section">
        <p>2.1. Объект недвижимости: {{property_address}}</p>
        <p>2.2. Результат: {{deal_result}}</p>
    </div>

    <h2>3. ЗАКЛЮЧЕНИЕ</h2>
    <div class="section">
        <p>3.1. Услуги оказаны в полном объеме, в установленные сроки, качественно.</p>
        <p>3.2. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.</p>
        <p>3.3. Настоящий Акт является основанием для окончательного расчета.</p>
    </div>

    <div class="signatures">
        <div class="signature-block">
            <p><strong>ИСПОЛНИТЕЛЬ:</strong></p>
            <p>{{executor_name}}</p>
            <p>Услуги оказал:</p>
            <div class="signature-line"></div>
        </div>
        <div class="signature-block">
            <p><strong>ЗАКАЗЧИК:</strong></p>
            <p>{{client_name}}</p>
            <p>Услуги принял:</p>
            <div class="signature-line"></div>
        </div>
    </div>

    <div class="footer">
        <p>Подписано ПЭП. ID: {{document_hash}}</p>
    </div>
</body>
</html>
"""

    @classmethod
    def get_template(cls, template_type: str) -> str:
        """Get template by type"""
        templates = {
            "secondary_buy": cls.SECONDARY_BUY_TEMPLATE,
            "secondary_sell": cls.SECONDARY_SELL_TEMPLATE,
            "newbuild_booking": cls.NEWBUILD_BOOKING_TEMPLATE,
            "act": cls.ACT_TEMPLATE,
        }
        # Fallback to secondary_buy if type not found
        return templates.get(template_type, cls.SECONDARY_BUY_TEMPLATE)

    @classmethod
    def get_available_types(cls) -> list:
        """Get list of available template types"""
        return ["secondary_buy", "secondary_sell", "newbuild_booking", "act"]
