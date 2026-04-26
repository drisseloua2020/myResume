from __future__ import annotations
import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_support_email(*, to: str, subject: str, text: str) -> None:
    if not settings.smtp_host or not settings.smtp_port:
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST and SMTP_PORT.")
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if settings.smtp_secure:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(message)
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            try:
                server.starttls(); server.ehlo()
            except smtplib.SMTPException:
                pass
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(message)
