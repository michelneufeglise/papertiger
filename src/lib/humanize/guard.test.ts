import { describe, expect, it } from 'vitest'
import { checkBlock, checkEdit, cleanOutput, documentNames, keyTerms, protectedTokens, quotedSpans, restoreQuotes } from './guard'
import { makeBlock } from './segment'

const SRC =
  'Sofonisba Anguissola (Cremona, ca. 1535–1625) schilderde haar leraar. ' +
  'Als adellijke dochter kreeg zij les van Campi. Vasari prees haar werk in 1559.'

describe('checkBlock', () => {
  it('accepts a faithful rewrite', () => {
    const out =
      'Sofonisba Anguissola (Cremona, ca. 1535-1625) schilderde haar eigen leraar. ' +
      'Zij kreeg als adellijke dochter les van Campi, en Vasari prees haar werk in 1559.'
    expect(checkBlock(SRC, out, { lang: 'nl' })).toEqual([])
  })

  it('flags repetition, missing names and length', () => {
    const rep = SRC + ' Als adellijke dochter kreeg zij les van Campi.'
    expect(checkBlock(SRC, rep, { lang: 'nl' })).toContain('repeated sentence')
    const loop = 'Zij kreeg les van haar vader en van Campi en zij kreeg les van haar vader en van Campi. ' + SRC
    expect(checkBlock(SRC, loop, { lang: 'nl' }).some((i) => i.startsWith('repeated'))).toBe(true)
    const miss = 'Anguissola schilderde haar leraar. Zij kreeg les van een meester, rond 1559 geprezen.'
    const issues = checkBlock(SRC, miss, { lang: 'nl' })
    expect(issues.some((i) => i.startsWith('missing:') && i.includes('Campi') && i.includes('Cremona'))).toBe(true)
    // a sentence-initial name only counts when the document uses it as a name elsewhere
    expect(issues.some((i) => i.includes('Vasari'))).toBe(false)
    const names = documentNames(['Het werk werd door Vasari geprezen.'], 'nl')
    expect(names.has('Vasari')).toBe(true)
    expect(checkBlock(SRC, miss, { lang: 'nl', names }).some((i) => i.includes('Vasari'))).toBe(true)
    expect(checkBlock(SRC, 'Kort.', { lang: 'nl' }).some((i) => i.startsWith('length'))).toBe(true)
    expect(checkBlock(SRC, '')).toEqual(['empty output'])
  })

  it('checks key terms and quotes, and tolerates reworded key terms at heavy strength', () => {
    const src = 'Daardoor mist ze de basis voor historieschilderkunst. Critici noemen het “knap voor een vrouw” en meer.'
    const bad = 'Hierdoor mist ze de basis voor genreschilderkunst. Critici noemen het knap voor een vrouw en meer.'
    const issues = checkBlock(src, bad, { lang: 'nl' })
    expect(issues.some((i) => i.includes('historieschilderkunst'))).toBe(true)
    expect(issues.some((i) => i.startsWith('quotation changed'))).toBe(true)
    expect(checkBlock(src, bad, { lang: 'nl', intensity: 'heavy' }).some((i) => i.includes('historieschilderkunst'))).toBe(false)
    expect(restoreQuotes('als “knap”', 'als „knap“')).toBe('als “knap”')
  })

  it('uses unicode word characters (accents are letters)', () => {
    expect(keyTerms('een heel bijzondere éénmaligeéééééé term')).toContain('éénmaligeéééééé')
    expect(protectedTokens('Hij sprak met Zoë Éva over Ørsted.')).toEqual(['Zoë', 'Éva', 'Ørsted'])
    expect(quotedSpans('hij zei “hallo daar” en „tot ziens”')).toEqual(['hallo daar', 'tot ziens'])
  })
})

describe('cleanOutput', () => {
  it('strips think blocks, a preamble line and an echoed question', () => {
    const b = makeBlock({ kind: 'para', text: 'Vraag hier? Het antwoord volgt nu in deze zin.', prefix: 'Vraag hier?', sep: ' ' })
    const raw = '<think>hmm</think>Hier is de herschreven tekst:\nVraag hier? Het antwoord komt nu.'
    expect(cleanOutput(raw, b)).toBe('Het antwoord komt nu.')
  })

  it('unwraps fences and surrounding quotes, and collapses newlines for one-line blocks', () => {
    const b = makeBlock({ kind: 'para', text: 'Een gewone zin zonder aanhalingstekens erin.' })
    expect(cleanOutput('```\n"Een zin\nover twee regels."\n```', b)).toBe('Een zin over twee regels.')
    expect(cleanOutput('<think>onafgemaakt', b)).toBe('')
  })

  it('restores the source quotation style', () => {
    const b = makeBlock({ kind: 'para', text: 'Critici noemen het “knap” genoeg voor een lange zin.' })
    expect(cleanOutput('Critici noemen het „knap“ genoeg voor een lange zin.', b)).toBe(
      'Critici noemen het “knap” genoeg voor een lange zin.',
    )
  })
})

describe('checkEdit', () => {
  const ORIG =
    'Studies of the wetland reported a range of 6-12 species per plot [14, 27]. Researchers noted that sampling effort varied between seasons.'

  it('passes an edit that restores the protected facts', () => {
    const edited =
      'Wetland studies reported 6-12 species per plot [14, 27], and researchers noted that sampling effort varied between seasons.'
    expect(checkEdit(ORIG, edited, { lang: 'en' })).toEqual([])
  })

  it('reports a dropped citation', () => {
    const edited = 'Wetland studies reported 6-12 species per plot, and researchers noted that sampling effort varied between seasons.'
    expect(checkEdit(ORIG, edited, { lang: 'en' }).some(i => i.startsWith('missing:'))).toBe(true)
  })

  it('never flags length', () => {
    const edited = 'Wetland studies reported 6-12 species [14, 27]; sampling effort varied.'
    expect(checkEdit(ORIG, edited, { lang: 'en' }).some(i => i.startsWith('length'))).toBe(false)
  })
})
