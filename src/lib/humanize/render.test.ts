import { describe, expect, it } from 'vitest'
import { renderMarkdown, toView } from './render'
import { segmentText } from './segment'

const TEXT = '# Kop\n\nEen gewone alinea met genoeg woorden erin.\n\n| A | B |\n|---|---|\n| kort | Een langere cel met een hele zin erin. |\n\n- Een lijstitem met genoeg woorden erin.'

describe('renderMarkdown', () => {
  it('keeps headings, tables and lists in order', () => {
    const blocks = segmentText(TEXT)
    const md = renderMarkdown(blocks)
    expect(md).toBe(
      '# Kop\n\nEen gewone alinea met genoeg woorden erin.\n\n| A | B |\n| --- | --- |\n| kort | Een langere cel met een hele zin erin. |\n\n- Een lijstitem met genoeg woorden erin.',
    )
  })

  it('uses outputs where present and escapes pipes in cells', () => {
    const blocks = segmentText(TEXT)
    const cell = blocks.find((b) => b.text.startsWith('Een langere'))!
    expect(renderMarkdown(blocks, { [cell.idx]: 'a | b' })).toContain('| kort | a \\| b |')
  })
})

describe('toView', () => {
  it('groups cells into table rows and flags rewritten blocks', () => {
    const blocks = segmentText(TEXT)
    const view = toView(blocks)
    expect(view.map((v) => v.type)).toEqual(['heading', 'para', 'table', 'list'])
    const table = view[2]
    if (table.type !== 'table') throw new Error('expected table')
    expect(table.rows.map((r) => r.map((c) => c.text))).toEqual([
      ['A', 'B'],
      ['kort', 'Een langere cel met een hele zin erin.'],
    ])
    expect(table.rows[1][1].rewrite).toBe(true)
  })
})
