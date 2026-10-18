# アプリアイコンを作る（方眼の上に、六角ボルトの頭と、締める向きの矢印）。python tools/make_icons.py（Pillow が必要）
from pathlib import Path
import math
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'icons'
BG, GRID, WHITE, HEAD, ARROW = (29, 92, 150), (50, 112, 168), (255, 255, 255), (170, 205, 240), (240, 160, 122)

def draw(size, maskable=False):
    s = 4 * size  # 4 倍で描いて縮小（縁を滑らかにする）
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BG)
        k = 0.72  # 円形に切り抜かれても収まる大きさ
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.2, fill=BG)
        k = 1.0
    step = s / 8
    for i in range(1, 8):
        d.line([i * step, 0, i * step, s], fill=GRID, width=max(1, s // 256))
        d.line([0, i * step, s, i * step], fill=GRID, width=max(1, s // 256))
    if not maskable:
        mask = Image.new('L', (s, s), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.2, fill=255)
        im.putalpha(mask)
        d = ImageDraw.Draw(im)
    c = s / 2
    # 六角の頭（二面幅を左右に）
    rh = s * 0.2 * k
    hexa = [(c + rh * math.cos(math.radians(a)), c + rh * math.sin(math.radians(a))) for a in range(30, 390, 60)]
    d.polygon(hexa, fill=HEAD)
    # 座面の円とねじの穴
    d.ellipse([c - rh * 0.62, c - rh * 0.62, c + rh * 0.62, c + rh * 0.62], outline=BG, width=round(s * 0.012 * k))
    d.ellipse([c - rh * 0.22, c - rh * 0.22, c + rh * 0.22, c + rh * 0.22], fill=WHITE)
    # 締める向き（時計回り）の矢印
    ra, w = s * 0.31 * k, round(s * 0.045 * k)
    d.arc([c - ra, c - ra, c + ra, c + ra], start=200, end=330, fill=ARROW, width=w)
    a = math.radians(330)
    tip = (c + ra * math.cos(a + 0.22), c + ra * math.sin(a + 0.22))
    base = (c + ra * math.cos(a - 0.05), c + ra * math.sin(a - 0.05))
    nx, ny = math.cos(a), math.sin(a)
    h = s * 0.075 * k
    d.polygon([tip, (base[0] + nx * h, base[1] + ny * h), (base[0] - nx * h, base[1] - ny * h)], fill=ARROW)
    # 軸力の矢印（下向きの白い線）
    d.line([c, c + rh * 1.15, c, c + s * 0.36 * k], fill=WHITE, width=round(s * 0.03 * k))
    d.polygon([(c, c + s * 0.42 * k), (c - s * 0.05 * k, c + s * 0.34 * k), (c + s * 0.05 * k, c + s * 0.34 * k)], fill=WHITE)
    return im.resize((size, size), Image.LANCZOS)

OUT.mkdir(exist_ok=True)
draw(512).save(OUT / 'icon-512.png')
draw(192).save(OUT / 'icon-192.png')
draw(512, maskable=True).save(OUT / 'icon-maskable-512.png')
im = draw(180)
bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im); bg.convert('RGB').save(OUT / 'apple-touch-icon.png')
