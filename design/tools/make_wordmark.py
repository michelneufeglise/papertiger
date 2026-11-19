#!/opt/homebrew/bin/python3
"""DEV-ONLY asset tool (not part of the app build; the shipped app stays Node/TS only).

Turns design/title_paper_tiger.jpeg (black brush-ink lettering on textured cream paper)
into src/assets/wordmark-paper-tiger.png: a single-colour (#2a2522) RGBA mask where
darkness becomes opacity. The app renders it via CSS mask-image filled with var(--fg).

Usage (from repo root):  /opt/homebrew/bin/python3 design/tools/make_wordmark.py [preview.png]
Needs: Pillow, numpy.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "title_paper_tiger.jpeg"
OUT = ROOT / "src" / "assets" / "wordmark-paper-tiger.png"
PREVIEW = Path(sys.argv[1]) if len(sys.argv) > 1 else None
HEIGHT = 96          # 2x the 48px max display height
PAD = 3              # px of padding around the ink (at output size)
LO, HI = 0.30, 0.62  # levels: luminance <= LO is solid ink, >= HI is paper (transparent)
INK = (0x2a, 0x25, 0x22)

lum = np.asarray(Image.open(SRC).convert("L"), dtype=np.float32) / 255.0
# Flatten uneven paper: divide by a heavily blurred paper estimate (large-radius max-ish).
from PIL import ImageFilter
bg = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(40)), dtype=np.float32) / 255.0
lum = np.clip(lum / np.maximum(bg, 0.2), 0, 1)
alpha = np.clip((HI - lum) / (HI - LO), 0, 1)
alpha = alpha * alpha * (3 - 2 * alpha)  # smoothstep keeps soft dry-brush edges

ys, xs = np.where(alpha > 0.15)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
a = Image.fromarray((alpha * 255).astype(np.uint8)).crop(box)

inner_h = HEIGHT - 2 * PAD
w = round(a.width * inner_h / a.height)
a = a.resize((w, inner_h), Image.LANCZOS)
canvas = Image.new("L", (w + 2 * PAD, HEIGHT), 0)
canvas.paste(a, (PAD, PAD))

out = Image.new("RGBA", canvas.size, INK + (0,))
out.putalpha(canvas)
OUT.parent.mkdir(parents=True, exist_ok=True)
out.save(OUT, optimize=True)
print(f"{OUT.relative_to(ROOT)}: {out.width}x{out.height}, {OUT.stat().st_size/1024:.1f} KB, ratio {out.width/out.height:.4f}")

if PREVIEW:
    rows = []
    for bg_c, fg_c in (((0xf3, 0xea, 0xd6), INK), ((0x24, 0x21, 0x1e), (0xef, 0xe6, 0xd2))):
        for h in (40, 96):
            m = canvas.resize((round(canvas.width * h / HEIGHT), h), Image.LANCZOS)
            tile = Image.new("RGB", (m.width + 40, h + 24), bg_c)
            tile.paste(Image.new("RGB", m.size, fg_c), (20, 12), m)
            rows.append(tile)
    W = max(r.width for r in rows)
    sheet = Image.new("RGB", (W, sum(r.height for r in rows)), (128, 128, 128))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height
    sheet.save(PREVIEW)
