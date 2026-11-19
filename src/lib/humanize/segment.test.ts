import { describe, expect, it } from 'vitest'
import { blocksToText, type OcrBlock } from '../ollama'
import { renderMarkdown, toView } from './render'
import { classify, contexts, joinLines, makeBlock, segmentText, splitLead } from './segment'

describe('segmentText', () => {
  it('handles markdown headings, bullets, lists, Q&A leads and pipe tables', () => {
    const text =
      '# Titel\n\nEerste alinea met een\nafgebroken regel die doorloopt.\n\n•\nWelke vraag stel je hier? ' +
      'Het antwoord is lang genoeg om te herschrijven.\n- Tweede punt met genoeg woorden erin.\n\n' +
      '| A | B |\n|---|---|\n| kort | Een langere cel met een hele zin erin. |\n'
    const blocks = segmentText(text)
    expect([blocks[0].kind, blocks[0].text]).toEqual(['heading', 'Titel'])
    expect(blocks[1].text).toBe('Eerste alinea met een afgebroken regel die doorloopt.')
    expect(blocks[2].kind).toBe('list')
    expect(blocks[2].prefix).toBe('Welke vraag stel je hier?')
    expect(blocks[3].kind).toBe('list')
    expect(blocks[3].marker).toBe('- ')
    const cells = blocks.filter((b) => b.table !== null)
    expect(cells.map((c) => c.text)).toEqual(['A', 'B', 'kort', 'Een langere cel met een hele zin erin.'])
    expect(cells[0].rewrite).toBe(false)
    expect(cells[3].rewrite).toBe(true)
  })

  it('joins hard-wrapped and hyphenated lines', () => {
    expect(joinLines(['een woord', 'en nog een'])).toBe('een woord en nog een')
    expect(joinLines(['afge-', 'broken'])).toBe('afgebroken')
    expect(joinLines(['1. ', 'Kinder', 'tijd en ', 'eerste ', 'lessen'], true)).toBe('1. Kindertijd en eerste lessen')
  })

  it('treats consecutive OCR rows with the same column count as a table', () => {
    const text = [
      'Intro paragraaf met genoeg woorden om te herschrijven.',
      '',
      'Fase | Hindernis | Omweg',
      '1 | Haar vader ziet tekenen als tijdverdrijf bij een meisje. | Ze leert in het atelier van haar vader.',
      '2 | De academie laat vrouwen niet toe tot de lessen. | Privélessen en studeren in musea.',
      '',
      'Daarna volgt weer gewone tekst met een a | b erin.',
    ].join('\n')
    const blocks = segmentText(text)
    const cells = blocks.filter((b) => b.table !== null)
    expect(cells).toHaveLength(9)
    expect(cells.slice(0, 3).map((c) => [c.row, c.col, c.reason])).toEqual([
      [0, 0, 'table header'],
      [0, 1, 'table header'],
      [0, 2, 'table header'],
    ])
    expect(cells[4].rewrite).toBe(true)
    expect(blocks[blocks.length - 1].table).toBeNull()
  })

  it('does not make a table of a single line or of rows with different column counts', () => {
    expect(segmentText('a | b').filter((b) => b.table !== null)).toHaveLength(0)
    expect(segmentText('a | b\nc | d | e').filter((b) => b.table !== null)).toHaveLength(0)
  })

  it('parses blocksToText output (no outer pipes) back into a table', () => {
    const ocr: OcrBlock[] = [
      { label: 'text', bbox: null, text: 'Een alinea voor de tabel met genoeg woorden erin.' },
      { label: 'table', bbox: null, text: '<table><tr><th>Naam</th><th>Jaar</th></tr><tr><td>Anguissola</td><td>1535</td></tr></table>' },
    ]
    const blocks = segmentText(blocksToText(ocr))
    const cells = blocks.filter((b) => b.table !== null)
    expect(cells.map((c) => c.text)).toEqual(['Naam', 'Jaar', 'Anguissola', '1535'])
  })
})

describe('classify', () => {
  const cases: [string, boolean, string][] = [
    ['Fase', false, 'short label'],
    ['1. Opleiding', false, 'short label'],
    ['V', false, 'short label'],
    ['1535–1625', false, 'numbers'],
    ['Bernardino Campi schildert Sofonisba Anguissola, ca. 1559', false, 'caption/label'],
    ['Welke categorie kwam het vaakst voor?', false, 'question'],
    ['Dit is een gewone zin met genoeg woorden om te herschrijven.', true, ''],
  ]
  it.each(cases)('%s', (text, rewrite, reason) => {
    const b = classify(makeBlock({ kind: 'para', text }))
    expect(b.rewrite).toBe(rewrite)
    expect(b.reason).toBe(reason)
  })

  it('splits a Question? Answer lead and a Label: lead', () => {
    const [p, s] = splitLead('Hadden de hindernissen te maken met talent? Nee, geen enkele. Pablita heeft talent.')
    expect(p).toBe('Hadden de hindernissen te maken met talent?')
    expect(s).toBe(' ')
    expect(splitLead('Extra vraag: Ik wilde vooral de keuze centraal stellen.')[0]).toBe('Extra vraag:')
    // a '?' after a full sentence is not a Q&A lead
    expect(splitLead('Zij zet haar auteurschap in beeld. Wie schildert hier wie? Als dochter kreeg zij les.')[0]).toBe('')
  })

  it('keeps accented words as words (unicode-aware)', () => {
    const b = classify(makeBlock({ kind: 'para', text: 'Één café financiële privé zin, volledig geaccentueerd en lang genoeg.' }))
    expect(b.rewrite).toBe(true)
  })
})

describe('contexts', () => {
  it('gives section, neighbours and the table column header', () => {
    const blocks = segmentText('# Kop\n\nEerste zin met genoeg woorden voor een alinea.\n\n| Kolom | Ander |\n| aaa bbb ccc ddd eee | x |')
    const ctx = contexts(blocks, 'Titel')
    const body = blocks.find((b) => b.text.startsWith('Eerste'))!
    expect(ctx.get(body.idx)).toMatchObject({ title: 'Titel', section: 'Kop', prev: 'Kop' })
    const cell = blocks.find((b) => b.text.startsWith('aaa'))!
    expect(ctx.get(cell.idx)!.column).toBe('Kolom')
    expect(ctx.get(blocks[0].idx)!.section).toBe('')
  })
})

describe('HTML tables from OCR', () => {
  it('converts <tr>/<td> markup into table cell blocks', () => {
    const blocks = segmentText(
      'Voor de tabel staat deze alinea met genoeg woorden.\n\n<table><tr><th>Naam</th><th>Jaar</th></tr><tr><td>Een <b>lange</b>  cel met genoeg woorden erin ja.</td><td>1535</td></tr></table>',
    )
    const cells = blocks.filter((b) => b.table !== null)
    expect(cells.map((c) => c.text)).toEqual(['Naam', 'Jaar', 'Een lange cel met genoeg woorden erin ja.', '1535'])
    expect(cells[0].reason).toBe('table header')
    expect(cells[2].rewrite).toBe(true)
  })

  it('keeps an HTML table without rows verbatim and unrewritten', () => {
    const html = '<table>ModelAUCSensitivityPPVLogistic regression0.740.610.41Random forest0.810.720.52</table>'
    const blocks = segmentText(html)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'label', reason: 'html table', rewrite: false, text: html })
    expect(renderMarkdown(blocks)).toBe(html)
    expect(toView(blocks)).toMatchObject([{ type: 'para', text: html, rewrite: false }])
  })
})
