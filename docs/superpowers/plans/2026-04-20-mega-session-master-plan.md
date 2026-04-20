# RoweOS v29.3+ Mega Session Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 7 priorities from the v29.2 roadmap in a single mega session, shipping v29.3+ with data integrity fixes, new features, GCP integrations, promo content, and a new AI assistant.

**Architecture:** Each priority is an independent sub-plan executed sequentially within phases. Phases are ordered by user impact (data loss fixes first) and dependency chains. Each sub-plan produces a deployable increment.

**Tech Stack:** ES5 JavaScript (monolithic build), Firebase/Firestore, Google Cloud APIs, TinyMCE, Vercel, html2canvas

---

## Phase Map

| Phase | Priority | Sub-Plan | Spec Ready? | Complexity |
|-------|----------|----------|-------------|------------|
| **A** | 1. Pulse Goals Per-Doc Sync | `2026-04-20-pulse-goals-per-doc-sync.md` | Yes | Medium |
| **A** | 2. People/Clients Bugs | `2026-04-20-people-clients-bugs.md` | No (bugs) | Small |
| **B** | 3a. Chat Content Selection/Export | `2026-04-20-chat-content-export.md` | Needs spec | Large |
| **B** | 3b. Scribe Polish | `2026-04-20-scribe-polish.md` | Items listed | Medium |
| **B** | 3c. UI Polish | `2026-04-20-ui-polish.md` | Items listed | Small |
| **C** | 4a. Speech-to-Text | `2026-04-20-speech-to-text.md` | Yes | Medium |
| **C** | 5. Analytics KPI Dashboard | `2026-04-20-analytics-kpi-dashboard.md` | Needs spec | Large |
| **D** | 6. Google for Startups Promo | `2026-04-20-google-for-startups-promo.md` | Yes | Large (content) |
| **E** | 7. Travel Planner AI | `2026-04-20-travel-planner-ai.md` | Needs brainstorm | Large |
| **F** | 4b. Cloud Pub/Sub Scheduler | Deferred to v30 | Yes | Very Large |

---

## Execution Order

### Phase A: Data Integrity (Ship First)
**Why first:** 10 real users experiencing data loss and People bugs. Highest impact per line of code.

- [ ] **A1: Pulse Goals Per-Doc Sync** — Migrate from single `pulse/main` array to per-goal Firestore documents. Fixes concurrent edit data loss across devices.
- [ ] **A2: People/Clients Bugs** — (a) Add bulk delete for clients, (b) Add default tab preference setting.
- [ ] **A-Deploy:** Build, commit as v29.3, deploy to roweos.com

### Phase B: Core Features (v29.3 Feature Sprint)
**Why second:** These are the v29 ship items that make the release complete.

- [ ] **B1: Chat Content Selection/Export** — Text selection toolbar, section markers, clip tool for exporting chat content to PDF/Word/Scribe/Library.
- [ ] **B2: Scribe Polish** — @-mention system, knowledge mode AI, People backlinks, Library integration.
- [ ] **B3: UI Polish** — Studio inline results, Pulse drag-and-drop sections.
- [ ] **B-Deploy:** Build, commit as v29.4, deploy

### Phase C: Infrastructure + Analytics (v29.5)
**Why third:** New capabilities that deepen the platform.

- [ ] **C1: Speech-to-Text** — Mic button in Chat and Studio using Google Speech-to-Text REST API.
- [ ] **C2: Analytics KPI Dashboard** — Full redesign with real KPI cards, revenue tracking, client metrics, social performance, brand health scoring.
- [ ] **C-Deploy:** Build, commit as v29.5, deploy

### Phase D: Promo Content (Can Parallel)
**Why here:** Independent of app features. Can be done anytime.

- [ ] **D1: Google for Startups Promo** — social3.html Content Studio, animated HTML pages, website/app badges.
- [ ] **D-Deploy:** Deploy social3.html + vercel.json route

### Phase E: New AI Assistant (v30.0)
**Why last:** Biggest design unknowns, needs brainstorming.

- [ ] **E1: Travel Planner AI** — New LifeAI coach for travel planning.
- [ ] **E-Deploy:** Build, commit as v30.0, deploy

### Phase F: Deferred to Future Session
- **Cloud Pub/Sub Scheduler** — Too risky for a mega session. Requires GCP infra changes, 5-phase migration, and weeks of parallel-run validation. Spec exists; plan when ready for dedicated infra sprint.

---

## Version Bump Schedule

| Milestone | Version | Changes |
|-----------|---------|---------|
| Phase A complete | v29.3 | Pulse per-doc sync + People bugs |
| Phase B complete | v29.4 | Chat export + Scribe polish + UI polish |
| Phase C complete | v29.5 | Speech-to-text + Analytics KPI |
| Phase D complete | v29.5 (no bump) | Promo content (separate deploy path) |
| Phase E complete | v30.0 | Travel Planner AI |

---

## Critical Rules (from CLAUDE.md + Memory)

- **ES5 only** — no arrow functions, let/const, template literals
- **No emoji** — SVG icons only
- **No one-sided borders** — full borders or subtle background tints
- **Version bump all 8 locations** before each deploy
- **Build command:** `bash src/build.sh && ./deploy.sh`
- **Dual execution paths** — always check both runSelectedOperation() and runOp()
- **Firebase sync** — new localStorage keys need BOTH syncToFirebaseV2() AND loadFromFirebaseV2()
- **Mobile CSS selectors** — new views must be added to panel-view + light-mode selectors
- **`ops` is the real global** — `operations` does NOT exist
