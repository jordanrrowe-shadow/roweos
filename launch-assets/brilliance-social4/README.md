# Brilliance / social4 - Launch Asset Capture

Captured from `RoweOS/dist/social4.html` on 2026-05-01.
Live URL after deploy: https://roweos.com/social4

## Files

22 PNG screenshots + 2 full-page renders, taken with Chromium 147 via Playwright,
deviceScaleFactor=2 (desktop) / 3 (mobile) for retina-ready output.

### Desktop (1440x900 @ 2x)
- `desktop-01-01-cold-open.png` - mid cold-open animation
- `desktop-02-02-hero-wordmark.png` - "Introducing Brilliance" hero, full reveal
- `desktop-03-03-manifesto-beats.png` - "Be Brilliant. Run Brilliant." manifesto
- `desktop-04-04-without-noise.png` - "Brilliance, without the noise."
- `desktop-05-05-tagline-cycle.png` - auto-rotating tagline carousel ("Brilliant by design.")
- `desktop-06-06-features-grid.png` - "One platform. Total brilliance." + 9 feature tiles
- `desktop-07-07-vs-competitors.png` - "Where AI meets actual brilliance." vs grid
- `desktop-08-08-tagline-wall.png` - "Operate. Build. Think. Run." numbered tagline wall
- `desktop-09-09-lives-here-orb.png` - "Brilliance lives here." with glowing orb
- `desktop-10-10-final-cta.png` - "Be Brilliant." final CTA
- `desktop-FULL-PAGE.png` - whole-page render, 11.8MB

### Mobile (390x844 @ 3x, iPhone 14 Pro UA)
- `mobile-01-01-cold-open.png` through `mobile-10-10-final-cta.png` - same scenes
- `mobile-FULL-PAGE.png` - whole-page render, 8.3MB

## Recommended uses

- Hero scene shots (02, 04, 09, 10) for press / X / LinkedIn carousels
- Features grid (06) for product launch copy / feature announcements
- Vs competitors (07) for positioning posts
- Tagline wall (08) for excerpting individual taglines as standalone posts
- FULL-PAGE renders for presentation decks / pitch material

## To re-capture

```bash
# Serve dist
cd RoweOS/dist && python3 -m http.server 8765 &

# Run the shoot
cd /tmp/social4-shoot
PLAYWRIGHT_BROWSERS_PATH=/Users/jordanrowe/Library/Caches/ms-playwright \
  node shoot.mjs
```

The shoot script lives at `/tmp/social4-shoot/shoot.mjs`. Move it to
`scripts/social4-shoot.mjs` if we want it persisted in the repo.
