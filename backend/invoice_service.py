"""Simple branded PDF payment receipts, generated at payment-confirmation
time. Kept intentionally simple (fpdf2, a built-in font) rather than an
HTML-to-PDF pipeline — no system dependencies (Cairo/Pango etc.) to get
working on Render, and Poppins isn't bundled as a .ttf in this repo, so
receipts use a clean built-in font instead of true Poppins. Everything
else (brand colors, logo, layout) stays on-brand.
"""

from __future__ import annotations

import os
from datetime import datetime

from fpdf import FPDF

BRAND_ORANGE = (255, 107, 53)
INK = (26, 26, 26)
MUTED = (138, 133, 136)
LINE = (230, 230, 230)

_LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "logo-black.png")

_STAGE_LABELS = {"deposit": "Deposit (50%)", "final": "Final payment (50%)", "full": "Full payment"}


def generate_receipt_pdf(*, order: dict, stage: str, amount: float, method: str, receipt_number: str) -> bytes:
    pdf = FPDF(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    if os.path.exists(_LOGO_PATH):
        pdf.image(_LOGO_PATH, x=15, y=15, w=12)
    pdf.set_xy(32, 15)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*INK)
    pdf.cell(0, 8, "Vance", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(32)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 5, "Vancouver, BC, Canada", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(38)
    pdf.set_draw_color(*LINE)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(8)

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*INK)
    pdf.cell(0, 8, "Payment Receipt", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    date_str = datetime.now().strftime("%B %d, %Y")
    pdf.cell(0, 6, f"Receipt #{receipt_number}    ·    {date_str}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    def row(label: str, value: str) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*MUTED)
        pdf.cell(45, 7, label)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*INK)
        pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")

    row("Billed to:", f"{order.get('client_name', '')} <{order.get('client_email', '')}>")
    row("Project:", order.get("commission_type") or "Design project")
    row("Description:", (order.get("description") or "")[:80])
    row("Payment method:", method.title())
    row("Stage:", _STAGE_LABELS.get(stage, stage.title()))

    pdf.ln(6)
    pdf.set_draw_color(*LINE)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(8)

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*INK)
    pdf.cell(140, 10, "Amount paid")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*BRAND_ORANGE)
    pdf.cell(0, 10, f"${amount:.2f} USD", new_x="LMARGIN", new_y="NEXT", align="R")

    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        0, 5, "This receipt is generated automatically for your records. Reach out via your Client Portal with any questions."
    )

    return bytes(pdf.output())
