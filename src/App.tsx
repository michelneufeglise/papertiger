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
    <div className="paper-ground relative flex flex-col h-screen w-screen overflow-hidden">
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
