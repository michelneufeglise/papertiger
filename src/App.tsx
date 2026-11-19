import React from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { MessageSquare, FolderOpen, PenLine, AudioWaveform, SlidersHorizontal } from 'lucide-react'

import { TitleBar, Sidebar, SidebarItem, SketchFrame } from './components/ui'
import { PaperPanel } from './components/PaperPanel'
import { ChatScreen } from './screens/ChatScreen'
import { ReferencesScreen } from './screens/ReferencesScreen'
import { EditorScreen } from './screens/EditorScreen'
import { StyleScreen } from './screens/StyleScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SetupWizard } from './screens/SetupWizard'
import { needsSetup } from './lib/setup'
import { useTigerStatusEngine } from './lib/tiger'

const routes = [
  { path: '/', name: 'Chat', icon: MessageSquare, screen: ChatScreen },
  { path: '/references', name: 'Sources', icon: FolderOpen, screen: ReferencesScreen },
  { path: '/editor', name: 'Draft', icon: PenLine, screen: EditorScreen },
  { path: '/style', name: 'Voice', icon: AudioWaveform, screen: StyleScreen },
  { path: '/settings', name: 'Settings', icon: SlidersHorizontal, screen: SettingsScreen },
]

const PAPER_PANEL_PATHS = new Set(['/', '/references', '/style'])

/** Mounts the tiger status engine once, inside the router, on every screen. */
const TigerEngine: React.FC = () => {
  useTigerStatusEngine()
  return null
}

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
      data-tauri-drag-region
      className="desk-ground relative flex flex-col h-screen w-screen overflow-hidden rounded-[22px] p-3 gap-3"
    >
      <TitleBar title={isSetup ? 'Setup' : currentRoute?.name || 'papertiger'} />

      {isSetup ? (
        <SketchFrame
          seed={3}
          radius={18}
          overflow="hidden"
          innerClassName="paper-ground"
          className="flex-1 min-h-0"
        >
          <Routes>
            <Route path="/setup" element={<SetupWizard />} />
          </Routes>
        </SketchFrame>
      ) : (
        <div data-tauri-drag-region className="flex flex-1 min-h-0 gap-3">
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

          <SketchFrame
            seed={3}
            radius={18}
            overflow="hidden"
            innerClassName="paper-ground"
            className="flex-1 min-w-0"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.7 }}
              >
                <Routes>
                  {routes.map(route => {
                    const ScreenComponent = route.screen
                    return <Route key={route.path} path={route.path} element={<ScreenComponent />} />
                  })}
                </Routes>
              </motion.div>
            </AnimatePresence>
          </SketchFrame>

          {PAPER_PANEL_PATHS.has(location.pathname) && <PaperPanel />}
        </div>
      )}

      {/* Window outline */}
      <SketchFrame
        seed={5}
        radius={22}
        fill={false}
        shadow={false}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  )
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Router>
        <TigerEngine />
        <AppContent />
      </Router>
    </MotionConfig>
  )
}

export default App
