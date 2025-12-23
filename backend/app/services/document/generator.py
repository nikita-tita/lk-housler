"""Document generator - HTML to PDF"""

import hashlib
from typing import Dict, Any
from io import BytesIO

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
        # Simple template rendering (можно заменить на Jinja2)
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
    """Contract template library"""
    
    SECONDARY_BUY_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { text-align: center; font-size: 18px; }
        .section { margin: 20px 0; }
        .signature { margin-top: 50px; display: flex; justify-content: space-between; }
        .signature-block { width: 45%; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border: 1px solid #ddd; }
    </style>
</head>
<body>
    <h1>ДОГОВОР НА ОКАЗАНИЕ УСЛУГ ПО ПОДБОРУ ОБЪЕКТА НЕДВИЖИМОСТИ</h1>
    
    <div class="section">
        <p><strong>г. Москва</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{{contract_date}}</p>
    </div>
    
    <div class="section">
        <p><strong>Исполнитель:</strong> {{executor_name}}, ИНН {{executor_inn}}</p>
        <p><strong>Заказчик (Клиент):</strong> {{client_name}}, тел. {{client_phone}}</p>
    </div>
    
    <div class="section">
        <h3>1. ПРЕДМЕТ ДОГОВОРА</h3>
        <p>1.1. Исполнитель обязуется оказать Заказчику услуги по подбору объекта недвижимости 
        по адресу: {{property_address}}</p>
        <p>1.2. Тип сделки: {{deal_type}}</p>
    </div>
    
    <div class="section">
        <h3>2. СТОИМОСТЬ УСЛУГ</h3>
        <p>2.1. Стоимость услуг Исполнителя составляет: <strong>{{commission_total}} руб.</strong></p>
        <p>2.2. График оплаты:</p>
        <table>
            <tr>
                <td><strong>Этап</strong></td>
                <td><strong>Сумма</strong></td>
                <td><strong>Условие</strong></td>
            </tr>
            {{payment_plan_rows}}
        </table>
    </div>
    
    <div class="section">
        <h3>3. ПОРЯДОК СДАЧИ И ПРИЕМКИ РАБОТ</h3>
        <p>3.1. Услуги считаются оказанными после подписания актов выполненных работ.</p>
    </div>
    
    <div class="section">
        <h3>4. ОТВЕТСТВЕННОСТЬ СТОРОН</h3>
        <p>4.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность 
        в соответствии с действующим законодательством РФ.</p>
    </div>
    
    <div class="section">
        <h3>5. ПОРЯДОК РАСТОРЖЕНИЯ ДОГОВОРА</h3>
        <p>5.1. Договор может быть расторгнут по соглашению сторон.</p>
        <p>5.2. При расторжении до начала оказания услуг - полный возврат средств.</p>
    </div>
    
    <div class="section">
        <h3>6. ЭЛЕКТРОННАЯ ПОДПИСЬ</h3>
        <p>6.1. Стороны согласились использовать простую электронную подпись (ПЭП) 
        в соответствии с 63-ФЗ "Об электронной подписи".</p>
        <p>6.2. Ключом ПЭП является код, полученный на номер телефона.</p>
    </div>
    
    <div class="signature">
        <div class="signature-block">
            <p><strong>Исполнитель:</strong></p>
            <p>{{executor_name}}</p>
            <p>ИНН: {{executor_inn}}</p>
            <p>_________________</p>
        </div>
        <div class="signature-block">
            <p><strong>Заказчик:</strong></p>
            <p>{{client_name}}</p>
            <p>Телефон: {{client_phone}}</p>
            <p>_________________</p>
        </div>
    </div>
    
    <div class="section" style="margin-top: 30px; font-size: 10px; color: #666;">
        <p>Документ подписан электронной подписью.</p>
        <p>Hash документа: {{document_hash}}</p>
    </div>
</body>
</html>
"""
    
    @classmethod
    def get_template(cls, template_type: str) -> str:
        """Get template by type"""
        templates = {
            "secondary_buy": cls.SECONDARY_BUY_TEMPLATE,
            "secondary_sell": cls.SECONDARY_BUY_TEMPLATE,  # Пока тот же
        }
        return templates.get(template_type, cls.SECONDARY_BUY_TEMPLATE)

