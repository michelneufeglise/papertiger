// A small RTF to text parser: groups, \par / \line / \tab, \'hh (cp1252), \uN? and skipped destinations.

const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'headerl', 'headerr',
  'footerl', 'footerr', 'headerf', 'footerf', 'themedata', 'colorschememapping', 'latentstyles',
  'datastore', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'fldinst',
  'object', 'bkmkstart', 'bkmkend', 'private', 'revtbl', 'pgdsctbl', 'template', 'filetbl',
])

const SYMBOLS: Record<string, string> = {
  emdash: '—', endash: '–', bullet: '•', lquote: '‘', rquote: '’',
  ldblquote: '“', rdblquote: '”', emspace: ' ', enspace: ' ', qmspace: ' ',
  tab: '\t', line: '\n', page: '\n\n', sect: '\n\n', lbrace: '{', rbrace: '}',
}

const cp1252 = new TextDecoder('windows-1252')

interface GroupState {
  skip: boolean
  uc: number
}

export function rtfToText(input: string): string {
  const s = input
  let out = ''
  const stack: GroupState[] = []
  let cur: GroupState = { skip: false, uc: 1 }
  let i = 0
  let skipChars = 0 // characters to drop after a \uN
  let atGroupStart = false

  const emit = (t: string) => {
    if (!cur.skip) out += t
  }

  while (i < s.length) {
    const ch = s[i]
    if (ch === '{') {
      stack.push({ ...cur })
      i++
      atGroupStart = true
      continue
    }
    if (ch === '}') {
      cur = stack.pop() ?? cur
      i++
      atGroupStart = false
      continue
    }
    if (ch === '\\') {
      const next = s[i + 1]
      if (next === undefined) break
      if (next === '\\' || next === '{' || next === '}') {
        if (skipChars > 0) skipChars--
        else emit(next)
        i += 2
        atGroupStart = false
        continue
      }
      if (next === '\n' || next === '\r') {
        emit('\n\n')
        i += 2
        atGroupStart = false
        continue
      }
      if (next === '~') { emit(' '); i += 2; atGroupStart = false; continue }
      if (next === '-' || next === '_') { emit(next === '_' ? '‑' : ''); i += 2; atGroupStart = false; continue }
      if (next === '*') {
        // Ignorable destination: skip the whole group unless it is understood (we understand none).
        cur.skip = true
        i += 2
        atGroupStart = false
        continue
      }
      if (next === "'") {
        const hex = s.slice(i + 2, i + 4)
        i += 4
        if (skipChars > 0) skipChars--
        else if (/^[0-9a-fA-F]{2}$/.test(hex)) emit(cp1252.decode(Uint8Array.of(parseInt(hex, 16))))
        atGroupStart = false
        continue
      }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40))
      if (!m) {
        i += 2
        atGroupStart = false
        continue
      }
      i += m[0].length
      const word = m[1]
      const num = m[2] !== undefined ? parseInt(m[2], 10) : undefined
      if (atGroupStart && SKIP_DESTINATIONS.has(word)) cur.skip = true
      atGroupStart = false
      if (word === 'par' || word === 'sect') emit('\n\n')
      else if (word === 'line') emit('\n')
      else if (word === 'tab') emit('\t')
      else if (word === 'cell' || word === 'nestcell' || word === 'row' || word === 'nestrow') emit('\n\n')
      else if (word === 'uc') cur.uc = num ?? 1
      else if (word === 'u') {
        let code = num ?? 0
        if (code < 0) code += 65536
        emit(String.fromCharCode(code))
        skipChars = cur.uc
      } else if (word in SYMBOLS) emit(SYMBOLS[word])
      continue
    }
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }
    atGroupStart = false
    if (skipChars > 0) {
      skipChars--
    } else {
      emit(ch)
    }
    i++
  }

  return out
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+/gm, '')
    .trim()
}
