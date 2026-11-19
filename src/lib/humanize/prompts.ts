// Port of persephone/server/humanize.py prompts. Every string is copied verbatim (EN and NL).
import { blockBody, CONTEXT_CHARS, type Block, type BlockContext } from './segment'

export type Tone = 'natural' | 'casual' | 'professional' | 'academic'
export type Strength = 'light' | 'medium' | 'heavy'

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
}

export const TONE_EN: Record<Tone, string> = {
  natural: 'natural and clear, lightly personal — like a thoughtful person wrote it',
  casual: 'relaxed and informal, like a friendly email',
  professional: 'clear and confident, like a well-written business memo',
  academic: 'careful and precise, but without stiff or robotic phrasing',
}
export const TONE_NL: Record<Tone, string> = {
  natural: 'natuurlijk en helder, licht persoonlijk — alsof een bedachtzaam mens het schreef',
  casual: 'ontspannen en informeel, zoals een vriendelijke e-mail',
  professional: 'zakelijk, helder en zelfverzekerd',
  academic: 'zorgvuldig en precies, maar niet stijf of houterig',
}
export const INTENSITY_EN: Record<Strength, string> = {
  light:
    'Change as little as possible: only smooth out stiff or clumsy phrasing. Keep most of the wording and the sentence order.',
  medium:
    'Rework the sentence structure: vary sentence length and rhythm, split long sentences or join short ones where that reads more naturally. The content stays the same.',
  heavy:
    'Rewrite more freely, in your own words and rhythm — but stay correct and completely faithful to the content.',
}
export const INTENSITY_NL: Record<Strength, string> = {
  light:
    'Verander zo weinig mogelijk: maak alleen stijve of houterige formuleringen soepeler. Behoud de meeste woorden en de zinsvolgorde.',
  medium:
    'Herschrijf de zinsbouw: varieer zinslengte en ritme, splits lange zinnen of voeg korte samen waar dat natuurlijker leest. De inhoud blijft gelijk.',
  heavy:
    'Herschrijf vrijer, in eigen woorden en met een eigen ritme — maar blijf correct en volledig trouw aan de inhoud.',
}
export const AI_PHRASES_EN = [
  'delve',
  'furthermore',
  'moreover',
  'in conclusion',
  'it is important to note',
  'navigate the landscape',
  'a testament to',
  "in today's fast-paced world",
  'tapestry',
  'realm',
  'crucial',
  'pivotal',
  'multifaceted',
  'holistic',
  'seamless',
  "let's explore",
]
export const AI_PHRASES_NL = [
  'Het is belangrijk om te benadrukken',
  'Het is belangrijk op te merken',
  'Kortom',
  'Daarnaast is het van belang',
  'in de hedendaagse samenleving',
  'in de huidige snelle wereld',
  'speelt een cruciale rol',
  'Al met al',
  'Concluderend',
  'Bovendien',
  'Tevens',
  'een rijk scala aan',
  'naadloos',
  'veelzijdig',
  'Laten we',
  'Dit toont aan dat',
]

export function systemPrompt(lang: string, toneIn: string, intensityIn: string): string {
  const intensity = (Object.hasOwn(INTENSITY_EN, intensityIn) ? intensityIn : 'medium') as Strength
  const tone = (Object.hasOwn(TONE_EN, toneIn) ? toneIn : 'natural') as Tone
  if (lang === 'nl') {
    const phrases = AI_PHRASES_NL.map((p) => `„${p}”`).join(', ')
    return (
      'Je bent een ervaren Nederlandstalige redacteur. Je herschrijft één tekstblok uit een ' +
      'document zodat het natuurlijk leest, alsof een mens het schreef.\n\n' +
      `Toon: ${TONE_NL[tone]}.\n` +
      `Mate van herschrijven: ${INTENSITY_NL[intensity]}\n\n` +
      'Regels:\n' +
      '- Behoud de betekenis en elk feit, elke naam, elk getal, jaartal, label (zoals V, R, M) en citaat exact.\n' +
      '- Schrijf foutloos Nederlands: juiste spelling inclusief accenten (één, privé, café, financiële), ' +
      'correcte grammatica en interpunctie. Geen Engelse woorden of Engelse samentrekkingen.\n' +
      '- Laat aanhalingstekens („ “ ” ‘ ’) en de tekst ertussen staan zoals ze zijn.\n' +
      '- Herhaal nooit een zin of zinsdeel. Voeg geen nieuwe inhoud, voorbeelden, meningen of conclusies toe. Laat niets weg.\n' +
      "- Maak nooit opzettelijk fouten of 'menselijke imperfecties'.\n" +
      '- Wissel langere en kortere zinnen af; vermijd steeds dezelfde zinsopbouw.\n' +
      `- Vermijd clichés en typische AI-formuleringen, zoals ${phrases}.\n` +
      '- Houd dezelfde persoon, werkwoordstijd en het perspectief aan (ik-vorm blijft ik-vorm, ' +
      'tegenwoordige tijd blijft tegenwoordige tijd). Verander niet wie wat doet of van wie iets is.\n' +
      '- Laat vaktermen en kernbegrippen (zoals historieschilderkunst, naaktstudie, agency) ongewijzigd.\n' +
      '- Geef ALLEEN het herschreven blok terug: geen inleiding, geen uitleg, geen titel, ' +
      'geen aanhalingstekens rond het geheel, geen markdown.'
    )
  }
  const lname = LANG_NAMES[lang] ?? "the document's language"
  const phrases = AI_PHRASES_EN.map((p) => `'${p}'`).join(', ')
  const langRule =
    lang === 'en'
      ? '- Write correct, idiomatic English with correct spelling, grammar and punctuation.' +
        (tone === 'natural' || tone === 'casual'
          ? " Contractions (it's, don't) are fine where they suit the tone."
          : '')
      : `- Write in ${lname} only — do not translate. Follow ${lname} spelling (including accents and ` +
        'diacritics), grammar, punctuation and quotation-mark conventions. No English words, no English contractions.'
  return (
    'You are an experienced editor. You rewrite ONE block of text from a document so it reads ' +
    'naturally, as if a person wrote it.\n\n' +
    `Tone: ${TONE_EN[tone]}.\n` +
    `Rewrite strength: ${INTENSITY_EN[intensity]}\n\n` +
    'Rules:\n' +
    '- Keep the meaning and every fact, name, number, date, label and quotation exactly.\n' +
    `${langRule}\n` +
    '- Keep quotation marks and the quoted words as they are.\n' +
    '- Never repeat a sentence or phrase. Do not add new content, examples, opinions or conclusions. Do not leave anything out.\n' +
    "- Never add deliberate errors or 'human imperfections'.\n" +
    '- Vary sentence length and structure.\n' +
    `- Avoid stock AI phrasing such as ${phrases}.\n` +
    '- Keep the same person, tense and point of view. Do not change who does what or who owns what.\n' +
    '- Keep technical terms and key concepts unchanged.\n' +
    '- Output ONLY the rewritten block: no preamble, no explanation, no title, no quotes around it, no markdown.'
  )
}

/** Python's `_clip`: cut at CONTEXT_CHARS on a word boundary and add " …". */
export function clip(sIn: string, n = CONTEXT_CHARS): string {
  const s = (sIn ?? '').trim()
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  const i = cut.lastIndexOf(' ')
  return (i >= 0 ? cut.slice(0, i) : cut) + ' …'
}

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildBlockMessages(
  block: Block,
  ctx: Partial<BlockContext>,
  o: { lang: string; tone: string; intensity: string; issues?: string[] | null },
): PromptMessage[] {
  const nl = o.lang === 'nl'
  const lines: string[] = []
  if (ctx.title) lines.push('Document: ' + ctx.title)
  if (ctx.section) lines.push((nl ? 'Sectie: ' : 'Section: ') + ctx.section)
  if (block.table !== null) {
    const col = ctx.column
    lines.push(
      nl
        ? `Dit blok is een cel in een tabel${col ? ` (kolom „${col}”)` : ''}. Houd het ongeveer even lang.`
        : `This block is a table cell${col ? ` (column “${col}”)` : ''}. Keep it about the same length.`,
    )
  }
  if (block.prefix) {
    lines.push(
      nl
        ? `Dit blok is het antwoord op: „${block.prefix}” — herschrijf alleen het antwoord, herhaal de vraag niet.`
        : `This block answers: “${block.prefix}” — rewrite only the answer, do not repeat the question.`,
    )
  }
  if (ctx.prev) {
    lines.push(
      (nl ? 'Vorige tekst (alleen context, niet herschrijven):\n' : 'Previous text (context only, do not rewrite):\n') +
        clip(ctx.prev),
    )
  }
  if (ctx.next) {
    lines.push(
      (nl ? 'Volgende tekst (alleen context, niet herschrijven):\n' : 'Next text (context only, do not rewrite):\n') +
        clip(ctx.next),
    )
  }
  if (o.issues && o.issues.length) {
    lines.push(
      (nl
        ? 'Let op — je vorige versie had deze problemen: '
        : 'Important — your previous attempt had these problems: ') +
        o.issues.join('; ') +
        (nl
          ? '. Blijf dicht bij het origineel, herhaal niets en neem alle namen en getallen over.'
          : '. Stay close to the original, repeat nothing and keep every name and number.'),
    )
  }
  lines.push((nl ? 'Herschrijf dit blok:\n' : 'Rewrite this block:\n') + '<<<\n' + blockBody(block).trim() + '\n>>>')
  return [
    { role: 'system', content: systemPrompt(o.lang, o.tone, o.intensity) },
    { role: 'user', content: lines.join('\n\n') },
  ]
}

export function temperature(intensity: string): number {
  return ({ light: 0.4, medium: 0.6, heavy: 0.75 } as Record<string, number>)[intensity] ?? 0.6
}

/** Temperature of the stricter retry. */
export const RETRY_TEMPERATURE = 0.2
