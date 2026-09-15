import { readSettings } from './settings'

/** True until the first-run wizard has been completed. */
export function needsSetup(): boolean {
  return !readSettings().setupDone
}
