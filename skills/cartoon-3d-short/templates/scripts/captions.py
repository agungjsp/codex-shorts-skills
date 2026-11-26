"""Render word-synced captions as a standalone green-screen clip for After Effects."""
import argparse
from fractions import Fraction
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("words"); ap.add_argument("out")
ap.add_argument("--start", type=Fraction, default=Fraction(0), help="seconds into the film")
ap.add_argument("--dur", type=Fraction, help="seconds to render (default: through the end of the film or last word + 1 s)")
ap.add_argument("--w", type=int, help="canvas width without a film (default: 1440)")
ap.add_argument("--h", type=int, help="canvas height without a film (default: 2560)")
ap.add_argument("--fps", type=Fraction, help="frame rate without a film (default: 30; accepts 24000/1001)")
# a heavy sans that exists on this OS (Windows, macOS, Linux); --font overrides
FONT_CANDIDATES = [
    "C:/Windows/Fonts/ariblk.ttf",                                   # Windows: Arial Black
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",            # macOS
    "/Library/Fonts/Arial Black.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf",       # Linux (ttf-mscorefonts)
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",          # Linux (most distros)
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
]
ap.add_argument("--font", default=next((f for f in FONT_CANDIDATES if os.path.exists(f)), None),
                help="TTF/OTF font file (default: the first heavy sans found on this OS)")
ap.add_argument("--size", type=float, default=0.032, help="font size as a fraction of the frame height")
ap.add_argument("--y", type=float, default=0.715, help="caption centre (capitals middle) as a fraction of the frame height")
ap.add_argument("--max-words", type=int, default=3)
ap.add_argument("--max-width", type=float, default=0.68,
                help="widest caption as a fraction of the frame width (0.68 = 16 %% clear each side, off the Shorts buttons)")
ap.add_argument("--gap", type=float, default=0.30, help="a voice pause this long (s) starts a new chunk")
ap.add_argument("--hold", type=float, default=0.25, help="seconds a chunk stays after its last word when the voice pauses")
ap.add_argument("--lead", type=int, default=0, help="frames the caption appears before its word")
ap.add_argument("--strip-punct", action="store_true", help="drop trailing . , ; : (default keeps the script's punctuation)")
ap.add_argument("--no-pop", action="store_true");ap.add_argument("--lower", action="store_true", help="keep the script's case")
ap.add_argument("--keep", action="append", default=[], metavar="PHRASE",
                help="keep matching words in one caption, even across a pause (repeatable)")
ap.add_argument("--key-color", metavar="RRGGBB", help="fill for words written in all caps in the input")
film_group = ap.add_mutually_exclusive_group()
film_group.add_argument("--film", help="match the film's video dimensions, frame rate and frame count")
film_group.add_argument("--preview", help="match this film and write a review composite with its audio")
ap.add_argument("--alpha", action="store_true", help="also write ProRes 4444 alpha and use it for the preview")
a = ap.parse_args()
if not a.font or not os.path.exists(a.font):
    sys.exit(f"captions.py: no font found ({a.font!r}). Pass one with --font /path/to/font.ttf")

def probe_film(path):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "V:0", "-count_frames",
        "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames",
        "-of", "json", path,
    ], check=True, capture_output=True, text=True)
    stream = json.loads(result.stdout)["streams"][0]
    w, h, fps, frames = stream["width"], stream["height"], Fraction(stream["avg_frame_rate"]), int(stream["nb_read_frames"])
    if min(w, h, fps, frames) <= 0:
        raise ValueError("video dimensions, rate and frame count must be positive")
    return w, h, fps, frames


GREEN = (0, 255, 0)
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)
key_color = None
if a.key_color is not None:
    color = a.key_color.removeprefix("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", color):
        ap.error("--key-color needs six hex digits, for example FFD21F")
    key_color = tuple(bytes.fromhex(color)) + (255,)

if a.start < 0 or (a.dur is not None and a.dur <= 0):
    ap.error("--start must be nonnegative and --dur must be positive")
if a.max_words < 1 or not 0 < a.max_width <= 1 or not 0 < a.size <= 1 or a.hold < 0 or a.gap < 0:
    ap.error("use positive --max-words, --max-width and --size, and nonnegative --hold and --gap")

try:
    with open(a.words, encoding="utf-8") as word_file:
        words = [w for w in json.load(word_file) if w["w"].strip()]
except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
    ap.error(f"cannot read words from {a.words}: {exc}")

film = a.film or a.preview
film_frames = None
if film:
    try:
        W, H, FPS, film_frames = probe_film(film)
    except subprocess.CalledProcessError as exc:
        ap.error(f"ffprobe could not read {film}: {exc.stderr.strip()}")
    except (OSError, KeyError, IndexError, ValueError, ZeroDivisionError) as exc:
        ap.error(f"cannot determine video dimensions, frame rate and frame count for {film}: {exc}")
    if any(given is not None and given != actual for given, actual in zip((a.w, a.h, a.fps), (W, H, FPS))):
        ap.error("--w, --h and --fps cannot override the film's video settings")
else:
    W = 1440 if a.w is None else a.w
    H = 2560 if a.h is None else a.h
    FPS = Fraction(30) if a.fps is None else a.fps
    if min(W, H, FPS) <= 0:
        ap.error("--w, --h and --fps must be positive")

f_start = round(a.start * FPS)
if a.dur is not None:
    f_end = round((a.start + a.dur) * FPS)
    if film_frames is not None:
        f_end = min(f_end, film_frames)
elif film_frames is not None:
    f_end = film_frames
elif words:
    f_end = round((words[-1]["e"] + 1.0) * FPS)
else:
    ap.error("empty words need a film or an explicit --dur")
if f_start >= f_end:
    ap.error("the requested span contains no video frames")

peak = 1.0 if a.no_pop else 1.06

# YouTube Shorts overlays (conservative): action buttons down the right 16 %, title/channel/music over the bottom
# 25 %, search/menu bar over the top 8 %. Captions must stay clear of all three.
SAFE_RIGHT, SAFE_BOTTOM, SAFE_TOP = 0.16, 0.25, 0.08
size = max(1, round(a.size * H))
font = ImageFont.truetype(a.font, size)
stroke = max(2, round(size * 0.11))
shadow = (round(size * 0.05), round(size * 0.07))
text_w = lambda t, f=font: (lambda b: b[2] - b[0])(f.getbbox(t, stroke_width=stroke)) + shadow[0]

# ---------------- chunks ----------------
clean = lambda w: re.sub(r"^[\"'(\[]+|[\"')\]]+$", "", w)
display = lambda w: w if a.lower else w.upper()
bare = lambda w: re.sub(r"[^\w]", "", w).lower()

# a single word wider than a caption (TWENTY-ONE-YEAR-OLD) is split at its hyphens into two halves that each fit,
# timed by character share, instead of being shrunk to an unreadable size
def split_long(w):
    t, parts = clean(w["w"]), w["w"].split("-")
    if len(parts) < 2 or text_w(display(t)) * peak <= a.max_width * W: return [w]
    best = min(range(1, len(parts)), key=lambda k: abs(len("-".join(parts[:k])) - len("-".join(parts[k:]))))
    a_txt, b_txt = "-".join(parts[:best]) + "-", "-".join(parts[best:])
    m = w["s"] + (w["e"] - w["s"]) * len(a_txt) / (len(a_txt) + len(b_txt))
    return [dict(w, w=a_txt, e=m), dict(w, w=b_txt, s=m)]
# A keep phrase is one indivisible unit. Overlaps share the same unit.
protected_cuts = set()
normalized = [bare(w["w"]) for w in words]
for phrase in a.keep:
    tokens = [key for w in phrase.split() if (key := bare(w))]
    if not tokens:
        ap.error("--keep needs a phrase containing words")
    for i in range(len(words) - len(tokens) + 1):
        if normalized[i:i + len(tokens)] == tokens:
            protected_cuts.update(range(i + 1, i + len(tokens)))

units = []
start = 0
for i in range(1, len(words) + 1):
    if i not in protected_cuts:
        if i == start + 1:
            units.extend([w] for w in split_long(words[start]))
        else:
            units.append(words[start:i])
        start = i
# words a caption should not END on (English + Indonesian): "WITH THE" / "DENGAN SI" read as unfinished
GLUE = set("a an the of to in on at for with and or but by from as into onto is was are were his her its their my "
           "your our yang di ke dari dan atau untuk dengan si sang para itu ini pada oleh akan sudah juga tapi".split())

# Break at punctuation and pauses, except within an explicit keep phrase.
phrases, cur = [], []
for unit in units:
    if cur:
        prev = cur[-1][-1]
        if re.search(r"[.,!?;:]$", prev["w"]) or unit[0]["s"] - prev["e"] > a.gap:
            phrases.append(cur)
            cur = []
    cur.append(unit)
if cur:
    phrases.append(cur)


def cost(c, word_count, prev_exists, following):
    txt = display(" ".join(clean(x["w"]) for x in c))
    k = 1.0 + (40 if text_w(txt) * peak > a.max_width * W and len(c) > 1 else 0)
    if len(c) == 1 and word_count > 1: k += 2
    if following and bare(c[-1]["w"]) in GLUE: k += 4
    if following and following["w"][:1].isupper() and c[-1]["w"][:1].isupper() and (prev_exists or len(c) > 1):
        k += 4
    if c[-1]["e"] - c[0]["s"] < 0.30: k += 2
    return k

chunks = []
for ph in phrases:
    n = len(ph)
    word_count = sum(map(len, ph))
    best = [0.0] + [float("inf")] * n
    cut = [0] * (n + 1)
    for j in range(1, n + 1):
        following = ph[j][0] if j < n else None
        i, count = j - 1, len(ph[j - 1])
        while i > 0 and count + len(ph[i - 1]) <= a.max_words:
            i -= 1
            count += len(ph[i])
        for i in range(i, j):
            c = [w for unit in ph[i:j] for w in unit]
            v = best[i] + cost(c, word_count, i > 0, following)
            if v < best[j]:
                best[j], cut[j] = v, i
    seg, j = [], n
    while j:
        seg.append([w for unit in ph[cut[j]:j] for w in unit])
        j = cut[j]
    chunks.extend(reversed(seg))

out = []
for k, c in enumerate(chunks):
    s = c[0]["s"]
    nxt = chunks[k + 1][0]["s"] if k + 1 < len(chunks) else None
    e = c[-1]["e"] + a.hold
    if nxt is not None and nxt - c[-1]["e"] <= a.gap: e = nxt          # continuous speech: butt up to the next chunk
    if nxt is not None: e = min(e, nxt)
    tokens = [clean(x["w"]) for x in c]
    if a.strip_punct:
        tokens[-1] = re.sub(r"[.,;:]+$", "", tokens[-1])
    out.append({"text": display(" ".join(tokens)), "s": round(s, 3), "e": round(e, 3),
                "f0": max(0, round(s * FPS) - a.lead), "f1": round(e * FPS)})

# ---------------- one sprite per chunk ----------------
def sprite(text, chunk):
    f = font
    sw, sh = stroke, shadow
    while True:
        l, t, r, b = f.getbbox(text, stroke_width=sw)
        if (r - l + sh[0]) * peak <= W * a.max_width:
            break
        if f.size == 1:
            ap.error(f"caption cannot fit --max-width: {text}")
        f = ImageFont.truetype(a.font, max(1, int(f.size * 0.95)))
        sw = max(1, round(f.size * 0.11))
        sh = (round(f.size * 0.05), round(f.size * 0.07))
    if f.size != size:
        print(f"  shrunk to {f.size}px to fit: {text}")
    # the sprite is centred on the CAPITALS' middle, so a comma or a Q never shifts a caption up or down
    _, ct, _, cb = f.getbbox("H")
    mid = (ct + cb) / 2
    pad = sw + max(sh) + 4
    half = max(mid - t, b + sh[1] - mid) + pad
    im = Image.new("RGBA", (r - l + 2 * pad, int(2 * half)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox, oy = pad - l, half - mid
    d.text((ox + sh[0], oy + sh[1]), text, font=f, fill=BLACK, stroke_width=sw, stroke_fill=BLACK)
    highlighted = [w["w"].isupper() for w in chunk] if key_color else []
    if any(highlighted):
        start = 0
        for word, mark in zip(text.split(" "), highlighted):
            d.text((ox + f.getlength(text[:start]), oy), word, font=f,
                   fill=key_color if mark else WHITE, stroke_width=sw, stroke_fill=BLACK)
            start += len(word) + 1
    else:
        d.text((ox, oy), text, font=f, fill=WHITE, stroke_width=sw, stroke_fill=BLACK)
    return im

sprites = [sprite(c["text"], chunk) for c, chunk in zip(out, chunks)]
# Measure the outline and shadow at the pop's largest scale.
cy_ = round(a.y * H)
x1, y0, y1 = 0, H, 0
for c, sp in zip(out, sprites):
    bounds = sp.getbbox()
    if bounds is None:
        continue
    l, t, r, b = bounds
    ix1 = W / 2 + (r - sp.width / 2) * peak
    iy0, iy1 = cy_ + (t - sp.height / 2) * peak, cy_ + (b - sp.height / 2) * peak
    x1, y0, y1 = max(x1, ix1), min(y0, iy0), max(y1, iy1)
    if ix1 > W * (1 - SAFE_RIGHT) or iy1 > H * (1 - SAFE_BOTTOM) or iy0 < H * SAFE_TOP:
        print(f"  WARNING outside the Shorts safe zone: {c['text']}")
if y0 < H:
    print(f"font {size}px; ink reaches {x1 / W:.1%} of width (buttons from {1 - SAFE_RIGHT:.0%}) and "
          f"{y0 / H:.1%}-{y1 / H:.1%} of height (bottom UI from {1 - SAFE_BOTTOM:.0%})")

def pop(n):  # scale for the n-th frame of a chunk
    if a.no_pop: return 1.0
    keys = [0.85, 0.97, 1.06, 1.03, 1.0]
    return keys[n] if n < len(keys) else 1.0

# ---------------- frames -> ffmpeg ----------------
os.makedirs(a.out, exist_ok=True)
green_path = os.path.join(a.out, "captions_green.mp4")
alpha_path = os.path.join(a.out, "captions_alpha.mov")


def encoder(pixel_format, *options):
    return ["ffmpeg", "-y", "-v", "error", "-filter_threads", "1",
            "-f", "rawvideo", "-pixel_format", pixel_format, "-video_size", f"{W}x{H}",
            "-framerate", str(FPS), "-i", "-", *options]


enc = [encoder("rgb24", "-c:v", "libx264", "-preset", "medium", "-crf", "8",
               "-pix_fmt", "yuv444p", "-tune", "animation", green_path)]
if a.alpha:
    enc.append(encoder("rgba", "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", alpha_path))
cy = round(a.y * H)
blank_g = Image.new("RGB", (W, H), GREEN).tobytes()
blank_a = Image.new("RGBA", (W, H)).tobytes() if a.alpha else None
procs = []
try:
    for command in enc:
        procs.append(subprocess.Popen(command, stdin=subprocess.PIPE))
    k = 0
    for f in range(f_start, f_end):
        while k < len(out) and out[k]["f1"] <= f:
            k += 1
        if k == len(out) or f < out[k]["f0"]:
            procs[0].stdin.write(blank_g)
            if a.alpha:
                procs[1].stdin.write(blank_a)
            continue
        sp = sprites[k]
        sc = pop(f - out[k]["f0"])
        if sc != 1.0:
            sp = sp.resize((max(1, round(sp.width * sc)), max(1, round(sp.height * sc))), Image.Resampling.LANCZOS)
        pos = (W // 2 - sp.width // 2, cy - sp.height // 2)
        g = Image.new("RGB", (W, H), GREEN)
        g.paste(sp, pos, sp)
        procs[0].stdin.write(g.tobytes())
        if a.alpha:
            lay = Image.new("RGBA", (W, H))
            lay.paste(sp, pos)
            procs[1].stdin.write(lay.tobytes())
    for p in procs:
        p.stdin.close()
    for p in procs:
        if p.wait():
            sys.exit(f"captions.py: FFmpeg failed encoding {p.args[-1]} (exit {p.returncode})")
except OSError as exc:
    sys.exit(f"captions.py: FFmpeg encoding failed: {exc}")
finally:
    for p in procs:
        if p.poll() is None:
            p.kill()
        p.wait()
        try:
            p.stdin.close()
        except BrokenPipeError:
            pass

with open(os.path.join(a.out, "captions.json"), "w", encoding="utf-8") as metadata:
    json.dump(out, metadata, ensure_ascii=False, indent=1)

shown = [c for c in out if c["f1"] > f_start and c["f0"] < f_end]
print(f"{len(out)} chunks total, {len(shown)} in {float(f_start / FPS):.2f}-{float(f_end / FPS):.2f} s -> {green_path}")
for c in shown: print(f"  {c['s']:6.2f}-{c['e']:6.2f}  {c['text']}")

# Composite with the actual alpha channel when present: green despill shifts yellow highlights.
if a.preview:
    prev = os.path.join(a.out, "captions_preview.mp4")
    graph = f"[0:V:0]trim=start_frame={f_start}:end_frame={f_end},setpts=PTS-STARTPTS[film];"
    if a.alpha:
        graph += "[film][1:v]overlay=eof_action=pass:format=auto[v]"
    else:
        graph += "[1:v]colorkey=0x00FF00:0.30:0.08,despill=type=green[c];[film][c]overlay=eof_action=pass[v]"
    try:
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-filter_complex_threads", "1", "-i", a.preview,
            "-i", alpha_path if a.alpha else green_path, "-filter_complex", graph,
            "-map", "[v]", "-map", "0:a?",
            "-af", f"atrim=start={float(f_start / FPS)}:end={float(f_end / FPS)},asetpts=PTS-STARTPTS",
            "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv444p" if W % 2 or H % 2 else "yuv420p",
            "-fps_mode", "passthrough", "-c:a", "aac", prev,
        ], check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        sys.exit(f"captions.py: FFmpeg preview failed: {exc}")
    print("preview ->", prev)
