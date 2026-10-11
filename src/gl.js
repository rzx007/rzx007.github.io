/**
 * gl.js — the WebGPU fields.
 *
 * Performance is the whole design here. Three facts shape it:
 *
 *  1. The library rasterises at `min(devicePixelRatio, 2)` — on any HiDPI
 *     display every canvas is 4× the pixel area of its CSS box. Multi-layer
 *     effects therefore cost four times what they look like they cost.
 *  2. Every additional component in a tree is another full-resolution render
 *     pass. This file went from ~21 passes per frame down to 8.
 *  3. `pause()` keeps the last rendered frame, and the library's own
 *     offscreen handling only *skips* work — it never stops a loop. So a
 *     field with no animated props should be paused on purpose, and a
 *     degraded field still looks correct because it freezes on a good frame.
 *
 * Everything that was a full-screen GPU pass for its own sake — the vignette
 * and the film grain — is done in CSS instead (see `.field::after` and the
 * global `.grain`), which costs the compositor nothing.
 */

/* ── ramps ─────────────────────────────────────────────────────────
   Five warm families, hand-tuned so the page can never leave its palette
   no matter which one the seed selects. */
export const RAMPS = [
  {
    name: 'Vermilion',
    ember: '#FF4A1C', ember2: '#FF8A4C', emberDim: '#A8320F',
    deep: '#2A0603', mid: '#8C2A12', pale: '#FFD9A8', bone: '#EFEAE1',
  },
  {
    name: 'Amber',
    ember: '#FF8A00', ember2: '#FFB259', emberDim: '#9C5200',
    deep: '#2A1403', mid: '#8F5208', pale: '#FFE3B0', bone: '#EFEAE1',
  },
  {
    name: 'Ochre',
    ember: '#D98A24', ember2: '#EFB561', emberDim: '#7A4A0E',
    deep: '#241605', mid: '#7A4E16', pale: '#F2DEB4', bone: '#EFEAE1',
  },
  {
    name: 'Oxblood',
    ember: '#D42B2B', ember2: '#F2705C', emberDim: '#7E1414',
    deep: '#260404', mid: '#841E1A', pale: '#F5CFC2', bone: '#EFEAE1',
  },
  {
    name: 'Rust',
    ember: '#E0551F', ember2: '#F58B57', emberDim: '#83300F',
    deep: '#250B04', mid: '#7E3413', pale: '#F7D2B4', bone: '#EFEAE1',
  },
]

/** Which ramp a seed selects. Stable, and spread across all five. */
export const rampFor = (a) => RAMPS[Math.floor(a.temp) % RAMPS.length]

/**
 * MeshGradient's stops, written out explicitly.
 *
 * This prop is a trap: it ships with a rainbow default and *overrides*
 * colorA/colorB whenever it is set, so a tree that only passes colorA/colorB
 * renders purple-and-magenta no matter what colours it asked for. It is also
 * weighted to the dark end on purpose — the close has a bone headline sitting
 * on this field, and a bright mesh makes it unreadable.
 *
 * The stop *count* is what triggers a recompile (the library checks length),
 * so keeping four stops means a re-roll can recolour the field at runtime.
 */
export const meshStops = (r) => [
  { color: r.deep, position: 0 },
  { color: r.deep, position: 0.2 },
  { color: r.mid, position: 0.64 },
  { color: r.ember, position: 1 },
]

/* ── component trees ─────────────────────────────────────────────
   Layer order matters: components draw first-to-last, so an effect placed
   later grades everything drawn before it. Keep the counts small. */

/**
 * @param {typeof RAMPS[number]} r
 * @param {number} seedValue a 0–100 number derived from the seed
 */
export function fieldTrees(r, seedValue) {
  return {
    /* 956 — the opening field. One generator plus an interactive trail:
       2 passes on the one full-viewport canvas, so Aurora carries the whole
       look with its own curtains and rays. */
    hero: {
      still: false,
      components: [
        { type: 'Aurora', id: 'heroAurora', props: {
          colorA: r.deep, colorB: r.ember, colorC: r.pale,
          colorSpace: 'oklab',
          balance: 42, intensity: 60, curtainCount: 3,
          speed: 2.6, waviness: 74, rayDensity: 30, height: 140,
          center: { x: 0.63, y: 0.42 }, seed: seedValue,
        } },
        { type: 'CursorTrail', id: 'heroTrail', props: {
          colorA: r.pale, colorB: r.ember,
          radius: 1.05, length: 0.72, shrink: 0.8,
          opacity: 0.38, blendMode: 'screen',
        } },
      ],
    },

    /* 333 — the work index. Coldest chapter: bone line work on ink.
       Truchet has no animated prop, so this field is a still: 1 pass,
       rendered a few frames and then frozen. */
    w1: {
      still: true,
      components: [
        { type: 'Truchet', id: 'w1Truchet', props: {
          colorA: '#0A0B0C', colorB: r.bone,
          cells: 12, thickness: 3.4, rotation: 16, softness: 0.03,
          seed: seedValue,
        } },
      ],
    },

    /* A stone-like field with topographic contour lines. Registered as a
       still: the drift was imperceptible, so it is frozen at speed 0. */
    w2: {
      still: true,
      components: [
        { type: 'Marble', id: 'w2Marble', props: {
          colorA: '#CFC6B6', colorB: r.deep, colorC: '#0B0A09',
          scale: 1.9, turbulence: 8, speed: 0, seed: seedValue,
        } },
        { type: 'ContourLines', id: 'w2Lines', props: {
          levels: 14, lineWidth: 1.3, softness: 0.04, gamma: 0.5,
          lineColor: r.ember, backgroundColor: 'transparent', opacity: 0.7,
        } },
      ],
    },

    /* Cellular noise through a halftone screen — a printed surface. */
    w3: {
      still: true,
      components: [
        { type: 'WorleyNoise', id: 'w3Worley', props: {
          colorA: '#F2E4D2', colorB: r.deep, colorSpace: 'oklab',
          scale: 8, octaves: 2, lacunarity: 2.1, persistence: 0.55,
          jitter: 1, contrast: 1.25, balance: -0.05, seed: seedValue, speed: 0,
        } },
        { type: 'Halftone', id: 'w3Half', props: {
          frequency: 130, angle: 28, radius: 0.38,
          misprint: 0.004, misprintAngle: 12,
          paperColor: '#0A0706', blackColor: r.pale,
          cyanColor: r.ember, magentaColor: r.mid, yellowColor: r.bone,
        } },
      ],
    },

    /* 98 — the close. Hottest chapter.
       MeshGradient carries a `stops` prop whose shipped default is a rainbow
       (#1a0533 → #6d2fd1 → #e04b9e → #ff8c42 → #ffdf8e) and it *overrides*
       colorA/colorB whenever it is set — so passing only colorA/colorB
       silently renders the rainbow. The stops are therefore written out
       explicitly, weighted to the dark end: the field reads as deep ember with
       heat concentrated in it, not as a bright wash, which is also what keeps
       the bone headline legible on top. */
    outro: {
      still: false,
      components: [
        { type: 'MeshGradient', id: 'outMesh', props: {
          stops: meshStops(r),
          colorA: r.deep, colorB: r.ember,
          colorSpace: 'oklab',
          count: 4, smoothness: 2.2, variation: 0.34,
          swirl: 0.32, drift: 0.46, wrapping: 0, speed: 0.45, seed: seedValue,
        } },
      ],
    },
  }
}

/** Colour-only patch per component id — used when the seed is re-rolled. */
export function colourPatch(r) {
  return {
    heroAurora: { colorA: r.deep, colorB: r.ember, colorC: r.pale },
    heroTrail:  { colorA: r.pale, colorB: r.ember },
    w1Truchet:  { colorB: r.bone },
    w2Marble:   { colorA: '#CFC6B6', colorB: r.deep },
    w2Lines:    { lineColor: r.ember },
    w3Worley:   { colorA: '#F2E4D2', colorB: r.deep },
    w3Half:     { blackColor: r.pale, cyanColor: r.ember, magentaColor: r.mid, yellowColor: r.bone },
    // Stops, not colorA/colorB: those are ignored while stops are set, which
    // would leave a re-roll showing the previous ramp's mesh.
    outMesh:    { stops: meshStops(r), colorA: r.deep, colorB: r.ember },
  }
}

/* ── mounting ────────────────────────────────────────────────────── */

/**
 * Freeze a field once it has actually painted, then repaint-and-refreeze on
 * demand. `pause()` preserves the last frame, so a frozen field still looks
 * right — it just stops costing a render pass every frame.
 */
function makeStill(instance) {
  let frozen = false
  return {
    get frozen() { return frozen },
    /** Render a short burst so a prop change is visible, then freeze again. */
    repaint(frames = 3) {
      frozen = false
      try { instance.resume() } catch { /* gone */ }
      const tick = (left) => {
        if (left <= 0) {
          try { instance.pause() } catch { /* gone */ }
          frozen = true
          return
        }
        requestAnimationFrame(() => tick(left - 1))
      }
      requestAnimationFrame(() => tick(frames))
    },
    freeze() {
      try { instance.pause() } catch { /* gone */ }
      frozen = true
    },
  }
}

/**
 * Boot every field. Resolves to a registry the rest of the app can poke.
 * Never throws: on any WebGPU failure the page falls back to CSS fields.
 */
export async function mountFields(ramp, seedValue) {
  const trees = fieldTrees(ramp, seedValue)
  const canvases = {
    hero:  document.getElementById('canvasHero'),
    w1:    document.querySelector('[data-canvas="w1"]'),
    w2:    document.querySelector('[data-canvas="w2"]'),
    w3:    document.querySelector('[data-canvas="w3"]'),
    outro: document.getElementById('canvasOutro'),
  }

  const fail = (why) => {
    document.documentElement.classList.add('no-gpu')
    document.documentElement.dataset.fields = `fail:${why}`
    const note = document.getElementById('gpuNote')
    if (note) note.textContent = 'WebGPU unavailable — CSS field shown'
    // eslint-disable-next-line no-console
    console.info(`[field] falling back to CSS: ${why}`)
    return { ok: false, reason: why, instances: {}, stills: {}, stillKeys: [] }
  }

  if (!('gpu' in navigator)) return fail('no navigator.gpu')

  let lib
  try {
    // Dynamic so the ~2.5 MB shader library lands in its own chunk and never
    // delays the text. Vite must see this specifier — no vite-ignore here.
    lib = await import('shaders/js')
  } catch (err) {
    return fail(`module load failed: ${err?.message ?? err}`)
  }

  try {
    if (typeof lib.isWebGPUSupported === 'function' && !(await lib.isWebGPUSupported())) {
      return fail('isWebGPUSupported() false')
    }
  } catch { /* fall through to the real attempt */ }

  // One device for all five instances: pipelines are compiled once and
  // cached across fields, which matters when a page loads several.
  let gpu
  try {
    gpu = typeof lib.createSharedDevice === 'function' ? await lib.createSharedDevice() : undefined
  } catch { gpu = undefined }

  const instances = {}
  const stills = {}
  const only = new URLSearchParams(window.location.search).get('fields')
  const keys = only ? only.split(',').filter((k) => k in trees) : Object.keys(trees)

  await Promise.all(keys.map(async (key) => {
    const entry = trees[key]
    const canvas = canvases[key]
    if (!canvas) return

    // Resolved when the library reports the field is up. Used to freeze the
    // still fields only after they have genuinely painted a frame.
    let markReady
    const ready = new Promise((resolve) => { markReady = resolve })

    const options = {
      colorSpace: 'srgb',
      disableTelemetry: true,
      onReady: () => markReady(),
      ...(gpu ? { gpu } : {}),
      onError: (reason) => {
        // 'device-lost' is recoverable — the library rebuilds itself.
        if (reason !== 'device-lost') fail(reason)
      },
    }

    try {
      const instance = await lib.createShader(canvas, { components: entry.components }, options)
      instances[key] = instance

      if (entry.still) {
        const still = makeStill(instance)
        stills[key] = still
        // Freeze two frames after ready — by then the first frame is up — or
        // after 4s no matter what, so a stalled field cannot animate forever.
        Promise.race([ready, new Promise((r) => window.setTimeout(r, 4000))])
          .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
          .then(() => {
            still.freeze()
            document.documentElement.dataset.frozen =
              Object.keys(stills).filter((k) => stills[k].frozen).join(',')
          })
      } else {
        ready.then(() => {}) // nothing to do; keeps the promise from dangling
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[field:${key}] createShader failed`, err)
      fail(`createShader(${key}) threw`)
    }
  }))

  const ok = Object.keys(instances).length > 0
  if (!ok) return fail('no instances created')

  const stillKeys = Object.keys(stills)

  // If the watchdog already handed these panels to the CSS fallback, take them
  // back: a late GPU is still a working GPU.
  document.documentElement.classList.remove('no-gpu')

  const health = Object.entries(instances).map(([key, instance]) => {
    let reason = null
    try { reason = instance.getFailureReason() } catch { reason = 'unknown' }
    return reason ? `${key}:${reason}` : `${key}:ok`
  })

  const note = document.getElementById('gpuNote')
  if (note) {
    note.textContent = health.every((h) => h.endsWith(':ok'))
      ? `WebGPU field active — ${health.length} canvases, ${stillKeys.length} still`
      : `WebGPU field degraded — ${health.join(' ')}`
  }

  const registry = {
    ok: true,
    instances,
    stills,
    stillKeys,
    all: Object.keys(instances),
    patch: colourPatch(ramp),
    health,
    pause(key) {
      try { instances[key]?.pause() } catch { /* already stopped */ }
    },
    resume(key) {
      try { instances[key]?.resume() } catch { /* gone */ }
    },
    /** Freeze everything except `except` — the adaptive quality step. */
    pauseAll(except = []) {
      Object.keys(instances).forEach((key) => {
        if (except.includes(key)) return
        if (stills[key]) { stills[key].freeze(); return }
        registry.pause(key)
      })
    },
  }

  document.documentElement.dataset.fields = `ok:${Object.keys(instances).join(',')}`
  return registry
}

/** Recolour live instances when a new seed picks a different ramp. */
export function recolour(registry, ramp) {
  if (!registry?.ok) return
  const patch = colourPatch(ramp)
  for (const instance of Object.values(registry.instances)) {
    for (const [id, props] of Object.entries(patch)) {
      try { instance.update(id, props) } catch { /* not in this field */ }
    }
  }
  // A frozen field will not show the new colours until it draws again.
  Object.values(registry.stills ?? {}).forEach((still) => still.repaint())
  registry.patch = patch
}
