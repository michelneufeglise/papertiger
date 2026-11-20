import { describe, expect, it } from 'vitest'
import { fontProfileOf, layoutToMarkdown, stripRunningLines, type PageLayout, type PageMarkdown, type RawTextItem } from './pdfText'

const H = 792

function ti(str: string, x: number, y: number, size = 10, font = 'f1', width?: number): RawTextItem {
  return { str, transform: [size, 0, 0, size, x, y], width: width ?? str.length * size * 0.5, fontName: font }
}

function page(items: RawTextItem[], styles?: PageLayout['styles']): PageMarkdown {
  return layoutToMarkdown({ items, styles, height: H })
}

/** Body lines of 10 pt text, 14 pt pitch, starting at y. */
function bodyLines(texts: string[], x: number, y: number): RawTextItem[] {
  return texts.map((t, i) => ti(t, x, y - i * 14))
}

const FILLER = 'The quick brown fox jumps over the lazy dog again and again.'

describe('pageToMarkdown: lines and spacing', () => {
  it('joins items on one baseline, adding a space only at real gaps', () => {
    const r = page([ti('Hello', 50, 600, 10, 'f1', 25), ti('world', 80, 600, 10, 'f1', 25), ti('foo', 120, 600, 10, 'f1', 15), ti('bar', 135, 600, 10, 'f1', 15), ...bodyLines([FILLER, FILLER], 50, 500)])
    expect(r.text).toContain('Hello world foobar')
  })

  it('does not double a space already present in an item', () => {
    const r = page([ti('Hello ', 50, 600, 10, 'f1', 30), ti('world', 82, 600, 10, 'f1', 25), ...bodyLines([FILLER], 50, 500)])
    expect(r.text).toContain('Hello world')
    expect(r.text).not.toContain('  ')
  })

  it('treats consecutive baselines as one paragraph', () => {
    const r = page(bodyLines(['First line of a paragraph that goes on', 'and continues on the next line here.'], 50, 600))
    expect(r.text).toBe('First line of a paragraph that goes on and continues on the next line here.')
  })
})

describe('pageToMarkdown: hyphens and paragraphs', () => {
  it('joins a trailing hyphen to a lowercase continuation', () => {
    const r = page(bodyLines(['This is a long sentence with an exam-', 'ple of a hyphenated word that wraps.'], 50, 600))
    expect(r.text).toContain('an example of')
  })

  it('keeps the hyphen before an uppercase continuation', () => {
    const r = page(bodyLines(['We compare the Rhine-', 'Main region with the Ruhr area today.'], 50, 600))
    expect(r.text).toContain('Rhine- Main')
  })

  it('starts a new paragraph on a vertical gap over 1.4x the pitch', () => {
    const items = [...bodyLines(['Paragraph one line one is here', 'paragraph one line two is here.'], 50, 600), ...bodyLines(['Paragraph two starts after a gap', 'and has its own second line.'], 50, 600 - 28 - 14)]
    const r = page(items)
    const paras = r.text.split('\n\n')
    expect(paras).toHaveLength(2)
    expect(paras[0]).toBe('Paragraph one line one is here paragraph one line two is here.')
    expect(paras[1]).toContain('Paragraph two starts')
  })

  it('starts a new paragraph on a first-line indent', () => {
    const items = [ti('First paragraph line one is here', 50, 600), ti('first paragraph line two ends.', 50, 586), ti('Indented second paragraph starts', 70, 572), ti('and continues at the margin.', 50, 558)]
    const paras = page(items).text.split('\n\n')
    expect(paras).toHaveLength(2)
    expect(paras[1]).toBe('Indented second paragraph starts and continues at the margin.')
  })
})

describe('pageToMarkdown: headings', () => {
  it('maps larger fonts to #, ## by size rank', () => {
    const items = [
      ti('The Big Title', 50, 700, 24),
      ti('A Section Heading', 50, 660, 16),
      ...bodyLines([FILLER, FILLER, FILLER], 50, 630),
    ]
    const r = page(items)
    expect(r.text.startsWith('# The Big Title\n\n## A Section Heading\n\n')).toBe(true)
    expect(r.text).toContain(FILLER + ' ' + FILLER)
  })

  it('detects an isolated bold body-size line as ###', () => {
    const items = [
      ...bodyLines([FILLER, FILLER], 50, 700),
      ti('Study design', 50, 656, 10, 'bold1'),
      ...bodyLines([FILLER, FILLER], 50, 628),
    ]
    const r = page(items, { bold1: { fontFamily: 'Times-Bold' } })
    expect(r.text).toContain('### Study design')
  })

  it('does not turn a bold sentence ending in a period into a heading', () => {
    const items = [...bodyLines([FILLER], 50, 700), ti('This sentence is bold and ends here.', 50, 672, 10, 'Helvetica-Bold'), ...bodyLines([FILLER], 50, 644)]
    expect(page(items).text).not.toContain('###')
  })

  it('merges a wrapped heading of the same size', () => {
    const items = [ti('A very long title that', 50, 700, 20), ti('wraps onto two lines', 50, 676, 20), ...bodyLines([FILLER, FILLER, FILLER, FILLER], 50, 640)]
    expect(page(items).text.startsWith('# A very long title that wraps onto two lines')).toBe(true)
  })
})

describe('pageToMarkdown: lists', () => {
  it('turns bullets and numbered items into list lines', () => {
    const items = [
      ...bodyLines([FILLER, FILLER], 50, 700),
      ti('• first bullet point', 60, 660),
      ti('◦ second bullet point', 60, 646),
      ti('1. numbered one', 60, 632),
      ti('2) numbered two', 60, 618),
    ]
    const r = page(items)
    expect(r.text).toContain('- first bullet point\n- second bullet point\n1. numbered one\n2. numbered two')
  })

  it('appends hanging continuation lines to the item', () => {
    const items = [ti('- a long item that wraps', 60, 600), ti('onto a second line', 70, 586), ti('- next item', 60, 572)]
    expect(page(items).text).toBe('- a long item that wraps onto a second line\n- next item')
  })
})

describe('pageToMarkdown: columns', () => {
  it('reads the left column fully before the right one', () => {
    const left = Array.from({ length: 10 }, (_, i) => `Left column line number ${i + 1} has text`)
    const right = Array.from({ length: 10 }, (_, i) => `Right column line number ${i + 1} has text`)
    const items = [...bodyLines(left, 50, 700), ...bodyLines(right, 320, 700)]
    const r = page(items)
    expect(r.stats.columns).toBe(true)
    const iLeft10 = r.text.indexOf('Left column line number 10')
    const iRight1 = r.text.indexOf('Right column line number 1 ')
    expect(iLeft10).toBeGreaterThan(-1)
    expect(iRight1).toBeGreaterThan(iLeft10)
    expect(r.text.indexOf('Left column line number 1 ')).toBeLessThan(r.text.indexOf('Left column line number 2 '))
  })

  it('puts a full-width title before both columns', () => {
    const left = Array.from({ length: 9 }, (_, i) => `Left column line number ${i + 1} has text`)
    const right = Array.from({ length: 9 }, (_, i) => `Right column line number ${i + 1} has text`)
    const items = [ti('A full width article title across both columns of the page', 50, 710, 18, 'f1', 500), ...bodyLines(left, 50, 670), ...bodyLines(right, 320, 670)]
    const r = page(items)
    expect(r.text.startsWith('# A full width article title')).toBe(true)
    expect(r.text.indexOf('Left column line number 9')).toBeLessThan(r.text.indexOf('Right column line number 1 '))
  })

  it('does not mistake a single-column table for columns', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [ti(`r${i}`, 50, 700 - i * 14), ti(`${i * 3}`, 200, 700 - i * 14), ti(`${i * 7}`, 350, 700 - i * 14)])
    expect(page(rows.flat()).stats.columns).toBe(false)
  })
})

describe('pageToMarkdown: tables', () => {
  it('writes a 3x3 aligned grid as pipe rows', () => {
    const rows = [
      ['Name', 'Count', 'Share'],
      ['alpha', '12', '40%'],
      ['beta', '18', '60%'],
    ]
    const items = [
      ...bodyLines([FILLER, FILLER], 50, 700),
      ...rows.flatMap((r, i) => r.map((c, j) => ti(c, 50 + j * 150, 640 - i * 14))),
    ]
    const r = page(items)
    expect(r.text).toContain('| Name | Count | Share |\n| alpha | 12 | 40% |\n| beta | 18 | 60% |')
  })

  it('leaves two aligned rows as plain text', () => {
    const items = [ti('a', 50, 600), ti('b', 200, 600), ti('c', 350, 600), ti('d', 50, 586), ti('e', 200, 586), ti('f', 350, 586), ...bodyLines([FILLER], 50, 500)]
    expect(page(items).text).not.toContain('|')
  })
})

describe('pageToMarkdown: verdicts', () => {
  it('is text for normal prose', () => {
    const r = page(bodyLines([FILLER, FILLER, FILLER], 50, 600))
    expect(r.verdict).toBe('text')
    expect(r.stats.chars).toBeGreaterThan(100)
  })

  it('is empty without items or with fewer than 40 characters', () => {
    expect(page([]).verdict).toBe('empty')
    expect(page([ti('Page 1', 50, 30), ti('tiny', 50, 600)]).verdict).toBe('empty')
  })

  it('ignores whitespace-only items and marked-content entries', () => {
    const r = layoutToMarkdown({ items: [{ type: 'beginMarkedContent' }, ti(' ', 50, 600), ...bodyLines([FILLER, FILLER], 50, 500)], height: H })
    expect(r.verdict).toBe('text')
  })

  it('is garbled for replacement and private-use characters', () => {
    const junk = '�� � �'.repeat(6)
    expect(page(bodyLines([junk, junk, junk], 50, 600)).verdict).toBe('garbled')
  })

  it('is garbled when most characters are control or odd symbols', () => {
    const junk = '\u0001\u0002\u0003\u0004 \u0005\u0006\u0007\u0008 \u0001\u0002\u0003\u0004'.repeat(6)
    expect(page(bodyLines([junk, junk, junk], 50, 600)).verdict).toBe('garbled')
  })

  it('is garbled when words are one letter long', () => {
    const junk = 'a b c d e f g h i j k l m n o p q r s t u v w x y z '
    expect(page(bodyLines([junk, junk], 50, 600)).verdict).toBe('garbled')
  })
})

describe('stripRunningLines', () => {
  function numbered(n: number, extra: RawTextItem[] = []): PageMarkdown {
    return page([
      ti('Journal of Imaginary Results', 50, 770),
      ...bodyLines([`Body text of page ${n} goes here and is long enough`, FILLER], 50, 600),
      ti(`Page ${n}`, 280, 30),
      ...extra,
    ])
  }

  it('records header and footer as edge lines', () => {
    const p = numbered(1)
    expect(p.edgeLines.map(e => e.zone).sort()).toEqual(['bottom', 'top'])
  })

  it('drops repeated headers and "Page n" footers, keeps the body', () => {
    const stripped = stripRunningLines([numbered(1), numbered(2), numbered(3), numbered(4)])
    for (const [i, p] of stripped.entries()) {
      expect(p.text).not.toContain('Journal of Imaginary Results')
      expect(p.text).not.toContain('Page ')
      expect(p.text).toContain(`Body text of page ${i + 1}`)
    }
  })

  it('keeps a header that repeats on fewer than 3 pages', () => {
    const stripped = stripRunningLines([numbered(1), numbered(2)])
    expect(stripped[0].text).toContain('Journal of Imaginary Results')
  })

  it('drops lone page numbers even when they do not repeat', () => {
    const p = page([...bodyLines([FILLER, FILLER], 50, 600), ti('- 7 -', 290, 30)])
    expect(stripRunningLines([p])[0].text).not.toContain('7')
  })

  it('never removes body text that matches a running line outside the edge zones', () => {
    const body = (n: number) => page([ti('Journal of Imaginary Results', 50, 770), ...bodyLines([FILLER, FILLER, 'Journal of Imaginary Results'], 50, 600 - n)])
    const stripped = stripRunningLines([body(0), body(1), body(2)])
    expect(stripped[0].text).toContain('Journal of Imaginary Results')
  })
})

describe('fixture regressions', () => {
  const PARA1 = ['It is important to understand how teachers experience autonomy', 'in their daily work and how this shapes motivation [1, 2].']
  const PARA2 = ['A second paragraph starts here and describes the sample of', 'schools that took part in the study over three years.']

  function fixturePage(): PageLayout {
    const items = [
      ti('Teacher Autonomy and Motivation', 50, 720, 20, 'Times-Bold'),
      ti('A Mixed-Methods Study in Three Schools', 50, 690, 14, 'Times-Roman'),
      ti('Introduction', 50, 674, 14, 'Times-Bold'),
      ti(PARA1[0], 50, 648, 11, 'Times-Roman'),
      ti(PARA1[1], 50, 633.7, 11, 'Times-Roman'),
      ti(PARA2[0], 50, 609.4, 11, 'Times-Roman'),
      ti(PARA2[1], 50, 595.1, 11, 'Times-Roman'),
    ]
    return { items, height: H }
  }

  it('does not merge a regular subtitle with a bold heading of the same size', () => {
    const r = layoutToMarkdown(fixturePage())
    expect(r.text).toContain('## A Mixed-Methods Study in Three Schools\n\n## Introduction')
    expect(r.text.startsWith('# Teacher Autonomy and Motivation')).toBe(true)
  })

  it('still merges a wrapped heading of the same size and weight within 1.3x the size', () => {
    const items = [ti('A very long bold title that', 50, 700, 20, 'Times-Bold'), ti('wraps onto two lines', 50, 676, 20, 'Times-Bold'), ...bodyLines([FILLER, FILLER, FILLER], 50, 640)]
    expect(page(items).text.startsWith('# A very long bold title that wraps onto two lines')).toBe(true)
  })

  it('splits paragraphs at 1.7x the body pitch even when headings precede them', () => {
    const paras = layoutToMarkdown(fixturePage()).text.split('\n\n').filter(p => !p.startsWith('#'))
    expect(paras).toHaveLength(2)
    expect(paras[0]).toContain('[1, 2].')
    expect(paras[1].startsWith('A second paragraph')).toBe(true)
  })

  it('ranks heading levels across the whole document, not per page', () => {
    const page1 = fixturePage()
    const page2: PageLayout = {
      items: [ti('Methods', 50, 700, 14, 'Times-Bold'), ti(PARA1[0], 50, 676, 11, 'Times-Roman'), ti(PARA1[1], 50, 661.7, 11, 'Times-Roman')],
      height: H,
    }
    expect(layoutToMarkdown(page2).text.startsWith('# Methods')).toBe(true) // per-page fallback
    const profile = fontProfileOf([page1, page2])
    expect(profile.headingSizes).toEqual([20, 14])
    expect(profile.bodySize).toBe(11)
    expect(layoutToMarkdown(page2, profile).text.startsWith('## Methods')).toBe(true)
    expect(layoutToMarkdown(page1, profile).text.startsWith('# Teacher Autonomy and Motivation')).toBe(true)
    expect(layoutToMarkdown(page1, profile).text).toContain('## Introduction')
  })
})
