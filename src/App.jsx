import { useState, useEffect, useCallback, useRef } from 'react'
import { AppProvider, useApp } from './i18n/AppContext'
import { t } from './i18n/translations'
import { House, Gear, Heart, Cube } from '@phosphor-icons/react'
import TitleBar from './components/TitleBar'
import CloseModal from './components/CloseModal'
import TooltipProvider from './components/ui/TooltipProvider'
import NodePage from './components/NodePage'
import LoginPage from './components/LoginPage'
import HomePage from './components/HomePage'
import DonatePage from './components/DonatePage'
import SettingsPage from './components/SettingsPage'

function Spinner({ theme, lang, text }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4" style={{ background: theme === 'light' ? '#f5f5f5' : '#0a0a0a' }}>
      <svg className="w-10 h-10 animate-spin" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke={theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} strokeWidth="4" />
        <path d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke={textColor} strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="text-sm" style={{ color: textColor }}>{text}</p>
    </div>
  )
}

function AppContent() {
  const { lang, theme } = useApp()
  const [session, setSession] = useState(null)
  const [activePage, setActivePage] = useState('servers')
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [version, setVersion] = useState('')
  const [dockerToast, setDockerToast] = useState(null)

  const [phase, setPhase] = useState('startup-spinner')
  const [displaySession, setDisplaySession] = useState(null)
  const [displayPage, setDisplayPage] = useState('servers')
  const [savedCredentials, setSavedCredentials] = useState({ savedUsername: '', savedPassword: '', rememberMe: false })

  const startupDone = useRef(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    const checkSession = async () => {
      if (!isElectron) {
        startupDone.current = true
        setPhase('idle')
        return
      }
      window.electronAPI.getVersion().then(setVersion).catch(() => {})
      const settings = await window.electronAPI.getSettings()
      if (settings) {
        setSavedCredentials({
          savedUsername: settings.savedUsername || '',
          savedPassword: settings.savedPassword || '',
          rememberMe: settings.rememberMe || false,
        })
      }
      const result = await window.electronAPI.getSession()
      if (result?.ok) {
        setSession(result)
        setDisplaySession(result)
        setPhase('startup-spinner')
        setTimeout(() => {
          setPhase('fading-in')
          startupDone.current = true
          setTimeout(() => setPhase('idle'), 200)
        }, 800)
      } else {
        startupDone.current = true
        setPhase('idle')
      }
    }
    checkSession()
  }, [])

  useEffect(() => {
    if (!isElectron || !startupDone.current) return
    const checkDocker = async () => {
      try {
        const res = await window.electronAPI.checkDocker()
        if (res && !res.installed) {
          setDockerToast({
            message: t(lang, 'docker.toast.notInstalled'),
            action: () => { setDockerToast(null); navigateTo('docker') },
            actionLabel: t(lang, 'docker.toast.setup'),
          })
        }
      } catch {}
    }
    const timer = setTimeout(checkDocker, 1500)
    return () => clearTimeout(timer)
  }, [isElectron, displaySession])

  const handleCloseRequest = useCallback(async () => {
    if (!isElectron) return
    const s = await window.electronAPI.getSettings()
    if (s?.closeBehavior === 'quit') { window.electronAPI.quitApp(); return }
    if (s?.closeBehavior === 'tray') { window.electronAPI.closeWindow(); return }
    setShowCloseModal(true)
  }, [isElectron])

  const navigateTo = (page) => {
    setPhase('fading-out')
    setTimeout(() => {
      setDisplayPage(page)
      setActivePage(page)
      setPhase('fading-in')
      setTimeout(() => setPhase('idle'), 200)
    }, 200)
  }

  const handleLogin = (data) => {
    setPhase('fading-out')
    setTimeout(() => {
      setSession(data)
      setDisplaySession(data)
      setPhase('login-spinner')
      setTimeout(() => {
        setPhase('fading-in')
        setTimeout(() => setPhase('idle'), 200)
      }, 800)
    }, 200)
  }

  const handleLogout = () => {
    setPhase('fading-out')
    setTimeout(() => {
      if (isElectron) {
        window.electronAPI.logout()
        window.electronAPI.saveSettings({ savedUsername: '', savedPassword: '', rememberMe: false })
      }
      setSession(null)
      setDisplaySession(null)
      setActivePage('servers')
      setDisplayPage('servers')
      setSavedCredentials({ savedUsername: '', savedPassword: '', rememberMe: false })
      setPhase('logout-spinner')
      setTimeout(() => {
        setPhase('fading-in')
        setTimeout(() => setPhase('idle'), 200)
      }, 800)
    }, 200)
  }

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const isFadingOut = phase === 'fading-out'
  const isFadingIn = phase === 'fading-in'
  const opacityClass = isFadingOut ? 'opacity-0' : isFadingIn ? 'opacity-100' : 'opacity-100'
  const transitionClass = `transition-opacity duration-200 ${opacityClass}`

  const renderContent = () => {
    if (phase === 'startup-spinner') {
      return <Spinner theme={theme} lang={lang} text={t(lang, 'transition.loggingIn')} />
    }
    if (phase === 'login-spinner') {
      return <Spinner theme={theme} lang={lang} text={t(lang, 'transition.loggingIn')} />
    }
    if (phase === 'logout-spinner') {
      return <Spinner theme={theme} lang={lang} text={t(lang, 'transition.loggingOut')} />
    }
    if (!displaySession) {
      return (
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className={transitionClass}>
            <LoginPage
              onLogin={handleLogin}
              initialUsername={savedCredentials.savedUsername}
              initialPassword={savedCredentials.savedPassword}
              initialRememberMe={savedCredentials.rememberMe}
            />
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-1 overflow-hidden relative pt-11">
        <nav className="absolute left-0 top-11 bottom-0 z-50 w-[72px] flex flex-col items-center py-3 overflow-hidden">
          <div className="flex flex-col items-center gap-1.5 px-2 py-2">
            <button
              onClick={() => navigateTo('servers')}
              data-tip={t(lang, 'sidebar.home')}
              className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
            >
              <House size={28} weight="duotone" className={`transition-all duration-200 ${activePage === 'servers' ? 'w-11 h-11' : 'w-9 h-9'}`} />
            </button>
            <button
              onClick={() => navigateTo('donate')}
              data-tip={t(lang, 'home.donate')}
              className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
            >
              <Heart size={28} weight="duotone" className={`transition-all duration-200 ${activePage === 'donate' ? 'w-11 h-11' : 'w-9 h-9'}`} />
            </button>
             <button
              onClick={() => navigateTo('docker')}
              data-tip={lang === 'vi' ? 'Quản lý Node' : 'Node Management'}
              className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
            >
              <Cube size={28} weight="duotone" className={`transition-all duration-200 ${activePage === 'docker' ? 'w-11 h-11' : 'w-9 h-9'}`} />
            </button>
          </div>

          <div className="mt-auto shrink-0 w-full flex flex-col items-center gap-2 pb-1">
            <button
              onClick={() => navigateTo('settings')}
              data-tip={t(lang, 'sidebar.settings')}
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105"
            >
              <Gear size={28} weight="duotone" className={`transition-all duration-200 ${activePage === 'settings' ? 'w-11 h-11' : 'w-9 h-9'}`} />
            </button>

            <div className="w-[52px] h-px" style={{ background: borderColor }} />

            <span className="text-[9px] font-mono leading-none whitespace-nowrap select-none" style={{ color: labelColor }}>
              {version ? `v${version}` : ''}
            </span>
          </div>
        </nav>

        <div className="absolute left-[72px] top-3 bottom-3 w-px" style={{ background: borderColor }} />

        <div className="flex-1 ml-[72px] overflow-hidden">
          <div className={`h-full ${transitionClass}`}>
            {displayPage === 'servers' && <HomePage theme={theme} lang={lang} />}
            {displayPage === 'donate' && <DonatePage theme={theme} lang={lang} />}
            {displayPage === 'docker' && <NodePage theme={theme} lang={lang} />}
            {displayPage === 'settings' && <SettingsPage theme={theme} lang={lang} />}
          </div>
        </div>

        {dockerToast && (
          <div className="fixed bottom-5 right-5 z-[70]">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all duration-300"
              style={{
                background: theme === 'light' ? '#fff' : '#1a1a1a',
                border: '1px solid #2496ed30',
                minWidth: '320px',
                maxWidth: '420px',
              }}
            >
              <svg className="w-5 h-5 shrink-0" style={{ color: '#2496ed' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs flex-1" style={{ color: textColor }}>{dockerToast.message}</span>
              <button
                onClick={dockerToast.action}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-colors"
                style={{ background: '#2496ed20', color: '#2496ed' }}
              >
                {dockerToast.actionLabel}
              </button>
              <button
                onClick={() => setDockerToast(null)}
                className="w-5 h-5 flex items-center justify-center shrink-0"
                style={{ color: labelColor }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative z-10" style={{ background: 'transparent' }}>
      <TitleBar onCloseRequest={handleCloseRequest} user={displaySession?.user} onLogout={handleLogout} lang={lang} theme={theme} />
      {renderContent()}
      {showCloseModal && (
        <CloseModal onClose={() => setShowCloseModal(false)} />
      )}
      <TooltipProvider />
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App
