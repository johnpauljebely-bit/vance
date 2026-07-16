"""Branded email service for VANCE.

Uses one shared HTML template (`render_email`) for all 7 automated
transactional emails. If SMTP fails or credentials are missing, emails are
logged to stdout instead of raising — so the app stays functional during
local dev / phased credential rollout.
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger("vance.email")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "hello@vance.design")

VANCE_LOGO_WHITE = (
    "https://customer-assets-lxgj4vgw.emergentagent.net/"
    "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/"
    "jlsm9cq4_Untitled%20design%20%285%29.png"
)

_DISCLAIMER = (
    "This email was sent automatically. Replies to this address are not "
    "monitored. To get in touch, please use your Client Portal, or submit a "
    "new commission request through the website."
)


def render_email(
    *,
    headline: str,
    body_html: str,
    button_label: Optional[str] = None,
    button_link: Optional[str] = None,
) -> str:
    """Build a single, on-brand HTML email.

    body_html should be already-safe HTML (paragraphs, line breaks, etc.).
    """
    button_html = ""
    if button_label and button_link:
        button_html = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
          <tr>
            <td align="center" style="border-radius:999px; background:#FF6B35;">
              <a href="{button_link}" style="display:inline-block; padding:14px 28px; font-family:'Poppins',Arial,sans-serif; font-weight:600; font-size:14px; color:#ffffff; text-decoration:none; border-radius:999px;">{button_label}</a>
            </td>
          </tr>
        </table>"""

    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{headline}</title>
  </head>
  <body style="margin:0; padding:0; background:#F7F5F2; font-family:'Poppins', Arial, Helvetica, sans-serif; color:#1A1A1A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;">
      <tr>
        <td align="center" style="padding:0;">

          <!-- Header bar -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#1A1A1A;">
            <tr>
              <td align="center" style="padding:24px 24px;">
                <img src="{VANCE_LOGO_WHITE}" alt="Vance" width="42" height="42" style="display:block; margin:0 auto;" />
                <div style="font-family:'Poppins',Arial,sans-serif; font-weight:700; letter-spacing:-0.02em; font-size:14px; color:#ffffff; margin-top:8px;">
                  vance<span style="color:#FF6B35;">.</span>
                </div>
              </td>
            </tr>
          </table>

          <!-- Content card -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; margin:24px 20px;">
            <tr>
              <td style="padding:40px 40px 32px;">
                <h1 style="margin:0 0 20px; font-family:'Poppins',Arial,sans-serif; font-weight:700; font-size:26px; line-height:1.15; letter-spacing:-0.02em; color:#1A1A1A;">{headline}</h1>
                <div style="font-family:'Poppins',Arial,sans-serif; font-size:15px; line-height:1.65; color:#1A1A1A;">
                  {body_html}
                </div>
                {button_html}
              </td>
            </tr>
          </table>

          <!-- Disclaimer -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 40px 24px; font-family:'Poppins',Arial,sans-serif; font-size:11px; line-height:1.5; color:#8A8588; font-style:italic;">
                {_DISCLAIMER}
              </td>
            </tr>
          </table>

          <!-- Footer bar -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#1A1A1A;">
            <tr>
              <td align="center" style="padding:20px 24px; font-family:'Poppins',Arial,sans-serif; font-size:11px; color:rgba(255,255,255,0.5); letter-spacing:0.14em; text-transform:uppercase;">
                Vancouver, BC, Canada
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>"""


def _log_only(to: str, subject: str, html: str) -> None:
    logger.info("EMAIL(log-only) to=%s subject=%s bytes=%d", to, subject, len(html))
    # Log a short preview so devs can see contents in supervisor logs.
    preview = html[:280].replace("\n", " ")
    logger.info("EMAIL preview: %s...", preview)


def send_email(*, to: str, subject: str, html: str) -> bool:
    """Send an email. Returns True on success. Falls back to console-log on failure."""
    subject_full = f"{subject} | Do Not Reply"
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP creds missing — logging email instead of sending")
        _log_only(to, subject_full, html)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject_full
    msg["From"] = f"Vance <{FROM_EMAIL}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        # App-password strings may contain spaces (Google displays them that way).
        password = SMTP_PASSWORD.replace(" ", "")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, password)
            server.sendmail(FROM_EMAIL, [to], msg.as_string())
        logger.info("Email sent → %s (%s)", to, subject_full)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Email send failed to %s: %s — falling back to log", to, exc)
        _log_only(to, subject_full, html)
        return False


# ---------------------------------------------------------------------- 7 triggers
def portal_url(path: str = "") -> str:
    base = os.environ.get("PUBLIC_URL", "https://vance-wip.preview.emergentagent.com").rstrip("/")
    return f"{base}{path}"


def email_request_accepted(*, to: str, name: str, order_id: str) -> None:
    body = f"""
      <p>Hey {name},</p>
      <p>Good news — I've accepted your commission request and I'm excited to get started.</p>
      <p>Next step: a <strong>50% deposit</strong> is required before work begins.</p>
      <p>Once that's in, you'll get access to your Client Portal where you can track progress and message me directly.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Commission Accepted",
        html=render_email(
            headline="Commission accepted",
            body_html=body,
            button_label="Pay Deposit",
            button_link=portal_url(f"/portal/orders/{order_id}"),
        ),
    )


def email_request_declined(*, to: str, name: str, reason: Optional[str] = None) -> None:
    reason_html = f" — {reason}" if reason else ""
    body = f"""
      <p>Hey {name},</p>
      <p>Thanks for reaching out about your project. Unfortunately I'm not able to take this one on right now{reason_html}.</p>
      <p>Feel free to check back later or reach out again down the line.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Commission Update",
        html=render_email(headline="Update on your commission request", body_html=body),
    )


def email_deposit_confirmed(*, to: str, name: str, order_id: str) -> None:
    body = f"""
      <p>Hey {name},</p>
      <p>Your deposit is confirmed and your project is officially in the queue.</p>
      <p>You can track progress anytime in your Client Portal.</p>
      <p>I'll be in touch as work gets underway.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Deposit Received",
        html=render_email(
            headline="Deposit received — you're in the queue.",
            body_html=body,
            button_label="View Portal",
            button_link=portal_url(f"/portal/orders/{order_id}"),
        ),
    )


def email_order_delivered(*, to: str, name: str, order_id: str) -> None:
    body = f"""
      <p>Hey {name},</p>
      <p>Your project is complete — head to your Client Portal to view and download everything.</p>
      <p>If a final payment is still outstanding, you can take care of that there too.</p>
      <p>Excited for you to see it.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Design Delivered",
        html=render_email(
            headline="Your design is ready.",
            body_html=body,
            button_label="View Delivery",
            button_link=portal_url(f"/portal/orders/{order_id}"),
        ),
    )


def email_review_request(*, to: str, name: str, order_id: str) -> None:
    body = f"""
      <p>Hey {name},</p>
      <p>Hope you're loving the final result. If you've got 60 seconds, I'd really appreciate a quick review.</p>
      <p>Thanks again for trusting me with your brand.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Leave a Review",
        html=render_email(
            headline="How did we do?",
            body_html=body,
            button_label="Leave a Review",
            button_link=portal_url(f"/portal/orders/{order_id}?tab=review"),
        ),
    )


def email_new_message(*, to: str, name: str, order_id: str, preview: str, from_side: str) -> None:
    who = "Vance" if from_side == "admin" else "your client"
    body = f"""
      <p>Hey {name},</p>
      <p>You've got a new message from {who} on your commission:</p>
      <blockquote style="margin:16px 0; padding:12px 16px; border-left:3px solid #FF6B35; background:#F7F5F2; font-style:italic; color:#1A1A1A;">
        {preview[:200]}
      </blockquote>
      <p>— Vance</p>
    """
    target = "/portal/orders/" if from_side == "admin" else "/admin/messages"
    send_email(
        to=to,
        subject="New Message",
        html=render_email(
            headline="New message",
            body_html=body,
            button_label="View Conversation",
            button_link=portal_url(f"{target}{order_id}"),
        ),
    )


def email_magic_link(*, to: str, name: str, link_token: str) -> None:
    body = f"""
      <p>Hey {name},</p>
      <p>Here's your one-time login link to access your Client Portal.</p>
      <p>This link expires in <strong>30 minutes</strong> for security. If you didn't request this, you can safely ignore this email.</p>
      <p>— Vance</p>
    """
    send_email(
        to=to,
        subject="Portal Login Link",
        html=render_email(
            headline="Your login link",
            body_html=body,
            button_label="Log In",
            button_link=portal_url(f"/portal/verify?token={link_token}"),
        ),
    )
