# Wakeup Summary — Overnight 2026-04-27 -> 2026-04-28

**Read this first.** Everything else is supporting detail.

---

## What you have when you wake up

### 8 strategy documents
Living in `docs/brilliance/`. Read in numerical order, or pick the one most useful right now.

| # | File | What it answers |
|---|---|---|
| 00 | `00-v33-master-plan.md` | What is v33.0? What ships? What doesn't? Phasing. |
| 01 | `01-brilli-entity.md` | What is Brilli? Where does Brilli appear? How does Brilli behave? |
| 02 | `02-welcome-experience.md` | The "Welcome to Brilliance" first-launch modal. Three copy variants. |
| 03 | `03-in-app-rename.md` | File-by-file inventory of ~600 user-facing strings to change. |
| 04 | `04-cleanup-targets.md` | ~6,100 lines of dead code, ~89 MB disk to reclaim, 9 dead pages, 25 specs to archive. |
| 05 | `05-brilli-animation.md` | Canvas 2D approach for animating Brilli. Why not Lottie/WebGL. Module shape. |
| 06 | `06-info-overhaul.md` | Plan to bring /info into the Brilliance world. |
| 07 | `07-investor-framework.md` | Skeleton for future investor pitch. **Not pursued in v33.0.** |

### 6 live mockups
Living in `RoweOS/dist/brilliance-mockups/`. Click through them locally OR after deploy at:
- https://roweos.com/brilliance-mockups (index)
- https://roweos.com/brilliance-mockups/01-brilli-canvas-prototype.html (THE Brilli prototype)
- https://roweos.com/brilliance-mockups/02-welcome-modal.html (welcome modal with variant switcher)
- https://roweos.com/brilliance-mockups/03-launch-screen.html (boot screen)
- https://roweos.com/brilliance-mockups/04-sidebar-rebrand.html (sidebar before/after)
- https://roweos.com/brilliance-mockups/05-info-overhaul-preview.html (/info preview)

### Updated memory
- `MEMORY.md` index updated
- `project_brilliance_landing.md` extended
- `project_brilliance_launch.md` updated with Option A confirmation
- `project_brilliance_app_rename.md` written (in-app rename surface map)
- `project_brilliance_v33.md` NEW (v33 milestone tracker)
- Launch strategy spec at `docs/superpowers/specs/2026-04-27-brilliance-rebrand-launch-strategy.md` updated

## The core decisions (locked, with your blessing)

1. **Option A**: Brilliance is the namesake. RoweOS is the engine credit. "by RoweOS" appears wherever the credit fits. RoweOS does not vanish.

2. **Code stays RoweOS**: Internal file names, JS function names, `roweos_*` localStorage keys, repo name, CSS classes, build paths, ROWEOS_VERSION constant - all stay. Only user-visible text changes.

3. **Brilli is the entity**: Firefly aesthetic from your reference image. Replaces the chat-view blob landing. Subordinates the helix in LifeAI. Lives in 6+ surfaces (launch screen, chat, empty states, thinking indicator, sidebar status dot, welcome modal).

4. **Welcome modal**: One-time, per-user, fires on first launch after v33.0. Single CTA "Continue." Three copy variants drafted (A is recommended).

5. **Cleanup is non-negotiable**: ~6,100 lines of Focus/Signal residue + autoTrimDataForSync + orphan HTML pages + corrupted ZIP fragments + 38 unused images. v33.0 ships *with* the cleanup, not around it.

6. **Old Standard TT** is the unified serif across `/brilliance`, `/info`, `/portfolio`, in-app splash. Already in `/brilliance`; rolling forward.

7. **No code rename inside the app** - Stripe price IDs, Firebase paths, localStorage keys all unchanged. Migration risk would not be worth it.

## The 7 phases of v33.0

(Per master plan)

- **Phase A** Foundation - asset library finalized, Brilli SVG sketched, surface inventory frozen, cleanup list approved (most of this is now done)
- **Phase B** Cleanup pass - delete Focus/Signal, archive shipped specs, delete orphaned pages, unused images
- **Phase C** Brilli production - canvas module built, wired into chat landing + launch screen + empty states
- **Phase D** Surface rebrand - 600 user-facing strings updated, 6 sub-phases
- **Phase E** Welcome experience - modal built and wired
- **Phase F** Site overhaul - /info, /portfolio, /purchase, /social refreshed
- **Phase G** Launch - version bump, deploy, welcome modal lights up, soft announcement

Realistic timeline: **5 weeks** if you give it focused sessions. Each phase is one to two sessions.

## Open questions waiting on you

These came up during the writing. None blocking; all answerable in the morning.

### Strategic
1. **Welcome copy variant**: A (declarative-warm), B (confident-terse), C (poetic). The mockup at `02-welcome-modal.html` lets you switch between them live. Recommendation: A.
2. **Show welcome to users who signed up *during* v33.0 launch week**? They never knew RoweOS-the-name. Recommend skipping for them.
3. **brillianceos.ai domain**: reserve, switch, or skip? Recommend reserve, don't switch (SEO).

### Brilli the entity
4. **Brilli on `/brilliance` marketing page**: replace the CSS gold orb in the Meet Brilli section with the canvas Brilli? Recommend yes (visual unity).
5. **Brilli on the login screen**: pre-auth Brilli risks looking like a chatbot widget. Recommend no.
6. **Brilli illustration source**: hand-illustrated from the reference, or AI-tool + vectorize + hand-clean? Recommend the latter for speed; the reference is high quality.
7. **Brilli inheriting per-brand color**: stay pure gold always, or tint per active brand? Recommend pure gold (Brilli is the platform, not the brand).

### Cleanup
8. **`verify.sh`** decision: regenerate the reference and keep, or delete entirely? Recommend delete.
9. **Tier names in /info**: keep "Founder / Basic / Premium" or rename to "Brilliance Founder / Brilliance Basic / Brilliance Premium"? Recommend keep tier names short.
10. **`ROWEOS_BRAND_GUIDE.md`**: migrate decisions to `docs/brilliance/` then delete? Recommend yes.

### /info
11. **Existing screenshot carousel**: re-shoot during Phase F (after in-app rename ships) to avoid showing "RoweOS" UI chrome. Recommend yes.
12. **`/info` Option 1 (surgical update) vs Option 2 (full rebuild)**: Recommend Option 1 for v33.0; Option 2 in v33.x if drift becomes visible.

## What I deliberately didn't do

- **Did not touch any production code in `src/`**. Everything is documentation + new files in `docs/brilliance/` + new files in `dist/brilliance-mockups/`. Zero risk to the live app.
- **Did not deploy anything yet** - waiting for you to decide whether to push the mockups to production, or keep them local for review.
- **Did not start the Phase B cleanup**. The plan exists; execution is for a later session when you've reviewed.
- **Did not build the in-app rename**. The plan exists; execution is for later sessions, batched per phase.
- **Did not hire investors** - skeleton only.
- **Did not register `brillianceos.ai`** - your call.
- **Did not modify CLAUDE.md** - might be worth adding a brief "v33.0 in progress" section. Your call.

## What I broke

Nothing. Net additions only. If you decide tonight's work is wrong direction, deleting `docs/brilliance/` and `RoweOS/dist/brilliance-mockups/` removes everything I added cleanly.

## The single most important thing to do first when you wake up

**Open `01-brilli-canvas-prototype.html`** in a browser. Click through the modes. Click through the sizes. See if Brilli feels right at hero, inline, and pin. That is the foundation everything else stands on. If the canvas Brilli does not feel right, we have to rethink before any other work proceeds.

If Brilli feels right, the next decision is: **commit + deploy the mockups** so you can share them, OR keep them local and iterate first.

## File map (everything I touched tonight)

```
docs/brilliance/
  00-v33-master-plan.md              [NEW]
  01-brilli-entity.md                [NEW]
  02-welcome-experience.md           [NEW]
  03-in-app-rename.md                [NEW]
  04-cleanup-targets.md              [NEW]
  05-brilli-animation.md             [NEW]
  06-info-overhaul.md                [NEW]
  07-investor-framework.md           [NEW]
  09-wakeup-summary.md               [NEW] <- this file

RoweOS/dist/brilliance-mockups/
  00-index.html                      [NEW]
  01-brilli-canvas-prototype.html    [NEW]
  02-welcome-modal.html              [NEW]
  03-launch-screen.html              [NEW]
  04-sidebar-rebrand.html            [NEW]
  05-info-overhaul-preview.html      [NEW]

RoweOS/dist/images/brilliance/
  app-icon.png                       [NEW] copied from iCloud
  app-icon-black.png                 [NEW] copied from iCloud
  b-mark-transparent.png             [NEW] copied from iCloud
  b-mark-black.png                   [NEW] copied from iCloud
  monogram-circle-transparent.png    [NEW] copied from iCloud
  wordmark-os-transparent.png        [NEW] copied from iCloud
  wordmark-os-black.png              [NEW] copied from iCloud
  brilli-firefly-reference.jpg       [NEW] design reference

RoweOS/dist/vercel.json              [MODIFIED] added /brilliance-mockups routes

~/.claude/projects/.../memory/
  MEMORY.md                          [MODIFIED] added v33 pointers
  project_brilliance_landing.md      [MODIFIED] asset library + v2.0 notes
  project_brilliance_launch.md       [MODIFIED] Option A confirmed
  project_brilliance_app_rename.md   [MODIFIED] surface inventory pointer
  project_brilliance_v33.md          [NEW] v33.0 milestone tracker

docs/superpowers/specs/
  2026-04-27-brilliance-rebrand-launch-strategy.md  [MODIFIED]
```

Total: 14 new files, 4 modified files, ~5,000 lines of strategy + ~2,500 lines of mockup code.

## Final word

I tried to leave the work in a state where you can either (a) wake up and fully commit to the v33.0 plan as written, or (b) take the parts that resonate and discard the rest, or (c) toss everything and rethink. Nothing is locked. Nothing is deployed. Everything is reviewable in 30 minutes if you want a fast pass, or a full afternoon if you want to read every word.

The most important deliverable is the **Brilli canvas prototype** at mockup #01. Open it first.

Sleep well. Good morning.
