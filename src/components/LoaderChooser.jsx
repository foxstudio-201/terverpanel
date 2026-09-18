import { useState, useEffect } from 'react'
import { fetchMcJarsBuilds } from '../api/mcjars'
import { t } from '../i18n/translations'

function LoaderChooser({ eggType, version, theme, lang, onBuildSelect }) {
  const [builds, setBuilds] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBuild, setSelectedBuild] = useState(null)
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'

  useEffect(() => {
    setLoading(true)
    setSelectedBuild(null)
    fetchMcJarsBuilds(eggType, version).then((data) => {
      setBuilds(data)
      setLoading(false)
    })
  }, [eggType, version])

  const handleSelect = (build) => {
    setSelectedBuild(build)
  }

  const handleConfirm = () => {
    if (selectedBuild) {
      onBuildSelect({
        buildId: selectedBuild.id,
        buildName: selectedBuild.projectVersionId || selectedBuild.name || `Build #${selectedBuild.buildNumber}`,
        jarUrl: selectedBuild.jarUrl || selectedBuild.zipUrl || null,
        isZip: !selectedBuild.jarUrl && !!selectedBuild.zipUrl,
        changes: selectedBuild.changes || [],
      })
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: inputBorder, borderTopColor: '#a78bfa' }} />
          <p className="text-[11px] mt-2" style={{ color: labelColor }}>{t(lang, 'modal.loader.loading')}</p>
        </div>
      ) : builds.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: labelColor }}>{t(lang, 'modal.loader.empty')}</p>
      ) : (
        <>
          <div className="max-h-[280px] overflow-auto space-y-1.5 pr-1">
            {builds.map((build) => {
              const label = build.projectVersionId || build.name || `Build #${build.buildNumber || build.id}`
              const isSelected = selectedBuild?.id === build.id
              return (
                <div
                  key={build.id}
                  onClick={() => handleSelect(build)}
                  className="rounded-lg p-3 cursor-pointer transition-all flex items-center gap-3"
                  style={{
                    background: isSelected ? 'rgba(167,139,250,0.15)' : inputBg,
                    border: `1px solid ${isSelected ? '#a78bfa' : inputBorder}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: textColor }}>{label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {build.buildNumber && (
                        <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: inputBorder, color: labelColor }}>
                          #{build.buildNumber}
                        </span>
                      )}
                      <span className="text-[9px]" style={{ color: labelColor }}>{formatDate(build.created)}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 shrink-0" style={{ color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>

          {selectedBuild?.changes?.length > 0 && (
            <div className="rounded-lg p-3" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: labelColor }}>{t(lang, 'modal.loader.changes')}</p>
              {selectedBuild.changes.slice(0, 3).map((change, i) => (
                <p key={i} className="text-[10px]" style={{ color: labelColor }}>• {change}</p>
              ))}
              {selectedBuild.changes.length > 3 && (
                <p className="text-[10px]" style={{ color: labelColor }}>...và {selectedBuild.changes.length - 3} thay đổi khác</p>
              )}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selectedBuild}
            className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: selectedBuild ? '#a78bfa' : inputBorder,
              color: selectedBuild ? '#fff' : labelColor,
            }}
          >
            {t(lang, 'modal.loader.confirm')}
          </button>
        </>
      )}
    </div>
  )
}

export default LoaderChooser
