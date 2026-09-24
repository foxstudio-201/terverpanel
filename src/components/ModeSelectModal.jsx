import { useState, useEffect } from 'react'
import { useApp } from '../i18n/AppContext'
import { t } from '../i18n/translations'

export default function ModeSelectModal({ onChosen }) {
  const { lang, theme } = useApp()
  const [platform, setPlatform] = useState('')
  const [saving, setSaving] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    if (isElectron && window.electronAPI.getPlatform) {
      window.electronAPI.getPlatform().then((p) => setPlatform(p || '')).catch(() => {})
    }
  }, [isElectron])

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.7)'
  const cardBg = theme === 'light' ? '#fff' : 'rgba(14,14,14,0.98)'
  const cardBorder = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
  const advancedLocked = platform === 'win32'

  const choose = async (mode) => {
    if (saving) return
    if (mode === 'advanced' && advancedLocked) return
    setSaving(true)
    try {
      if (isElectron) {
        await window.electronAPI.saveSettings({ appMode: mode })
      } else {
        try { localStorage.setItem('terver_appMode', mode) } catch {}
      }
      onChosen?.(mode)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl" style={{ background: cardBg, borderColor: cardBorder }}>
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: cardBorder }}>
          <h2 className="text-lg font-bold" style={{ color: textColor }}>{t(lang, 'mode.title')}</h2>
          <p className="text-xs mt-1.5" style={{ color: labelColor }}>{t(lang, 'mode.subtitle')}</p>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => choose('basic')}
            disabled={saving}
            className="text-left rounded-xl p-4 border transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ borderColor: '#a78bfa55', background: 'rgba(167,139,250,0.08)' }}
          >
            <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>{t(lang, 'mode.basic')}</p>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: labelColor }}>{t(lang, 'mode.basic.desc')}</p>
            <ul className="mt-3 space-y-1 text-[10px]" style={{ color: labelColor }}>
              <li>• {t(lang, 'mode.basic.noDocker')}</li>
              <li>• {t(lang, 'mode.basic.noRoot')}</li>
              <li>• {t(lang, 'mode.basic.managedJava')}</li>
              <li>• {t(lang, 'mode.basic.eggScript')}</li>
            </ul>
          </button>

          <button
            onClick={() => choose('advanced')}
            disabled={saving || advancedLocked}
            className="text-left rounded-xl p-4 border transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: advancedLocked ? cardBorder : '#2496ed55', background: advancedLocked ? (theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)') : 'rgba(36,150,237,0.08)' }}
          >
            <p className="text-sm font-bold" style={{ color: advancedLocked ? labelColor : '#2496ed' }}>{t(lang, 'mode.advanced')}</p>
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: labelColor }}>{t(lang, 'mode.advanced.desc')}</p>
            <ul className="mt-3 space-y-1 text-[10px]" style={{ color: labelColor }}>
              <li>• {t(lang, 'mode.advanced.docker')}</li>
              <li>• {t(lang, 'mode.advanced.wings')}</li>
              <li>• {t(lang, 'mode.advanced.nodes')}</li>
            </ul>
            {advancedLocked && (
              <p className="mt-3 text-[10px] font-semibold" style={{ color: '#ef4444' }}>{t(lang, 'mode.advanced.winLocked')}</p>
            )}
          </button>
        </div>

        <div className="px-6 py-3 border-t text-[10px]" style={{ borderColor: cardBorder, color: labelColor }}>
          {t(lang, 'mode.changeLater')}
        </div>
      </div>
    </div>
  )
}
