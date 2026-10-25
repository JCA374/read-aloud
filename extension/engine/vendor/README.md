# Vendored engine files (all code ships inside the add-on; nothing is loaded from the internet)

Each file is byte-for-byte the file from its npm package (checked 2026-10-25 with `npm pack` and `cmp`).

| File | From | Version | Licence |
|---|---|---|---|
| `ort.wasm.min.js`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | npm `onnxruntime-web` (github.com/microsoft/onnxruntime) | 1.30.0 | MIT, plus the notices of the code compiled into it |
| `piper_phonemize.js`, `.wasm`, `.data` | npm `@diffusionstudio/piper-wasm` (github.com/diffusion-studio/piper-wasm) | 1.0.0 | espeak-ng: GPL-3.0 or later; piper-phonemize: MIT; Emscripten runtime: MIT |

Sources, commits and full licence texts: `THIRD-PARTY-NOTICES` and `licenses/` at the top of the repository
(`build.sh` puts them in the add-on). Voice models are not shipped: they download on first use, each with
its own licence (shown in Settings, from `catalog.js`).
