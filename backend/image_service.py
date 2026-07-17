"""Image processing service — watermarking and flat color variants.

- Manual watermark layers: opacity + admin-positioned/sized boxes (canvas editor).
- Auto corner watermark: brightness-detects the target corner, picks black/white
  brand logo for contrast, no warping — simple corner badge only.
- Logo kit: flat recolor / solid-background-swap variants, no warping.
- Dominant color extraction for accent tints.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

import numpy as np
import requests
from PIL import Image, ImageEnhance

logger = logging.getLogger("vance.image")

# Vance's own brand mark — used as the corner-watermark stamp on portfolio
# photos (not the client's project logo).
BRAND_LOGO_BLACK_URL = (
    "https://customer-assets-lxgj4vgw.emergentagent.net/"
    "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/2nhu3pin_Untitled%20design%20%284%29.png"
)
BRAND_LOGO_WHITE_URL = (
    "https://customer-assets-lxgj4vgw.emergentagent.net/"
    "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/jlsm9cq4_Untitled%20design%20%285%29.png"
)


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


def flatten_on_bg(logo: Image.Image, bg_hex: str) -> Image.Image:
    """Composite a logo onto a solid opaque background (no transparency)."""
    logo = logo.convert("RGBA")
    bg = Image.new("RGBA", logo.size, bg_hex)
    bg.alpha_composite(logo)
    return bg.convert("RGB")


def dominant_color_hex(logo: Image.Image) -> str:
    """Approx dominant color of opaque pixels — used as accent tint."""
    arr = np.array(logo.convert("RGBA"))
    mask = arr[..., 3] > 40
    if not mask.any():
        return "#F7F5F2"
    pixels = arr[mask][:, :3]
    avg = pixels.mean(axis=0).astype(int)
    return "#{:02X}{:02X}{:02X}".format(*avg)


# ---------------------------------------------------------- manual watermark (canvas editor)
def apply_watermark_layers(
    original_url_or_img,
    watermark_url_or_img,
    *,
    opacity: float = 0.35,
    instances: Optional[list[dict]] = None,
) -> bytes:
    """Composite one or more independently positioned/sized watermark layers
    over the original image — click-to-place / drag-to-move / drag-to-resize
    canvas editor. Each instance is {x_pct, y_pct, w_pct, h_pct}, fractions
    (0-1) of the base image's width/height so placement is resolution-
    independent between the browser preview and the full-size render.
    Opacity is a single global knob applied to every instance.
    """
    base = original_url_or_img if isinstance(original_url_or_img, Image.Image) else _download(original_url_or_img)
    wm_src = watermark_url_or_img if isinstance(watermark_url_or_img, Image.Image) else _download(watermark_url_or_img)

    base = base.convert("RGBA")
    wm_src = wm_src.convert("RGBA")

    if opacity < 1.0:
        alpha = wm_src.split()[3]
        alpha = ImageEnhance.Brightness(alpha).enhance(opacity)
        wm_src = wm_src.copy()
        wm_src.putalpha(alpha)

    canvas = base.copy()
    for inst in instances or [{"x_pct": 0.325, "y_pct": 0.325, "w_pct": 0.35, "h_pct": 0.35}]:
        w = max(1, int(base.width * inst["w_pct"]))
        h = max(1, int(base.height * inst["h_pct"]))
        x = int(base.width * inst["x_pct"])
        y = int(base.height * inst["y_pct"])
        resized = wm_src.resize((w, h), Image.LANCZOS)
        canvas.alpha_composite(resized, dest=(x, y))

    return _to_bytes(canvas)


# ---------------------------------------------------------- auto corner watermark
def _region_is_dark(img: Image.Image, *, corner: str = "bottom-right", region_pct: float = 0.25) -> bool:
    """Sample the target corner region and return True if it's dark enough
    that a white logo would read better than black."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    rw, rh = max(1, int(w * region_pct)), max(1, int(h * region_pct))
    if corner == "bottom-right":
        box = (w - rw, h - rh, w, h)
    elif corner == "bottom-left":
        box = (0, h - rh, rw, h)
    elif corner == "top-right":
        box = (w - rw, 0, w, rh)
    else:
        box = (0, 0, rw, rh)
    region = np.array(rgb.crop(box)).astype(float)
    luminance = 0.2126 * region[..., 0] + 0.7152 * region[..., 1] + 0.0722 * region[..., 2]
    return bool(luminance.mean() < 128)


def apply_corner_watermark(
    original_url_or_img,
    *,
    corner: str = "bottom-right",
    scale_pct: float = 0.14,
    padding_pct: float = 0.035,
    logo_black_url: str = BRAND_LOGO_BLACK_URL,
    logo_white_url: str = BRAND_LOGO_WHITE_URL,
) -> bytes:
    """Auto-detect corner brightness and stamp the contrasting brand logo
    (white on dark, black on light) as a small corner badge. No warping,
    no complex placement — a simple flat overlay."""
    base = original_url_or_img if isinstance(original_url_or_img, Image.Image) else _download(original_url_or_img)
    base = base.convert("RGBA")

    dark = _region_is_dark(base, corner=corner)
    logo = _download(logo_white_url if dark else logo_black_url).convert("RGBA")

    target_w = max(1, int(base.width * scale_pct))
    ratio = target_w / logo.width
    target_h = max(1, int(logo.height * ratio))
    logo_r = logo.resize((target_w, target_h), Image.LANCZOS)

    pad_x = int(base.width * padding_pct)
    pad_y = int(base.height * padding_pct)
    if corner == "bottom-right":
        x, y = base.width - target_w - pad_x, base.height - target_h - pad_y
    elif corner == "bottom-left":
        x, y = pad_x, base.height - target_h - pad_y
    elif corner == "top-right":
        x, y = base.width - target_w - pad_x, pad_y
    else:
        x, y = pad_x, pad_y

    canvas = base.copy()
    canvas.alpha_composite(logo_r, dest=(x, y))
    return _to_bytes(canvas)


# ---------------------------------------------------------- brand kit (flat variants only)
def generate_logo_kit(logo: Image.Image, *, accent_hex: str = "#1A1A1A") -> dict[str, bytes]:
    """Six flat recolor/background-swap logo variants — no warping, no
    placement logic. Returns {filename: png_bytes}."""
    logo = logo.convert("RGBA")
    black = recolor_logo(logo, "#000000")
    white = recolor_logo(logo, "#FFFFFF")

    return {
        "logo-black-transparent.png": _to_bytes(black),
        "logo-white-transparent.png": _to_bytes(white),
        "logo-black-white-bg.png": _to_bytes(flatten_on_bg(black, "#FFFFFF")),
        "logo-white-black-bg.png": _to_bytes(flatten_on_bg(white, "#000000")),
        "logo-color-accent-bg.png": _to_bytes(flatten_on_bg(logo, accent_hex)),
        "logo-color-transparent.png": _to_bytes(logo),
    }
