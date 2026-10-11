/**
 * main.js — boot, and the re-roll.
 *
 * Order matters:
 *   1. derive + render from the seed (text is the LCP, so it goes first)
 *   2. wire passive readouts and decorative scenes
 *   3. start the WebGPU fields without blocking the entry screen
 *   4. play the entry, then the intro
 */

import { SEED, analyze, roll } from './seed.js'
import { renderAll, renderLoaderStrip } from './render.js'
import { rampFor, mountFields, recolour } from './gl.js'
import {
  gsap, ScrollTrigger, prefersReduced, createSmoothScroll, playIntro,
  buildDecorativeScenes, buildPassiveScenes, replayDerived, revealEverything,
  countTo, guardMaskedHeadings,
} from './motion.js'
import {
  runEntry, initCursor, initMagnets, initCopyMail, bindReroll, setBusy,
} from './ui.js'

document.documentElement.classList.add('js')

/* Verification affordances: ?static=1 renders the finished state without motion,
   ?snap=<px> parks the page at a scroll offset. Used by the screenshot pass. */
const params = new URLSearchParams(window.location.search)

const SECTIONS = ['hero', 'work', 'seed', 'method', 'contact']

const refs = {
  heroStrip: document.getElementById('heroStrip'),
  seedStrip: document.getElementById('seedStrip'),
  marks: document.getElementById('seedMarks'),
  seedText: document.getElementById('seedText'),
  heat: document.getElementById('heat'),
  chapters: document.getElementById('chapters'),
}

/* ── the ramp drives the CSS palette ───────────────────────────── */

function applyRamp(ramp) {
  const root = document.documentElement.style
  root.setProperty('--ember', ramp.ember)
  root.setProperty('--ember-2', ramp.ember2)
  root.setProperty('--ember-dim', ramp.emberDim)
}

const chapterList = (a) => a.groups.map((group, i) => ({
  id: SECTIONS[i], label: group.label, temp: group.temp,
}))

const seedValue = (a) => Math.min(100, a.digitSum)

/* ── state ─────────────────────────────────────────────────────── */

let chapters = []
let activeChapter = 0
let registry = { ok: false, instances: {} }
let decorative = null
let governor = null
let nodes = null
let busy = false
let buttons = []

/** Rail + nav readout. Called whenever the visible chapter changes. */
function onChapter(index) {
  activeChapter = index
  const chapter = chapters[index]
  if (!chapter) return

  const ch = document.getElementById('railCh')
  const temp = document.getElementById('railTemp')
  if (ch) ch.textContent = chapter.label
  if (temp) temp.textContent = `TEMP ${chapter.temp.toFixed(1)}`

  document.querySelectorAll('.nav a').forEach((link, i) => {
    link.setAttribute('aria-current', i === index - 1 ? 'true' : 'false')
  })
}

/** Animate every counter on the page to its newly derived value. */
function refreshCounters() {
  document.querySelectorAll('[data-count]').forEach((node, i) => {
    countTo(node, Number(node.dataset.count), .8 + i * .05)
  })
}

/* ── re-roll ───────────────────────────────────────────────────── */

async function reroll() {
  if (busy) return
  busy = true
  setBusy(buttons, true)

  try {
    const next = analyze(roll())

    // Retire the seed-bound tweens so they stop driving detached nodes.
    if (decorative) decorative.seedTweens.forEach((tween) => tween.kill())

    applyRamp(rampFor(next))
    nodes = renderAll(next, refs)
    chapters = chapterList(next)
    onChapter(activeChapter)

    recolour(registry, rampFor(next))
    replayDerived(nodes)
    refreshCounters()

    // Layout shifted (chapter labels, digits count), so remeasure.
    ScrollTrigger.refresh()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[re-roll] failed', error)
  } finally {
    busy = false
    setBusy(buttons, false)
  }
}

/* ── performance ───────────────────────────────────────────────────
   Measured, not assumed. Two rules keep this safe:
     · never govern a page that is not animating, and never measure while the
       page is still loading — frame times during a load are meaningless and
       acting on them freezes fields before they have painted a single frame;
     · only ever *freeze*, never remove. `pause()` keeps the last rendered
       frame, so a degraded page still looks correct — it just stops paying
       for render passes. The hero is never frozen: it carries the
       interaction, so degrading stops at "hero only". */

function startGovernor(registry, { showMeter = false, govern = true } = {}) {
  const meter = document.createElement('div')
  if (showMeter) {
    meter.setAttribute('aria-hidden', 'true')
    meter.style.cssText = [
      'position:fixed', 'left:10px', 'bottom:10px', 'z-index:99999',
      'font:11px/1.4 ui-monospace,monospace', 'color:#FF4A1C',
      'background:rgba(8,9,10,.82)', 'padding:5px 8px', 'pointer-events:none',
      'white-space:pre',
    ].join(';')
    document.body.append(meter)
    meter.textContent = '— fps · measuring'
  }

  const canGovern = govern && registry?.ok
  let frames = 0
  let windowStart = performance.now()
  // The first windows cover the entry animation, when frame times mean
  // nothing. Never act on them.
  let warmup = 3
  let slowWindows = 0
  let level = 0

  const tick = (now) => {
    frames += 1
    const elapsed = now - windowStart
    if (elapsed >= 1000) {
      const fps = (frames * 1000) / elapsed
      if (meter) {
        meter.textContent = `${fps.toFixed(0)} fps · ${canGovern ? (level === 0 ? 'full' : 'hero only') : 'meter only'}`
      }

      if (warmup > 0) {
        warmup -= 1
      } else if (canGovern) {
        if (fps < 50) slowWindows += 1
        else slowWindows = 0

        if (level === 0 && slowWindows >= 2) {
          level = 1
          registry.pauseAll(['hero'])
          document.documentElement.dataset.quality = 'hero-only'
          // eslint-disable-next-line no-console
          console.info(`[perf] ${fps.toFixed(0)}fps — freezing all fields except the hero`)
        }
      }

      frames = 0
      windowStart = now
    }
    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
  if (canGovern) document.documentElement.dataset.quality = 'full'
  return { get level() { return level }, canGovern }
}

/* ── boot ──────────────────────────────────────────────────────── */

async function boot() {
  const reduced = prefersReduced() || params.get('static') === '1'
  const analysis = analyze(SEED)

  applyRamp(rampFor(analysis))
  nodes = renderAll(analysis, refs)
  chapters = chapterList(analysis)

  const loaderCells = renderLoaderStrip(document.getElementById('preStrip'), analysis)

  /* ?only=<section> isolates one section at the top of the page.
     This MUST run before any scene is built: collapsing the document with
     `display: none` after ScrollTrigger has measured its trigger positions
     leaves every cached position wrong, so the reveals silently never fire.
     Applying it first means scenes are measured against the layout they will
     actually run in. */
  const only = params.get('only')
  if (only) {
    document.querySelectorAll('main > section').forEach((section) => {
      if (section.id !== only) section.style.display = 'none'
    })
    const foot = document.querySelector('.foot')
    if (foot && only !== 'contact') foot.style.display = 'none'
  }

  initCursor()
  initMagnets()
  initCopyMail()
  buttons = bindReroll(() => reroll())

  /* scrolling */
  let lenis = null
  if (!reduced) {
    lenis = createSmoothScroll()
    lenis.stop()
  }

  /* scenes */
  if (!reduced) decorative = buildDecorativeScenes({ nodes, onChapter })
  buildPassiveScenes({ sections: SECTIONS, onChapter, reduced })
  document.documentElement.classList.add('rv-ready')
  onChapter(0)

  /* WebGPU fields start in the background; nothing below waits on them. */
  const fields = mountFields(rampFor(analysis), seedValue(analysis))
    .then((result) => {
      registry = result
      if (reduced && result.ok) {
        window.setTimeout(() => {
          Object.values(result.instances).forEach((instance) => {
            try { instance.pause() } catch { /* already stopped */ }
          })
        }, 900)
      }
      // Field canvases are sized from their containers, so nothing moved here,
      // but the shared device can shift paint timing — remeasure anyway.
      ScrollTrigger.refresh()
      return result
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[field] mount threw', error)
      document.documentElement.classList.add('no-gpu')
      document.documentElement.dataset.fields = `threw:${error?.message ?? error}`
      return { ok: false, instances: {} }
    })

  /* Watchdog: a GPU that never answers must not leave five blank panels.
     If the fields land later the fallback is withdrawn again in mountFields. */
  const watchdog = window.setTimeout(() => {
    if (document.documentElement.dataset.fields) return
    document.documentElement.classList.add('no-gpu')
    document.documentElement.dataset.fields = 'timeout'
    const note = document.getElementById('gpuNote')
    if (note) note.textContent = 'GPU slow to answer — CSS field shown'
  }, 15000)

  /* Fonts first, so the reveal never fires against a fallback face. */
  const fonts = Promise.race([
    document.fonts.ready,
    new Promise((resolve) => window.setTimeout(resolve, 1800)),
  ])

  await Promise.all([runEntry(analysis, loaderCells, { reduced }), fonts])

  if (lenis) lenis.start()
  const intro = reduced ? null : playIntro(nodes)
  if (reduced) revealEverything(nodes)

  // Nothing masked may stay hidden once it is on screen. Cheap, and it fails
  // loudly instead of shipping an invisible heading.
  guardMaskedHeadings()

  ScrollTrigger.refresh()

  /* ?audit=1 reports why things are or are not visible, on screen, so a
     headless screenshot can carry the answer instead of a guess. Driven by the
     GSAP ticker because timers are throttled in headless virtual time. */
  if (params.get('audit')) {
    gsap.delayedCall(6, () => {
      const read = (sel, prop) => {
        const node = document.querySelector(sel)
        if (!node) return 'missing'
        return getComputedStyle(node)[prop]
      }
      const lines = [
        `reduced=${reduced}  intro=${intro ? `${intro.time().toFixed(2)}s/${intro.progress().toFixed(2)}` : 'none'}`,
        `stuckLines=${document.documentElement.dataset.stuckLines ?? '0'}`,
        `.hero__title .ln>i  transform = ${read('.hero__title .ln > i', 'transform')}`,
        `.hero .eyebrow      opacity   = ${read('.hero .eyebrow', 'opacity')}`,
        `.ledger__r dd       text      = ${document.querySelector('#ledger dd')?.textContent}`,
        `#fieldHero          transform = ${read('#fieldHero', 'transform')}`,
        `fields=${document.documentElement.dataset.fields ?? '-'}  frozen=${document.documentElement.dataset.frozen ?? '-'}  q=${document.documentElement.dataset.quality ?? '-'}`,
      ]
      const pre = document.getElementById('pre')
      if (pre) {
        pre.style.cssText += ';display:block;opacity:1;animation:none;position:fixed;inset:0;background:#08090A;color:#EFEAE1;font:12px/1.7 monospace;white-space:pre-wrap;padding:16px;z-index:99999'
        pre.textContent = lines.join('\n')
      }
    })
  }

  /* Verification affordances. These run before the GPU work settles so a
     slow device can never stall an inspection. */
  const snap = params.get('snap')
  if (snap !== null) {
    // Accepts a pixel offset or a section id, optionally with a +offset.
    const [key, offsetRaw] = snap.split('+')
    const offset = Number(offsetRaw) || 0
    let y = Number(key)
    if (Number.isNaN(y)) {
      const target = document.getElementById(key)
      y = target ? target.getBoundingClientRect().top + window.scrollY : 0
    }
    y = Math.max(0, y + offset)

    const go = () => {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
      else window.scrollTo(0, y)
      ScrollTrigger.update()
    }
    go()
    requestAnimationFrame(go)
  }

  /* ?overflow=1 prints every element wider than the viewport. Layout bugs at
     small widths are otherwise invisible behind `overflow-x: hidden`. */
  if (params.get('overflow')) {
    requestAnimationFrame(() => {
      const vw = document.documentElement.clientWidth
      const rows = []
      document.querySelectorAll('body *').forEach((node) => {
        const rect = node.getBoundingClientRect()
        if (rect.width === 0) return
        if (rect.right > vw + 1 || rect.left < -1) {
          const cls = typeof node.className === 'string' ? node.className.split(' ')[0] : ''
          rows.push(`${node.tagName.toLowerCase()}${cls ? '.' + cls : ''} L${Math.round(rect.left)} R${Math.round(rect.right)} W${Math.round(rect.width)}`)
        }
      })
      const pre = document.getElementById('pre')
      if (pre) {
        pre.style.display = 'block'
        pre.style.opacity = '1'
        pre.style.animation = 'none'
        pre.textContent = `viewport ${vw}px\nscrollWidth ${document.documentElement.scrollWidth}px\n${rows.slice(0, 60).join('\n')}`
        pre.style.cssText += ';font:11px/1.5 monospace;color:#EFEAE1;white-space:pre-wrap;padding:18px;background:#08090A;z-index:99999'
      }
    })
  }

  // Handy in the console, and what the verification pass reads.
  window.__tq = { analysis, nodes, chapters, ramp: rampFor(analysis), get registry() { return registry } }

  await fields

  // The sampler starts straight away so `?fps=1` reads out from the first
  // second; the governor itself ignores the opening windows (see `warmup`)
  // and never runs on a reduced-motion or inspection render.
  governor = startGovernor(registry, {
    showMeter: params.get('fps') === '1',
    govern: !reduced,
  })
}

boot().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[boot] failed', error)
  const pre = document.getElementById('pre')
  if (pre) pre.style.display = 'none'
  document.documentElement.classList.add('rv-ready')
  try { revealEverything(nodes) } catch { /* nothing else to do */ }
})
