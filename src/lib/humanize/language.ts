// Port of persephone/server/speech_summary.py `detect_language` (tiny stop-word guesser).

const STOPWORDS: Record<string, Set<string>> = {
  en: new Set(['the', 'and', 'is', 'are', 'you', 'of', 'to', 'that', 'with', 'for', 'this', 'it']),
  nl: new Set(['de', 'het', 'een', 'en', 'is', 'van', 'je', 'dat', 'niet', 'met', 'voor', 'op', 'zijn', 'ook', 'wat']),
  de: new Set(['der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'sie', 'ein', 'eine', 'auch', 'für', 'zu', 'ich']),
  fr: new Set(['le', 'la', 'les', 'et', 'est', 'des', 'une', 'pour', 'que', 'pas', 'vous', 'avec', 'dans', 'du']),
  es: new Set(['el', 'la', 'los', 'las', 'y', 'es', 'que', 'para', 'una', 'con', 'por', 'del', 'no', 'se']),
  it: new Set(['il', 'la', 'che', 'e', 'di', 'per', 'una', 'non', 'con', 'sono', 'gli', 'del', 'anche']),
  pt: new Set(['o', 'a', 'os', 'que', 'e', 'para', 'uma', 'com', 'não', 'do', 'da', 'em', 'você']),
}

/** Faithful port: the language code, or null when the text is too short or ambiguous. */
export function detectLanguageRaw(text: string): string | null {
  const ws = (text.toLowerCase().match(/[a-zà-öø-ÿ]+/g) ?? []).slice(0, 600)
  if (ws.length < 8) return null
  const scores: Record<string, number> = {}
  for (const [lang, sw] of Object.entries(STOPWORDS)) scores[lang] = ws.reduce((n, w) => n + (sw.has(w) ? 1 : 0), 0)
  let best = ''
  for (const lang of Object.keys(scores)) if (best === '' || scores[lang] > scores[best]) best = lang
  if (scores[best] < 3) return null
  const runnerUp = Math.max(...Object.entries(scores).filter(([k]) => k !== best).map(([, v]) => v))
  return scores[best] >= 1.3 * Math.max(runnerUp, 1) ? best : null
}

/** Humanize's wrapper (`detect_language`): falls back to "en". */
export function detectLanguage(text: string): string {
  return detectLanguageRaw(text ?? '') ?? 'en'
}
