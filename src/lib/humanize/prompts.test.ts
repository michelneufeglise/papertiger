import { describe, expect, it } from 'vitest'
import { detectLanguage, detectLanguageRaw } from './language'
import { buildBlockMessages, clip, systemPrompt, temperature } from './prompts'
import { makeBlock } from './segment'

const NL =
  'Haar vader ziet tekenen bij een meisje als tijdverdrijf en niet als voorbereiding op een beroep. ' +
  'De kunstacademie laat vrouwen niet toe, of in elk geval niet bij de lessen met levende naaktmodellen. ' +
  'Ze leert in het atelier van haar vader: kopiëren, assisteren en zijn leerlingen observeren.'

describe('detectLanguage', () => {
  it('recognises Dutch and English, and falls back', () => {
    expect(detectLanguage(NL)).toBe('nl')
    expect(detectLanguage('The cat is on the mat and you are with it for this reason that we go to the shop.')).toBe('en')
    expect(detectLanguageRaw('too short')).toBeNull()
    expect(detectLanguage('too short')).toBe('en')
  })
})

describe('prompts', () => {
  it('builds the Dutch prompt for a Dutch document', () => {
    const b = makeBlock({ kind: 'cell', text: 'x', table: 0, row: 1, col: 1, rewrite: true })
    b.text = NL
    const msgs = buildBlockMessages(b, { title: 'opdracht', column: 'Hindernis', prev: 'x', next: 'y' }, {
      lang: 'nl',
      tone: 'natural',
      intensity: 'medium',
    })
    const sys = msgs[0].content
    expect(sys).toContain('Nederlandstalige')
    expect(sys).toContain('Kortom')
    expect(sys).toContain('Het is belangrijk om te benadrukken')
    expect(msgs[1].content).toContain('kolom „Hindernis”')
    expect(msgs[1].content.trimEnd().endsWith('>>>')).toBe(true)
  })

  it('has per-tone English rules', () => {
    const nat = systemPrompt('en', 'natural', 'heavy')
    const pro = systemPrompt('en', 'professional', 'light')
    expect(nat).toContain('Contractions')
    expect(pro).not.toContain('Contractions')
    expect(nat).toContain('Never add deliberate errors')
    const de = systemPrompt('de', 'natural', 'medium')
    expect(de).toContain('Write in German only')
    expect(de).not.toContain('Contractions')
  })

  it('feeds the issues back on a retry', () => {
    const b = makeBlock({ kind: 'para', text: 'Een lange zin met genoeg woorden erin.' })
    const m = buildBlockMessages(b, {}, { lang: 'nl', tone: 'natural', intensity: 'medium', issues: ['repeated sentence'] })
    expect(m[1].content).toContain('vorige versie')
    expect(m[1].content).toContain('repeated sentence')
  })

  it('clips context at a word boundary and maps temperatures', () => {
    expect(clip('aaa bbb ccc', 8)).toBe('aaa bbb …')
    expect(clip('short')).toBe('short')
    expect([temperature('light'), temperature('medium'), temperature('heavy'), temperature('x')]).toEqual([0.4, 0.6, 0.75, 0.6])
  })
})
