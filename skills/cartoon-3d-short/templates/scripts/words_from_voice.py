"""Align the script's words to measured word timestamps from faster-whisper."""
import argparse
import difflib
import json
import math
import os
from pathlib import Path
import re


def norm(word):
    return "".join(c for c in word.casefold() if c.isalnum())


def narration(path, lang):
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if path.suffix.lower() == ".txt":
        beats = enumerate((line.strip() for line in lines if line.strip()), 1)
        return [{"w": w, "beat": beat} for beat, text in beats for w in text.split() if norm(w)]
    if path.suffix.lower() != ".md":
        raise ValueError("use a Markdown narration table (.md) or plain text narration (.txt)")

    words = []
    beat_col, voice_col = None, None
    for line in lines:
        line = line.strip()
        if "|" not in line:
            beat_col, voice_col = None, None
            continue
        cells = [cell.strip().replace(r"\|", "|")
                 for cell in re.split(r"(?<!\\)\|", line.removeprefix("|").removesuffix("|"))]
        headers = [c.strip("`* ").casefold() for c in cells]
        if "#" in headers:
            beat_col = headers.index("#")
            voice_col = next((headers.index(h) for h in (lang, "narration", "narasi") if h in headers), None)
            continue
        if voice_col is not None and max(beat_col, voice_col) < len(cells) and cells[beat_col].isdecimal():
            words.extend({"w": w, "beat": int(cells[beat_col])} for w in cells[voice_col].split() if norm(w))
    return words


def write_json(path, value):
    with path.open("w", encoding="utf-8") as output:
        json.dump(value, output, ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("voice", help="recorded narration audio")
    ap.add_argument("script", type=Path, help="numbered Narration/Narasi or EN/ID Markdown table, or narration .txt")
    ap.add_argument("out", type=Path, help="output words.json")
    ap.add_argument("language", choices=("en", "id"), nargs="?", default="id", help="spoken language (default: id)")
    a = ap.parse_args()
    try:
        words = narration(a.script, a.language)
    except (OSError, ValueError) as exc:
        ap.error(f"cannot read script {a.script}: {exc}")
    if not words:
        ap.error(f"No narration found in {a.script} for {a.language}. Use a numbered narration table or a .txt file.")

    if os.environ.get("HF_CACHE_DIR"):
        os.environ.setdefault("HF_HOME", os.environ["HF_CACHE_DIR"])
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        ap.error(f"cannot load faster-whisper: {exc}")
    try:
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(a.voice, language=a.language, word_timestamps=True,
                                      vad_filter=True, condition_on_previous_text=False)
        rec = [{"w": x.word.strip(), "s": x.start, "e": x.end} for segment in segments for x in segment.words or ()]
    except (OSError, RuntimeError, ValueError) as exc:
        ap.error(f"could not transcribe {a.voice}: {exc}")

    raw_path = a.out.with_name(f"{a.out.stem}_raw.json")
    try:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        write_json(raw_path, rec)
    except OSError as exc:
        ap.error(f"could not write recognizer output {raw_path}: {exc}")
    rec = [r for r in rec if norm(r["w"]) and r["s"] is not None and r["e"] is not None
           and math.isfinite(r["s"]) and math.isfinite(r["e"]) and 0 <= r["s"] < r["e"]]
    if not rec:
        ap.error(f"No timed speech recognized in {a.voice}. Check the audio and language. Raw output: {raw_path}")

    sm = difflib.SequenceMatcher(a=[norm(w["w"]) for w in words], b=[norm(r["w"]) for r in rec], autojunk=False)
    matches = sum(block.size for block in sm.get_matching_blocks())
    if not matches:
        ap.error(f"No recognized words match the script. Check the script and language. Raw output: {raw_path}")

    for op, i, j, u, v in sm.get_opcodes():
        if op == "insert":
            continue
        if j - i != v - u:
            text = " ".join(w["w"] for w in words[i:j])
            ap.error(f"Cannot time script words without matching speech: {text!r}. Correct the alignment using {raw_path}.")
        for word, recognized in zip(words[i:j], rec[u:v]):
            word.update(s=recognized["s"], e=recognized["e"])
            if op != "equal":
                word["guess"] = True

    try:
        write_json(a.out, words)
    except OSError as exc:
        ap.error(f"could not write word timings {a.out}: {exc}")
    print(f"{len(words)} script words, {matches} matched, {len(words) - matches} spelling substitutions; "
          f"{len(rec)} recognized; speech {words[0]['s']:.2f}-{words[-1]['e']:.2f} s")
    for beat in dict.fromkeys(w["beat"] for w in words):
        ws = [w for w in words if w["beat"] == beat]
        print(f"beat {beat}: {ws[0]['s']:6.2f}-{ws[-1]['e']:6.2f}  {' '.join(w['w'] for w in ws[:5])} ...")


if __name__ == "__main__":
    main()
