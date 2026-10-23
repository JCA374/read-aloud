"""Join the narration per slide and write the timeline, audio track and captions.

Reads out/narration.json (from narrate.mjs). Writes out/narration.wav, out/slides.txt (ffmpeg concat list:
slide image + how long it shows) and docs/media/intro.vtt (one caption per sentence, timed from the
engine's word timings).
"""
import json, re, wave, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/out"
LEAD, GAP, TAIL = 0.5, 0.35, 0.9  # seconds: before a slide's first line, between lines, after its last

lines = json.load(open(f"{OUT}/narration.json"))
rate = None
audio, cues, slides = [], [], []
t = 0.0

def ts(x):
    return f"{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{x % 60:06.3f}"

for n in sorted({l["slide"] for l in lines}):
    start = t
    parts = [l for l in lines if l["slide"] == n]
    for k, l in enumerate(parts):
        with wave.open(f"{OUT}/{l['file']}") as w:
            rate = rate or w.getframerate()
            assert w.getframerate() == rate, "all voices must share a sample rate"
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        pad = LEAD if k == 0 else GAP
        audio += [np.zeros(int(pad * rate), np.int16), pcm]
        t += pad
        # captions: split the line into sentences, timed by the first and last word of each
        words, text = l["words"], l["text"]
        sentences = re.findall(r"[^.!?]+[.!?]?", text)
        wi = 0
        for s in sentences:
            count = len(re.findall(r"[\w'’-]+", s))
            if not count:
                continue
            first, last = words[wi], words[min(wi + count, len(words)) - 1]
            cues.append((t + first[1], t + last[2] + 0.15, s.strip()))
            wi += count
        t += len(pcm) / rate
    audio.append(np.zeros(int(TAIL * rate), np.int16))
    t += TAIL
    slides.append((n, t - start))

with wave.open(f"{OUT}/narration.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(np.concatenate(audio).tobytes())
with open(f"{OUT}/slides.txt", "w") as f:
    for n, d in slides:
        f.write(f"file 'slide-{n:02d}.png'\nduration {d:.3f}\n")
    f.write(f"file 'slide-{slides[-1][0]:02d}.png'\n")  # concat needs the last file twice
os.makedirs(f"{HERE}/../../docs/media", exist_ok=True)
with open(f"{HERE}/../../docs/media/intro.vtt", "w") as f:
    f.write("WEBVTT\n\n")
    for k, (a, b, s) in enumerate(cues, 1):
        f.write(f"{k}\n{ts(a)} --> {ts(b)}\n{s}\n\n")
print(f"{len(slides)} slides, {t:.1f} s, {len(cues)} captions")
for n, d in slides:
    print(f"  slide {n}: {d:.1f} s")
