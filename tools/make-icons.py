#!/usr/bin/env python3
"""Draw the add-on's icon (a speaker with two sound waves on an orange square) into extension/icons/.

Original drawing, made for Neural Voices (GPL-3.0). Needs Pillow: pip install pillow
  python3 tools/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ORANGE = (232, 89, 12, 255)  # #e8590c, the add-on's accent colour
WHITE = (255, 255, 255, 255)
S = 512  # drawn large, then scaled down

im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle([16, 16, S - 16, S - 16], radius=120, fill=ORANGE)
# speaker
d.polygon([(110, 205), (175, 205), (255, 130), (255, 382), (175, 307), (110, 307)], fill=WHITE)
# sound waves
cx, cy = 255, 256
for r in (70, 140):
    d.arc([cx - r + 20, cy - r, cx + r + 20, cy + r], start=-50, end=50, fill=WHITE, width=30)

out = Path(__file__).resolve().parent.parent / "extension" / "icons"
for n in (16, 32, 48, 128):
    im.resize((n, n), Image.LANCZOS).save(out / f"icon{n}.png")
    print(f"extension/icons/icon{n}.png")
