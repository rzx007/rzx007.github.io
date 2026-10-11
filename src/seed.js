/**
 * seed.js — the page's only source of truth.
 *
 * Everything structural on this site (chapters, temperatures, the strip,
 * the heat trace, the shader palettes, the copy) is read off one random
 * 96-character string. Nothing here is hand-tuned for the aesthetic:
 * change the seed and every derived number moves with it.
 */

/** The seed this build ships with. */
export const SEED =
  'bdbkdbNh95NRtgLRzL6NQLeUHdQJac3vsL3WbtmrkQ3DmSRaHtoyVNtsRcq4VXKomtQozXg7T2VZM9dQJnEYZKbCZ46nd98m'

/** Ambiguous glyphs (I, O, l, o, 0, 1) are left out so the string stays readable. */
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export const SEED_LENGTH = 96
export const CHAPTERS = 5

const isDigit = (c) => c >= '0' && c <= '9'
const isUpper = (c) => c >= 'A' && c <= 'Z'
const isLower = (c) => c >= 'a' && c <= 'z'
const isLetter = (c) => isUpper(c) || isLower(c)

/** A fresh seed from the platform CSPRNG. */
export function roll(length = SEED_LENGTH) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Split `n` items into `k` contiguous groups, as evenly as possible. */
function evenGroups(n, k) {
  const sizes = new Array(k).fill(Math.floor(n / k))
  for (let i = 0; i < n % k; i += 1) sizes[i] += 1
  return sizes
}

/** Every n-gram of `len` that occurs more than once, most repeated first. */
function repeats(chars, len) {
  const map = new Map()
  for (let i = 0; i + len <= chars.length; i += 1) {
    const g = chars.slice(i, i + len).join('')
    const at = map.get(g)
    if (at) at.push(i)
    else map.set(g, [i])
  }
  return [...map.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([gram, indices]) => ({ gram, indices, len }))
    .sort((a, b) => b.indices.length - a.indices.length)
}

/**
 * The longest sequence that appears more than once — the seed's fingerprint.
 * Degrades honestly: a random string often has no repeated three-gram at all,
 * so we walk down to pairs and report `unique` when even those never collide.
 */
function fingerprint(chars) {
  for (let len = 6; len >= 2; len -= 1) {
    const found = repeats(chars, len)
    if (found.length) return { ...found[0], collisions: found.length, unique: false }
  }
  return { gram: chars.slice(0, 2).join(''), indices: [0], len: 2, collisions: 0, unique: true }
}

/** Read the 14 digits as five contiguous chapters. */
function chapters(digits) {
  if (digits.length < CHAPTERS) {
    return Array.from({ length: CHAPTERS }, (_, i) => [digits[i % Math.max(1, digits.length)] ?? 0])
  }
  const sizes = evenGroups(digits.length, CHAPTERS)
  let cursor = 0
  return sizes.map((size) => {
    const slice = digits.slice(cursor, cursor + size)
    cursor += size
    return slice
  })
}

/**
 * Derive every number the page needs.
 * @param {string} seed
 */
export function analyze(seed) {
  const chars = [...seed]
  const digits = chars.filter(isDigit).map(Number)
  const digitSum = digits.reduce((a, b) => a + b, 0)

  const qPositions = []
  chars.forEach((c, i) => { if (c === 'Q' || c === 'q') qPositions.push(i) })
  const qFollowers = qPositions.map((i) => chars[i + 1] ?? '—')

  const sig = fingerprint(chars)

  const groups = chapters(digits).map((list, index) => {
    const label = list.join('')
    const temp = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
    return { index, label, digits: list, temp, hot: temp / 9 }
  })

  // Per-character descriptor for the 96-cell strip.
  // Height encodes case; digits additionally light up in ember.
  const cells = chars.map((c) => {
    if (isDigit(c)) return { kind: 'd', value: Number(c), h: 34 + (Number(c) / 9) * 66 }
    if (isUpper(c)) return { kind: 'u', h: 100 }
    return { kind: 'l', h: 34 }
  })

  // Which characters sit inside a repeated sequence (highlighted in the text).
  const sigChars = new Set()
  for (const start of sig.indices) {
    for (let i = start; i < start + sig.len; i += 1) sigChars.add(i)
  }

  // Temperature of the whole seed — drives shader intensity and the rail readout.
  const temp = digits.length ? digitSum / digits.length : 0

  return {
    seed,
    chars,
    cells,
    length: chars.length,

    digits,
    digitCount: digits.length,
    digitSum,

    letterCount: chars.filter(isLetter).length,
    upperCount: chars.filter(isUpper).length,
    lowerCount: chars.filter(isLower).length,
    punctuationFree: chars.every((c) => isLetter(c) || isDigit(c)),

    qPositions,
    qFollowers,
    qCount: qPositions.length,
    qUnpaired: qFollowers.every((f) => f !== 'U' && f !== 'u'),

    signature: sig,
    sigChars,
    /** Does the fingerprint land on the index that equals the digit sum? */
    sigMeetsDigitSum: sig.indices.includes(digitSum),

    groups,
    temp,
    hot: temp / 9,
  }
}

/** "25 and 78" · "25, 31 and 78" */
export function listIndices(indices) {
  if (!indices.length) return 'nowhere'
  if (indices.length === 1) return `index ${indices[0]}`
  const head = indices.slice(0, -1).join(', ')
  return `index ${head} and ${indices[indices.length - 1]}`
}

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
export const countWord = (n) => COUNT_WORD[n] ?? String(n)

/** Sentence-initial version of the same. */
export const CountWord = (n) => {
  const word = countWord(n)
  return word.charAt(0).toUpperCase() + word.slice(1)
}
