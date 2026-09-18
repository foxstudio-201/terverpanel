import { useState, useEffect } from 'react'
import { useApp } from '../i18n/AppContext'
import { t } from '../i18n/translations'

export default function SettingsPage({ theme, lang }) {
  const { setLang, setTheme } = useApp()
  const [autoCheckDocker, setAutoCheckDocker] = useState(true)
  const [saved, setSaved] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    const load = async () => {
      if (isElectron) {
        const s = await window.electronAPI.getSettings()
        if (s) setAutoCheckDocker(s.autoCheckDocker !== false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (isElectron) {
      const s = await window.electronAPI.getSettings()
      await window.electronAPI.saveSettings({ ...s, autoCheckDocker })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.7)'

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 min-h-full" style={{ background: bg }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8" style={{ color: textColor }}>
          {t(lang, 'settings.title')}
        </h1>

        <div className="space-y-6">
          <div className="glass-panel rounded-xl p-5">
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {t(lang, 'settings.language')}
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setLang('vi')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  lang === 'vi'
                    ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400'
                    : 'border border-white/10 hover:border-white/20'
                }`}
                style={{ color: lang !== 'vi' ? labelColor : undefined }}
              >
                Tiếng Việt
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  lang === 'en'
                    ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400'
                    : 'border border-white/10 hover:border-white/20'
                }`}
                style={{ color: lang !== 'en' ? labelColor : undefined }}
              >
                English
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {t(lang, 'settings.theme')}
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  theme === 'dark'
                    ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400'
                    : 'border border-white/10 hover:border-white/20'
                }`}
                style={{ color: theme !== 'dark' ? labelColor : undefined }}
              >
                {t(lang, 'settings.theme.dark')}
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  theme === 'light'
                    ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400'
                    : 'border border-white/10 hover:border-white/20'
                }`}
                style={{ color: theme !== 'light' ? labelColor : undefined }}
              >
                {t(lang, 'settings.theme.light')}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: labelColor }}>
                {t(lang, 'settings.autoCheckDocker')}
              </label>
              <label className="relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCheckDocker}
                  onChange={(e) => setAutoCheckDocker(e.target.checked)}
                  className="sr-only"
                />
                <div className={`inline-block h-6 w-12 rounded-full transition-colors ${
                  autoCheckDocker ? 'bg-purple-600' : 'bg-gray-600'
                }`}>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform mt-0.5 ${
                      autoCheckDocker ? 'translate-x-6 ml-0.5' : 'translate-x-1'
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {saved && (
              <p className="text-sm text-green-400">{t(lang, 'settings.saved')}</p>
            )}
            <div className="ml-auto">
              <button
                onClick={handleSave}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                {t(lang, 'settings.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
