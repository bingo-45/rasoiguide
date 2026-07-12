# @rasoiguide/voice

Local-first voice primitives for RasoiGuide:

- Web Speech STT with an explicit vendor-processing privacy notice.
- Injectable Whisper/Vosk and Piper/sherpa-onnx adapter surfaces; model downloads remain lazy.
- Multilingual MiniLM nearest-exemplar classifier with a deterministic n-gram fallback for tests and low-resource UX.
- English, Hindi, and Hinglish exemplar/evaluation corpora.
- Bilingual number extraction and an XState half-duplex voice machine.

`pnpm eval` evaluates 825 positive utterances plus adversarial near-misses. Production classification should construct `MiniLmOnDeviceEmbedder` with a lazy transformers.js pipeline loader; `HashingSentenceEmbedder` is deliberately small and is not represented as an ML model.
