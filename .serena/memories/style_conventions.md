# Code Style & Conventions

## JavaScript — ES5 ONLY
```javascript
// CORRECT
var items = data.filter(function(d) { return d.active; });
function renderView() { /* ... */ }

// WRONG — never use these
const items = data.filter(d => d.active);  // no const, no arrows
let x = `template ${literal}`;             // no let, no template literals
```

- Use `var` exclusively, never `let` or `const`
- Use `function` keyword declarations, not `var fn = function`
- Null/undefined safety before property access
- HTML escaping via `escapeHtml(str)` for user input in innerHTML
- Wrap localStorage reads and API calls in try/catch
- Tag all changes with version comments: `// v15.33: Description`

## CSS
- Use CSS custom properties: `var(--accent)`, `var(--text-primary)`, etc.
- Light mode: `html.light-mode`
- Mode classes: `html.brand-mode` / `html.life-mode`
- Mobile breakpoint: `@media (max-width: 768px)`
- Glass morphism: `backdrop-filter: blur(20px)`
- Default accent gold: `#a89878`

## Icons — SVG Only, Never Emoji
- ViewBox: `0 0 24 24`, stroke-width: `1.5` or `2`
- Sizes: 14px small, 16px default, 20px large

## Brand Names
Always use `brands[idx].shortName || brands[idx].name` — never full `.name` alone.

## Version Numbering
Two-part format: v15.33 (not v15.33.0). Must update in 8 locations:
1. `ROWEOS_VERSION` JS constant
2. `launchVersionTag` HTML
3. `mobileVersionDisplay` HTML
4. `settingsVersionDisplay` HTML
5. Settings changelog span
6. `.sidebar-version` HTML
7. Welcome footer HTML
8. `.onboarding-welcome-version` HTML
Plus CLAUDE.md.
