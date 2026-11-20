import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import { GlassCard, GlassButton, GlassInput, Chip, Tiger } from '../components/ui'
import { useTheme, THEME_LABELS, type ThemeMode } from '../lib/theme'
import { useSettings, updateSettings } from '../lib/settings'
import { OCR_MODELS, writerById } from '../lib/models'
import { useVoice, setTuning, describeVoice, type VoiceTunings } from '../lib/voice'

const TUNING_SLIDERS: { key: keyof VoiceTunings; label: string }[] = [
  { key: 'formality', label: 'Formality' },
  { key: 'conciseness', label: 'Conciseness' },
  { key: 'technicality', label: 'Technicality' },
]

const themeOptions: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: 'light', label: THEME_LABELS.light, icon: Sun },
  { mode: 'dark', label: THEME_LABELS.dark, icon: Moon },
  { mode: 'system', label: THEME_LABELS.system, icon: Monitor },
]

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-display text-[22px] leading-none text-fg mb-5">
    <span className="doodle-underline">{children}</span>
  </h2>
)

const PDF_TEXT_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Use the text when it's there" },
  { value: false, label: 'Always use OCR' },
]

const Hairline: React.FC = () => <div className="border-t-2 border-dashed border-[var(--line-soft)]" />

export const SettingsScreen: React.FC = () => {
  const { mode, setMode, isDark } = useTheme()
  const navigate = useNavigate()
  const settings = useSettings()
  const voice = useVoice()
  const voiceHints = describeVoice(voice)
  const [dbPath, setDbPath] = useState('/Users/michelneufeglise/.papertiger/data.db')

  const ocrModel = settings.ocrQuant ? OCR_MODELS[settings.ocrQuant] : null
  const writerModel = settings.writerId ? writerById(settings.writerId) : null

  const reduce = useReducedMotion()
  const pop = (i: number, rot: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96, rotate: rot },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: 0 },
    transition: reduce ? { duration: 0.15 } : { type: 'spring' as const, stiffness: 380, damping: 22, delay: i * 0.05 },
  })

  const mockDBSize = '24.5 MB'
  const mockDBEntries = '1,247 memories'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div {...pop(0, -1)}>
          <h1 className="font-display text-[40px] leading-none text-fg">
            <span className="doodle-underline">Settings</span>
          </h1>
        </motion.div>

        {/* Appearance */}
        <motion.div {...pop(1, 1)}>
          <GlassCard className="p-6">
            <Eyebrow>Appearance</Eyebrow>

            <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Theme">
              {themeOptions.map(({ mode: optionMode, label, icon: Icon }, idx) => {
                const selected = mode === optionMode
                return (
                  <button
                    key={optionMode}
                    type="button"
                    onClick={() => setMode(optionMode)}
                    aria-pressed={selected}
                    className={`${idx % 2 ? 'wobble-alt' : 'wobble'} sketch-btn relative border-2 px-4 py-1.5 font-display text-[19px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                      selected ? 'border-[var(--line)] text-fg' : 'border-[var(--line-soft)] text-fg-muted'
                    }`}
                  >
                    {selected && (
                      <motion.div
                        layoutId="theme-pill"
                        className="highlighter absolute inset-0 -z-0 wobble"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon size={16} />
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="font-mono text-[11px] text-fg-faint mt-4">
              now: {isDark ? THEME_LABELS.dark : THEME_LABELS.light}
            </p>
          </GlassCard>
        </motion.div>

        {/* Models */}
        <motion.div {...pop(2, -1)}>
          <GlassCard className="p-6 space-y-5">
            <Eyebrow>Models</Eyebrow>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[19px] leading-tight text-fg">
                  {ocrModel ? ocrModel.label : 'OCR · not set up'}
                </p>
                {ocrModel ? (
                  <p className="font-mono text-xs text-fg-muted mt-1">{ocrModel.tag}</p>
                ) : (
                  <p className="text-xs text-fg-muted mt-1">Extracts text from documents and images.</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ocrModel && (
                  <Chip tone="mint" mono>ON-DEVICE</Chip>
                )}
                <GlassButton variant="ghost" size="sm" onClick={() => navigate('/setup?step=ocr&from=settings')}>
                  Change
                </GlassButton>
              </div>
            </div>

            <div className="pt-1">
              <p className="font-display text-[17px] leading-tight text-fg mb-2">PDF text</p>
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="PDF text">
                {PDF_TEXT_OPTIONS.map(({ value, label }, idx) => {
                  const selected = settings.pdfTextLayer === value
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => updateSettings({ pdfTextLayer: value })}
                      aria-pressed={selected}
                      className={`${idx % 2 ? 'wobble-alt' : 'wobble'} sketch-btn relative border-2 px-4 py-1.5 font-display text-[17px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                        selected ? 'border-[var(--line)] text-fg' : 'border-[var(--line-soft)] text-fg-muted'
                      }`}
                    >
                      {selected && (
                        <motion.div
                          layoutId="pdf-text-pill"
                          className="highlighter absolute inset-0 -z-0 wobble"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-fg-muted mt-2">
                Digital PDFs are read straight from their text, which is instant; scanned pages always use OCR.
                Always using OCR keeps table layout better.
              </p>
            </div>

            <Hairline />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[19px] leading-tight text-fg">
                  {writerModel ? writerModel.label : 'Writer · not set'}
                </p>
                {writerModel ? (
                  <p className="font-mono text-xs text-fg-muted mt-1">{writerModel.tag}</p>
                ) : (
                  <p className="text-xs text-fg-muted mt-1">
                    {settings.writerSkipped ? 'Skipped. Assists with writing suggestions and generation.' : 'Assists with writing suggestions and generation.'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {writerModel && (
                  <Chip tone="mint" mono>ON-DEVICE</Chip>
                )}
                <GlassButton variant="ghost" size="sm" onClick={() => navigate('/setup?step=writer&from=settings')}>
                  {writerModel ? 'Change' : 'Choose'}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Writing style */}
        <motion.div {...pop(3, 1)}>
          <GlassCard className="p-6 space-y-5">
            <Eyebrow>Writing style</Eyebrow>

            {TUNING_SLIDERS.map(({ key, label }, idx) => {
              const value = voice[key]
              const pct = ((value - 1) / 9) * 100
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor={`voice-${key}`} className="font-display text-[19px] text-fg">
                      {label}
                    </label>
                    <Chip tone="tiger" mono>
                      {value} / 10
                    </Chip>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-fg-faint">1</span>
                    <input
                      id={`voice-${key}`}
                      type="range"
                      min={1}
                      max={10}
                      value={value}
                      onChange={e => setTuning(key, parseInt(e.target.value, 10))}
                      style={{ ['--range-fill' as string]: `${pct}%` }}
                      className="flex-1"
                    />
                    <span className="font-mono text-[11px] text-fg-faint">10</span>
                  </div>
                  <p className="text-xs text-fg-muted mt-2">{voiceHints[idx]}</p>
                </div>
              )
            })}

            <p className="font-mono text-[11px] text-fg-faint">
              The writer follows these when drafting sections.
            </p>
          </GlassCard>
        </motion.div>

        {/* Memory */}
        <motion.div {...pop(4, -1)}>
          <GlassCard className="p-6 space-y-4">
            <Eyebrow>Memory</Eyebrow>

            <div>
              <label htmlFor="db-path" className="block font-display text-[18px] text-fg mb-2">
                Database location
              </label>
              <GlassInput
                id="db-path"
                value={dbPath}
                onChange={e => setDbPath(e.target.value)}
                placeholder="Enter database path"
                className="w-full"
              />
              <p className="text-xs text-fg-muted mt-2">
                SQLite file that holds what the writer remembers about you and your sources.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="sketch-alt p-3 -rotate-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Size</p>
                <p className="font-mono text-lg text-fg mt-1">{mockDBSize}</p>
              </div>
              <div className="sketch p-3 rotate-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Stored</p>
                <p className="font-mono text-lg text-fg mt-1">{mockDBEntries}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* About */}
        <motion.div {...pop(5, 1)}>
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <Eyebrow>About</Eyebrow>
              <Tiger cycle size={64} className="-mt-3 rotate-6" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Application</span>
              <span className="text-sm font-semibold text-fg">papertiger</span>
            </div>

            <Hairline />

            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Version</span>
              <span className="text-sm font-semibold text-fg">0.1.0</span>
            </div>

            <Hairline />

            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Build</span>
              <span className="text-sm font-semibold text-fg">2025.09.15</span>
            </div>

            <Hairline />

            <p className="text-xs text-fg-muted leading-relaxed">
              papertiger is a research assistant that reads your sources and writes in your voice, entirely on-device.
            </p>

            <GlassButton variant="ghost" size="sm" onClick={() => navigate('/setup?from=settings')}>
              Run setup again
            </GlassButton>

            <GlassButton variant="secondary" size="sm" className="w-full">
              Check for updates
            </GlassButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
