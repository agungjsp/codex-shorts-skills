"""Cek kemiripan teks SCRIPT.md vs folder referensi.
Usage: python overlap_check.py SCRIPT.md refs_folder/"""
import re, sys, pathlib

COMMON = {"in this world", "in this town", "and then", "but here's the thing"}
def toks(t): return re.findall(r"[a-z0-9']+", t.lower())
def grams(w, n): return {" ".join(w[i:i+n]) for i in range(len(w)-n+1)}

text = open(sys.argv[1], encoding="utf-8").read()
vo = text.split("## VOICEOVER", 1)[-1].split("\n## ", 1)[0]
vo = re.sub(r"^B\d+\s*\|", "", vo, flags=re.M)
s = toks(vo)
fail = False
for f in sorted(pathlib.Path(sys.argv[2]).glob("*")):
    if not f.is_file(): continue
    r = toks(f.read_text(encoding="utf-8", errors="ignore"))
    g4 = grams(s, 4); shared4 = g4 & grams(r, 4)
    shared6 = {g for g in grams(s, 6) & grams(r, 6) if not any(c in g for c in COMMON)}
    pct = 100 * len(shared4) / max(len(g4), 1)
    bad = shared6 or pct > 3
    fail |= bool(bad)
    print(f"[{'FAIL' if bad else 'PASS'}] {f.name}: 4-gram overlap {pct:.1f}% | shared 6-gram: {len(shared6)}")
    for g in sorted(shared6)[:15]: print(f"    6g: {g}")
    if pct > 3:
        for g in sorted(shared4)[:15]: print(f"    4g: {g}")
print("VERDICT TEKS:", "FAIL" if fail else "PASS", "(premis/twist tetap dinilai agent)")
sys.exit(1 if fail else 0)
