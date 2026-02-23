# RoweOS Project Overview

## Purpose
RoweOS is a private AI platform — "Operating intelligence, built for brands." It has two modes:
- **BrandAI Mode** — Business management with 4 agents (Strategy, Marketing, Operations, Documents) across a 5-brand portfolio
- **LifeAI Mode** — Personal life management with coach archetypes

## Tech Stack
- **Single-file HTML app** — no build tools, no bundler, no framework
- Pure vanilla HTML/CSS/JS (ES5 only — no arrow functions, let/const, template literals)
- CDN dependencies: Firebase SDK, Marked.js
- Direct browser API calls to Anthropic/OpenAI/Google (keys in localStorage)
- Optional Firebase sync for cross-device data
- Deployed to Vercel via `deploy.sh`

## Architecture
The entire app is in one file: `RoweOS/dist/index.html` (~118,800 lines)
```
Lines 1-15,000      — CSS (themes, components, animations)
Lines 15,000-44,000  — HTML (views, modals, overlays)
Lines 44,000-118,800 — JavaScript (state, API, logic)
```

Supporting files:
- `RoweOS/dist/api/session.js` — Vercel serverless function
- `RoweOS/dist/vercel.json` — Vercel routing config
- `RoweOS/dist/login.html` — Login page
- `deploy.sh` — Automated deploy (git + zip + Vercel)
- `build.sh` — Minification script

## Owner
Jordan — The Rowe Collection LLC — Austin, Texas

## Current Version
v15.33
