"""Hitung kata VO di SCRIPT.md + estimasi durasi. Opsional: ukur durasi audio asli.
Usage: python word_timing.py SCRIPT.md [--wpm 162] [--audio vo.wav]"""
import re, sys, subprocess, argparse

TARGET = 135.0
ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("--wpm", type=float, default=162)
ap.add_argument("--audio")
a = ap.parse_args()

text = open(a.script, encoding="utf-8").read()
vo = text.split("## VOICEOVER", 1)[-1].split("\n## ", 1)[0]
beats = re.findall(r"^B(\d+)\s*\|\s*(.+)$", vo, re.M)
if not beats:
    sys.exit("Tidak ada baris 'Bxx | ...' di bagian ## VOICEOVER")
counts = [len(re.findall(r"[A-Za-z0-9']+", t)) for _, t in beats]
words = sum(counts)
est = words / a.wpm * 60
fmt = lambda s: f"{int(s//60)}:{s%60:05.2f}"
print(f"Beats: {len(beats)} | Words: {words} | Est @ {a.wpm:.0f} wpm: {fmt(est)}")
print("Target kata: 340-370 | Target VO: 2:10-2:14 | Video: 2:15.00")
if not 340 <= words <= 370:
    diff = (355 - words)
    print(f"!! Di luar target. {'Tambah' if diff > 0 else 'Kurangi'} ~{abs(diff)} kata.")
t = 0.0
for (n, _), c in zip(beats, counts):
    d = c / a.wpm * 60
    print(f"  B{n}: {fmt(t)} - {fmt(t+d)}  ({c} kata)"); t += d
if a.audio:
    try:
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
              "format=duration", "-of", "csv=p=0", a.audio]).strip())
    except Exception as e:
        sys.exit(f"Gagal baca audio (ffprobe terpasang?): {e}")
    real_wpm = words / dur * 60
    print(f"Audio: {fmt(dur)} | real wpm: {real_wpm:.0f}")
    if dur > 134: print(f"!! Terlalu panjang. Potong ~{int((dur-132)*real_wpm/60)+1} kata atau atempo {dur/132:.3f} (maks 1.05)")
    elif dur < 130: print(f"!! Terlalu pendek. Tambah ~{int((132-dur)*real_wpm/60)+1} kata")
    else: print(f"OK. Tail musik: {TARGET-dur:.2f} detik")
