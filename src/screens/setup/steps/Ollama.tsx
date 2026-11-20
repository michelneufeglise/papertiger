import React from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { GlassCard, GlassButton, Chip, StatusChip } from '../../../components/ui'
import { useGuide, useWizard } from '../WizardContext'
import { Heading, WizardActions } from '../parts'

const RECHECK_MS = 3000

export const Ollama: React.FC = () => {
  const { ollama, ollamaChecking, checkOllamaAgain, next, returnToDone } = useWizard()
  const online = !!ollama?.online
  const missing = !!ollama && !ollama.online

  useGuide(
    'ollama',
    missing
      ? { tiger: 'confused', line: "I can't find Ollama yet. Install it and open it once, and I will notice by myself." }
      : online
        ? { tiger: 'excited', line: 'Found it! Ollama is running.' }
        : null,
  )

  // Refresh any status cached earlier in the session, once on entry.
  React.useEffect(() => {
    void checkOllamaAgain({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While Ollama is missing, quietly re-check every 3 s. Cleared when it appears or on leave.
  React.useEffect(() => {
    if (!missing) return
    const id = window.setInterval(() => {
      void checkOllamaAgain({ silent: true })
    }, RECHECK_MS)
    return () => window.clearInterval(id)
  }, [missing, checkOllamaAgain])

  return (
    <div>
      <Heading className="mb-2">Ollama</Heading>
      <p className="text-sm text-fg-muted mb-5">
        papertiger uses Ollama to run its models on-device. It is free and installs like any Mac app.
      </p>

      <GlassCard className="p-6 mb-5 -rotate-[0.4deg]">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Status</span>
          {ollamaChecking && !ollama ? (
            <span className="font-mono text-sm text-fg-faint">Checking…</span>
          ) : online ? (
            <Chip tone="mint" mono>
              Running · v{ollama?.version ?? '?'}
            </Chip>
          ) : (
            <StatusChip status="error">Not found</StatusChip>
          )}
        </div>
      </GlassCard>

      {missing && (
        <div className="mb-2 space-y-3">
          <p className="text-sm text-fg-muted">
            Install Ollama, make sure it is running, then check again. I will also look every few seconds.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<ExternalLink size={14} />}
              onClick={() => window.open('https://ollama.com/download', '_blank')}
            >
              Open ollama.com/download
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} className={ollamaChecking ? 'animate-spin' : undefined} />}
              onClick={() => void checkOllamaAgain()}
              disabled={ollamaChecking}
            >
              Check again
            </GlassButton>
          </div>
        </div>
      )}

      <WizardActions>
        <GlassButton variant="primary" size="lg" onClick={next} disabled={!online}>
          {returnToDone ? 'Back to summary' : 'Continue'}
        </GlassButton>
      </WizardActions>
    </div>
  )
}
