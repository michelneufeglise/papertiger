import { diffWordsWithSpace } from 'diff'

export type DiffPart = { type: 'same' | 'del' | 'ins'; text: string }

/**
 * Word-level diff between the original and the rewrite. Left column = same + del,
 * right column = same + ins; adjacent del/ins runs keep their order.
 */
export function diffWords(original: string, rewritten: string): DiffPart[] {
  return diffWordsWithSpace(original, rewritten).map((p) => ({
    type: p.added ? 'ins' : p.removed ? 'del' : 'same',
    text: p.value,
  }))
}
