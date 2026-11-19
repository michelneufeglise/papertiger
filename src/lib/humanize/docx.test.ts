import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildHumanizedDocx } from './docx'
import { segmentText } from './segment'

describe('buildHumanizedDocx', () => {
  it('writes the title, headings, lists, tables and the rewritten text', async () => {
    const text =
      '# Kop\n\nEen gewone alinea met genoeg woorden erin.\n\n- Eerste lijstitem met genoeg woorden erin.\n1. Genummerd item met genoeg woorden erin.\n\n' +
      '| Naam | Jaar |\n|---|---|\n| Anguissola | 1535 |'
    const blocks = segmentText(text)
    const para = blocks.find((b) => b.text.startsWith('Een gewone'))!
    const blob = await buildHumanizedDocx('Mijn document', blocks, { [para.idx]: 'Herschreven alinea.' })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Mijn document')
    expect(xml).toContain('Heading1')
    expect(xml).toContain('Herschreven alinea.')
    expect(xml).not.toContain('Een gewone alinea')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('Anguissola')
    expect(xml).toContain('<w:numPr>')
    expect(xml).toMatch(/<w:b\/?>[\s\S]*Naam/)
    expect(await zip.file('word/numbering.xml')!.async('string')).toContain('w:numFmt w:val="decimal"')
  })
})
