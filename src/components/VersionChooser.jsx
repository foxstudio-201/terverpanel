import { useState, useEffect } from 'react'
import { fetchMcJarsVersions, detectJavaVersion, detectDockerImageKey } from '../api/mcjars'
import { t } from '../i18n/translations'

function VersionChooser({ eggType, eggData, theme, lang, onVersionSelect }) {
  const [versions, setVersions] = useState({})
  const [loading, setLoading] = useState(true)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'

  useEffect(() => {
    setLoading(true)
    fetchMcJarsVersions(eggType).then((data) => {
      setVersions(data)
      setLoading(false)
    })
  }, [eggType])

  const sortedVersions = Object.entries(versions)
    .filter(([v]) => showSnapshots || (!v.includes('-') && !v.includes('pre') && !v.includes('rc') && !v.includes('snapshot')))
    .sort((a, b) => {
      const parseVer = (s) => s.split('.').map(Number)
      const [a1, a2, a3] = parseVer(a[0])
      const [b1, b2, b3] = parseVer(b[0])
      if (b1 !== a1) return b1 - a1
      if (b2 !== a2) return b2 - a2
      return (b3 || 0) - (a3 || 0)
    })

  const handleSelect = (version) => {
    const info = versions[version]
    const javaVer = info?.java || detectJavaVersion(version)
    const dockerKey = detectDockerImageKey(eggData?.docker_images, javaVer)
    onVersionSelect({ version, javaVersion: javaVer, dockerImageKey: dockerKey, builds: info?.builds || 0 })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: labelColor }}>
          <input type="checkbox" checked={showSnapshots} onChange={(e) => setShowSnapshots(e.target.checked)} className="rounded" />
          {t(lang, 'modal.version.snapshot')}
        </label>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: inputBorder, borderTopColor: '#a78bfa' }} />
          <p className="text-[11px] mt-2" style={{ color: labelColor }}>{t(lang, 'modal.version.loading')}</p>
        </div>
      ) : sortedVersions.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: labelColor }}>{t(lang, 'modal.version.empty')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-[340px] overflow-auto pr-1">
          {sortedVersions.map(([version, info]) => {
            const javaVer = info?.java || detectJavaVersion(version)
            return (
              <button
                key={version}
                onClick={() => handleSelect(version)}
                className="rounded-lg p-2.5 text-left transition-all hover:scale-[1.02]"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                <p className="text-xs font-semibold" style={{ color: textColor }}>{version}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: inputBorder, color: labelColor }}>
                    Java {javaVer}
                  </span>
                  {info?.builds > 0 && (
                    <span className="text-[9px]" style={{ color: labelColor }}>{info.builds} builds</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VersionChooser
