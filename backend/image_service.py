"""Image processing service — watermark, mockup placement, color variants.

- Watermark: centered, opacity/size configurable via Settings (Automation).
- Flat mockup placement: paste logo into an (x, y, w, h) zone.
- Angled mockup placement: 4-corner perspective warp via OpenCV.
- Auto color variants: recolor logo (black, white, or arbitrary hex) preserving alpha.
- Dominant color extraction for case-study page accent tint.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

import cv2
import numpy as np
import requests
from PIL import Image, ImageEnhance

logger = logging.getLogger("vance.image")


def _download(url: str) -> Image.Image:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGBA")


def _to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------- color variants
def recolor_logo(logo: Image.Image, hex_color: str) -> Image.Image:
    """Return a new image where opaque pixels are the given hex color,
    preserving the original alpha channel."""
    if len(hex_color) == 7 and hex_color.startswith("#"):
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
    else:
        r, g, b = 0, 0, 0

    arr = np.array(logo.convert("RGBA"))
    alpha = arr[..., 3:4]
    tinted = np.zeros_like(arr)
    tinted[..., 0] = r
    tinted[..., 1] = g
    tinted[..., 2] = b
    tinted[..., 3:4] = alpha
    return Image.fromarray(tinted, "RGBA")


def dominant_color_hex(logo: Image.Image) -> str:
    """Approx dominant color of opaque pixels — used as case-study accent tint."""
    arr = np.array(logo.convert("RGBA"))
    mask = arr[..., 3] > 40
    if not mask.any():
        return "#F7F5F2"
    pixels = arr[mask][:, :3]
    # Average color, biased toward saturated pixels
    avg = pixels.mean(axis=0).astype(int)
    return "#{:02X}{:02X}{:02X}".format(*avg)


# ---------------------------------------------------------- watermark
def apply_watermark(
    original_url_or_img,
    watermark_url_or_img,
    *,
    opacity: float = 0.35,
    size_pct: float = 0.35,
) -> bytes:
    """Composite the watermark at the CENTER of the original image.
    - opacity in [0, 1]
    - size_pct in (0, 1]: watermark width as fraction of original width
    Returns PNG bytes.
    """
    base = original_url_or_img if isinstance(original_url_or_img, Image.Image) else _download(original_url_or_img)
    wm = watermark_url_or_img if isinstance(watermark_url_or_img, Image.Image) else _download(watermark_url_or_img)

    base = base.convert("RGBA")
    wm = wm.convert("RGBA")

    # Scale watermark
    target_w = max(1, int(base.width * size_pct))
    ratio = target_w / wm.width
    target_h = max(1, int(wm.height * ratio))
    wm = wm.resize((target_w, target_h), Image.LANCZOS)

    # Apply opacity
    if opacity < 1.0:
        alpha = wm.split()[3]
        alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
        wm.putalpha(alpha)

    # Paste centered
    cx = (base.width - wm.width) // 2
    cy = (base.height - wm.height) // 2
    canvas = base.copy()
    canvas.alpha_composite(wm, dest=(cx, cy))

    return _to_bytes(canvas)


# ---------------------------------------------------------- flat placement
def place_flat(
    mockup_url_or_img,
    logo_url_or_img,
    *,
    zone: tuple[int, int, int, int],  # (x, y, w, h)
) -> bytes:
    """Paste (with alpha) the logo into a rectangular zone of the mockup.
    Logo is centered inside the zone at max size that fits, preserving aspect."""
    base = mockup_url_or_img if isinstance(mockup_url_or_img, Image.Image) else _download(mockup_url_or_img)
    logo = logo_url_or_img if isinstance(logo_url_or_img, Image.Image) else _download(logo_url_or_img)
    base = base.convert("RGBA")
    logo = logo.convert("RGBA")

    x, y, w, h = zone
    ar_zone = w / h
    ar_logo = logo.width / logo.height
    if ar_logo >= ar_zone:
        # Fit width
        new_w = w
        new_h = max(1, int(w / ar_logo))
    else:
        new_h = h
        new_w = max(1, int(h * ar_logo))

    logo_r = logo.resize((new_w, new_h), Image.LANCZOS)
    px = x + (w - new_w) // 2
    py = y + (h - new_h) // 2

    canvas = base.copy()
    canvas.alpha_composite(logo_r, dest=(px, py))
    return _to_bytes(canvas)


# ---------------------------------------------------------- angled placement
def place_angled(
    mockup_url_or_img,
    logo_url_or_img,
    *,
    corners: list[tuple[int, int]],  # 4 (x, y) points: TL, TR, BR, BL
) -> bytes:
    """Warp the logo into a quadrilateral defined by 4 corner points using
    OpenCV's perspective transform (same math as Photoshop Free Transform →
    Perspective). Preserves alpha."""
    base_pil = mockup_url_or_img if isinstance(mockup_url_or_img, Image.Image) else _download(mockup_url_or_img)
    logo_pil = logo_url_or_img if isinstance(logo_url_or_img, Image.Image) else _download(logo_url_or_img)
    base_pil = base_pil.convert("RGBA")
    logo_pil = logo_pil.convert("RGBA")

    base = np.array(base_pil)  # (H, W, 4)
    logo = np.array(logo_pil)

    lh, lw = logo.shape[:2]
    src = np.float32([[0, 0], [lw - 1, 0], [lw - 1, lh - 1], [0, lh - 1]])
    dst = np.float32(corners)
    M = cv2.getPerspectiveTransform(src, dst)

    Hb, Wb = base.shape[:2]
    warped = cv2.warpPerspective(
        logo, M, (Wb, Hb),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    # Alpha-composite warped over base
    warped_pil = Image.fromarray(warped, "RGBA")
    canvas = base_pil.copy()
    canvas.alpha_composite(warped_pil, dest=(0, 0))
    return _to_bytes(canvas)


# ---------------------------------------------------------- typography specimen
def make_typography_tile(
    logo_url_or_img,
    *,
    bg_hex: str = "#F7F5F2",
    width: int = 1200,
    height: int = 800,
) -> bytes:
    """Generate a big-letter typography specimen tile — Aa / 123 / punctuation
    layout, centered logo below. Used as an auto-generated case-study tile."""
    from PIL import ImageDraw, ImageFont

    logo = logo_url_or_img if isinstance(logo_url_or_img, Image.Image) else _download(logo_url_or_img)

    canvas = Image.new("RGB", (width, height), bg_hex)
    draw = ImageDraw.Draw(canvas)

    try:
        font_big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 260)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except Exception:
        font_big = ImageFont.load_default()
        font_small = ImageFont.load_default()

    draw.text((60, 60), "Aa", font=font_big, fill="#1A1A1A")
    draw.text((width - 260, 60), "01", font=font_big, fill="#FF6B35")
    draw.text((60, height - 90), "Poppins · Lora Italic", font=font_small, fill="#1A1A1A")

    # Composite logo bottom-right
    logo = logo.convert("RGBA")
    lh = 96
    lw = int(logo.width * (lh / logo.height))
    logo_r = logo.resize((lw, lh), Image.LANCZOS)
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(logo_r, dest=(width - lw - 60, height - lh - 60))

    return _to_bytes(canvas_rgba.convert("RGB"), fmt="PNG")


# ---------------------------------------------------------- pattern tile
def make_pattern_tile(
    logo_url_or_img,
    *,
    bg_hex: str = "#1A1A1A",
    logo_hex: str = "#FF6B35",
    width: int = 1200,
    height: int = 800,
    tile_size: int = 100,
    spacing: int = 60,
) -> bytes:
    """Diagonal repeat pattern with alternating rotation and generous spacing."""
    logo_raw = logo_url_or_img if isinstance(logo_url_or_img, Image.Image) else _download(logo_url_or_img)
    logo = recolor_logo(logo_raw, logo_hex).convert("RGBA")
    lw = tile_size
    lh = max(1, int(logo.height * (lw / logo.width)))
    logo = logo.resize((lw, lh), Image.LANCZOS)

    canvas = Image.new("RGB", (width, height), bg_hex).convert("RGBA")
    step = tile_size + spacing
    for row_idx, y in enumerate(range(-lh, height + step, step)):
        offset = (step // 2) if row_idx % 2 else 0
        for x in range(-lw + offset, width + step, step):
            rotated = logo.rotate(20 if row_idx % 2 == 0 else -20, expand=True, resample=Image.BICUBIC)
            canvas.alpha_composite(rotated, dest=(x, y))
    return _to_bytes(canvas.convert("RGB"), fmt="PNG")
