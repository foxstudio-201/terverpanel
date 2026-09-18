import { t } from '../i18n/translations'

function DonatePage({ theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const cardBorder = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const imgSrc = theme === 'light' ? './donate_light.png' : './donate_dark.png'

  const packages = [
    { pkg: 'free', color: '#22c55e', features: ['f1', 'f2', 'f3'], current: true },
    { pkg: 'bird', color: '#f59e0b', features: ['f1', 'f2', 'f3', 'f4'], coming: true },
    { pkg: 'dragon', color: '#ef4444', features: ['f1', 'f2', 'f3', 'f4', 'f5'], coming: true },
  ]

  return (
    <div className="h-full overflow-auto p-6" style={{ background: bg }}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex gap-8 items-start">
          <div className="w-1/3 shrink-0">
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
              <img src="./donate.png" alt="Donate" className="w-full h-auto object-cover" onError={(e) => { e.target.style.display = 'none' }} />
            </div>
          </div>
          <div className="flex-1 space-y-4 pt-2">
            <h2 className="text-2xl font-bold" style={{ color: textColor }}>{t(lang, 'donate.title')}</h2>
            <p className="text-sm leading-relaxed" style={{ color: labelColor }}>{t(lang, 'donate.desc')}</p>
            <p className="text-sm leading-relaxed" style={{ color: labelColor }}>{t(lang, 'donate.desc2')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {packages.map(({ pkg, color, features, coming, current }) => (
            <div
              key={pkg}
              className="relative rounded-2xl p-5 flex flex-col"
              style={{
                background: theme === 'light' ? '#fff' : '#1a1a1a',
                border: `2px solid ${color}30`,
                boxShadow: `0 0 20px ${color}10`,
              }}
            >
              {coming && (
                <div
                  className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: color, color: '#fff' }}
                >
                  {t(lang, 'donate.badge')}
                </div>
              )}
              {current && (
                <div
                  className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: color, color: '#fff' }}
                >
                  {t(lang, 'donate.currentPackage')}
                </div>
              )}
              <div className="mb-3 mt-1">
                <h3 className="text-lg font-bold" style={{ color: textColor }}>{t(lang, `donate.pkg.${pkg}.name`)}</h3>
                <p className="text-xl font-bold mt-1" style={{ color }}>{t(lang, `donate.pkg.${pkg}.price`)}</p>
              </div>
              <div className="space-y-2 flex-1">
                {features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs" style={{ color: labelColor }}>{t(lang, `donate.pkg.${pkg}.${f}`)}</span>
                  </div>
                ))}
              </div>
              <button
                className="w-full mt-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: coming ? `${color}20` : color,
                  color: coming ? color : '#fff',
                  border: `1px solid ${color}`,
                  opacity: coming ? 0.7 : 1,
                  cursor: coming ? 'not-allowed' : 'pointer',
                }}
                disabled={coming}
              >
                {current ? t(lang, 'donate.currentPackage') : t(lang, 'donate.badge')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DonatePage
