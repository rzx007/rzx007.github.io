/**
 * ui.js — entry screen, cursor readout, magnetic targets, copy, keyboard.
 * Small, self-contained behaviours with no knowledge of the seed.
 */

import gsap from 'gsap'

const FINE_POINTER = '(hover: hover) and (pointer: fine)'
export const hasFinePointer = () => window.matchMedia(FINE_POINTER).matches

/* ── entry screen ──────────────────────────────────────────────── */

/**
 * Plays the entry sequence and resolves once the page is uncovered.
 * The CSS has its own 4s failsafe, so a failure here can never trap
 * the visitor behind an overlay.
 */
export function runEntry(analysis, cells, { reduced = false } = {}) {
  const pre = document.getElementById('pre')
  const counter = document.getElementById('preCount')
  const note = document.getElementById('preNote')
  if (!pre) return Promise.resolve()

  const total = analysis.length
  const writeCount = (v) => {
    if (counter) counter.textContent = String(Math.round(v)).padStart(2, '0')
  }
  writeCount(0)

  if (reduced) {
    pre.style.display = 'none'
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    gsap.set(cells, { scaleY: 0 })

    const tl = gsap.timeline({
      onComplete: () => {
        pre.style.display = 'none'
        resolve()
      },
    })

    const state = { v: 0 }
    tl.to(state, {
      v: total, duration: 1, ease: 'power2.inOut',
      onUpdate: () => writeCount(state.v),
    }, 0)

    tl.to(cells, {
      scaleY: 1, duration: 1, ease: 'power2.out',
      stagger: { each: 1 / total },
    }, 0)

    tl.add(() => {
      if (note) {
        note.textContent = 'seed accepted — building five fields'
        note.dataset.state = 'ready'
      }
    }, .92)

    tl.to(pre, { yPercent: -101, duration: .95, ease: 'expo.inOut' }, 1.18)
  })
}

/* ── cursor readout ────────────────────────────────────────────── */

export function initCursor() {
  if (!hasFinePointer()) return null

  const cursor = document.getElementById('cursor')
  const label = document.getElementById('cursorLabel')
  if (!cursor) return null

  const xTo = gsap.quickTo(cursor, 'x', { duration: .28, ease: 'power3' })
  const yTo = gsap.quickTo(cursor, 'y', { duration: .28, ease: 'power3' })

  let seen = false
  let current = null

  window.addEventListener('pointermove', (event) => {
    if (!seen) {
      seen = true
      document.body.classList.add('has-cursor')
      cursor.classList.add('is-on')
      gsap.set(cursor, { x: event.clientX, y: event.clientY })
    }
    xTo(event.clientX)
    yTo(event.clientY)

    const target = event.target instanceof Element
      ? event.target.closest('[data-cursor], a, button')
      : null

    if (target === current) return
    current = target

    if (!target) {
      cursor.classList.remove('is-active')
      if (label) label.textContent = ''
      return
    }

    cursor.classList.add('is-active')
    if (label) label.textContent = target.getAttribute('data-cursor') ?? ''
  }, { passive: true })

  window.addEventListener('pointerdown', () => cursor.classList.add('is-down'))
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'))
  window.addEventListener('blur', () => cursor.classList.remove('is-down'))

  return cursor
}

/* ── magnetic targets ──────────────────────────────────────────── */

export function initMagnets(selector = '.mail') {
  if (!hasFinePointer()) return
  document.querySelectorAll(selector).forEach((node) => {
    const xTo = gsap.quickTo(node, 'x', { duration: .55, ease: 'power3.out' })
    const yTo = gsap.quickTo(node, 'y', { duration: .55, ease: 'power3.out' })

    node.addEventListener('pointermove', (event) => {
      const rect = node.getBoundingClientRect()
      xTo(((event.clientX - rect.left) / rect.width - .5) * 12)
      yTo(((event.clientY - rect.top) / rect.height - .5) * 9)
    })
    node.addEventListener('pointerleave', () => { xTo(0); yTo(0) })
  })
}

/* ── copy the address ──────────────────────────────────────────── */

export function initCopyMail() {
  const button = document.getElementById('mail')
  const hint = document.getElementById('mailHint')
  if (!button || !hint) return

  const textNode = button.querySelector('.mail__t')
  const address = (textNode?.textContent ?? '').trim()
  if (!address) return

  let timer = 0
  const say = (message, ok) => {
    hint.textContent = message
    if (ok) hint.dataset.state = 'ok'
    else delete hint.dataset.state
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      hint.textContent = 'Click to copy'
      delete hint.dataset.state
    }, 2600)
  }

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address)
      say('Copied — R for a new seed', true)
      return
    } catch { /* clipboard blocked; fall through to selection */ }

    try {
      const range = document.createRange()
      range.selectNodeContents(textNode)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      say('Selected — press Ctrl+C', true)
    } catch {
      say('Write to mail@tobiasquill.com', false)
    }
  })
}

/* ── re-roll triggers ──────────────────────────────────────────── */

export function bindReroll(handler) {
  const buttons = ['rerollTop', 'rerollFoot']
    .map((id) => document.getElementById(id))
    .filter(Boolean)

  buttons.forEach((button) => button.addEventListener('click', () => handler()))

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target
    if (target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      handler()
    }
  })

  return buttons
}

export const setBusy = (buttons, busy) =>
  buttons.forEach((button) => button.classList.toggle('is-busy', busy))
