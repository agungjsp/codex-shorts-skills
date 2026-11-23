"""Validasi skin Minecraft di folder. Usage: python check_skin.py assets/skins/"""
import sys, pathlib
from PIL import Image

ok = True
for p in sorted(pathlib.Path(sys.argv[1]).glob("*.png")):
    im = Image.open(p).convert("RGBA"); w, h = im.size
    if (w, h) not in [(64, 64), (64, 32)]:
        print(f"[X] {p.name}: ukuran {w}x{h} (harus 64x64 atau 64x32)"); ok = False; continue
    if h == 32:
        arm = "classic (format lama 64x32 — sebaiknya convert ke 64x64)"
    else:
        arm = "slim (Alex)" if im.getpixel((54, 20))[3] == 0 else "classic (Steve)"
    px = [im.getpixel((x, y))[:3] for x in range(8, 16) for y in range(8, 16)]
    top = max(set(px), key=px.count)
    print(f"[OK] {p.stem}: {w}x{h} | arm: {arm} | warna wajah dominan: #{top[0]:02x}{top[1]:02x}{top[2]:02x}")
if not ok: sys.exit(1)
