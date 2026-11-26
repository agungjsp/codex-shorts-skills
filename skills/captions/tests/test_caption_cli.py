import json
from fractions import Fraction
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPTS = Path(__file__).resolve().parents[2] / "cartoon-3d-short/templates/scripts"


def run(*args, check=True):
    result = subprocess.run(args, capture_output=True)
    if check and result.returncode:
        raise AssertionError(f"{args!r} exited {result.returncode}: {result.stderr.decode(errors='replace')}")
    return result


def stream(path, selector="v:0"):
    return json.loads(run(
        "ffprobe", "-v", "error", "-select_streams", selector, "-count_frames",
        "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames,codec_name",
        "-of", "json", path,
    ).stdout)["streams"][0]


class CaptionCLI(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.words = self.root / "words.json"
        self.words.write_text(json.dumps([
            {"w": w, "s": s, "e": e} for w, s, e in [
                ("Go", 0.08, 0.14), ("HOME", 0.14, 0.20), ("right", 0.20, 0.26), ("now,", 0.26, 0.32),
                ("see", 0.84, 0.89), ("the", 0.89, 0.94), ("BLUE", 0.94, 1.00), ("moon.", 1.00, 1.08),
            ]
        ]), encoding="utf-8")
        self.film = self.root / "film.mp4"
        self.out = self.root / "captions output"

    def make_film(self):
        run("ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=0x204080:s=192x336:r=24000/1001",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1.5", "-frames:v", "34",
            "-c:v", "libx264", "-threads:v", "1", "-c:a", "aac", self.film)

    def captions(self, *flags, check=True):
        return run(sys.executable, SCRIPTS / "captions.py", self.words, self.out, *flags, check=check)

    def test_full_preview_matches_film_and_preserves_alpha_highlight(self):
        self.make_film()
        self.captions("--preview", self.film, "--alpha", "--no-pop", "--size", ".055",
                      "--keep", "go home right now", "--keep", "see the blue moon", "--key-color", "FFD21F")
        green = self.out / "captions_green.mp4"
        alpha = self.out / "captions_alpha.mov"
        preview = self.out / "captions_preview.mp4"
        film = stream(self.film)
        self.assertEqual(film["nb_read_frames"], "34")
        for path in (green, alpha, preview):
            with self.subTest(path=path):
                rendered = stream(path)
                for prop in ("width", "height", "nb_read_frames"):
                    self.assertEqual(rendered[prop], film[prop])
                self.assertEqual(Fraction(rendered["avg_frame_rate"]), Fraction(24000, 1001))
        self.assertEqual(stream(preview, "a:0")["codec_name"], "aac")

        chunks = json.loads((self.out / "captions.json").read_text(encoding="utf-8"))
        self.assertEqual([(c["text"], c["s"], c["e"]) for c in chunks], [
            ("GO HOME RIGHT NOW,", 0.08, 0.57), ("SEE THE BLUE MOON.", 0.84, 1.33),
        ])
        frame_bytes = 192 * 336 * 4

        def pixels(path, index):
            decoded = run("ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{index})",
                          "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-threads:v", "1", "-").stdout
            self.assertEqual(len(decoded), frame_bytes)
            return list(zip(decoded[0::4], decoded[1::4], decoded[2::4], decoded[3::4]))

        self.assertFalse(any(a for _, _, _, a in pixels(alpha, 17)))
        held = pixels(alpha, 10)  # the last word ended at 0.32 s; this frame is at about 0.42 s
        self.assertEqual(held[0][3], 0)
        self.assertTrue(any(min(r, g, b, a) > 220 for r, g, b, a in held))
        for path in (alpha, preview):
            self.assertTrue(any(r > 205 and g > 185 and b < 95 and a > 220 for r, g, b, a in pixels(path, 10)))

    def test_film_span_and_encoder_failure(self):
        self.make_film()
        self.captions("--film", self.film)
        self.assertEqual(stream(self.out / "captions_green.mp4")["nb_read_frames"], "34")
        self.assertFalse((self.out / "captions_preview.mp4").exists())
        self.captions("--preview", self.film, "--start", ".25", "--dur", ".5")
        for name in ("captions_green.mp4", "captions_preview.mp4"):
            self.assertEqual(stream(self.out / name)["nb_read_frames"], "12")
        (self.out / "captions_alpha.mov").mkdir()
        failed = self.captions("--film", self.film, "--alpha", check=False)
        self.assertNotEqual(failed.returncode, 0)
        self.assertIn(b"FFmpeg", failed.stderr)

    def test_explicit_canvas_without_film(self):
        result = self.captions("--w", "64", "--h", "96", "--fps", "4", "--dur", ".25", "--y", ".85")
        self.assertIn(b"WARNING outside the Shorts safe zone", result.stdout)
        self.assertEqual(stream(self.out / "captions_green.mp4"), {
            "codec_name": "h264", "width": 64, "height": 96, "avg_frame_rate": "4/1", "nb_read_frames": "1",
        })

    def test_aligner_rejects_empty_script_before_loading_whisper(self):
        script = self.root / "SCRIPT.md"
        script.write_text("| # | Beat | Narration | Picture |\n| --- | --- | --- | --- |\n", encoding="utf-8")
        out = self.root / "unusable.json"
        result = run(sys.executable, SCRIPTS / "words_from_voice.py", self.film, script, out, "en", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"No narration", result.stderr)
        self.assertFalse(out.exists())
        self.assertNotIn(b"Traceback", result.stderr)
