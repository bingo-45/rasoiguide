# RasoiGuide v2

RasoiGuide is a local-first, bilingual cooking companion built for a noisy Indian kitchen: big touch targets, Hinglish voice commands, power-cut-safe resume, pressure-cooker whistle counting, authored recovery help, and parallel Thali planning. It is an installable React PWA with no account, backend, cookies, analytics, or recurring infrastructure cost.

## Start in two commands

```bash
pnpm i
pnpm dev
```

Open the local address shown by Vite. The bundled Dal Tadka, Jeera Rice, and Aloo Gobi experiences are available immediately; once the service worker has installed, the full touch cooking path works in airplane mode.

Run every local quality gate with:

```bash
pnpm verify
pnpm e2e
pnpm lighthouse
```

## What is working

- Installable offline PWA shell with immutable recipe/content caching and bundled fonts.
- Recipe library, filters, pantry matching, nonlinear serving/andaaz measures, and authored substitutions.
- Gated mise en place plus an experienced-cook escape hatch.
- Persistent cooking sessions in IndexedDB, transition journal, resume after reload, all-timer pause, wake lock, background notification fallback, and original bell cue.
- Immersive cooking view with 64 px targets, timer ring, stove-specific flame translation, proactive risk labels, cookware notes, stage-similarity privacy copy, and touch navigation.
- Bilingual recovery trees and post-cook recovery/substitution recap.
- Web Speech STT and browser TTS with half-duplex behavior, visible voice states, push-to-talk, spoken steps, a semantic 825-positive-example intent corpus, bilingual number parsing, and top-three disambiguation.
- Exact whistle detector thresholds, a live Web Audio adapter, manual fallback, local calibration, and four deterministic WAV gates.
- Backward-scheduled Thali plan with a one-active-step constraint and passive overlaps.
- Settings for English, हिन्दी, Hinglish, stove, katori size, Devanagari numerals, sound, low-battery PTT, and local/offline voice mode.
- Nani Mode data/UX scaffold without pretending the post-v1 transcription pipeline is shipped.

## Honest device support

| Device | Cooking | Browser voice | On-device voice |
|---|---|---|---|
| Android Chrome | Full touch, PWA install, wake lock, notifications, Web Audio whistle count | Best supported; browser vendor may process audio | Adapter and download UI are scaffolded; model binary is not bundled |
| iPhone Safari | Full touch and browser TTS; install through Add to Home Screen | Web Speech is unreliable and must not be assumed | Injectable Whisper/Vosk path; model binary is not bundled |
| Firefox | Full touch | Web Speech unavailable on most builds | Injectable model path or touch-only |
| Desktop Chromium | Full touch/mouse, voice, offline development pass | Supported where OS/browser allows | Injectable adapter |

Touch cooking never depends on microphone permission. The setting labeled On-device voice is honest about the optional model download; the repository exposes lazy adapter seams without putting a 40–300 MB model on the critical path.

## Content

The canonical schema lives in `packages/content-schema`. The complete bilingual reference pack is `content/packs/2.0.0/dal-tadka.json`. It includes authored Hindi throughout, dependencies, scaling curves, variants, substitutions, risk check-ins, whistle metadata, cookware guidance, and recovery trees.

Photography entries are intentionally marked `planned`. The app uses a local, non-stock stage treatment during development. A real, consistently lit stage shoot must replace those frames before a production content release; the repository does not mislabel stock or generated food imagery as recipe evidence.

## Privacy

Default state never leaves the device. IndexedDB holds preferences, sessions, transition history, local notes, ambiguous voice transcripts, and cook history. Camera preview frames are not uploaded. Web Speech is the sole documented exception: the browser may route microphone audio to its vendor service. See `docs/privacy.md`.

## $0 deployment

Push this public repository, connect `apps/web` to Cloudflare Pages, set the build command to `pnpm --filter @rasoiguide/web build`, and the output directory to `apps/web/dist`. No database, account service, secret, paid plan, or credit card is required. See `docs/runbook.md`.

## License

Application code and original content are AGPL-3.0-or-later. Runtime libraries retain their own OSI licenses. The Web Speech API is a browser capability, not a repository dependency, and its network behavior is disclosed in-product.
