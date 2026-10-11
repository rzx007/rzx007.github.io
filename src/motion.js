/**
 * motion.js — Lenis, GSAP and the ScrollTrigger scenes.
 *
 * Two families of scene:
 *   decorative — reveals, parallax, pinning. Skipped for prefers-reduced-motion.
 *   passive    — the rail readout, active chapter, header hairline. Always on.
 *
 * Scenes are built once. A re-roll re-renders the derived DOM and replays the
 * reveal animations against the new nodes rather than rebuilding triggers.
 */

import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const finePointer = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * How far a masked line sits below its mask before it is revealed.
 *
 * Must match `.js .ln > i` in base.css, and must clear the *clip box*, not the
 * element — the mask is padded for descenders (`--mask-pad`), so an element of
 * height L has to travel L + pad. 140% covers the worst case on this page
 * (line-height .82, pad .3em → 137%).
 *
 * Reveals are written with `fromTo` and pin *both* `yPercent` and `y` to 0 at
 * the end. A plain `to(..., { yPercent: 0 })` silently fails here: the browser
 * converts the CSS percentage transform into a pixel matrix, so GSAP reads the
 * start state as `y: 183px` and never clears it — the heading stays pushed out
 * of its mask forever.
 */
const MASK_OUT = 140

/* ── smooth scroll ─────────────────────────────────────────────── */

export function createSmoothScroll() {
  const lenis = new Lenis({
    lerp: 0.085,        // the damping the whole page is tuned around
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    smoothWheel: true,
    autoRaf: false,     // GSAP's ticker drives it instead
  })

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)

  // In-page navigation goes through Lenis so jumps stay damped.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href')
      if (!id || id === '#') return
      const target = document.querySelector(id)
      if (!target) return
      event.preventDefault()
      lenis.scrollTo(target, {
        offset: -8,
        duration: 1.35,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      })
    })
  })

  return lenis
}

/* ── counters ──────────────────────────────────────────────────── */

/** Count a number up to its `data-count`, starting from what it currently shows. */
export function countTo(node, value, duration = 1.1) {
  const from = Number(node.dataset.v ?? 0)
  const state = { v: from }
  return gsap.to(state, {
    v: value,
    duration,
    ease: 'power2.out',
    onUpdate: () => { node.textContent = String(Math.round(state.v)) },
    onComplete: () => {
      node.dataset.v = String(value)
      node.textContent = String(value)
    },
  })
}

/** Zero every counter so the first pass counts up from nothing. */
function armCounters() {
  document.querySelectorAll('[data-count]').forEach((node) => {
    node.dataset.v = '0'
    node.textContent = '0'
  })
}

/**
 * Belt to the count-up's braces: after `delay` seconds, snap any counter that
 * has not landed on its target. Runs on the GSAP ticker rather than a timer, so
 * it holds even when timers are throttled or the page was backgrounded
 * mid-count — and a figure that is merely *wrong* is worse than one that
 * skipped its flourish.
 */
function settleCounters(selector, delay = 2.2) {
  gsap.delayedCall(delay, () => {
    document.querySelectorAll(selector).forEach((node) => {
      const target = node.dataset.count
      if (target && node.textContent !== target) {
        node.textContent = target
        node.dataset.v = target
      }
    })
  })
}

/* ── the intro, once the entry screen lifts ────────────────────── */

export function playIntro(nodes) {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })

  tl.to('.top', { opacity: 1, duration: .6, ease: 'power2.out' }, 0)
  tl.fromTo('.hero__title .ln > i',
    { yPercent: MASK_OUT, y: 0 },
    { yPercent: 0, y: 0, duration: 1.25, stagger: .085, ease: 'expo.out' }, .06)
  tl.to('.hero__eyebrow, .hero .eyebrow', { opacity: 1, y: 0, duration: .9 }, .34)
  tl.to('.hero__lead', { opacity: 1, y: 0, duration: .9 }, .44)
  tl.to('.hero__cta', { opacity: 1, y: 0, duration: .9 }, .52)
  tl.from('.ledger__r', { opacity: 0, y: 16, duration: .8, stagger: .07 }, .46)
  tl.add(() => {
    document.querySelectorAll('#ledger [data-count]').forEach((node, i) => {
      countTo(node, Number(node.dataset.count), .85 + i * .07)
    })
  }, .5)
  settleCounters('#ledger [data-count]', 2.4)
  tl.from(nodes.heroCells, {
    scaleY: 0, duration: .9, ease: 'power2.out',
    stagger: { each: .008, from: 'start' },
  }, .3)
  tl.from('.hero__metarow', { opacity: 0, duration: .8 }, .82)

  return tl
}

/* ── decorative scenes ─────────────────────────────────────────── */

/**
 * @param {object} ctx
 * @param {object} ctx.nodes refs returned by renderAll()
 * @param {(index:number) => void} ctx.onChapter
 * @returns {{ seedTweens: gsap.core.Tween[], kill: () => void }}
 */
export function buildDecorativeScenes({ nodes, onChapter }) {
  const seedTweens = []

  /* ── hero ──────────────────────────────────────────────────── */
  // Parallax is translate-only. No `scale`: scaling a canvas layer forces the
  // compositor to resample it at 2× every frame, which is far more expensive
  // than the effect is worth. Translate is a straight layer move.
  gsap.to('#fieldHero', {
    yPercent: 2.5,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  })

  gsap.to('.hero__grid', {
    yPercent: -8,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  })

  // The headline previously tweened its `wght` axis on scroll. Re-rasterising a
  // 12rem variable headline every frame is one of the most expensive things a
  // page can do, so the weight is set once and left alone.
  gsap.to('.hero__cue i', {
    scaleX: .3, transformOrigin: 'left', duration: 1.1,
    ease: 'power2.inOut', repeat: -1, yoyo: true,
  })

  /* ── work: reveal, then pin and pan ────────────────────────── */
  const cards = gsap.utils.toArray('[data-card]')

  gsap.from(cards, {
    yPercent: 6, opacity: 0, duration: 1.15, ease: 'expo.out', stagger: .12,
    scrollTrigger: { trigger: '#workStage', start: 'top 88%', once: true },
  })

  const mm = gsap.matchMedia()
  mm.add('(min-width: 900px)', () => {
    const track = document.getElementById('workTrack')
    if (!track) return undefined
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)

    const pan = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '#workStage',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: .65,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })

    return () => pan.kill()
  })

  /* The card fields are frozen stills, so there is no per-pointer parallax
     here: moving a 2× canvas layer on every pointermove buys nothing that the
     compositor can do cheaply, and the cards already read as plates. */

  /* ── seed ──────────────────────────────────────────────────── */
  seedTweens.push(gsap.to('.seed__copy [data-rise]', {
    opacity: 1, y: 0, duration: .9, ease: 'power2.out', stagger: .1,
    scrollTrigger: { trigger: '.seed__top', start: 'top 74%' },
  }))

  seedTweens.push(gsap.from('.figures', {
    opacity: 0, y: 22, duration: .9, ease: 'power2.out',
    scrollTrigger: { trigger: '.seed__top', start: 'top 72%' },
  }))

  seedTweens.push(gsap.from(nodes.seedCells, {
    scaleY: 0, duration: .9, ease: 'power2.out',
    stagger: { each: .007, from: 'start' },
    scrollTrigger: { trigger: '#seedStrip', start: 'top 84%' },
  }))

  seedTweens.push(gsap.from('.strip__cap, .seed__textwrap', {
    opacity: 0, y: 18, duration: .8, ease: 'power2.out', stagger: .08,
    scrollTrigger: { trigger: '#seedStrip', start: 'top 76%' },
  }))

  seedTweens.push(gsap.from(nodes.markNodes, {
    scaleY: 0, duration: .8, ease: 'expo.out', stagger: .14,
    scrollTrigger: { trigger: '#seedStrip', start: 'top 76%' },
  }))

  seedTweens.push(gsap.from(nodes.charNodes.children, {
    opacity: 0, duration: .5, ease: 'power1.out',
    stagger: { each: .006, from: 'start' },
    scrollTrigger: { trigger: '#seedText', start: 'top 84%' },
  }))

  seedTweens.push(gsap.from(nodes.bars, {
    scaleY: 0, duration: .95, ease: 'power3.out', stagger: .05,
    scrollTrigger: { trigger: '#heat', start: 'top 86%' },
  }))

  seedTweens.push(gsap.from('.heat__head', {
    opacity: 0, y: 14, duration: .7, ease: 'power2.out',
    scrollTrigger: { trigger: '#heat', start: 'top 92%' },
  }))

  seedTweens.push(gsap.from(nodes.chapNodes, {
    opacity: 0, y: 12, duration: .7, ease: 'power2.out', stagger: .08,
    scrollTrigger: { trigger: '.chapters', start: 'top 92%' },
  }))

  /* Figures count up the first time the seed section is reached. */
  seedTweens.push(gsap.from('#figures .figures__r', {
    opacity: 0, y: 12, duration: .6, ease: 'power2.out', stagger: .06,
    scrollTrigger: { trigger: '.seed__top', start: 'top 72%' },
    onStart: () => {
      document.querySelectorAll('#figures [data-count]').forEach((node, i) => {
        countTo(node, Number(node.dataset.count), .9 + i * .06)
      })
      settleCounters('#figures [data-count]', 2)
    },
  }))

  /* ── method ────────────────────────────────────────────────── */
  gsap.from('.method__aside > .sechead__i, .method__aside > .method__note', {
    opacity: 0, y: 20, duration: .8, ease: 'power2.out', stagger: .07,
    scrollTrigger: { trigger: '.method__grid', start: 'top 78%' },
  })

  gsap.from('.row', {
    opacity: 0, y: 26, duration: .9, ease: 'power3.out', stagger: .09,
    scrollTrigger: { trigger: '.rows', start: 'top 86%', once: true },
  })

  gsap.from('.chips li', {
    opacity: 0, y: 14, duration: .6, ease: 'power2.out', stagger: .05,
    scrollTrigger: { trigger: '.method__tools', start: 'top 92%' },
  })

  /* ── outro ─────────────────────────────────────────────────── */
  /* Every masked heading on the page, revealed as its section arrives.
     The work / seed / method <h2>s used to be in the markup but in no tween
     at all — the CSS kept them at translate3d(0,140%,0) behind overflow:hidden
     with the no-JS failsafe cancelled, so they simply never appeared. */
  gsap.utils.toArray('.h2').forEach((heading) => {
    const lines = heading.querySelectorAll('.ln > i')
    if (!lines.length) return
    gsap.fromTo(lines,
      { yPercent: MASK_OUT, y: 0 },
      {
        yPercent: 0, y: 0, duration: 1.15, ease: 'expo.out', stagger: .075,
        scrollTrigger: { trigger: heading, start: 'top 86%' },
      })
  })

  gsap.fromTo('.outro__title .ln > i',
    { yPercent: MASK_OUT, y: 0 },
    {
      yPercent: 0, y: 0, duration: 1.15, ease: 'expo.out', stagger: .08,
      scrollTrigger: { trigger: '#contact', start: 'top 70%' },
    })

  gsap.fromTo('#fieldOutro',
    { yPercent: 2.5 },
    {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '#contact', start: 'top bottom', end: 'bottom bottom', scrub: true },
    })

  gsap.from('.outro__cta > *', {
    opacity: 0, y: 22, duration: .9, ease: 'power2.out', stagger: .1,
    scrollTrigger: { trigger: '.outro__cta', start: 'top 90%' },
  })

  gsap.from('.foot__col', {
    opacity: 0, y: 18, duration: .8, ease: 'power2.out', stagger: .09,
    scrollTrigger: { trigger: '.foot', start: 'top 94%' },
  })

  return { seedTweens, mm }
}

/* ── passive scenes: readouts that just report state ───────────── */

/**
 * @param {object} ctx
 * @param {string[]} ctx.sections  ids, top to bottom
 * @param {(index:number) => void} ctx.onChapter
 * @param {boolean} ctx.reduced
 */
export function buildPassiveScenes({ sections, onChapter, reduced = false }) {
  if (!reduced) armCounters()

  const fill = document.getElementById('railFill')
  const triggers = [
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        if (fill) fill.style.height = `${(self.progress * 100).toFixed(2)}%`
      },
    }),
  ]

  sections.forEach((id, index) => {
    const section = document.getElementById(id)
    if (!section) return
    triggers.push(ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) onChapter(index) },
    }))
  })

  triggers.push(ScrollTrigger.create({
    start: 40,
    end: 'max',
    onToggle: (self) => document.body.classList.toggle('is-scrolled', self.isActive),
  }))

  return { triggers, armCounters }
}

/* ── re-play the derived reveals after a re-roll ───────────────── */

export function replayDerived(nodes) {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
  tl.fromTo(nodes.heroCells, { scaleY: 0 }, {
    scaleY: 1, duration: .7, stagger: { each: .005 },
  }, 0)
  tl.fromTo(nodes.seedCells, { scaleY: 0 }, {
    scaleY: 1, duration: .7, stagger: { each: .005 },
  }, 0)
  tl.fromTo(nodes.charNodes.children, { opacity: 0 }, {
    opacity: 1, duration: .45, stagger: { each: .005 },
  }, .05)
  tl.fromTo(nodes.markNodes, { scaleY: 0 }, {
    scaleY: 1, duration: .6, ease: 'expo.out', stagger: .14,
  }, .2)
  tl.fromTo(nodes.bars, { scaleY: 0 }, {
    scaleY: 1, duration: .8, ease: 'power3.out', stagger: .04,
  }, .12)
  tl.fromTo(nodes.chapNodes, { opacity: 0, y: 10 }, {
    opacity: 1, y: 0, duration: .6, stagger: .07,
  }, .22)
  return tl
}

/* ── invariant guard ────────────────────────────────────────────── */

/**
 * A masked line that is *on screen* while still parked below its mask is a bug,
 * never a design: its reveal did not run — a selector missed it, a timeline was
 * interrupted, or GSAP could not clear the transform the CSS set.
 *
 * This is the guard for the class of bug that shipped the work / seed / method
 * headings at `translateY(140%)` behind `overflow: hidden` with no tween
 * attached, so they never appeared at all. Rather than trust that every masked
 * line has a tween, the page now checks, forces any stragglers into place, and
 * says so in the console.
 *
 * Runs on the GSAP ticker (not a timer) so it holds when timers are throttled.
 */
export function guardMaskedHeadings({ at = [3, 7] } = {}) {
  const forced = new Set()

  const check = () => {
    document.querySelectorAll('.h2, .hero__title, .outro__title').forEach((heading) => {
      const box = heading.getBoundingClientRect()
      if (box.height === 0 || box.width === 0) return          // section is hidden
      const onScreen = box.top < window.innerHeight * .94 && box.bottom > 0
      if (!onScreen) return                                    // legitimately parked

      heading.querySelectorAll('.ln > i').forEach((node) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform)
        if (Math.abs(matrix.m42) <= 4) return                  // already in place
        gsap.set(node, { yPercent: 0, y: 0 })
        forced.add((node.textContent || '').trim().slice(0, 30))
      })
    })

    if (forced.size) {
      // eslint-disable-next-line no-console
      console.warn('[motion] reveal never ran for these lines — forced into view:', [...forced])
      document.documentElement.dataset.stuckLines = String(forced.size)
    }
  }

  at.forEach((seconds) => gsap.delayedCall(seconds, check))
  return check
}

/* ── safety net ────────────────────────────────────────────────── */

/** Put the page in its finished state — reduced motion, or a failure path. */
export function revealEverything(nodes) {
  gsap.set('[data-rise], .ln > i', { yPercent: 0, y: 0, opacity: 1 })
  gsap.set('.top, .ledger__r, .hero__metarow, .figures, .heat__head, .strip__cap, .seed__textwrap, .row, .chips li, .foot__col, .method__aside > *',
    { opacity: 1, y: 0 })
  gsap.set('[data-card]', { yPercent: 0, opacity: 1 })
  if (nodes?.heroCells) gsap.set(nodes.heroCells, { scaleY: 1 })
  if (nodes?.seedCells) gsap.set(nodes.seedCells, { scaleY: 1 })
  if (nodes?.markNodes) gsap.set(nodes.markNodes, { scaleY: 1 })
  if (nodes?.charNodes) gsap.set(nodes.charNodes.children, { opacity: 1 })
  if (nodes?.bars) gsap.set(nodes.bars, { scaleY: 1 })
  if (nodes?.chapNodes) gsap.set(nodes.chapNodes, { opacity: 1, y: 0 })
  document.querySelectorAll('[data-count]').forEach((node) => {
    node.textContent = node.dataset.count ?? node.textContent
    node.dataset.v = node.dataset.count ?? '0'
  })
  document.documentElement.classList.add('rv-ready')
}

export { gsap, ScrollTrigger }
