// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from './html'
import { segmentText } from '../humanize/segment'

describe('htmlToMarkdown', () => {
  it('maps headings, paragraphs and lists', () => {
    const md = htmlToMarkdown(
      '<h1>Title</h1><p>First   paragraph\nwith <b>bold</b> text.</p><h2>Sub</h2><ul><li>One</li><li>Two</li></ul>',
    )
    expect(md).toBe('# Title\n\nFirst paragraph with bold text.\n\n## Sub\n\n- One\n\n- Two')
  })

  it('strips script and style', () => {
    const md = htmlToMarkdown('<style>p{color:red}</style><script>alert(1)</script><p>Visible</p>')
    expect(md).toBe('Visible')
  })

  it('emits table rows with pipes', () => {
    const md = htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>x | y</td></tr></table>')
    expect(md).toBe('| A | B |\n| 1 | x / y |')
  })

  it('splits paragraphs on double br and handles nested lists', () => {
    const md = htmlToMarkdown('<div>One<br><br>Two</div><ul><li>Top<ul><li>Inner</li></ul></li></ul>')
    expect(md).toBe('One\n\nTwo\n\n- Top\n\n- Inner')
  })

  it('output is understood by the segmenter', () => {
    const blocks = segmentText(
      htmlToMarkdown('<h1>Intro</h1><p>This sentence is long enough to be rewritten by the writer model.</p><ul><li>An item in a list that is long enough to rewrite.</li></ul>'),
    )
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'para', 'list'])
    expect(blocks[0].level).toBe(1)
  })
})
