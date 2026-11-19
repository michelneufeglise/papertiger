#!/opt/homebrew/bin/python3
"""DEV-ONLY asset tool (not part of the app build; the shipped app stays Node/TS only).

Cuts design/tiger-emotions-sheet.jpg (6x6 pencil tigers) into 36 transparent
WebP sprites at src/assets/tiger/<state>.webp and writes a contact sheet.

Usage (from repo root):  /opt/homebrew/bin/python3 design/tools/cut_tiger_sheet.py [--sheet emotions|reading-writing] [contact.png]
Needs: Pillow, numpy, scipy.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "assets" / "tiger"

SHEETS = {
    "emotions": dict(
        src="tiger-emotions-sheet.jpg",
        scale=1792 / 1493,  # coordinates measured on a 1493px-wide preview
        cols=[(20, 275), (275, 515), (515, 750), (750, 978), (978, 1195), (1195, 1460)],
        # (top, label_top) per row; label_top may be overridden per cell
        rows=[(135, 400), (448, 712), (760, 1030), (1075, 1340), (1385, 1648), (1700, 1921)],
        label_top_override={(1, 3): 666, (3, 3): 1340},  # SLEEPING/SNEAKY two-line label
        # Two-line labels of the row above poke into these cells: start lower.
        top_override={(4, 3): 1412, (5, 0): 1727, (5, 1): 1727},
        names=("idle listening thinking talking happy sad surprised laughing shy sleeping bored angry "
               "scared excited disgusted confused cheerful frustrated sick shocked anxious proud doubtful lazy "
               "sad-hello waving-bye cuddly thirsty busy spooked nervous hopeful chilling wonder writing reading").split(),
        # Cells whose side/bottom-edge doodles are intended (zzz, sparkle, lightning, sweat, motion marks).
        keep_edge_doodles={"sleeping", "wonder", "scared", "doubtful", "spooked", "nervous", "sick", "listening"},
        side_speck_frac=0.015, bottom_speck_frac=0.002,
    ),
    "reading-writing": dict(
        src="tiger-reading-writing-sheet.jpg",
        scale=2.0,  # coordinates measured on a 896px-wide preview
        cols=[(20, 305), (305, 595), (595, 885)],
        rows=[(82, 332), (362, 618), (652, 868), (928, 1156)],
        label_top_override={(3, 2): 1128},
        top_override={(3, 0): 934, (3, 1): 934, (3, 2): 912},
        names="opening-book focused-reading turning-page amazed-reading sleepy-reading taking-notes "
              "picking-up-pencil thinking-before-writing writing-intently scribbling-fast erasing-mistake "
              "finished-page".split(),
        # props (zzz, motion marks, crumbs, loose pencil, held page) may touch the crop sides
        keep_edge_doodles={"amazed-reading", "sleepy-reading", "scribbling-fast", "erasing-mistake",
                           "thinking-before-writing", "finished-page", "turning-page", "picking-up-pencil",
                           "writing-intently"},
        side_speck_frac=0.004, bottom_speck_frac=0.0005,
    ),
}
CFG = SHEETS["emotions"]


PAPER_TOL = 26   # colour distance from paper treated as "paper"
SOFT = 55        # distance at which alpha reaches 1 in the background region


def cell_window(r, c):
    x0, x1 = CFG["cols"][c]
    top, lab = CFG["rows"][r]
    top = CFG["top_override"].get((r, c), top)
    lab = CFG["label_top_override"].get((r, c), lab)
    K = CFG["scale"]
    return int(x0 * K), int(top * K), int(x1 * K), int(lab * K)


def drop_edge_specks(im, name):
    """Drop small alpha components touching the left/right/bottom crop edge
    (fragments of neighbouring drawings), unless the state has intended doodles."""
    a = np.asarray(im.getchannel("A")) > 40
    lab, n = ndi.label(ndi.binary_dilation(a, iterations=2))
    total = a.sum()
    H, W = a.shape
    keep = np.ones_like(a)
    for i in range(1, n + 1):
        m = (lab == i) & a
        cnt = m.sum()
        if cnt == 0:
            continue
        ys, xs = np.nonzero(m)
        side = xs.min() <= 0 or xs.max() >= W - 1
        bottom = ys.max() >= H - 1
        if bottom and cnt < CFG["bottom_speck_frac"] * total:
            keep[lab == i] = False
        elif side and cnt < CFG["side_speck_frac"] * total and name not in CFG["keep_edge_doodles"]:
            keep[lab == i] = False
    alpha = np.asarray(im.getchannel("A")).copy()
    alpha[~keep] = 0
    im = im.copy()
    im.putalpha(Image.fromarray(alpha))
    bb = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(bb)


def cut(img, r, c):
    x0, y0, x1, y1 = cell_window(r, c)
    arr = np.asarray(img.crop((x0, y0, x1, y1)).convert("RGB")).astype(np.float32)
    paper = np.median(np.concatenate([arr[:3].reshape(-1, 3), arr[:, :3].reshape(-1, 3)]), axis=0)
    d = np.abs(arr - paper).max(axis=2)
    ink = d > 70
    # group strokes + doodles into components via heavy dilation
    grp, n = ndi.label(ndi.binary_dilation(ink, iterations=10))
    keep = np.zeros_like(ink)
    w = x1 - x0
    for i in range(1, n + 1):
        ys, xs = np.nonzero(grp == i)
        if (ink[ys, xs]).sum() < 12:
            continue
        cx = (xs.min() + xs.max()) / 2
        # neighbour fragments clip the window side edges; real parts are large
        if (xs.min() <= 0 or xs.max() >= w - 1) and ink[ys, xs].sum() < 400:
            continue
        if 0 <= cx < w and (r, c) != (-1, -1):
            keep[grp == i] = True
    keep &= ndi.binary_dilation(ink, iterations=10) | (d > 14)
    ys, xs = np.nonzero(keep & ink)
    m = 14
    bx0, bx1 = max(xs.min() - m, 0), min(xs.max() + m, arr.shape[1] - 1)
    by0, by1 = max(ys.min() - m, 0), min(ys.max() + m, arr.shape[0] - 1)
    a = arr[by0:by1 + 1, bx0:bx1 + 1]
    kp = keep[by0:by1 + 1, bx0:bx1 + 1]
    dd = d[by0:by1 + 1, bx0:bx1 + 1]
    # barrier = outlines (dilated to close gaps); flood the paper from the border
    barrier = ndi.binary_dilation(dd >= PAPER_TOL, iterations=2)
    free = ~barrier
    lab, _ = ndi.label(free)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    bg = ndi.binary_dilation(bg, iterations=2) & (dd < PAPER_TOL * 1.6) | bg
    alpha = np.where(bg, np.clip((dd - 6) / SOFT, 0, 1), 1.0)
    alpha[~kp & bg] = 0  # stray neighbour pixels inside the crop
    # un-premultiply against paper so soft shading becomes translucent graphite
    al = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(bg[..., None], (a - (1 - al) * paper) / al, a)
    rgb = np.clip(rgb, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    bb = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    return im.crop(bb)


def main():
    global CFG
    args = sys.argv[1:]
    sheet = "emotions"
    if "--sheet" in args:
        k = args.index("--sheet")
        sheet = args[k + 1]
        del args[k:k + 2]
    CFG = SHEETS[sheet]
    contact = Path(args[0]) if args else Path("tiger-contact.png")
    names, cols, nrows = CFG["names"], len(CFG["cols"]), len(CFG["rows"])
    img = Image.open(ROOT / "design" / CFG["src"])
    sprites = [drop_edge_specks(cut(img, r, c), names[r * cols + c])
               for r in range(nrows) for c in range(cols)]
    side = int(max(max(s.size) for s in sprites) * 1.04)
    OUT.mkdir(parents=True, exist_ok=True)
    final = []
    for name, s in zip(names, sprites):
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(s, ((side - s.width) // 2, side - s.height - int(side * 0.015)), s)
        canvas = canvas.resize((320, 320), Image.LANCZOS)
        canvas.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
        final.append(canvas)
    cell = 330
    sheet_im = Image.new("RGB", (cell * cols, (cell + 24) * nrows), (128, 128, 128))
    dr = ImageDraw.Draw(sheet_im)
    for i, (name, s) in enumerate(zip(names, final)):
        x, y = (i % cols) * cell, (i // cols) * (cell + 24)
        sheet_im.paste(s, (x + 5, y), s)
        dr.text((x + 8, y + cell + 4), name, fill=(255, 255, 255))
    contact.parent.mkdir(parents=True, exist_ok=True)
    sheet_im.save(contact)
    print("sprites:", len(final), "canvas side:", side)


if __name__ == "__main__":
    main()
