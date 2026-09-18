import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext()

const isElectron = typeof window !== 'undefined' && window.electronAPI

export function AppProvider({ children }) {
  const [lang, setLang] = useState('vi')
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const load = async () => {
      if (isElectron) {
        const s = await window.electronAPI.getSettings()
        if (s) {
          if (s.language) setLang(s.language)
          if (s.theme) setTheme(s.theme)
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'light') {
      document.body.style.background = '#f5f5f5'
      document.body.style.color = '#111'
    } else {
      document.body.style.background = '#0a0a0a'
      document.body.style.color = '#fff'
    }
  }, [theme])

  const saveLang = async (newLang) => {
    setLang(newLang)
    if (isElectron) {
      const s = await window.electronAPI.getSettings()
      await window.electronAPI.saveSettings({ ...s, language: newLang })
    }
  }

  const saveTheme = async (newTheme) => {
    setTheme(newTheme)
    if (isElectron) {
      const s = await window.electronAPI.getSettings()
      await window.electronAPI.saveSettings({ ...s, theme: newTheme })
    }
  }

  return (
    <AppContext.Provider value={{ lang, theme, setLang: saveLang, setTheme: saveTheme }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
