# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # development server at http://localhost:3000
npm run build    # production build
npm run start    # run production build
npm run lint     # ESLint via next lint
```

No test suite is configured; lint is the only automated check.

## Configuration

Copy `.env.example` to `.env.local`. Layer 5 (Prompt Engineering) uses a three-tier AI fallback:

1. **OpenRouter** (`OPENROUTER_API_KEY` + optional `OPENROUTER_MODEL`) — free models, primary
2. **Claude** (`ANTHROPIC_API_KEY`) — if no OpenRouter key
3. **Offline evaluator** — if neither key is set; uses `promptCoversRequirements()` in `lib/acrostic.ts`

## Architecture

### Stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Zustand (with localStorage persistence) · Tone.js · `@anthropic-ai/sdk`

### Game Flow
The game is a single-player, RTL Persian educational escape room teaching how LLMs work. Players solve five sequential puzzle layers in 10 minutes. The turn-by-turn game loop is:

```
/ (intro page) → startGame() → /game
  per layer: intro narration → puzzle → outro narration → next layer (or win)
  timer runs out → lose
```

State is held in a single Zustand store ([lib/store.ts](lib/store.ts)) and persisted to `localStorage` under the key `hatef-escape-room` so the session survives page refresh.

### Key Directories

- **`app/`** — Next.js App Router pages
  - `page.tsx` — landing/intro screen
  - `game/page.tsx` — main game orchestrator; renders the current layer's puzzle component based on `currentLayer` from Zustand
  - `api/oracle/route.ts` — server-side POST endpoint that calls the LLM and evaluates Layer 5 acrostic output
- **`components/`**
  - `LayerShell.tsx` — wrapper used by every layer; manages the `intro → puzzle → outro` stage machine and calls `solveLayer()` when outro narration completes
  - `puzzles/` — one component per layer (`Layer1Tokenize` … `Layer5Prompt`); each receives an `onSolved` callback
  - `screens/` — `Intro.tsx`, `Win.tsx`, `Lose.tsx`
  - Shared HUD: `Hud.tsx`, `Timer.tsx`, `ProgressLocks.tsx`, `HintButton.tsx`, `SoundToggle.tsx`, `RestartButton.tsx`, `HatefSpeech.tsx`, `HatefOrb.tsx`, `SceneBackground.tsx`
- **`lib/`**
  - `puzzles.ts` — **all game content**: layer metadata, puzzle data, correct answers, hints, narration strings (Persian)
  - `store.ts` — Zustand game state and actions
  - `scoring.ts` — score computation, `formatTime()`, `toFa()` (convert digits to Persian)
  - `acrostic.ts` — shared logic for checking the Layer 5 acrostic condition (used by both the API route and offline evaluator)
  - `audio.ts` — Tone.js ambient music and SFX; falls back gracefully if `public/audio/ambient.mp3` is absent

### Layer Summary

| Layer | Concept | Mechanic |
|---|---|---|
| 1 | Tokenization | Split a Persian phrase into correct tokens; unlock code from key-token IDs |
| 2 | Embedding | Identify the intruder word in each semantic cluster; collected letters form password |
| 3 | Attention | Draw pronoun-to-referent connections in a sentence |
| 4 | Generation | Step-by-step next-token selection, avoiding dead-end hallucinations |
| 5 | Prompt Engineering | Write a prompt that makes the LLM produce a 3-line acrostic poem (رها) |

### Adding a New Layer
1. Add `LayerMeta` entry to `layers` in `lib/puzzles.ts` and extend `LayerId` type
2. Create `components/puzzles/LayerN.tsx` accepting `{ onSolved: () => void }`
3. Wire it in `app/game/page.tsx` alongside the existing `currentLayer === N` blocks
4. `LayerShell` handles intro/outro automatically using `puzzles.ts` content

### Optional Static Assets
Place files in `public/images/` (`room.png`, `hatef-orb.png`, `layer-1.png` … `layer-5.png`, `win.png`, `lose.png`) and `public/audio/ambient.mp3`; missing files fall back to CSS gradients and generated Tone.js music respectively.

## RTL / Persian Notes
- The entire UI is Persian (`dir="rtl"`); all user-visible strings live in `lib/puzzles.ts`
- `toFa()` in `lib/scoring.ts` converts ASCII digits to Eastern Arabic numerals for display
- The acrostic checker in `lib/acrostic.ts` normalises Arabic letter variants (آ/أ/إ → ا) and strips diacritics before comparing
