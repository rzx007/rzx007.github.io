# rzx007 — a personal page derived from a random string

**Live:** https://rzx007.github.io/tobias-quill/

A personal site for a senior front-end / full-stack engineer working on AI.
Its entire art direction is *read off* a 96-character random string. The seed was
generated with a shell one-liner:

```bash
# 96 random alphanumerics (no ambiguous I/O/l/0/1)
LC_ALL=C tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' \
  < /dev/urandom | head -c 96
```

```
bdbkdbNh95NRtgLRzL6NQLeUHdQJac3vsL3WbtmrkQ3DmSRaHtoyVNtsRcq4VXKomtQozXg7T2VZM9dQJnEYZKbCZ46nd98m
```

Nothing on the page is hand-tuned for the aesthetic. Chapters, temperatures,
the 96-cell strip, the heat trace, the shader palettes and most of the prose are
computed from that string at runtime. **Press `R`** (or *Re-roll*) and the page
re-derives itself from a fresh seed.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # → dist/
npm run preview
```

Needs a WebGPU browser (Chrome/Edge 113+). Without it the page falls back to
CSS-rendered fields in the same palette, and the colophon says so.

## Deploy

GitHub Pages, built in CI from `.github/workflows/deploy.yml` on every push to
`main`. `dist/` stays gitignored, so the repository only ever holds source and
there is no `gh-pages` branch — Pages is configured with `build_type: workflow`
and receives the build as an artifact.

One thing to know if you fork or rename this: it is a *project* Pages site, so
it is served from `/<repo>/` rather than the domain root, and Vite emits
absolute `/assets/...` paths by default — which 404 there. `base` in
`vite.config.js` is therefore set to `/<repo>/`, and **only for builds**, so
`npm run dev` still serves from `/`. Rename the repository and that string has
to move with it.

The lazy WebGPU chunk is the canary for this: it is a dynamic import, so it is
not referenced in `index.html`, and a wrong `base` shows up as a 404 on
`/assets/shaders-*.js` at runtime rather than as a broken first paint.

## Placeholder copy — replace before sharing widely

Two things on the page are written for you rather than derived, and both are
meant to be edited:

- **The three projects** (`Relay` / `Recall` / `Kestrel`) are realistic
  placeholders with plausible metrics, not a record of work that exists. Swap in
  real projects — or delete cards — in `index.html`, and keep the
  `data-canvas="w1|w2|w3"` attributes if you want to keep the GPU fields.
- **The availability line** in the close reads *“Open to senior front-end and
  AI platform work.”* Change it if that is not true yet.

Everything else — the five chapters, the temperatures, the strip, the heat
trace, the shader palettes, most of the prose — is computed from the seed and
will follow it when you re-roll.

## What the seed actually says

| Derived | Value | Where it lands |
|---|---|---|
| length | 96 | the strip, the ledger |
| 14 digits, summed | 78 | chapter ruler, "digit sum" |
| digits in fives | 956 · 333 · 472 · 946 · 98 | the five chapters |
| mean digit per chapter | 6.7 · 3.0 · 4.3 · 6.3 · 8.5 | chapter temperature; drives shader heat |
| longest repeated run | `dQJ` at 25 and 78 | marked on the strip and in the specimen |
| coincidence | index 78 == digit sum 78 | stated in the prose, computed live |
| Q occurrences | 6, never followed by U | the "unpaired Q" figure and the closing line |
| case pattern | 40 upper / 42 lower | encoded as bar height in the 96-cell strip |

Two structural facts the design leans on: the repeated trigram lands on index
78, which is *also* the sum of every digit — and the letter Q never once pairs
with a U. The page says both out loud, and says "no sequence repeats" honestly
when a re-rolled seed has no repeat at all.

## Art direction

- **Palette** — warm only. Near-black ink `#08090A`, bone paper `#EFEAE1`, one
  ember accent. No blue, no purple, no decorative gradients. Five hand-tuned
  ramps (vermillion → amber → ochre → oxblood → rust); the seed's mean digit
  selects one, so a re-roll recolours both the CSS and the GPU output.
- **Type** — Fraunces (variable) for display, Instrument Sans for text, Azeret
  Mono for data. The seed reads as a *specimen*, so the mono carries real
  information rather than decoration.
- **Motion** — Lenis for damped scroll, GSAP ScrollTrigger for parallax, a
  pinned horizontal work index, masked line reveals, count-ups and a rail
  readout. The hero headline tweens its `wght` axis as you leave it.

## Architecture

```
index.html                 markup + no-JS fallbacks for every derived number
src/
  seed.js                  the seed, its analysis, and the derivation rules
  render.js                analysis → DOM (strip, marks, specimen, heat, prose)
  gl.js                    five WebGPU fields via the `shaders` library
  motion.js                Lenis + GSAP; decorative vs passive scenes
  ui.js                    entry screen, cursor readout, magnets, copy, keys
  main.js                  boot order and the re-roll
  styles/
    tokens.css             palette, spacing scale, type, motion tokens
    base.css               reset, type primitives, strip, field wrapper
    chrome.css             grain, cursor, entry, header, rail
    sections.css           the five chapters + responsive rules
```

`seed.js` is the only source of truth. `render.js` is deliberately dumb: it
turns analysis into nodes and never invents a number. `gl.js` composes effects
by hand from the `shaders` component library (no Pro presets), drawing all five
canvases from one shared WebGPU device.

Boot order matters and is commented in `main.js`: text renders first (it's the
LCP), then scenes, then the GPU fields *in the background* so a slow GPU can
never delay the page, then the entry screen, then the intro.

## Performance

The first version was janky, and the reasons were structural rather than
mysterious. Five things were wrong:

**1. Too many GPU passes.** Every component in a tree is another
full-resolution render pass, and the page was running ~21 of them per frame
across five canvases. The library rasterises at `min(devicePixelRatio, 2)`, so
on any HiDPI display each pass is 4× the pixel area of its CSS box — those 21
passes were really 84 viewport-equivalents of fill per frame.

**2. Full-screen passes spent on things CSS does for free.** A `Vignette`
component was a whole render pass per field; it is now one radial-gradient on
`.field::after`. `FilmGrain` was five more passes over content the global grain
overlay already covered. The fields lost 13 passes between them:

| Field | Before | After |
|---|---|---|
| hero | Aurora · Godrays · SimplexNoise · CursorTrail · Vignette (5) | Aurora · CursorTrail (2) |
| work 01 | Truchet · FilmGrain · Vignette (3) | Truchet (1) |
| work 02 | Marble · ContourLines · FilmGrain · Vignette (4) | Marble · ContourLines (2) |
| work 03 | WorleyNoise · Halftone · FilmGrain · Vignette (4) | WorleyNoise · Halftone (2) |
| outro | MeshGradient · Godrays · SimplexNoise · FilmGrain · Vignette (5) | MeshGradient (1) |

**3. Fields that rendered forever for no reason.** Truchet has no animated
prop at all — it was redrawing an identical frame 60 times a second. The three
work-card fields are now *stills*: they render a few frames after `onReady`,
then `pause()`. That is free, because `pause()` keeps the last frame — the
cards look identical, they just stop costing a pass. A re-roll calls
`repaint()` to show the new ramp before freezing again. Steady state is now the
hero (2 passes) plus the outro (1 pass), and only one of those is on screen at
a time.

**4. Per-frame work the compositor should never have been asked to do.**
- `will-change: transform` on 192 strip cells — 192 promoted layers, now gone.
- `mix-blend-mode: soft-light` on a fixed full-viewport grain layer sitting on
  top of animated canvases — that is an extra full-screen composite every
  frame. Now plain low alpha, visually identical.
- `mix-blend-mode: difference` on two cursor elements.
- A scroll-linked tween on the `wght` axis of a 12rem variable headline.
  **Re-rasterising giant glyphs every frame is one of the most expensive things
  a page can do.** The weight is now set once.
- `scale` scrubs on both full-viewport canvases. Scaling a canvas layer forces
  the compositor to resample it at 2× every frame; the parallax is now
  translate-only, which is a straight layer move.
- Per-card pointer parallax that wrote transforms to canvas layers on every
  `pointermove`.
- Canvas bleed reduced (`-7% -3%` → `-3% 0`): the bleed exists to hide the
  parallax edge, and every extra percent of area is 4× the pixels.

**5. No measurement.** `?fps=1` shows a live frame-rate and quality readout, and
the governor degrades automatically: if two consecutive one-second windows come
in under 50 fps, every field except the hero is frozen. It never degrades the
hero (that is where the interaction lives), never runs on a
`prefers-reduced-motion` render, and ignores the opening windows — measuring
during load would freeze fields before they had painted a single frame.

## Two reveal bugs, and the guard that replaces trusting them

Both of these shipped invisible, and both were hidden by the verification
method: every screenshot taken during development used `?static=1`, which
*bypasses the animation entirely* and jumps to the finished state. The animated
page was never actually rendered.

**1. Three headings had no tween at all.** The work / seed / method `<h2>`s are
wrapped in `.ln` masks, and the CSS parks their lines at `translate3d(0,140%,0)`
behind `overflow: hidden`. The no-JS failsafe that would have revealed them is
cancelled by `.rv-ready` as soon as the module boots — and no tween for them
existed. They were simply never going to appear. All masked headings now get a
reveal, `.h2` included.

**2. `yPercent` cannot clear a pixel `y`.** The hero title was revealed with
`gsap.to(el, { yPercent: 0 })`. The browser converts the CSS percentage
transform into a pixel matrix, so GSAP reads the start state as `y: 183px` —
a *different component* — and `yPercent: 0` never touches it. The headline
stayed pushed out of its mask, showing only a sliver of glyph tops. The
reveals are now `fromTo` with **both** `yPercent` and `y` pinned to 0.

The related mask arithmetic was wrong too: the mask is padded for Fraunces'
descenders, so it is *taller* than the line inside it. The line must travel
`L + pad`, not `L` — the old `112%` did not even reach the clip edge. It is
now `140%`, which covers the worst case on the page (`.82` line-height with
`.3em` pad needs `137%`), with the arithmetic written down in both the CSS and
in `MASK_OUT`.

**The guard.** Because a missed reveal is invisible by construction, the page
now checks its own invariant: any masked line that is *on screen* while still
parked below its mask gets forced into place, and the console says so —

```
[motion] reveal never ran for these lines — forced into view: ['Work,', 'in threes.']
```

It runs on the GSAP ticker (not a timer) at 3s and 7s. `settleCounters()` does
the same for the figure count-ups: a number that merely skipped its flourish is
better than a wrong one, so anything that has not landed is snapped to target.

## A limit of the verification harness

Animation could not be verified reliably here, and that is worth stating
plainly. Chrome's headless `--virtual-time-budget` frequently does not run
`requestAnimationFrame` at all in this environment. When rAF is starved, GSAP's
ticker never advances — so the intro stays at time 0, every `from` tween's
start state is applied, and the page screenshots *blank*. The same starvation
is why the WebGPU fields only sometimes appear.

This is why the two reveal bugs above survived so long: the symptom
(blank hero) and the harness failure (rAF starved) look identical in a
screenshot. What could be confirmed is recorded in the commits — the seed and
work sections rendering complete in animated mode, and one hero capture with
the headline, ledger, CTAs and strip all in place. Everything else rests on the
code reasoning above plus the runtime guard, and should be confirmed by loading
the page in a real browser.

## Verification hooks

| Param | Effect |
|---|---|
| `?static=1` | finished state, no motion, no Lenis — deterministic rendering |
| `?only=<id>` | isolates one section (`hero`, `work`, `seed`, `method`, `contact`) |
| `?fields=<keys>` | mounts only some GPU fields (`hero,outro`) — the quickest way to check whether a local GPU is the bottleneck |
| `?snap=<px\|sectionId>[+offset]` | parks the page at a scroll offset |
| `?overflow=1` | prints every element wider than the viewport |
| `?fps=1` | live frame-rate and quality readout |

`window.__tq` exposes `{ analysis, nodes, chapters, registry, ramp }`, and
`<html data-fields="ok:hero,w1,…">`, `data-frozen` and `data-quality` report
per-canvas health, which fields have been frozen, and the current quality tier.

**If it still feels slow on your machine, run `?fps=1&fields=hero,outro`.** If
that is smooth, the cost is the three work-card canvases; if it is not, a single
2-pass field is already your GPU's limit and the fix has to be resolution
(which the library does not expose) rather than layer count.

## A trap worth knowing about

`MeshGradient` carries a `stops` prop that ships with a **rainbow** default
(`#1a0533 → #6d2fd1 → #e04b9e → #ff8c42 → #ffdf8e`) and is documented as
*"overrides Color A / Color B when set"*. Passing only `colorA`/`colorB` — as
the component's own prop list invites you to — therefore renders purple and
magenta regardless of what you asked for, and nothing warns you.

The close of this page writes `stops` out explicitly (`meshStops()` in
`src/gl.js`), weighted to the dark end so the bone headline stays legible, and
the re-roll updates `stops` rather than `colorA`/`colorB` — updating the
ignored props would have left the previous ramp's mesh on screen. The stop
*count* is what triggers a recompile, so keeping four stops means recolouring
works at runtime.

Every other component used here takes its colours directly, so this was the
only one with the trap.

## Accessibility & performance

- Focus-visible rings, a skip link, semantic landmarks, `aria-label`s on the
  canvases' containers, and labelled figure lists.
- Text is HTML, never canvas, so LCP is a text paint.
- The shader library (~2.5 MB, 714 kB gzipped) is a separate lazily-imported
  chunk; it is never on the critical path.
- One shared WebGPU device across all five fields, so pipelines compile once.
  The library auto-pauses offscreen canvases.
- `prefers-reduced-motion` drops Lenis and every decorative tween, reveals the
  finished state immediately, and pauses the fields shortly after first paint.
- Measured contrast: body text ≥ 5:1 on ink; the ember accent is only used at
  large sizes or as a state change.
- CSS has a 4 s failsafe that reveals the page even if the module never boots.

## Known caveats

- **Frame rate was not measured on your hardware.** The optimisations above are
  structural — fewer render passes, fewer promoted layers, no per-frame glyph
  rasterisation — and each is justified on its own. The headless capture
  environment renders WebGPU in software, so its frame times say nothing about
  a real GPU. Run `?fps=1` locally to get the actual number.
- **WebGPU canvases** were verified healthy (five instances, no failure
  reasons, no console errors) and the hero aurora and outro mesh gradient were
  both captured rendering correctly. Composing several software-WebGPU canvases
  *simultaneously* into a headless screenshot proved unreliable, so fields were
  confirmed individually (`?fields=hero`) rather than together. Worth a look on
  real hardware.
- A real bug was found and fixed along the way: `will-change: transform` on the
  horizontal work track promoted the whole track — three WebGPU canvases
  included — into one composited layer, and Chrome then painted nothing into
  them. The pin still transforms the track (unavoidable for a horizontal pan);
  that path is the one most worth re-checking on a real GPU.
- Narrow-width layout was only verifiable down to ~493 px in the capture
  harness (Chrome clamps the window), so true 360–430 px phone widths are
  unverified. Document overflow was measured as zero at every width tested
  (`scrollWidth === clientWidth`).
