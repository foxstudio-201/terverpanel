import { useState, useEffect } from 'react'
import { useApp } from '../i18n/AppContext'
import { t } from '../i18n/translations'

const defaultPaths = {
  base: '',
  docker: '',
  wings: '',
  wingsConfig: '',
  cloudflare: '',
  database: '',
  downloads: '',
  servers: '',
  logs: '',
}

const pathLabels = {
  base: { vi: 'Thư mục gốc (tất cả data)', en: 'Base directory (all data)' },
  docker: { vi: 'Docker — Data directory', en: 'Docker — Data directory' },
  wings: { vi: 'Wings — Data directory', en: 'Wings — Data directory' },
  wingsConfig: { vi: 'Wings — Config file', en: 'Wings — Config file' },
  cloudflare: { vi: 'Cloudflare — Config & Certs', en: 'Cloudflare — Config & Certs' },
  database: { vi: 'PostgreSQL — Data directory', en: 'PostgreSQL — Data directory' },
  downloads: { vi: 'Thư mục tải về', en: 'Downloads directory' },
  servers: { vi: 'Game servers — Data', en: 'Game servers — Data' },
  logs: { vi: 'Logs', en: 'Logs directory' },
}

export default function SettingsPage({ theme, lang }) {
  const { setLang, setTheme } = useApp()
  const [paths, setPaths] = useState(defaultPaths)
  const [autoStart, setAutoStart] = useState({ docker: true, wings: true, cloudflare: false, database: true })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    const load = async () => {
      if (isElectron) {
        const s = await window.electronAPI.getSettings()
        if (s) {
          if (s.paths) setPaths(prev => ({ ...prev, ...s.paths }))
          if (s.autoStart) setAutoStart(prev => ({ ...prev, ...s.autoStart }))
        }
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!isElectron) return
    setSaving(true)
    try {
      const s = await window.electronAPI.getSettings()
      await window.electronAPI.saveSettings({ ...s, paths, autoStart })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const updateAutoStart = (key, val) => setAutoStart(prev => ({ ...prev, [key]: val }))

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.7)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'
  const sectionBg = theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'

  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-6 min-h-full" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {t(lang, 'settings.title')}
          </h1>

          {/* ── Language ── */}
          <div className="rounded-xl p-5" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {t(lang, 'settings.language')}
            </label>
            <div className="flex gap-3">
              <button onClick={() => setLang('vi')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${lang === 'vi' ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400' : 'border hover:border-white/20'}`} style={{ borderColor: lang !== 'vi' ? inputBorder : undefined, color: lang !== 'vi' ? labelColor : undefined }}>
                Tiếng Việt
              </button>
              <button onClick={() => setLang('en')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${lang === 'en' ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400' : 'border hover:border-white/20'}`} style={{ borderColor: lang !== 'en' ? inputBorder : undefined, color: lang !== 'en' ? labelColor : undefined }}>
                English
              </button>
            </div>
          </div>

          {/* ── Theme ── */}
          <div className="rounded-xl p-5" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {t(lang, 'settings.theme')}
            </label>
            <div className="flex gap-3">
              <button onClick={() => setTheme('dark')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${theme === 'dark' ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400' : 'border hover:border-white/20'}`} style={{ borderColor: theme !== 'dark' ? inputBorder : undefined, color: theme !== 'dark' ? labelColor : undefined }}>
                {t(lang, 'settings.theme.dark')}
              </button>
              <button onClick={() => setTheme('light')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${theme === 'light' ? 'bg-purple-500/20 border-2 border-purple-500/50 text-purple-400' : 'border hover:border-white/20'}`} style={{ borderColor: theme !== 'light' ? inputBorder : undefined, color: theme !== 'light' ? labelColor : undefined }}>
                {t(lang, 'settings.theme.light')}
              </button>
            </div>
          </div>

          {/* ── Auto-start services ── */}
          <div className="rounded-xl p-5" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {lang === 'vi' ? 'Tự khởi động khi mở app' : 'Auto-start on app launch'}
            </label>
            <div className="space-y-3">
              {[
                { key: 'docker', label: 'Docker Engine' },
                { key: 'wings', label: 'LunarSpace Wings' },
                { key: 'cloudflare', label: 'Cloudflare Tunnel' },
                { key: 'database', label: 'PostgreSQL' },
              ].map(svc => (
                <div key={svc.key} className="flex items-center justify-between py-2">
                  <span className="text-sm" style={{ color: textColor }}>{svc.label}</span>
                  <label className="relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={autoStart[svc.key] || false} onChange={(e) => updateAutoStart(svc.key, e.target.checked)} className="sr-only" />
                    <div className={`inline-block h-6 w-12 rounded-full transition-colors ${autoStart[svc.key] ? 'bg-purple-600' : 'bg-gray-600'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform mt-0.5 ${autoStart[svc.key] ? 'translate-x-6 ml-0.5' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── Path configuration (read-only) ── */}
          <div className="rounded-xl p-5" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {lang === 'vi' ? 'Đường dẫn lưu trữ' : 'Storage paths'}
            </label>
            <p className="text-xs mb-4" style={{ color: labelColor, opacity: 0.6 }}>
              {lang === 'vi' ? 'Được tự tạo từ thư mục gốc khi Setup. Muốn đổi → Setup lại.' : 'Auto-created from base dir during Setup. Change via Re-setup.'}
            </p>
            <div className="space-y-2">
              {Object.entries(pathLabels).map(([key, lbl]) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium" style={{ color: labelColor }}>{lbl[lang]}</span>
                    <p className="text-[11px] truncate" style={{ color: textColor }}>{paths[key] || '---'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Docker custom data dir (read-only) ── */}
          <div className="rounded-xl p-5" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
            <label className="block text-sm font-medium mb-3" style={{ color: labelColor }}>
              {lang === 'vi' ? 'Docker — Data Directory' : 'Docker — Data directory'}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] truncate" style={{ color: textColor }}>{paths.docker || '---'}</p>
              </div>
            </div>
          </div>

          {/* ── Save ── */}
          <div className="flex items-center justify-between pb-8">
            {saved && <p className="text-sm text-green-400">{t(lang, 'settings.saved')}</p>}
            <div className="ml-auto">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80 active:scale-95"
                style={{ background: '#a78bfa', color: '#fff', opacity: saving ? 0.5 : 1 }}
              >
                {saving ? '...' : t(lang, 'settings.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
