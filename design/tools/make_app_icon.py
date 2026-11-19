#!/opt/homebrew/bin/python3
"""DEV-ONLY asset tool (not part of the app build; the shipped app stays Node/TS only).

Renders design/app-icon.png (1024x1024, macOS icon grid): a cream paper squircle with an
ink border and the pencil "idle" tiger cut from design/tiger-emotions-sheet.jpg at native
resolution (reuses the cutter's logic).

Usage (from repo root):  /opt/homebrew/bin/python3 design/tools/make_app_icon.py [preview.png]
Then: npx tauri icon design/app-icon.png && rm -rf src-tauri/icons/{android,ios}
Needs: Pillow, numpy, scipy.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).resolve().parent))
import cut_tiger_sheet as ct

ROOT = ct.ROOT
OUT = ROOT / "design" / "app-icon.png"
PREVIEW = Path(sys.argv[1]) if len(sys.argv) > 1 else None

S = 1024
BODY, RADIUS = 824, 185
INK = (0x2a, 0x25, 0x22)
SS = 2  # supersample for clean edges


def squircle_mask(size, body, radius):
    big = size * SS
    m = Image.new("L", (big, big), 0)
    o = (big - body * SS) // 2
    ImageDraw.Draw(m).rounded_rectangle((o, o, o + body * SS - 1, o + body * SS - 1), radius * SS, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def tiger():
    img = Image.open(ct.SRC)
    t = ct.drop_edge_specks(ct.cut(img, 0, 0), "idle")
    a = np.asarray(t).astype(np.float32)
    lum = a[..., :3].mean(axis=2)
    # treat the sprite as graphite only: paper-coloured fill becomes transparent so the
    # squircle paper shows through; a gentle curve keeps the lines legible at 16-32px
    ink = np.clip((228 - lum) / 200, 0, 1)
    ink = np.clip(ink ** 0.75 * 1.2, 0, 1) * (a[..., 3] / 255.0)
    rgb = np.broadcast_to(np.array(INK, np.float32), lum.shape + (3,))
    out = np.dstack([rgb, ink * 255]).astype(np.uint8)
    return Image.fromarray(out)


def main():
    rng = np.random.default_rng(7)
    mask = squircle_mask(S, BODY, RADIUS)
    # paper gradient + grain
    yy = np.linspace(0, 1, S)[:, None]
    c0 = np.array([0xfb, 0xf6, 0xea], np.float32)
    c1 = np.array([0xf3, 0xea, 0xd6], np.float32)
    paper = c0 * (1 - yy[..., None]) + c1 * yy[..., None]
    paper = np.broadcast_to(paper, (S, S, 3)).copy()
    grain = ndi_blur(rng.normal(0, 1, (S, S)).astype(np.float32))
    paper += grain[..., None] * 3.5
    body = Image.fromarray(np.clip(paper, 0, 255).astype(np.uint8)).convert("RGBA")

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # soft drop shadow + hard offset ink shadow
    sh = Image.new("RGBA", (S, S), INK + (0,))
    sa = mask.point(lambda v: int(v * 0.28)).filter(ImageFilter.GaussianBlur(14))
    sh.putalpha(sa)
    canvas.alpha_composite(sh, (0, 14))
    hard = Image.new("RGBA", (S, S), INK + (0,))
    hard.putalpha(mask.point(lambda v: int(v * 0.22)))
    canvas.alpha_composite(hard, (0, 10))
    body.putalpha(mask)
    canvas.alpha_composite(body)

    # tiger
    t = tiger()
    th = int(BODY * 0.74)
    tw = int(t.width * th / t.height)
    if tw > BODY * 0.82:
        tw = int(BODY * 0.82)
        th = int(t.height * tw / t.width)
    t = t.resize((tw, th), Image.LANCZOS)
    top = (S - BODY) // 2
    x = (S - tw) // 2
    y = top + BODY - th - int(BODY * 0.07)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer.alpha_composite(t, (x, y))
    canvas.alpha_composite(layer)

    # ink border
    ring = Image.new("L", (S, S), 0)
    ImageDraw.Draw(ring).rounded_rectangle((0, 0, 1, 1), 1)  # placeholder
    inner = squircle_mask(S, BODY - 14, RADIUS - 7)
    border = Image.new("RGBA", (S, S), INK + (255,))
    ba = np.clip(np.asarray(mask, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8)
    border.putalpha(Image.fromarray(ba))
    canvas.alpha_composite(border)

    canvas.save(OUT)
    print("wrote", OUT, "tiger", t.size)

    if PREVIEW:
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        sizes = [128, 64, 32, 16]
        W = 1024 + sum(sizes) + 40 * (len(sizes) + 2)
        strip = Image.new("RGB", (W, 2 * 1100), (0xec, 0xec, 0xec))
        for k, bg in enumerate([(0xec, 0xec, 0xec), (0x1e, 0x1e, 0x1e)]):
            ImageDraw.Draw(strip).rectangle((0, k * 1100, W, (k + 1) * 1100), fill=bg)
            xx = 40
            strip.paste(canvas, (xx, k * 1100 + 38), canvas)
            xx += 1024 + 40
            for s in sizes:
                sm = canvas.resize((s, s), Image.LANCZOS)
                strip.paste(sm, (xx, k * 1100 + 38 + 1024 - s), sm)
                xx += s + 40
        strip.save(PREVIEW)


def ndi_blur(a):
    from scipy import ndimage as ndi
    return ndi.gaussian_filter(a, 0.8) * 2.2


if __name__ == "__main__":
    main()
