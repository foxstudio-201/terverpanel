import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    language: 'vi',
    theme: 'dark',
    autoCheckDocker: true,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  useEffect(() => {
    const loadSettings = async () => {
      if (isElectron) {
        const result = await window.electronAPI.getSettings()
        if (result) {
          setSettings({
            language: result.language || 'vi',
            theme: result.theme || 'dark',
            autoCheckDocker: result.autoCheckDocker !== false,
          })
        }
      }
    }
    loadSettings()
  }, [])

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      if (isElectron) {
        await window.electronAPI.saveSettings(settings)
      } else {
        localStorage.setItem('terverpanel_settings', JSON.stringify(settings))
      }
      setSaved(true)
    } catch (err) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
      <div className="glass-panel rounded-xl p-6 w-full max-w-lg m-4">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold text-white">Cai dat</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Ngon ngu</label>
            <select
              value={settings.language}
              onChange={(e) => handleChange('language', e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm"
            >
              <option value="vi">Tieng Viet</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">De mau</label>
            <select
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-lg text-sm"
            >
              <option value="dark">Toi (mac dinh)</option>
              <option value="light"> Sang</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Kiem tra Docker khi khoi dong</label>
            <label className="relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoCheckDocker}
                onChange={(e) => handleChange('autoCheckDocker', e.target.checked)}
                className="sr-only"
              />
              <div className={`inline-block h-6 w-12 rounded-full transition-colors ${
                settings.autoCheckDocker ? 'bg-purple-600' : 'bg-gray-600'
              }`}>
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    settings.autoCheckDocker ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </label>
          </div>
        </div>

        {saved && (
          <div className="mt-4 p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            Da luu cai dat!
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Dong
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Dang luu...' : 'Luu'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
