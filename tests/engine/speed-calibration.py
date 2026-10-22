import os, numpy as np
from piper import PiperVoice, SynthesisConfig
T = {"sv_SE-alma-medium": ["Fyren stod på klipporna i mer än hundra år, och varje kväll tändes lampan.", "Hon hade räknat trappstegen som barn. Hon kom ihåg vartenda ett av dem."],
     "en_GB-cori-medium": ["The lighthouse stood on the rocks for more than a hundred years, and every evening the lamp was lit.", "She had counted the stairs as a child. She remembered every one of them."]}
for name, texts in T.items():
    v = PiperVoice.load(os.path.expanduser(f"~/.local/share/read-aloud/piper/{name}.onnx"))
    dur = lambda ls: sum(sum(len(c.audio_float_array) for c in v.synthesize(t, syn_config=SynthesisConfig(length_scale=ls))) for t in texts) / 22050
    base = dur(1.0)
    for k in [1.6, 1.8]:
        print(name.split("-")[1], f"length_scale = 1/speed^{k}:", "  ".join(f"{s}x -> {base/dur(1/s**k):.2f}x" for s in [1.25, 1.5, 1.75, 2.0]))
