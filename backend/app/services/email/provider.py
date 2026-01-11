"""Email provider interface and implementations

Поддерживаемые провайдеры:
- mock: Тестовый режим (логирование в консоль)
- smtp: Yandex 360 / любой SMTP сервер

Настройки Yandex 360:
- SMTP_HOST: smtp.yandex.ru
- SMTP_PORT: 465 (SSL) или 587 (STARTTLS)
- SMTP_USE_SSL: true для порта 465
- SMTP_USER: email@yandex.ru или email@domain.ru
- SMTP_PASSWORD: пароль приложения (не основной пароль!)
"""

from abc import ABC, abstractmethod
from typing import Optional, List
import smtplib
import ssl
import logging
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailProvider(ABC):
    """Abstract email provider"""

    @abstractmethod
    async def send(
        self, to_email: str, subject: str, body: str, html: bool = False, reply_to: Optional[str] = None
    ) -> bool:
        """Send email"""
        pass

    @abstractmethod
    async def send_bulk(self, to_emails: List[str], subject: str, body: str, html: bool = False) -> int:
        """Send bulk emails, returns count of successful sends"""
        pass


class MockEmailProvider(EmailProvider):
    """Mock email provider for development"""

    async def send(
        self, to_email: str, subject: str, body: str, html: bool = False, reply_to: Optional[str] = None
    ) -> bool:
        """Mock send - log without exposing sensitive content (OTP codes)"""
        # SECURITY: Never log email body as it may contain OTP codes
        logger.info(f"[Email Mock] Email sent to: {to_email} | Subject: {subject}")
        print(f"\n{'='*60}")
        print(f"[Email Mock] Email sent to: {to_email}")
        print(f"[Email Mock] Subject: {subject}")
        if reply_to:
            print(f"[Email Mock] Reply-To: {reply_to}")
        print(f"[Email Mock] HTML: {html}")
        print("[Email Mock] Body: (hidden for security)")
        print(f"{'='*60}\n")
        return True

    async def send_bulk(self, to_emails: List[str], subject: str, body: str, html: bool = False) -> int:
        """Mock bulk send"""
        for email in to_emails:
            await self.send(email, subject, body, html)
        return len(to_emails)


class SMTPEmailProvider(EmailProvider):
    """
    SMTP email provider for production

    Tested with:
    - Yandex 360 (smtp.yandex.ru)
    - Gmail (smtp.gmail.com)
    - Mail.ru (smtp.mail.ru)
    """

    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        from_email: str,
        from_name: str = "Housler",
        use_ssl: bool = True,
        use_tls: bool = False,
        timeout: int = 30,
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.from_name = from_name
        self.use_ssl = use_ssl
        self.use_tls = use_tls
        self.timeout = timeout

    def _create_message(
        self, to_email: str, subject: str, body: str, html: bool = False, reply_to: Optional[str] = None
    ) -> MIMEMultipart:
        """Create email message"""
        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((self.from_name, self.from_email))
        msg["To"] = to_email
        msg["Subject"] = subject

        if reply_to:
            msg["Reply-To"] = reply_to

        # Add plain text version
        if html:
            # Strip HTML for plain text fallback
            import re

            plain_text = re.sub(r"<[^>]+>", "", body)
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(body, "plain", "utf-8"))

        return msg

    def _get_smtp_connection(self):
        """Get SMTP connection based on settings"""
        context = ssl.create_default_context()

        if self.use_ssl:
            # Port 465 with SSL
            return smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=self.timeout)
        else:
            # Port 587 with STARTTLS
            return smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=self.timeout)

    async def send(
        self, to_email: str, subject: str, body: str, html: bool = False, reply_to: Optional[str] = None
    ) -> bool:
        """Send email via SMTP"""
        try:
            msg = self._create_message(to_email, subject, body, html, reply_to)

            with self._get_smtp_connection() as server:
                if self.use_tls and not self.use_ssl:
                    server.starttls()

                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"[Email] Sent to {to_email}, Subject: {subject}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"[Email Auth Error] Check SMTP credentials: {e}")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"[Email Recipient Error] Invalid email {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"[Email Error] {type(e).__name__}: {e}")
            return False

    async def send_bulk(self, to_emails: List[str], subject: str, body: str, html: bool = False) -> int:
        """Send bulk emails via single SMTP connection"""
        success_count = 0

        try:
            with self._get_smtp_connection() as server:
                if self.use_tls and not self.use_ssl:
                    server.starttls()

                server.login(self.smtp_user, self.smtp_password)

                for to_email in to_emails:
                    try:
                        msg = self._create_message(to_email, subject, body, html)
                        server.send_message(msg)
                        success_count += 1
                    except Exception as e:
                        logger.error(f"[Email Bulk Error] Failed for {to_email}: {e}")

            logger.info(f"[Email Bulk] Sent {success_count}/{len(to_emails)} emails")

        except Exception as e:
            logger.error(f"[Email Bulk Connection Error] {e}")

        return success_count


class SendGridEmailProvider(EmailProvider):
    """
    SendGrid HTTP API provider

    Используется когда SMTP порты заблокированы хостингом.
    Работает через HTTPS (порт 443).

    Free tier: 100 emails/day
    """

    def __init__(self, api_key: str, from_email: str, from_name: str = "Housler", timeout: int = 30):
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name
        self.timeout = timeout
        self.api_url = "https://api.sendgrid.com/v3/mail/send"

    async def send(
        self, to_email: str, subject: str, body: str, html: bool = False, reply_to: Optional[str] = None
    ) -> bool:
        """Send email via SendGrid API"""
        try:
            content_type = "text/html" if html else "text/plain"

            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email, "name": self.from_name},
                "subject": subject,
                "content": [{"type": content_type, "value": body}],
            }

            if reply_to:
                payload["reply_to"] = {"email": reply_to}

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                )

            if response.status_code in (200, 202):
                logger.info(f"[SendGrid] Sent to {to_email}, Subject: {subject}")
                return True
            else:
                logger.error(f"[SendGrid Error] {response.status_code}: {response.text}")
                return False

        except Exception as e:
            logger.error(f"[SendGrid Error] {type(e).__name__}: {e}")
            return False

    async def send_bulk(self, to_emails: List[str], subject: str, body: str, html: bool = False) -> int:
        """Send bulk emails via SendGrid"""
        success_count = 0
        for email in to_emails:
            if await self.send(email, subject, body, html):
                success_count += 1
        return success_count


def get_email_provider() -> EmailProvider:
    """Get email provider based on settings

    Supported providers:
    - mock: Development (logs to console)
    - smtp: Yandex 360 / any SMTP server (requires open ports 465/587)
    - sendgrid: SendGrid HTTP API (works when SMTP ports are blocked)
    """
    email_provider = getattr(settings, "EMAIL_PROVIDER", "mock")

    if email_provider == "mock":
        return MockEmailProvider()

    elif email_provider == "smtp":
        # Yandex 360: use SSL for port 465, TLS for port 587
        use_ssl = getattr(settings, "SMTP_USE_SSL", settings.SMTP_PORT == 465)
        use_tls = getattr(settings, "SMTP_USE_TLS", settings.SMTP_PORT == 587)

        return SMTPEmailProvider(
            smtp_host=settings.SMTP_HOST,
            smtp_port=settings.SMTP_PORT,
            smtp_user=settings.SMTP_USER,
            smtp_password=settings.SMTP_PASSWORD,
            from_email=settings.SMTP_FROM_EMAIL,
            from_name=settings.SMTP_FROM_NAME,
            use_ssl=use_ssl,
            use_tls=use_tls,
        )

    elif email_provider == "sendgrid":
        # SendGrid HTTP API - works when SMTP ports are blocked
        api_key = getattr(settings, "SENDGRID_API_KEY", "")
        if not api_key:
            logger.error("[Email] SendGrid API key not configured, using Mock")
            return MockEmailProvider()

        return SendGridEmailProvider(
            api_key=api_key, from_email=settings.SMTP_FROM_EMAIL, from_name=settings.SMTP_FROM_NAME
        )

    else:
        logger.warning(f"Unknown email provider: {email_provider}, using Mock")
        return MockEmailProvider()


# =============================================================================
# Email Templates
# =============================================================================


def _get_email_footer() -> str:
    """Common email footer"""
    return f"""
--
С уважением,
Команда Housler
{settings.COMPANY_EMAIL}

{settings.COMPANY_NAME}
ИНН {settings.COMPANY_INN}
"""


def _get_html_wrapper(content: str) -> str:
    """Wrap content in HTML template"""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #181A20;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .code {{
            font-size: 32px;
            font-weight: 600;
            letter-spacing: 4px;
            background: #F3F4F6;
            padding: 16px 24px;
            border-radius: 8px;
            display: inline-block;
            margin: 16px 0;
        }}
        .footer {{
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #E5E7EB;
            font-size: 14px;
            color: #6B7280;
        }}
        .button {{
            display: inline-block;
            background: #181A20;
            color: #FFFFFF;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            margin: 16px 0;
        }}
    </style>
</head>
<body>
{content}
<div class="footer">
    С уважением,<br>
    Команда Housler<br>
    <a href="mailto:{settings.COMPANY_EMAIL}">{settings.COMPANY_EMAIL}</a><br><br>
    {settings.COMPANY_NAME}<br>
    ИНН {settings.COMPANY_INN}
</div>
</body>
</html>
"""


# =============================================================================
# Email Helpers
# =============================================================================


async def send_otp_email(email: str, code: str) -> bool:
    """Send OTP code via email"""
    provider = get_email_provider()

    subject = "Код подтверждения Housler"

    html_content = f"""
<h2>Код подтверждения</h2>
<p>Добрый день!</p>
<p>Ваш код для входа в личный кабинет Housler:</p>
<div class="code">{code}</div>
<p>Код действителен {settings.OTP_EXPIRE_MINUTES} минут.</p>
<p>Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)


async def send_welcome_email(email: str, name: str) -> bool:
    """Send welcome email after registration"""
    provider = get_email_provider()

    subject = "Добро пожаловать в Housler"

    html_content = f"""
<h2>Добро пожаловать в Housler!</h2>
<p>Здравствуйте, {name}!</p>
<p>Вы успешно зарегистрировались в личном кабинете Housler.</p>
<p>Теперь вам доступны:</p>
<ul>
    <li>Просмотр статуса ваших сделок</li>
    <li>Документы и договоры</li>
    <li>История платежей</li>
    <li>Связь с вашим агентом</li>
</ul>
<a href="{settings.FRONTEND_URL}" class="button">Войти в личный кабинет</a>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)


async def send_deal_status_email(email: str, name: str, deal_id: int, status: str, message: str) -> bool:
    """Send deal status update email"""
    provider = get_email_provider()

    subject = f"Обновление по сделке #{deal_id}"

    html_content = f"""
<h2>Обновление статуса сделки</h2>
<p>Здравствуйте, {name}!</p>
<p>Статус вашей сделки <strong>#{deal_id}</strong> изменился.</p>
<p><strong>Новый статус:</strong> {status}</p>
<p>{message}</p>
<a href="{settings.FRONTEND_URL}/deals/{deal_id}" class="button">Подробнее о сделке</a>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)


async def send_document_ready_email(email: str, name: str, document_name: str, deal_id: int) -> bool:
    """Send notification when document is ready"""
    provider = get_email_provider()

    subject = "Документ готов к подписанию"

    html_content = f"""
<h2>Документ готов</h2>
<p>Здравствуйте, {name}!</p>
<p>Документ <strong>{document_name}</strong> готов к подписанию.</p>
<p>Вы можете подписать его в личном кабинете с помощью СМС-кода.</p>
<a href="{settings.FRONTEND_URL}/deals/{deal_id}/documents" class="button">Перейти к документам</a>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)


async def send_payment_received_email(email: str, name: str, amount: int, deal_id: int) -> bool:
    """Send payment confirmation email"""
    provider = get_email_provider()

    formatted_amount = f"{amount:,}".replace(",", " ")
    subject = f"Платеж получен - {formatted_amount} руб."

    html_content = f"""
<h2>Платеж получен</h2>
<p>Здравствуйте, {name}!</p>
<p>Мы получили ваш платеж на сумму <strong>{formatted_amount} руб.</strong></p>
<p>Средства будут зачислены в течение 1-2 рабочих дней.</p>
<a href="{settings.FRONTEND_URL}/deals/{deal_id}/payments" class="button">История платежей</a>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)


async def send_password_reset_email(email: str, code: str) -> bool:
    """Send password reset code"""
    provider = get_email_provider()

    subject = "Сброс пароля Housler"

    html_content = f"""
<h2>Сброс пароля</h2>
<p>Вы запросили сброс пароля для вашего аккаунта Housler.</p>
<p>Ваш код подтверждения:</p>
<div class="code">{code}</div>
<p>Код действителен {settings.OTP_EXPIRE_MINUTES} минут.</p>
<p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо. Ваш пароль не будет изменен.</p>
"""
    html = _get_html_wrapper(html_content)

    return await provider.send(email, subject, html, html=True)
