import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import { GlassCard, GlassButton, GlassInput, Chip } from '../components/ui'
import { useTheme, type ThemeMode } from '../lib/theme'
import { useSettings } from '../lib/settings'
import { OCR_MODELS, writerById } from '../lib/models'

const themeOptions: { mode: ThemeMode; label: string; icon: LucideIcon }[] = [
  { mode: 'light', label: 'Paper', icon: Sun },
  { mode: 'dark', label: 'Tiger', icon: Moon },
  { mode: 'system', label: 'Auto', icon: Monitor },
]

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint mb-4">
    {children}
  </p>
)

const Hairline: React.FC = () => <div className="border-t border-line" />

export const SettingsScreen: React.FC = () => {
  const { mode, setMode, isDark } = useTheme()
  const navigate = useNavigate()
  const settings = useSettings()
  const [dbPath, setDbPath] = useState('/Users/michelneufeglise/.papertiger/data.db')

  const ocrModel = settings.ocrQuant ? OCR_MODELS[settings.ocrQuant] : null
  const writerModel = settings.writerId ? writerById(settings.writerId) : null

  const mockDBSize = '24.5 MB'
  const mockDBEntries = '1,247 memories'

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <h1 className="font-display text-2xl font-bold text-fg">Settings</h1>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.03 }}
        >
          <GlassCard className="p-6">
            <Eyebrow>Appearance</Eyebrow>

            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--panel-2)] border border-line">
              {themeOptions.map(({ mode: optionMode, label, icon: Icon }) => {
                const selected = mode === optionMode
                return (
                  <button
                    key={optionMode}
                    type="button"
                    onClick={() => setMode(optionMode)}
                    aria-pressed={selected}
                    className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiger"
                  >
                    {selected && (
                      <motion.div
                        layoutId="theme-pill"
                        className="absolute inset-0 rounded-full bg-tiger"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span
                      className={`relative z-10 flex items-center gap-1.5 ${
                        selected ? 'text-[#0E0D12]' : 'text-fg-muted'
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="font-mono text-[11px] text-fg-faint mt-3">
              now: {isDark ? 'tiger' : 'paper'}
            </p>
          </GlassCard>
        </motion.div>

        {/* Models */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.06 }}
        >
          <GlassCard className="p-6 space-y-5">
            <Eyebrow>Models</Eyebrow>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-fg">
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
                <GlassButton variant="ghost" size="sm" onClick={() => navigate('/setup')}>
                  Change
                </GlassButton>
              </div>
            </div>

            <Hairline />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-fg">
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
                <GlassButton variant="ghost" size="sm" onClick={() => navigate('/setup?step=writer')}>
                  {writerModel ? 'Change' : 'Choose'}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Memory */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.09 }}
        >
          <GlassCard className="p-6 space-y-4">
            <Eyebrow>Memory</Eyebrow>

            <div>
              <label htmlFor="db-path" className="block text-sm font-medium text-fg mb-2">
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
              <div className="p-3 bg-[var(--panel-2)] rounded-[var(--r-md)] border border-line">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Size</p>
                <p className="font-mono text-lg text-fg mt-1">{mockDBSize}</p>
              </div>
              <div className="p-3 bg-[var(--panel-2)] rounded-[var(--r-md)] border border-line">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-faint">Stored</p>
                <p className="font-mono text-lg text-fg mt-1">{mockDBEntries}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* About */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
        >
          <GlassCard className="p-6 space-y-4">
            <Eyebrow>About</Eyebrow>

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

            <GlassButton variant="secondary" size="sm" className="w-full">
              Check for updates
            </GlassButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
