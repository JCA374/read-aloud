# Needs: pip install piper-tts soundfile numpy; the .onnx + .onnx.json voice files in <voices dir>.
# Speed samples: Piper length scale (what the add-on does) vs. playing faster (pitch goes up).
import sys, numpy as np, soundfile as sf
from piper import PiperVoice, SynthesisConfig
VOICES, out = sys.argv[1], sys.argv[2]
TEXT = {"sv_SE-alma-medium": "Fyren stod på klipporna i mer än hundra år, och varje kväll tändes lampan.",
        "en_GB-cori-medium": "The lighthouse stood on the rocks for more than a hundred years, and every evening the lamp was lit."}
def f0(x, sr):
    # median pitch of voiced 40 ms frames, by autocorrelation (70-400 Hz)
    n = int(0.04 * sr); vals = []
    for i in range(0, len(x) - n, n // 2):
        f = x[i:i+n] - x[i:i+n].mean()
        if np.sqrt((f**2).mean()) < 0.02: continue
        ac = np.correlate(f, f, "full")[n-1:]
        lo, hi = int(sr/400), int(sr/70)
        k = lo + np.argmax(ac[lo:hi])
        if ac[k] > 0.5 * ac[0]: vals.append(sr / k)
    return np.median(vals)
for name, text in TEXT.items():
    v = PiperVoice.load(f"{VOICES}/{name}.onnx")
    base = None
    for speed in [0.75, 1.0, 1.5, 2.0]:
        chunks = list(v.synthesize(text, syn_config=SynthesisConfig(length_scale=1/speed**(1.4 if speed <= 1 else 1.4 + 0.4*(speed-1)))))
        sr = chunks[0].sample_rate; a = np.concatenate([c.audio_float_array for c in chunks])
        if speed == 1.0: base = a
        sf.write(f"{out}/{name.split('-')[1]}-{speed}x-in-voice.wav", a, sr)
        print(f"{name.split('-')[1]:5} {speed}x  in the voice: {len(a)/sr:4.1f} s, pitch {f0(a, sr):4.0f} Hz")
    for speed in [0.75, 1.5, 2.0]:
        # played faster: same samples at a higher rate = shorter and higher
        sf.write(f"{out}/{name.split('-')[1]}-{speed}x-played-faster.wav", base, int(sr * speed))
        print(f"{name.split('-')[1]:5} {speed}x  played faster: {len(base)/sr/speed:4.1f} s, pitch {f0(base, sr)*speed:4.0f} Hz")
