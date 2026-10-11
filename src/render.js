/**
 * render.js — turns the analysis into DOM.
 *
 * Every value written here comes out of `analyze()`. Nothing is hard-coded,
 * so a re-roll genuinely re-renders the page rather than swapping a string.
 */

import { listIndices, countWord, CountWord } from './seed.js'

/* ── tiny DOM helpers ──────────────────────────────────────────── */

const el = (tag, cls, text) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

/**
 * Build a paragraph from parts. Strings become text nodes; {strong} / {em}
 * parts become emphasised spans. Never uses innerHTML.
 */
function sentence(parts) {
  const frag = document.createDocumentFragment()
  for (const part of parts) {
    if (typeof part === 'string') frag.append(document.createTextNode(part))
    else if (part.strong) frag.append(el('strong', null, part.strong))
    else if (part.em) frag.append(el('em', null, part.em))
  }
  return frag
}

/* ── the 96-cell strip ─────────────────────────────────────────── */

const CELL_COLOUR = {
  l: 'var(--bone-mute)',
  u: 'var(--bone)',
  d: 'var(--ember)',
}

/** Cells are rendered once and kept, so animation can address them by index. */
export function renderStrip(container, analysis) {
  container.textContent = ''
  // `minmax(0, 1fr)` rather than `1fr`: the columns must be allowed to shrink
  // to nothing, otherwise the strip forces the document wider than the screen.
  container.style.gridTemplateColumns = `repeat(${analysis.length}, minmax(0, 1fr))`

  const cells = analysis.cells.map((cell) => {
    const node = el('span', `strip__c strip__c--${cell.kind}`)
    node.style.setProperty('--h', `${cell.h}%`)
    node.style.setProperty('--c', CELL_COLOUR[cell.kind])
    node.dataset.i = String(container.childElementCount)
    container.append(node)
    return node
  })
  return cells
}

/** The strip inside the entry screen counts up to the seed length. */
export function renderLoaderStrip(container, analysis) {
  const cells = renderStrip(container, analysis)
  return cells
}

/* ── signature markers over the strip ──────────────────────────── */

export function renderMarks(container, analysis) {
  container.textContent = ''
  const { signature, length } = analysis
  if (signature.unique) return []

  const marks = signature.indices.map((start) => {
    const centre = (start + (signature.len - 1) / 2 + 0.5) / length
    const mark = el('span', 'mark')
    mark.style.left = `${(centre * 100).toFixed(4)}%`
    mark.append(el('b', null, String(start)))
    container.append(mark)
    return mark
  })
  return marks
}

/* ── the seed, character by character ──────────────────────────── */

export function renderSeedText(node, analysis) {
  node.textContent = ''
  node.setAttribute('aria-label', analysis.seed)

  const inner = document.createElement('span')
  inner.setAttribute('aria-hidden', 'true')

  analysis.chars.forEach((char, i) => {
    let cls = 'l'
    if (char >= '0' && char <= '9') cls = 'd'
    else if (char >= 'A' && char <= 'Z') cls = 'u'
    if (analysis.sigChars.has(i)) cls += ' sg'
    inner.append(el('span', cls, char))
  })

  node.append(inner)
  return inner
}

/* ── the heat trace ────────────────────────────────────────────── */

export function renderHeat(container, analysis) {
  container.textContent = ''
  const cols = Math.max(analysis.digitCount, 1)
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  const bars = analysis.digits.map((digit) => {
    const cell = el('div', 'heat__c')
    cell.style.setProperty('--v', String(digit / 9))
    cell.append(el('i'), el('b', null, String(digit)))
    container.append(cell)
    return cell.querySelector('i')
  })
  return bars
}

/* ── chapter ruler under the heat trace ────────────────────────── */

export function renderChapters(container, analysis) {
  container.textContent = ''
  const cols = Math.max(analysis.digitCount, 1)
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  let cursor = 1
  const labels = analysis.groups.map((group) => {
    const span = Math.max(group.digits.length, 1)
    const node = el('div', 'chap')
    node.style.gridColumn = `${cursor} / ${cursor + span}`
    node.append(
      el('span', 'chap__l', group.label),
      el('span', 'chap__t', `TEMP ${group.temp.toFixed(1)}`),
    )
    container.append(node)
    cursor += span
    return node
  })
  return labels
}

/* ── chapter numbers stamped through the page ──────────────────── */

export function renderChapterNumbers(analysis) {
  const g = analysis.groups
  const set = (id, value) => {
    const node = document.getElementById(id)
    if (node) node.textContent = value
  }

  set('workCh', g[1].label)
  set('seedCh', g[2].label)
  set('methodCh', g[3].label)
  set('outroCh', g[4].label)

  document.querySelectorAll('.nav a').forEach((link, i) => {
    const n = link.querySelector('.nav__n')
    const group = g[i + 1]
    if (n && group) n.textContent = group.label
  })

  const heroMeta = document.querySelector('.hero__metarow span:last-child')
  if (heroMeta) {
    heroMeta.textContent = `Chapter ${g[0].label} · Temp ${g[0].temp.toFixed(1)}`
  }
}

/* ── figures ───────────────────────────────────────────────────── */

export function renderFigures(analysis) {
  const rows = [
    ['Characters', analysis.length],
    ['Digit sum', analysis.digitSum],
    ['Digits', analysis.digitCount],
    ['Unpaired Q', analysis.qCount],
    ['Longest repeat', analysis.signature.unique ? 0 : analysis.signature.len],
  ]

  const nodes = document.querySelectorAll('#figures .figures__r')
  rows.forEach(([label, value], i) => {
    const row = nodes[i]
    if (!row) return
    const dt = row.querySelector('dt')
    const dd = row.querySelector('dd')
    if (dt) dt.textContent = label
    if (dd) {
      dd.dataset.count = String(value)
      // Once the counters are armed, GSAP owns the text.
      if (dd.dataset.v === undefined) dd.textContent = String(value)
    }
  })
}

/** The four hero figures (characters / letters / digits / unpaired Q). */
export function renderLedger(analysis) {
  const rows = [
    ['Characters', analysis.length],
    ['Letters', analysis.letterCount],
    ['Digits', analysis.digitCount],
    ['Unpaired Q', analysis.qCount],
  ]
  const nodes = document.querySelectorAll('#ledger .ledger__r')
  rows.forEach(([label, value], i) => {
    const row = nodes[i]
    if (!row) return
    const dt = row.querySelector('dt')
    const dd = row.querySelector('dd')
    if (dt) dt.textContent = label
    if (dd) {
      dd.dataset.count = String(value)
      if (dd.dataset.v === undefined) dd.textContent = String(value)
    }
  })
}

/* ── the two paragraphs that read the seed aloud ───────────────── */

export function renderCopy(analysis) {
  const { signature, digitSum, digitCount, qCount, qFollowers, length } = analysis

  /* fingerprint paragraph */
  const story = document.getElementById('seedStory')
  if (story) {
    const parts = []

    if (signature.unique) {
      const pairs = length - 1
      parts.push(
        `${CountWord(digitCount)} of them are digits, and they sum to `,
        { strong: String(digitSum) },
        `. No two-character sequence repeats anywhere in the string — ${pairs} pairings, all different. `,
      )
    } else {
      const word = signature.len === 2 ? 'two' : signature.len === 3 ? 'three' : String(signature.len)
      parts.push(
        `${CountWord(digitCount)} of them are digits, and they sum to `,
        { strong: String(digitSum) },
        `. The longest sequence that repeats is `,
        { strong: signature.gram },
        ` — ${word} characters, at ${listIndices(signature.indices)}. `,
      )
      if (analysis.sigMeetsDigitSum) {
        parts.push(
          'That second index is also the sum of every digit in the seed, which is either ',
          { em: 'the point' },
          ' or ',
          { em: 'a coincidence' },
          ' depending on how you feel about randomness.',
        )
      } else {
        parts.push('Nobody put it there.')
      }
    }

    story.replaceChildren(sentence(parts))
  }

  /* Q paragraph */
  const q = document.getElementById('seedQ')
  if (q) {
    if (!qCount) {
      q.replaceChildren(sentence(['No Q at all this time. The seed keeps its own counsel.']))
    } else {
      const followers = [...new Set(qFollowers)]
      const word = countWord(qCount)
      const parts = [
        `The letter Q appears ${word} ${qCount === 1 ? 'time' : 'times'}, and `,
      ]
      if (analysis.qUnpaired) {
        parts.push(
          `it never once pairs with U. ${CountWord(qCount)} times the language expects a partner, and `,
          `${word} times `,
          { em: 'Q' },
          ' goes it alone. That felt like the whole brief.',
        )
      } else {
        parts.push(
          `it takes the company it finds: ${followers.join(', ')}. Good enough to build on.`,
        )
      }
      q.replaceChildren(sentence(parts))
    }
  }
}

/* ── strings that literally carry the seed ─────────────────────── */

export function renderSeedCopies(analysis) {
  const foot = document.getElementById('footSeed')
  if (foot) foot.textContent = analysis.seed

  const cap = document.getElementById('stripCap')
  if (cap) {
    cap.textContent = `${analysis.length} cells · height = case, ember = digit`
  }

  const sum = document.getElementById('heatSum')
  if (sum) sum.textContent = `Sum ${analysis.digitSum}`

  const heatHead = document.querySelector('.heat__head span:first-child')
  if (heatHead) {
    heatHead.textContent = `${CountWord(analysis.digitCount)} digits, read as temperature`
  }
}

/* ── one call to paint everything seed-derived ─────────────────── */

export function renderAll(analysis, { heroStrip, seedStrip, marks, seedText, heat, chapters }) {
  const heroCells = renderStrip(heroStrip, analysis)
  renderStrip(seedStrip, analysis)
  const markNodes = renderMarks(marks, analysis)
  const charNodes = renderSeedText(seedText, analysis)
  const bars = renderHeat(heat, analysis)
  const chapNodes = renderChapters(chapters, analysis)

  renderChapterNumbers(analysis)
  renderFigures(analysis)
  renderLedger(analysis)
  renderCopy(analysis)
  renderSeedCopies(analysis)

  return { heroCells, markNodes, charNodes, bars, chapNodes }
}
