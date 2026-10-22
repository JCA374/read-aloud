# Vendored engine files (all code ships inside the add-on; nothing is loaded from the internet)

| File | From | Version | Licence |
|---|---|---|---|
| `ort.wasm.min.js`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | npm `onnxruntime-web` (github.com/microsoft/onnxruntime) | 1.30.0 | MIT |
| `piper_phonemize.js`, `.wasm`, `.data` | npm `@diffusionstudio/piper-wasm` (github.com/diffusion-studio/piper-wasm) | 1.0.0 | package says MIT; it contains espeak-ng and its data, which are GPL-3.0 |

Voice models are not shipped. They download on first use from huggingface.co/rhasspy/piper-voices
and each has its own licence (to be listed in THIRD-PARTY-NOTICES before any sharing).
