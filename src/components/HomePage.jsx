import { useState, useEffect, useRef } from 'react'
import { t } from '../i18n/translations'
import { Cpu, Memory, HardDrive } from '@phosphor-icons/react'
import VariableContainer from './VariableContainer'
import VersionChooser from './VersionChooser'
import LoaderChooser from './LoaderChooser'
import { detectJavaVersion, detectDockerImageKey } from '../api/mcjars'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDownloads(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const GAMES = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    icon: './minecraft_icon.png',
    background: './Minecraft_backgound.png',
    slot: './Minecraft_slot.webp',
    description: 'Tạo và quản lý server Minecraft với nhiều phiên bản và modpack.',
  },
  {
    id: 'terraria',
    name: 'Terraria',
    icon: './terraria_icon.png',
    background: './terraria_backgound.png',
    slot: './terraria_slot.webp',
    description: 'Tạo và quản lý server Terraria, khám phá thế giới ngầm.',
  },
]

function GameCard({ game, theme, onClick }) {
  const cardBg = theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'
  const cardBorder = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
  const textColor = theme === 'light' ? '#111' : '#fff'

  return (
    <div
      onClick={() => onClick(game)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl group relative"
      style={{ border: `1px solid ${cardBorder}`, background: cardBg }}
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={game.background}
          alt={game.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
          <img src={game.icon} alt="" className="h-10 w-auto object-contain rounded-xl shadow-lg" />
          <div>
            <h3 className="text-lg font-bold text-white">{game.name}</h3>
            <p className="text-xs text-white/60 line-clamp-1">{game.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const EGG_ICONS = {
  minecraft: {
    paper: './server-icon/paper-server.png',
    vanilla: './server-icon/vanilla-server.png',
    fabric: './server-icon/fabric-server.png',
    forge: './server-icon/forge-server.png',
    purpur: './server-icon/purpur-server.png',
    spigot: './server-icon/spigot.png',
  },
  terraria: {
    tshock: './terraria_icon.png',
    vanilla: './terraria_icon.png',
    tmodloader: './terraria_icon.png',
  },
}

const GAME_ICONS = {
  minecraft: './minecraft_icon.png',
  terraria: './terraria_icon.png',
}

function GameModal({ game, theme, lang, onClose, onServerCreated }) {
  const [closing, setClosing] = useState(false)
  const [eggs, setEggs] = useState([])
  const [selectedEgg, setSelectedEgg] = useState(null)
  const [eggData, setEggData] = useState(null)
  const [step, setStep] = useState('egg')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [selectedBuild, setSelectedBuild] = useState(null)
  const [serverName, setServerName] = useState('')
  const [loadingEggs, setLoadingEggs] = useState(true)
  const [selectedDockerImage, setSelectedDockerImage] = useState('')
  const [resources, setResources] = useState(null)
  const [eggConfigVars, setEggConfigVars] = useState({})
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const modalBg = theme === 'light' ? '#fff' : '#141414'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const gradientEnd = theme === 'light' ? 'rgba(255,255,255,1)' : 'rgba(20,20,20,1)'
  const sectionBg = theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const editableVars = (eggData?.variables || []).filter(v => v.user_viewable && v.user_editable)

  const getEggIcon = (eggId) => {
    const key = eggId.split('/').pop()
    return EGG_ICONS[game.id]?.[key] || GAME_ICONS[game.id] || './favicon.png'
  }

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.listEggs().then((res) => {
        if (res?.ok && res.eggs[game.id]) {
          setEggs(res.eggs[game.id])
        }
        setLoadingEggs(false)
      }).catch(() => setLoadingEggs(false))
    } else {
      setLoadingEggs(false)
    }
  }, [game.id])

  useEffect(() => {
    if (selectedEgg && isElectron) {
      window.electronAPI.getEgg(selectedEgg).then((res) => {
        if (res?.ok) {
          setEggData(res.egg)
          const vars = {}
          ;(res.egg.variables || []).forEach(v => {
            if (v.user_viewable && v.user_editable) {
              vars[v.env_variable] = v.default_value || ''
            }
          })
          setEggConfigVars(vars)
          setStep('version')
        }
      })
    }
  }, [selectedEgg])

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getSystemInfo().then((res) => {
        if (res?.ok) {
          const ramMB = Math.floor(res.ram.total / (1024 * 1024))
          const diskMB = Math.floor(res.disk.total / (1024 * 1024))
          const defaultRam = Math.min(Math.floor(ramMB * 0.5 / 256) * 256, 8192)
          const defaultDisk = Math.min(Math.floor(diskMB * 0.3 / 1024) * 1024, 20480)
          setResources({
            memory: Math.max(2048, defaultRam),
            cpuPercent: 100,
            cpuCores: res.cpu.cores,
            cpuCoresUsed: Math.max(1, Math.floor(res.cpu.cores * 0.5)),
            disk: Math.max(10240, defaultDisk)
          })
        } else {
          setResources({ memory: 2048, cpuPercent: 100, cpuCores: 1, cpuCoresUsed: 1, disk: 10240 })
        }
      }).catch(() => {
        setResources({ memory: 2048, cpuPercent: 100, cpuCores: 1, cpuCoresUsed: 1, disk: 10240 })
      })
    } else {
      setResources({ memory: 2048, cpuPercent: 100, cpuCores: 1, cpuCoresUsed: 1, disk: 10240 })
    }
  }, [])

  const handleVersionSelect = ({ version, javaVersion, dockerImageKey }) => {
    setSelectedVersion(version)
    setSelectedDockerImage(dockerImageKey)
    setStep('loader')
  }

  const handleBuildSelect = ({ buildId, buildName, jarUrl, isZip, changes }) => {
    setSelectedBuild({ buildId, buildName, jarUrl, isZip, changes })
    setStep('config')
  }

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => onClose(), 200)
  }

  const handleBack = () => {
    if (step === 'config') { setStep('loader'); setSelectedBuild(null); return }
    if (step === 'loader') { setStep('version'); setSelectedVersion(null); return }
    if (step === 'version') { setSelectedEgg(null); setEggData(null); setEggConfigVars({}); setStep('egg'); return }
    setSelectedEgg(null); setEggData(null); setEggConfigVars({}); setStep('egg'); setServerName(''); setSelectedDockerImage(''); setSelectedVersion(null); setSelectedBuild(null); setResources(null)
  }

  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    const serverData = {
      name: serverName || `${game.name}-server`,
      game: game.id,
      egg: eggData?.name || '',
      eggId: selectedEgg,
      version: selectedVersion,
      build: selectedBuild?.buildName || null,
      dockerImage: selectedDockerImage,
      resources: {
        memory: resources.memory,
        cpuPercent: resources.cpuPercent,
        cpuCores: resources.cpuCoresUsed,
        disk: resources.disk,
      },
      config: eggConfigVars,
      status: 'stopped',
    }
    if (isElectron) {
      try {
        await window.electronAPI.addServerConfig(serverData)
        onServerCreated?.()
        handleClose()
      } catch (err) {
        console.error('Failed to save server config:', err)
      }
    }
    setCreating(false)
  }

  const Section = ({ title, children }) => (
    <div className="rounded-xl p-4" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
      <h4 className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: labelColor }}>{title}</h4>
      {children}
    </div>
  )

  const SliderInput = ({ label, value, onChange, min, max, unit, step = 1 }) => {
    const pct = ((value - min) / (max - min)) * 100
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs w-16 shrink-0" style={{ color: labelColor }}>{label}</span>
        <div className="flex-1 relative h-5 flex items-center">
          <div className="absolute w-full h-1.5 rounded-full pointer-events-none" style={{ background: inputBorder }} />
          <div className="absolute h-1.5 rounded-full pointer-events-none" style={{ background: '#a78bfa', width: `${pct}%` }} />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={(e) => onChange(parseInt(e.target.value))}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute w-full h-5 opacity-0 cursor-pointer z-10"
          />
          <div
            className="absolute w-3.5 h-3.5 rounded-full border-2 pointer-events-none z-20"
            style={{
              left: `calc(${pct}% - 7px)`,
              background: '#a78bfa',
              borderColor: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
            }}
          />
        </div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
          className="w-20 px-2 py-1 rounded-lg text-xs text-right outline-none"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
        />
        <span className="text-[10px] w-8" style={{ color: labelColor }}>{unit}</span>
      </div>
    )
  }

  const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: labelColor }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: checked ? '#a78bfa' : inputBorder }}
      >
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ left: checked ? '18px' : '2px' }} />
      </button>
    </div>
  )

  const CustomSelect = ({ value, options, labels, onChange }) => {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
      const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [])
    const selectedLabel = `${value} - ${labels[value] || value}`
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
        >
          <span>{selectedLabel}</span>
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-lg"
            style={{ background: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${inputBorder}` }}
          >
            {options.map(opt => {
              const isSelected = String(value) === String(opt)
              return (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors"
                  style={{
                    color: textColor,
                    background: isSelected ? 'rgba(167,139,250,0.15)' : 'transparent'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.target.style.background = inputBg }}
                  onMouseLeave={(e) => { if (!isSelected) e.target.style.background = 'transparent' }}
                >
                  {isSelected && <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  <span>{opt} - {labels[opt] || opt}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center modal-backdrop ${closing ? 'closing' : ''}`}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className={`w-[680px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col modal-content ${closing ? 'closing' : ''}`}
        style={{ border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          <img src={game.background} alt="" className="w-full h-40 object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${gradientEnd} 0%, ${gradientEnd.replace(',1)', ',0.3)')} 30%, transparent 60%)` }} />
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {step === 'egg' && (
            <div className="absolute bottom-3 left-5 flex items-center gap-3">
              <img src={game.icon} alt="" className="h-9 w-auto object-contain rounded-xl shadow-lg" />
              <div>
                <h2 className="text-lg font-bold text-white">{game.name}</h2>
                <p className="text-[11px] text-white/50">{game.description}</p>
              </div>
            </div>
          )}

          {step !== 'egg' && (
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <button onClick={handleBack} className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                {t(lang, 'modal.back')}
              </button>
              <div className="flex items-center gap-0">
                {[{ id: 'version', label: t(lang, 'modal.step.version') }, { id: 'loader', label: t(lang, 'modal.step.loader') }, { id: 'config', label: t(lang, 'modal.step.config') }].map((s, i) => {
                  const stepOrder = ['version', 'loader', 'config']
                  const currentIdx = stepOrder.indexOf(step)
                  const isActive = step === s.id
                  const isDone = currentIdx > i
                  return (
                    <div key={s.id} className="flex items-center">
                      {i > 0 && (
                        <div className="w-8 h-[1px] mx-1" style={{ background: isDone ? '#a78bfa' : 'rgba(255,255,255,0.2)' }} />
                      )}
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{
                            background: isActive ? '#a78bfa' : isDone ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                            color: isActive || isDone ? '#fff' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span
                          className="text-[10px] font-medium whitespace-nowrap"
                          style={{ color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}
                        >
                          {s.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-3" style={{ background: modalBg }}>
          {loadingEggs ? (
            <p className="text-xs text-center py-8" style={{ color: labelColor }}>{t(lang, 'modal.loading')}</p>
          ) : eggs.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: labelColor }}>{t(lang, 'modal.noEgg')} {game.name}.</p>
          ) : step === 'egg' ? (
            <>
              <h3 className="text-sm font-semibold" style={{ color: textColor }}>{t(lang, 'modal.selectEgg')}</h3>
              {eggs.map((egg) => (
                <div
                  key={egg.id}
                  onClick={() => setSelectedEgg(egg.id)}
                  className="rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.01] flex items-center gap-3"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                >
                  <img src={getEggIcon(egg.id)} alt="" className="w-10 h-10 object-contain rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: textColor }}>{egg.name}</p>
                    <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: labelColor }}>{egg.description}</p>
                  </div>
                  <svg className="w-4 h-4 shrink-0" style={{ color: labelColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              ))}
            </>
          ) : step === 'version' ? (
            <>
              <div className="flex items-center gap-2.5 mb-1">
                <img src={getEggIcon(selectedEgg)} alt="" className="w-7 h-7 object-contain rounded" />
                <span className="text-sm font-bold" style={{ color: textColor }}>{eggData?.name}</span>
              </div>
              <VersionChooser
                eggType={selectedEgg.split('/').pop()}
                eggData={eggData}
                theme={theme}
                lang={lang}
                onVersionSelect={handleVersionSelect}
              />
            </>
          ) : step === 'loader' ? (
            <>
              <div className="flex items-center gap-2.5 mb-1">
                <img src={getEggIcon(selectedEgg)} alt="" className="w-7 h-7 object-contain rounded" />
                <div>
                  <span className="text-sm font-bold" style={{ color: textColor }}>{eggData?.name}</span>
                  <span className="text-[11px] ml-2 px-1.5 py-0.5 rounded" style={{ background: inputBorder, color: labelColor }}>v{selectedVersion}</span>
                </div>
              </div>
              <LoaderChooser
                eggType={selectedEgg.split('/').pop()}
                version={selectedVersion}
                theme={theme}
                lang={lang}
                onBuildSelect={handleBuildSelect}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-1">
                <img src={getEggIcon(selectedEgg)} alt="" className="w-7 h-7 object-contain rounded" />
                <div>
                  <span className="text-sm font-bold" style={{ color: textColor }}>{eggData?.name}</span>
                  <span className="text-[11px] ml-2 px-1.5 py-0.5 rounded" style={{ background: inputBorder, color: labelColor }}>v{selectedVersion}</span>
                  {selectedBuild?.buildName && (
                    <span className="text-[11px] ml-1 px-1.5 py-0.5 rounded" style={{ background: inputBorder, color: labelColor }}>{selectedBuild.buildName}</span>
                  )}
                </div>
              </div>

              <Section title={t(lang, 'modal.serverName')}>
                <input
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                  placeholder={`${game.name}-server`}
                />
              </Section>

              {editableVars.length > 0 && (
                <Section title={t(lang, 'modal.config')}>
                  <div className="space-y-3">
                    {editableVars.map((v) => {
                      const val = eggConfigVars[v.env_variable] || ''
                      if (v.rules?.includes('in:')) {
                        const match = v.rules.match(/in:([^|]+)/)
                        const options = match ? match[1].split(',') : []
                        const labels = {
                          '0': v.env_variable === 'WORLD_DIFFICULTY' || v.env_variable === 'DIFFICULTY' ? (lang === 'vi' ? 'Bình thường' : 'Normal') : '0',
                          '1': v.env_variable === 'WORLD_DIFFICULTY' || v.env_variable === 'DIFFICULTY' ? (lang === 'vi' ? 'Chuyên nghiệp' : 'Expert') : (v.env_variable === 'WORLD_SIZE' ? (lang === 'vi' ? 'Trung bình' : 'Medium') : (v.env_variable === 'LANGUAGE' ? 'Deutsch' : '1')),
                          '2': v.env_variable === 'WORLD_DIFFICULTY' || v.env_variable === 'DIFFICULTY' ? (lang === 'vi' ? 'Bậc thầy' : 'Master') : (v.env_variable === 'WORLD_SIZE' ? (lang === 'vi' ? 'Lớn' : 'Large') : (v.env_variable === 'LANGUAGE' ? 'Italiano' : '2')),
                          '3': v.env_variable === 'WORLD_DIFFICULTY' || v.env_variable === 'DIFFICULTY' ? (lang === 'vi' ? 'Hành trình' : 'Journey') : (v.env_variable === 'LANGUAGE' ? 'Français' : '3'),
                          '4': v.env_variable === 'LANGUAGE' ? 'Español' : '4',
                          '5': v.env_variable === 'LANGUAGE' ? 'Português' : '5',
                        }
                        return (
                          <div key={v.env_variable}>
                            <label className="block text-xs mb-1" style={{ color: labelColor }}>{v.name}</label>
                            <CustomSelect
                              value={val}
                              options={options}
                              labels={labels}
                              onChange={(v2) => setEggConfigVars({ ...eggConfigVars, [v.env_variable]: v2 })}
                            />
                          </div>
                        )
                      }
                      if (v.env_variable === 'PASSWORD' || v.env_variable === 'SERVER_PASSWORD') {
                        return (
                          <div key={v.env_variable}>
                            <label className="block text-xs mb-1" style={{ color: labelColor }}>{v.name}</label>
                            <input
                              type="password"
                              value={val}
                              onChange={(e) => setEggConfigVars({ ...eggConfigVars, [v.env_variable]: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                              placeholder={lang === 'vi' ? 'Để trống nếu không muốn đặt mật khẩu' : 'Leave empty for no password'}
                            />
                          </div>
                        )
                      }
                      return (
                        <div key={v.env_variable}>
                          <label className="block text-xs mb-1" style={{ color: labelColor }}>{v.name}</label>
                          <input
                            value={val}
                            onChange={(e) => setEggConfigVars({ ...eggConfigVars, [v.env_variable]: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                            placeholder={v.default_value || ''}
                          />
                          {v.description && (
                            <p className="text-[10px] mt-0.5" style={{ color: labelColor }}>{v.description.split('\r\n')[0]}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {resources && (
                <Section title={t(lang, 'modal.resources')}>
                  <div className="space-y-3">
                    <SliderInput label={t(lang, 'modal.ram')} value={resources.memory} onChange={(v) => setResources({ ...resources, memory: v })} min={512} max={32768} step={256} unit="MB" />
                    <SliderInput label={t(lang, 'modal.cpu')} value={resources.cpuPercent} onChange={(v) => setResources({ ...resources, cpuPercent: v })} min={10} max={400} step={10} unit="%" />
                    {resources.cpuCores > 1 && (
                      <SliderInput label={t(lang, 'modal.cpuCores')} value={resources.cpuCoresUsed} onChange={(v) => setResources({ ...resources, cpuCoresUsed: Math.min(v, resources.cpuCores) })} min={1} max={resources.cpuCores} step={1} unit={t(lang, 'modal.cores')} />
                    )}
                    <SliderInput label={t(lang, 'modal.disk')} value={resources.disk} onChange={(v) => setResources({ ...resources, disk: v })} min={1024} max={102400} step={1024} unit="MB" />
                  </div>
                </Section>
              )}

              <button
                onClick={handleCreate}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-2"
                style={{ background: '#a78bfa', color: '#fff' }}
                onMouseEnter={(e) => e.target.style.background = '#8b5cf6'}
                onMouseLeave={(e) => e.target.style.background = '#a78bfa'}
              >
                {t(lang, 'modal.create')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ServerCard({ server, theme, lang, onStart, onStop, onRestart }) {
  const textColor = '#fff'
  const labelColor = 'rgba(255,255,255,0.6)'
  const inputBg = 'rgba(255,255,255,0.1)'
  const dividerColor = 'rgba(255,255,255,0.12)'
  const [menuOpen, setMenuOpen] = useState(false)

  const bgImage = server.game === 'minecraft' ? './Minecraft_backgound.png' : './terraria_backgound.png'
  const gameIcon = server.game === 'minecraft' ? './minecraft_icon.png' : './terraria_icon.png'
  const statusColor = server.status === 'running' ? '#22c55e' : server.status === 'installing' ? '#eab308' : '#ef4444'
  const serverIp = '127.0.0.1'
  const serverPort = '25565'

  return (
    <div
      className="rounded-2xl overflow-hidden relative transition-all hover:scale-[1.01]"
      style={{ border: `1px solid ${dividerColor}` }}
    >
      <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.4) 100%)' }} />

      <div className="relative z-10 p-4 flex flex-col gap-3">
        {/* Top row: icon + name + status | menu button */}
        <div className="flex items-center gap-3">
          <img src={gameIcon} alt="" className="w-10 h-10 rounded-xl object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: textColor }}>{server.name}</p>
            <p className="text-[11px] truncate" style={{ color: labelColor }}>{server.egg}</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor }} />
          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: menuOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', color: textColor }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full z-50 w-40 rounded-xl overflow-hidden shadow-2xl mt-1"
                  style={{ background: 'rgba(20,20,20,0.98)', border: `1px solid ${dividerColor}`, backdropFilter: 'blur(20px)' }}
                >
                  {server.status !== 'running' ? (
                    <button
                      onClick={() => { onStart(server); setMenuOpen(false) }}
                      className="w-full px-3 py-2.5 flex items-center gap-2 text-[11px] font-semibold transition-colors hover:bg-white/10"
                      style={{ color: '#22c55e' }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      {lang === 'vi' ? 'Khởi động' : 'Start'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { onStop(server); setMenuOpen(false) }}
                        className="w-full px-3 py-2.5 flex items-center gap-2 text-[11px] font-semibold transition-colors hover:bg-white/10"
                        style={{ color: '#ef4444' }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        {lang === 'vi' ? 'Dừng' : 'Stop'}
                      </button>
                      <button
                        onClick={() => { onRestart(server); setMenuOpen(false) }}
                        className="w-full px-3 py-2.5 flex items-center gap-2 text-[11px] font-semibold transition-colors hover:bg-white/10"
                        style={{ color: '#eab308' }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                        {lang === 'vi' ? 'Khởi động lại' : 'Restart'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* IP + Port badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-md font-mono" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${dividerColor}`, color: 'rgba(255,255,255,0.7)' }}>
            {serverIp}:{serverPort}
          </span>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: dividerColor }} />

        {/* RAM, CPU, Disk */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Memory size={16} weight="duotone" style={{ color: '#a78bfa' }} />
            <div>
              <p className="text-[9px] uppercase font-semibold" style={{ color: labelColor }}>RAM</p>
              <p className="text-[11px] font-bold" style={{ color: textColor }}>0/{server.resources?.memory || 0}<span className="text-[9px] font-normal ml-0.5" style={{ color: labelColor }}>MB</span></p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu size={16} weight="duotone" style={{ color: '#3b82f6' }} />
            <div>
              <p className="text-[9px] uppercase font-semibold" style={{ color: labelColor }}>CPU</p>
              <p className="text-[11px] font-bold" style={{ color: textColor }}>0/{server.resources?.cpuPercent || 0}<span className="text-[9px] font-normal ml-0.5" style={{ color: labelColor }}>%</span></p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive size={16} weight="duotone" style={{ color: '#22c55e' }} />
            <div>
              <p className="text-[9px] uppercase font-semibold" style={{ color: labelColor }}>Disk</p>
              <p className="text-[11px] font-bold" style={{ color: textColor }}>0/{(server.resources?.disk || 0) >= 1024 ? Math.round((server.resources.disk / 1024) * 10) / 10 : server.resources?.disk || 0}<span className="text-[9px] font-normal ml-0.5" style={{ color: labelColor }}>{(server.resources?.disk || 0) >= 1024 ? 'GB' : 'MB'}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomePage({ theme, lang, onServerCreated }) {
  const [activeTab, setActiveTab] = useState('servers')
  const [tabFade, setTabFade] = useState(true)
  const [prevTab, setPrevTab] = useState('servers')
  const [selectedGame, setSelectedGame] = useState(null)
  const [servers, setServers] = useState([])
  const [loadingServers, setLoadingServers] = useState(true)
  const [serverRefreshKey, setServerRefreshKey] = useState(0)

  const [versions, setVersions] = useState(null)
  const [modpacks, setModpacks] = useState([])
  const [systemInfo, setSystemInfo] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [loadingModpacks, setLoadingModpacks] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [changelog, setChangelog] = useState(null)
  const [loadingChangelog, setLoadingChangelog] = useState(false)
  const [showChangelogModal, setShowChangelogModal] = useState(false)
  const [modalClosing, setModalClosing] = useState(false)
  const [imgKey, setImgKey] = useState(0)
  const [visibleCount, setVisibleCount] = useState(20)
  const versionListRef = useRef(null)

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const handleTabChange = (tab) => {
    if (tab === activeTab) return
    setTabFade(false)
    setTimeout(() => {
      setPrevTab(tab)
      setActiveTab(tab)
      setTabFade(true)
    }, 200)
  }

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.getMcVersions().then((res) => {
      if (res?.ok) setVersions(res)
      setLoadingVersions(false)
    }).catch(() => setLoadingVersions(false))

    window.electronAPI.getModpacks().then((res) => {
      if (res?.ok) setModpacks(res.hits || [])
      setLoadingModpacks(false)
    }).catch(() => setLoadingModpacks(false))

    window.electronAPI.getSystemInfo().then((res) => {
      if (res?.ok) setSystemInfo(res)
    }).catch(() => {})

    const loadServers = () => {
      window.electronAPI.getServerConfigs().then((res) => {
        if (res?.ok) setServers(res.servers || [])
        setLoadingServers(false)
      }).catch(() => setLoadingServers(false))
    }
    loadServers()
  }, [serverRefreshKey])

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const cardBg = theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'
  const cardBorder = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'

  const latestVersion = versions?.latest?.release || ''
  const allVersions = (versions?.versions || []).filter((v) => {
    const parts = v.id.split('.')
    const major = parseInt(parts[0], 10)
    const minor = parseInt(parts[1], 10)
    if (major > 1) return true
    if (major === 1 && minor >= 13) return true
    return false
  })
  const latestVersionData = allVersions.find(v => v.id === latestVersion)
  const selected = selectedVersion || latestVersion
  const selectedData = allVersions.find(v => v.id === selected) || latestVersionData
  const isRelease = selectedData?.type === 'release'

  const handleSelectVersion = (versionId) => {
    setSelectedVersion(versionId)
    setChangelog(null)
    setLoadingChangelog(true)
    setImgKey((k) => k + 1)
    if (isElectron) {
      window.electronAPI.getMcChangelog(versionId).then((res) => {
        if (res?.ok) setChangelog(res)
        setLoadingChangelog(false)
      }).catch(() => setLoadingChangelog(false))
    }
  }

  const handleCloseModal = () => {
    setModalClosing(true)
    setTimeout(() => {
      setShowChangelogModal(false)
      setModalClosing(false)
    }, 200)
  }

  const handleVersionScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setVisibleCount((prev) => Math.min(prev + 20, allVersions.length))
    }
  }

  const handleStartServer = async (server) => {
    if (!isElectron) return
    try {
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, status: 'installing' } : s))
      await window.electronAPI.startServer({ name: server.name, egg: server.eggId, dockerImage: server.dockerImage, config: server.config, resources: server.resources })
      const res = await window.electronAPI.getServerConfigs()
      if (res?.ok) setServers(res.configs || [])
    } catch (err) {
      console.error('Start server failed:', err)
      const res = await window.electronAPI.getServerConfigs()
      if (res?.ok) setServers(res.configs || [])
    }
  }

  const handleStopServer = async (server) => {
    if (!isElectron) return
    try {
      await window.electronAPI.stopServer(server.name)
      const res = await window.electronAPI.getServerConfigs()
      if (res?.ok) setServers(res.configs || [])
    } catch (err) {
      console.error('Stop server failed:', err)
    }
  }

  const handleRestartServer = async (server) => {
    if (!isElectron) return
    try {
      await window.electronAPI.stopServer(server.name)
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, status: 'installing' } : s))
      await window.electronAPI.startServer({ name: server.name, egg: server.eggId, dockerImage: server.dockerImage, config: server.config, resources: server.resources })
      const res = await window.electronAPI.getServerConfigs()
      if (res?.ok) setServers(res.configs || [])
    } catch (err) {
      console.error('Restart server failed:', err)
      const res = await window.electronAPI.getServerConfigs()
      if (res?.ok) setServers(res.configs || [])
    }
  }

  useEffect(() => {
    setVisibleCount(20)
  }, [versions])

  useEffect(() => {
    if (selected && isElectron) {
      setLoadingChangelog(true)
      window.electronAPI.getMcChangelog(selected).then((res) => {
        if (res?.ok) setChangelog(res)
        setLoadingChangelog(false)
      }).catch(() => setLoadingChangelog(false))
    }
  }, [selected])

  return (
    <div className="h-full flex flex-col" style={{ background: bg }}>
      {/* Tab bar - fixed, not scrolling */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-6 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
        <button
          onClick={() => handleTabChange('servers')}
          className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: activeTab === 'servers' ? 'rgba(167,139,250,0.15)' : 'transparent',
            color: activeTab === 'servers' ? '#a78bfa' : labelColor,
          }}
        >
          {lang === 'vi' ? 'Danh sách' : 'Servers'}
        </button>
        <button
          onClick={() => handleTabChange('server')}
          className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: activeTab === 'server' ? 'rgba(167,139,250,0.15)' : 'transparent',
            color: activeTab === 'server' ? '#a78bfa' : labelColor,
          }}
        >
          {t(lang, 'home.serverGame') || 'Server Game'}
        </button>
        <button
          onClick={() => handleTabChange('minecraft')}
          className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: activeTab === 'minecraft' ? 'rgba(167,139,250,0.15)' : 'transparent',
            color: activeTab === 'minecraft' ? '#a78bfa' : labelColor,
          }}
        >
          Minecraft
        </button>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-auto">
        <div style={{ opacity: tabFade ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        {prevTab === 'servers' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {loadingServers ? (
                <p className="text-xs text-center py-12" style={{ color: labelColor }}>{t(lang, 'home.loading')}</p>
              ) : servers.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: labelColor }}>{lang === 'vi' ? 'Chưa có server nào. Tạo server đầu tiên!' : 'No servers yet. Create your first server!'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {servers.map((server, i) => (
                    <ServerCard
                      key={server.id || i}
                      server={server}
                      theme={theme}
                      lang={lang}
                      onStart={handleStartServer}
                      onStop={handleStopServer}
                      onRestart={handleRestartServer}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {prevTab === 'server' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-2 gap-5">
                {GAMES.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    theme={theme}
                    onClick={setSelectedGame}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {prevTab === 'minecraft' && (
          <div className="p-6">
            <div className="max-w-6xl mx-auto space-y-6">

              <div className="grid grid-cols-3 gap-5" style={{ height: '300px' }}>
                <div
                  className="col-span-2 rounded-2xl overflow-hidden relative flex items-end"
                  style={{ border: `1px solid ${cardBorder}` }}
                >
                  <img
                    key={imgKey}
                    src={isRelease
                      ? 'https://launchercontent.mojang.com/v2/images/dappledcamp540x540.jpg'
                      : `https://launchercontent.mojang.com/v2/images/${selected.replace(/-/g, '')}540x540.jpg`
                    }
                    alt="Minecraft"
                    className="absolute inset-0 w-full h-full object-cover fade-banner"
                    style={{ animation: 'fadeIn 0.4s ease' }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)' }} />
                  <div className="relative z-10 p-6 w-full h-full overflow-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        {selectedData?.type || 'release'}
                      </span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {changelog?.date || formatDate(selectedData?.releaseTime)}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">
                      {changelog?.title || `Minecraft ${selected}`}
                    </h2>
                    {loadingChangelog ? (
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{t(lang, 'home.loading')}</p>
                    ) : changelog?.content ? (
                      <div className="relative">
                        <div
                          className="text-xs leading-relaxed max-h-[120px] overflow-hidden changelog-content"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          dangerouslySetInnerHTML={{ __html: changelog.content.replace(/<img[\s\S]*?>/gi, '').slice(0, 1500) + (changelog.content.length > 1500 ? '<span style="color:rgba(255,255,255,0.4)">...</span>' : '') }}
                        />
                        {changelog.content.length > 1500 && (
                          <button
                            onClick={() => setShowChangelogModal(true)}
                            className="mt-2 text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors"
                            style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(167,139,250,0.35)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(167,139,250,0.2)'}
                          >
                            Read more
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <h3 className="text-sm font-semibold" style={{ color: textColor }}>{t(lang, 'home.releases')}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: cardBorder, color: labelColor }}>
                      {allVersions.length}
                    </span>
                  </div>
                  <div ref={versionListRef} onScroll={handleVersionScroll} className="flex-1 overflow-auto px-2 py-1 space-y-0.5">
                    {loadingVersions ? (
                      <p className="text-xs py-4 text-center" style={{ color: labelColor }}>{t(lang, 'home.loading')}</p>
                    ) : (
                      allVersions.slice(0, visibleCount).map((v) => (
                        <div
                          key={v.id}
                          onClick={() => handleSelectVersion(v.id)}
                          className="flex items-center justify-between py-2 px-2 rounded-xl text-xs cursor-pointer transition-colors"
                          style={{
                            background: v.id === selected ? 'rgba(167,139,250,0.1)' : undefined,
                            color: v.id === selected ? '#a78bfa' : undefined,
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-semibold truncate" style={{ color: v.id === selected ? '#a78bfa' : v.id === latestVersion ? '#a78bfa' : textColor }}>
                              {v.id}
                            </p>
                            <p className="text-[10px] truncate" style={{ color: labelColor }}>
                              {formatDate(v.releaseTime)}
                            </p>
                          </div>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ml-2"
                            style={{
                              background: v.type === 'release' ? 'rgba(34,197,94,0.15)' : v.type === 'snapshot' ? 'rgba(59,130,246,0.15)' : 'rgba(156,163,175,0.15)',
                              color: v.type === 'release' ? '#22c55e' : v.type === 'snapshot' ? '#3b82f6' : '#9ca3af',
                            }}
                          >
                            {v.type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 rounded-2xl overflow-hidden flex flex-col" style={{ background: cardBg, border: `1px solid ${cardBorder}`, minHeight: '280px' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <h3 className="text-sm font-semibold" style={{ color: textColor }}>{t(lang, 'home.topModpacks')}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: cardBorder, color: labelColor }}>
                      Modrinth
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {loadingModpacks ? (
                      <p className="text-xs py-8 text-center" style={{ color: labelColor }}>{t(lang, 'home.loading')}</p>
                    ) : (
                      <div className="space-y-2">
                        {modpacks.map((mod, i) => (
                          <div
                            key={mod.slug || i}
                            className="flex items-center gap-3 py-2 px-3 rounded-xl transition-colors hover:bg-white/5"
                          >
                            <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: labelColor }}>
                              {i + 1}
                            </span>
                            {mod.icon_url && (
                              <img src={mod.icon_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: textColor }}>{mod.title}</p>
                              <p className="text-[11px] truncate" style={{ color: labelColor }}>
                                {t(lang, 'home.by')} {mod.author} &middot; {mod.description?.slice(0, 60)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
                                {formatDownloads(mod.downloads)}
                              </p>
                              <p className="text-[10px]" style={{ color: labelColor }}>{t(lang, 'home.downloads')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: cardBg, border: `1px solid ${cardBorder}`, minHeight: '280px' }}>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <h3 className="text-sm font-semibold" style={{ color: textColor }}>{t(lang, 'home.systemInfo')}</h3>
                  </div>
                  <div className="flex-1 p-4 space-y-4">
                    <SystemRow
                      label={t(lang, 'home.ram')}
                      icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3v18M18 3v18M6 9h12M6 15h12M3 6h3M3 12h3M3 18h3M18 6h3M18 12h3M18 18h3" /></svg>}
                      value={systemInfo ? `${formatBytes(systemInfo.ram.total - systemInfo.ram.free)} / ${formatBytes(systemInfo.ram.total)}` : '...'}
                      sub={systemInfo ? `${formatBytes(systemInfo.ram.free)} trống` : ''}
                      theme={theme}
                    />
                    <SystemRow
                      label={t(lang, 'home.cpu')}
                      icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5M4.5 15.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" /></svg>}
                      value={systemInfo ? systemInfo.cpu.model.replace(/\s+/g, ' ').trim().slice(0, 30) : '...'}
                      sub={systemInfo ? `${systemInfo.cpu.cores} cores` : ''}
                      theme={theme}
                    />
                    <SystemRow
                      label={t(lang, 'home.disk')}
                      icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>}
                      value={systemInfo ? `${formatBytes(systemInfo.disk.total - systemInfo.disk.free)} / ${formatBytes(systemInfo.disk.total)}` : '...'}
                      sub={systemInfo ? `${formatBytes(systemInfo.disk.free)} trống` : ''}
                      theme={theme}
                    />
                    <div className="pt-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: labelColor }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {systemInfo?.platform} {systemInfo?.arch}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
        </div>
      </div>

      {selectedGame && (
        <GameModal game={selectedGame} theme={theme} lang={lang} onClose={() => setSelectedGame(null)} onServerCreated={() => { onServerCreated?.(); setServerRefreshKey(k => k + 1) }} />
      )}

      {showChangelogModal && changelog?.content && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center modal-backdrop ${modalClosing ? 'closing' : ''}`}
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={handleCloseModal}
        >
          <div
            className={`w-[700px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col modal-content ${modalClosing ? 'closing' : ''}`}
            style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${cardBorder}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>{changelog.title || selected}</h3>
              <button
                onClick={handleCloseModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: labelColor }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {changelog.image && (
                <img src={changelog.image} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
              )}
              <div
                className="text-sm leading-relaxed changelog-content"
                style={{ color: theme === 'light' ? '#333' : 'rgba(255,255,255,0.8)' }}
                dangerouslySetInnerHTML={{ __html: changelog.content }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SystemRow({ label, icon, value, sub, theme }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: labelColor }}>{label}</p>
        <p className="text-sm font-semibold truncate" style={{ color: textColor }}>{value}</p>
        {sub && <p className="text-[11px] truncate" style={{ color: labelColor }}>{sub}</p>}
      </div>
    </div>
  )
}

export default HomePage
