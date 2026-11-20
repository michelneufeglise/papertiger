import { describe, expect, it } from 'vitest'
import { rtfToText } from './rtf'

describe('rtfToText', () => {
  it('reads paragraphs and skips font and color tables', () => {
    const rtf =
      '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times;}}{\\colortbl;\\red0\\green0\\blue0;}\\pard First paragraph.\\par Second\\tab one.\\par}'
    expect(rtfToText(rtf)).toBe('First paragraph.\n\nSecond\tone.')
  })
  it('decodes hex escapes and unicode with fallback chars', () => {
    expect(rtfToText("{\\rtf1 caf\\'e9 and \\u8364?uro \\u-10179?\\u-8704? done}")).toBe('café and €uro \u{1F600} done')
  })
  it('skips ignorable destinations and info', () => {
    expect(rtfToText('{\\rtf1{\\*\\generator Word;}{\\info{\\title X}}Body \\{braces\\}}')).toBe('Body {braces}')
  })
  it('uses \\line and symbol words', () => {
    expect(rtfToText('{\\rtf1 a\\line b \\emdash c\\par}')).toBe('a\nb —c')
  })
})
