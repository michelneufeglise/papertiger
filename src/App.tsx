import React from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { MessageSquare, FolderOpen, PenLine, AudioWaveform, SlidersHorizontal } from 'lucide-react'

import { TitleBar, Sidebar, SidebarItem } from './components/ui'
import { PaperPanel } from './components/PaperPanel'
import { ChatScreen } from './screens/ChatScreen'
import { ReferencesScreen } from './screens/ReferencesScreen'
import { EditorScreen } from './screens/EditorScreen'
import { StyleScreen } from './screens/StyleScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupWizard } from './screens/SetupWizard'
import { needsSetup } from './lib/setup'

const routes = [
  { path: '/', name: 'Chat', icon: MessageSquare, screen: ChatScreen },
  { path: '/references', name: 'Sources', icon: FolderOpen, screen: ReferencesScreen },
  { path: '/editor', name: 'Draft', icon: PenLine, screen: EditorScreen },
  { path: '/style', name: 'Voice', icon: AudioWaveform, screen: StyleScreen },
  { path: '/settings', name: 'Settings', icon: SlidersHorizontal, screen: SettingsScreen },
]

const PAPER_PANEL_PATHS = new Set(['/', '/references', '/style'])

const AppContent: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (needsSetup() && location.pathname !== '/setup') {
      navigate('/setup', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const currentRoute = routes.find(r => r.path === location.pathname)
  const isSetup = location.pathname === '/setup'

  return (
    <div
      className="relative flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: 'color-mix(in srgb, var(--bg) 84%, transparent)' }}
    >
      {/* Atmosphere: aurora + grain, decorative only */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="aurora absolute -top-40 -right-40 w-[720px] h-[720px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--tiger) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.05,
            mixBlendMode: 'overlay',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full">
        <TitleBar title={isSetup ? 'Setup' : currentRoute?.name || 'papertiger'} />

        {isSetup ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <Routes>
              <Route path="/setup" element={<SetupWizard />} />
            </Routes>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            <Sidebar>
              {routes.map(route => (
                <SidebarItem
                  key={route.path}
                  icon={route.icon}
                  label={route.name}
                  active={location.pathname === route.path}
                  onClick={() => navigate(route.path)}
                />
              ))}
            </Sidebar>

            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  className="flex-1 min-h-0 flex flex-col overflow-hidden"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <Routes>
                    {routes.map(route => {
                      const ScreenComponent = route.screen
                      return <Route key={route.path} path={route.path} element={<ScreenComponent />} />
                    })}
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </div>

            {PAPER_PANEL_PATHS.has(location.pathname) && <PaperPanel />}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <AppContent />
      </Router>
    </MotionConfig>
  )
}

export default App
