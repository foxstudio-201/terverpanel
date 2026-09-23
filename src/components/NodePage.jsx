import { useState, useEffect, useRef } from 'react'
import { t } from '../i18n/translations'
import { Cpu, Memory, HardDrive, DesktopTower, Info } from '@phosphor-icons/react'

function StatusDot({ color, size = 10 }) {
  return (
    <span className="relative flex shrink-0" style={{ width: size, height: size }}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-full w-full" style={{ background: color }} />
    </span>
  )
}

function ProgressBar({ percent, color, theme }) {
  const bg = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: bg }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

function Toast({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-sm animate-[slideIn_0.3s_ease-out]" style={{ background: t.type === 'ok' ? '#22c55e' : t.type === 'error' ? '#ef4444' : '#3b82f6', color: '#fff' }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, theme, lang, onConfirm, onCancel }) {
  if (!open) return null
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="max-w-sm w-[90vw] rounded-2xl p-5 space-y-3" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${inputBorder}` }} onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold" style={{ color: textColor }}>{title}</h3>
        <p className="text-[11px] leading-relaxed" style={{ color: labelColor }}>{message}</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: confirmColor || '#ef4444', color: '#fff' }}>{confirmLabel || (lang === 'vi' ? 'Xóa' : 'Delete')}</button>
        </div>
      </div>
    </div>
  )
}

function LogBox({ value, placeholder, theme, labelColor, inputBg, inputBorder, copiedKey, copyKey, onCopy }) {
  return (
    <div className="relative">
      <button onClick={() => value && onCopy()} className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-all z-10 hover:opacity-80 active:scale-95" style={{ background: copiedKey === copyKey ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === copyKey ? '#fff' : labelColor }}>
        {copiedKey === copyKey ? '✓' : 'Copy'}
      </button>
      <pre className="p-3 pr-12 rounded-xl text-[10px] whitespace-pre-wrap max-h-32 overflow-auto" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
        {value || placeholder}
      </pre>
    </div>
  )
}

function ServiceCard({ title, icon, color, installed, running, version, theme, onInstall, onUninstall, onStart, onStop, onLoadLogs, installing, uninstalling, progress, log, logPlaceholder, copiedKey, copyKey, onCopy, children }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const sectionBg = theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'
  const [loadingLogs, setLoadingLogs] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${inputBorder}` }}>
        <div className="flex items-center gap-2.5">
          {icon}
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{title}</h4>
          <StatusDot color={installed ? (running ? '#22c55e' : '#ef4444') : '#6b7280'} />
          {version && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: inputBg, color: labelColor }}>v{version}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!installed ? (
            <button onClick={onInstall} disabled={installing} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#22c55e', color: '#fff', opacity: installing ? 0.5 : 1 }}>
              {installing ? `${progress?.percent || 0}%` : 'Cài'}
            </button>
          ) : (
            <>
              {running ? (
                <button onClick={onStop} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#ef4444', color: '#fff' }}>Dừng</button>
              ) : (
                <button onClick={onStart} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#22c55e', color: '#fff' }}>Khởi động</button>
              )}
              {onLoadLogs && (
                <button onClick={async () => { setLoadingLogs(true); await onLoadLogs(); setLoadingLogs(false) }} disabled={loadingLogs} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#3b82f6', color: '#fff', opacity: loadingLogs ? 0.5 : 1 }}>
                  {loadingLogs ? '...' : 'Log'}
                </button>
              )}
              <button onClick={onUninstall} disabled={uninstalling} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', opacity: uninstalling ? 0.5 : 1 }}>
                {uninstalling ? '...' : 'Gỡ'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {installing && progress?.percent > 0 && (
          <div className="space-y-1">
            <ProgressBar percent={progress.percent} color={color} theme={theme} />
            <p className="text-[9px]" style={{ color: labelColor }}>{progress.message}</p>
          </div>
        )}
        <LogBox value={log} placeholder={logPlaceholder} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey={copyKey} onCopy={onCopy} />
        {children}
      </div>
    </div>
  )
}

function NodePage({ theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const [tab, setTab] = useState('status')
  const statusRef = useRef({ docker: null, wings: null, cloudflare: null })
  const [docker, setDocker] = useState(null)
  const [dockerInstalling, setDockerInstalling] = useState(false)
  const [dockerUninstalling, setDockerUninstalling] = useState(false)
  const [dockerLog, setDockerLog] = useState('')
  const [wings, setWings] = useState(null)
  const [wingsInstalling, setWingsInstalling] = useState(false)
  const [wingsUninstalling, setWingsUninstalling] = useState(false)
  const [wingsLog, setWingsLog] = useState('')
  const [wingsConfigSaved, setWingsConfigSaved] = useState(false)
  const [cloudflare, setCloudflare] = useState(null)
  const [cfInstalling, setCfInstalling] = useState(false)
  const [cfUninstalling, setCfUninstalling] = useState(false)
  const [cfLog, setCfLog] = useState('')
  const [sysInfo, setSysInfo] = useState(null)
  const [database, setDatabase] = useState(null)
  const [dbInstalling, setDbInstalling] = useState(false)
  const [dbProgress, setDbProgress] = useState(null)
  const [dbConfig, setDbConfig] = useState({ name: 'terver_db', user: 'terver', pass: '' })
  const [dbLog, setDbLog] = useState('')
  const [cleanupLog, setCleanupLog] = useState('')
  const [copiedKey, setCopiedKey] = useState(null)
  const [cfConfig, setCfConfig] = useState({ tunnelName: 'terver-tunnel', appDomain: '' })
  const [dockerConfig, setDockerConfig] = useState({ socketPath: '/var/run/docker.sock', dataDir: '/var/lib/docker', networkInterface: 'docker0' })

  const [dockerProgress, setDockerProgress] = useState(null)
  const [wingsProgress, setWingsProgress] = useState(null)
  const [cfProgress, setCfProgress] = useState(null)
  const [toasts, setToasts] = useState([])
  const toastIdRef = { current: 0 }

  const [authenticated, setAuthenticated] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [cfAuthenticated, setCfAuthenticated] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState({ title: '', message: '', action: null })
  const [firstTimeOpen, setFirstTimeOpen] = useState(false)
  const [hasPaths, setHasPaths] = useState(false)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardDockerLog, setWizardDockerLog] = useState('')
  const [wizardWingsLog, setWizardWingsLog] = useState('')
  const [wizardCfLog, setWizardCfLog] = useState('')
  const [wizardProcessing, setWizardProcessing] = useState(false)
  const [wingsConfig, setWingsConfig] = useState({})
  const [wizardPaths, setWizardPaths] = useState({
    base: '',
    docker: '',
    wings: '',
    wingsConfig: '',
    cloudflare: '',
    database: '',
    downloads: '',
    servers: '',
    logs: '',
  })
  const [allInstalled, setAllInstalled] = useState(false)

  const addToast = (message, type = 'ok') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const openConfirm = (title, message, action, confirmLabel, confirmColor) => {
    setConfirmData({ title, message, action, confirmLabel: confirmLabel || (lang === 'vi' ? 'Xóa' : 'Delete'), confirmColor: confirmColor || '#ef4444' })
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    setConfirmOpen(false)
    if (confirmData.action) confirmData.action()
  }

  // Save/load node config
  const saveNodeConfig = async (patch) => {
    if (!isElectron) return
    try { await window.electronAPI.saveSettings({ nodeConfig: patch }) } catch {}
  }
  const loadNodeConfig = async () => {
    if (!isElectron) return
    try {
      // Load from disk first (actual config files)
      const diskRes = await window.electronAPI.loadNodeConfigs()
      if (diskRes?.ok && diskRes.configs) {
        const c = diskRes.configs
        if (c.docker) setDockerConfig(c.docker)
        if (c.wings) setWingsConfig(c.wings)
        if (c.cloudflare) setCfConfig(prev => ({ ...prev, tunnelName: prev.tunnelName || 'terver-tunnel', appDomain: c.cloudflare.domain || prev.appDomain }))
        if (c.db) setDbConfig(c.db)
      }
      // Also load from settings (for values not in config files)
      const res = await window.electronAPI.getSettings()
      const cfg = res?.nodeConfig || res?.settings?.nodeConfig
      if (cfg) {
        if (cfg.dockerConfig && !diskRes?.configs?.docker) setDockerConfig(cfg.dockerConfig)
        if (cfg.cfConfig) setCfConfig(prev => ({ ...prev, ...cfg.cfConfig }))
        if (cfg.dbConfig && !diskRes?.configs?.db) setDbConfig(cfg.dbConfig)
      }
      // Load paths from settings
      if (res?.paths) {
        setWizardPaths(prev => ({ ...prev, ...res.paths }))
        if (res.paths.base) {
          setHasPaths(true)
        }
      }
      if (res?.setupComplete) {
        setAllInstalled(true)
      } else if (!res?.paths?.base) {
        setFirstTimeOpen(true)
      }
    } catch {}
  }

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.systemCheckAuth().then((res) => {
      if (res?.authenticated) setAuthenticated(true)
      else setAuthOpen(true)
    }).catch(() => setAuthOpen(true))
    window.electronAPI.cloudflaredCheckAuth().then((res) => {
      if (res?.authenticated) setCfAuthenticated(true)
    }).catch(() => {})
    loadNodeConfig()
    refreshAll()
    const statusInterval = setInterval(refreshAll, 5000)
    const logInterval = setInterval(async () => {
      if (!window.electronAPI?.systemdLogs) return
      try {
        const dInst = statusRef.current.docker?.installed
        const wInst = statusRef.current.wings?.installed
        const cInst = statusRef.current.cloudflare?.installed
        const [d, w, c] = await Promise.all([
          dInst ? window.electronAPI.systemdLogs('docker', 60) : Promise.resolve(null),
          wInst ? window.electronAPI.systemdLogs('lunarspace-wings', 60) : Promise.resolve(null),
          cInst ? window.electronAPI.systemdLogs('cloudflared', 60) : Promise.resolve(null),
        ])
        if (d?.ok && d.logs) setDockerLog(d.logs)
        else if (!dInst) setDockerLog('')
        if (w?.ok && w.logs) setWingsLog(w.logs)
        else if (!wInst) setWingsLog('')
        if (c?.ok && c.logs) setCfLog(c.logs)
        else if (!cInst) setCfLog('')
      } catch {}
    }, 2000)
    if (window.electronAPI.onInstallProgress) {
      window.electronAPI.onInstallProgress(({ key, percent, message }) => {
        const update = { percent, message }
        const progressLine = `[${percent}%] ${message}`
        if (key === 'docker') {
          setDockerProgress(update)
          setWizardDockerLog(prev => {
            const lines = prev.split('\n').filter(l => !l.startsWith('[') || l.startsWith('[INFO]') || l.startsWith('[OK]') || l.startsWith('[LỖI]'))
            lines.push(progressLine)
            return lines.join('\n')
          })
        } else if (key === 'wings') {
          setWingsProgress(update)
          setWizardWingsLog(prev => {
            const lines = prev.split('\n').filter(l => !l.startsWith('[') || l.startsWith('[INFO]') || l.startsWith('[OK]') || l.startsWith('[LỖI]'))
            lines.push(progressLine)
            return lines.join('\n')
          })
        } else if (key === 'cloudflare') {
          setCfProgress(update)
          setWizardCfLog(prev => {
            const lines = prev.split('\n').filter(l => !l.startsWith('[') || l.startsWith('[INFO]') || l.startsWith('[OK]') || l.startsWith('[LỖI]'))
            lines.push(progressLine)
            return lines.join('\n')
          })
        } else if (key === 'database') {
          setDbProgress(update)
          setWizardCfLog(prev => {
            const lines = prev.split('\n').filter(l => !l.startsWith('[') || l.startsWith('[INFO]') || l.startsWith('[OK]') || l.startsWith('[LỖI]'))
            lines.push(progressLine)
            return lines.join('\n')
          })
        }
      })
    }
    return () => { clearInterval(statusInterval); clearInterval(logInterval) }
  }, [])

  const refreshAll = async () => {
    try {
      const [d, w, info, cf, db] = await Promise.all([
        window.electronAPI.checkDocker(),
        window.electronAPI.getWingsStatus(),
        window.electronAPI.getSystemInfo(),
        window.electronAPI.checkCloudflared(),
        window.electronAPI.getDatabaseStatus(),
      ])
      if (d?.ok !== false) { setDocker(d); statusRef.current.docker = d }
      if (w?.ok) { setWings(w); statusRef.current.wings = w }
      if (info?.ok) setSysInfo(info)
      if (cf?.ok) { setCloudflare(cf); statusRef.current.cloudflare = cf }
      if (db?.ok) setDatabase(db)
    } catch {}
  }

  const handleAuth = async () => {
    if (!authPassword.trim()) return
    setAuthError('')
    const res = await window.electronAPI.systemAuth(authPassword)
    if (res?.ok) { setAuthenticated(true); setAuthOpen(false); setAuthPassword('') }
    else { setAuthError(lang === 'vi' ? 'Sai mật khẩu' : 'Wrong password'); setAuthPassword('') }
  }

  const copy = (key, val) => { navigator.clipboard.writeText(val); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1500) }

  // Docker handlers
  const handleDockerInstall = async () => {
    if (!isElectron) return
    setDockerInstalling(true); setDockerLog(''); setDockerProgress({ percent: 0, message: 'Đang bắt đầu...' })
    const res = await window.electronAPI.installDocker()
    if (res?.ok) { setDockerLog('[OK] ' + (lang === 'vi' ? 'Cài Docker thành công!' : 'Docker installed!') + '\n' + (res.version || '')); refreshAll(); addToast(lang === 'vi' ? 'Docker đã cài xong!' : 'Docker installed!', 'ok') }
    else if (res?.needAuth) { setDockerLog('[LỖI] ' + (lang === 'vi' ? 'Cần quyền root. Hãy xác thực sudo trước.' : 'Needs root. Authenticate sudo first.')); setAuthOpen(true) }
    else { setDockerLog('[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Cài Docker thất bại' : 'Docker install failed', 'error') }
    setDockerInstalling(false); setDockerProgress(null)
  }
  const handleDockerUninstall = async () => {
    openConfirm(
      lang === 'vi' ? 'Gỡ Docker?' : 'Uninstall Docker?',
      lang === 'vi' ? 'Sẽ xóa toàn bộ Docker: binary, config, container, image, volume, network. Không thể hoàn tác.' : 'Will remove all Docker: binary, config, containers, images, volumes, networks. Cannot undo.',
      async () => {
        setDockerUninstalling(true)
        setDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng Docker service...' : 'Stopping Docker service...'))
        await new Promise(r => setTimeout(r, 500))
        setDockerLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Đang xóa Docker package...' : 'Removing Docker packages...'))
        const res = await window.electronAPI.systemCleanup('docker')
        if (res?.ok) { setDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ Docker hoàn toàn!' : 'Docker fully uninstalled!')); refreshAll(); addToast(lang === 'vi' ? 'Đã gỡ Docker' : 'Docker uninstalled', 'ok') }
        else { setDockerLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Gỡ Docker thất bại' : 'Docker uninstall failed', 'error') }
        setDockerUninstalling(false)
      }
    )
  }

  // Wings handlers
  const handleWingsInstall = async () => {
    if (!isElectron) return
    setWingsInstalling(true); setWingsLog(''); setWingsProgress({ percent: 0, message: 'Đang bắt đầu...' })
    const res = await window.electronAPI.installWings()
    if (res?.ok) { setWingsLog('[OK] ' + (lang === 'vi' ? 'Cài Wings thành công!' : 'Wings installed!') + `\nVersion: ${res.version}\nArch: ${res.arch}\nInit: ${res.initSystem}`); refreshAll(); addToast(lang === 'vi' ? 'Wings đã cài xong!' : 'Wings installed!', 'ok') }
    else { setWingsLog('[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Cài Wings thất bại' : 'Wings install failed', 'error') }
    setWingsInstalling(false); setWingsProgress(null)
  }
  const handleWingsUninstall = async () => {
    openConfirm(
      lang === 'vi' ? 'Gỡ Wings?' : 'Uninstall Wings?',
      lang === 'vi' ? 'Sẽ xóa Wings binary, config, data, logs, service file. Không thể hoàn tác.' : 'Will remove Wings binary, config, data, logs, service file. Cannot undo.',
      async () => {
        setWingsUninstalling(true)
        setWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng Wings service...' : 'Stopping Wings service...'))
        await new Promise(r => setTimeout(r, 500))
        setWingsLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Đang xóa Wings binary + config...' : 'Removing Wings binary + config...'))
        const res = await window.electronAPI.systemCleanup('wings')
        if (res?.ok) { setWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ Wings hoàn toàn!' : 'Wings fully uninstalled!')); refreshAll(); addToast(lang === 'vi' ? 'Đã gỡ Wings' : 'Wings uninstalled', 'ok') }
        else { setWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Gỡ Wings thất bại' : 'Wings uninstall failed', 'error') }
        setWingsUninstalling(false)
      }
    )
  }
  const handleWingsConfigGenerate = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.generateWingsConfig()
    if (res?.ok) { setWingsConfigSaved(true); setTimeout(() => setWingsConfigSaved(false), 2000); refreshAll(); addToast(lang === 'vi' ? 'Đã tạo config.yml!' : 'Config generated!', 'ok') }
    else addToast(lang === 'vi' ? 'Tạo config thất bại' : 'Config failed', 'error')
  }

  // Cloudflare handlers
  const handleCfInstall = async () => {
    if (!isElectron) return
    setCfInstalling(true); setCfLog(''); setCfProgress({ percent: 0, message: 'Đang bắt đầu...' })
    const info = await window.electronAPI.getSystemInfo()
    const res = await window.electronAPI.installCloudflared(info?.os?.arch || 'x86_64')
    if (res?.ok) { setCfLog('[OK] ' + (lang === 'vi' ? 'Cài cloudflared thành công!' : 'cloudflared installed!') + `\nVersion: ${res.version}`); refreshAll(); addToast(lang === 'vi' ? 'cloudflared đã cài xong!' : 'cloudflared installed!', 'ok') }
    else { setCfLog('[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Cài cloudflared thất bại' : 'cloudflared install failed', 'error') }
    setCfInstalling(false); setCfProgress(null)
  }
  const handleCfUninstall = async () => {
    openConfirm(
      lang === 'vi' ? 'Gỡ Cloudflare?' : 'Uninstall Cloudflare?',
      lang === 'vi' ? 'Sẽ xóa cloudflared binary, cert, config, tunnel. Không thể hoàn tác.' : 'Will remove cloudflared binary, cert, config, tunnel. Cannot undo.',
      async () => {
        setCfUninstalling(true)
        setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng cloudflared service...' : 'Stopping cloudflared service...'))
        await new Promise(r => setTimeout(r, 500))
        setCfLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Đang xóa cloudflared binary + cert...' : 'Removing cloudflared binary + cert...'))
        const res = await window.electronAPI.systemCleanup('cloudflare')
        if (res?.ok) { setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ cloudflared hoàn toàn!' : 'cloudflared fully uninstalled!')); refreshAll(); addToast(lang === 'vi' ? 'Đã gỡ cloudflared' : 'cloudflared uninstalled', 'ok') }
        else { setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Gỡ cloudflared thất bại' : 'cloudflared uninstall failed', 'error') }
        setCfUninstalling(false)
      }
    )
  }
  const handleTunnelCreate = async () => {
    if (!isElectron) return
    if (!cfConfig.appDomain.trim()) {
      setCfLog('[LỖI] ' + (lang === 'vi' ? 'Nhập domain đầy đủ (ví dụ: panel.example.com)' : 'Enter full domain (e.g. panel.example.com)'))
      addToast(lang === 'vi' ? 'Chưa nhập domain' : 'No domain entered', 'error'); return
    }
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang kiểm tra xác thực...' : 'Checking authentication...'))
    const auth = await window.electronAPI.cloudflaredCheckAuth()
    if (!auth?.authenticated) {
      setCfLog(prev => prev + '\n[LỖI] ' + (lang === 'vi' ? 'Chưa xác thực Cloudflare. Hãy bấm "Đăng nhập" trên tab Trạng thái trước.' : 'Not authenticated. Click "Login" on Status tab first.'))
      addToast(lang === 'vi' ? 'Chưa xác thực Cloudflare' : 'Not authenticated', 'error'); return
    }
    setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã xác thực!' : 'Authenticated!'))
    setCfLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? `Đang tạo tunnel "${cfConfig.tunnelName}"...` : `Creating tunnel "${cfConfig.tunnelName}"...`))
    const res = await window.electronAPI.createTunnel(cfConfig.tunnelName, cfConfig.appDomain)
    if (res?.ok) { setCfLog(prev => prev + '\n[OK] ' + (res.message || (lang === 'vi' ? 'Tunnel đã tạo!' : 'Tunnel created!'))); addToast(lang === 'vi' ? 'Tunnel đã tạo!' : 'Tunnel created!', 'ok'); saveNodeConfig({ cfConfig }) }
    else { setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Tạo tunnel thất bại' : 'Tunnel creation failed', 'error') }
  }
  const handleCfLogin = async () => {
    if (!isElectron) return
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...'))
    const res = await window.electronAPI.cloudflaredLogin()
    if (res?.ok) {
      setCfLog(prev => prev + '\n[OK] ' + (res.message || (lang === 'vi' ? 'Đã mở trình duyệt! Hãy đăng nhập Cloudflare.' : 'Browser opened! Login to Cloudflare.')))
      addToast(lang === 'vi' ? 'Đang mở trình duyệt Cloudflare...' : 'Opening Cloudflare browser...', 'ok')
    } else {
      setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
      addToast(lang === 'vi' ? 'Lỗi mở trình duyệt' : 'Browser error', 'error')
    }
  }
  const handleCfCheckAuth = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.cloudflaredCheckAuth()
    if (res?.authenticated) {
      setCfAuthenticated(true)
      setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã xác thực Cloudflare!' : 'Cloudflare authenticated!'))
      addToast(lang === 'vi' ? 'Đã xác thực Cloudflare!' : 'Authenticated!', 'ok')
    } else {
      setCfAuthenticated(false)
      setCfLog(prev => prev + '\n[LỖI] ' + (lang === 'vi' ? 'Chưa xác thực. Hãy đăng nhập trước.' : 'Not authenticated. Login first.'))
      addToast(lang === 'vi' ? 'Chưa xác thực Cloudflare' : 'Not authenticated', 'error')
    }
  }

  // Wizard handlers
  const handleWizardDockerInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true); setWizardDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Docker...' : 'Installing Docker...'))
    const res = await window.electronAPI.installDocker()
    if (res?.ok) { setWizardDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!')); setTimeout(() => { setWizardStep(2); setWizardProcessing(false) }, 1000) }
    else if (res?.needAuth) { setWizardDockerLog(prev => prev + '\n[LỖI] ' + (lang === 'vi' ? 'Cần quyền root. Hãy xác thực sudo trước.' : 'Needs root. Authenticate sudo first.')); setWizardProcessing(false); setAuthOpen(true) }
    else { setWizardDockerLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); setWizardProcessing(false) }
  }
  const handleWizardWingsInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true); setWizardWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Wings...' : 'Installing Wings...'))
    const res = await window.electronAPI.installWings()
    if (res?.ok) { setWizardWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!')); refreshAll() }
    else { setWizardWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); setWizardProcessing(false) }
  }
  const handleWizardCfLogin = async () => {
    if (!isElectron) return
    setWizardProcessing(true); setWizardCfLog('[INFO] ' + (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...'))
    const res = await window.electronAPI.cloudflaredLogin()
    if (res?.ok) {
      setWizardCfLog(prev => prev + '\n[OK] ' + (res.message || (lang === 'vi' ? 'Đã mở trình duyệt! Hãy đăng nhập Cloudflare.' : 'Browser opened! Login to Cloudflare.')))
      addToast(lang === 'vi' ? 'Đang mở trình duyệt Cloudflare...' : 'Opening Cloudflare browser...', 'ok')
    } else {
      setWizardCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    }
    setWizardProcessing(false)
  }
  const handleWizardCfCheckAuth = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.cloudflaredCheckAuth()
    if (res?.authenticated) {
      setCfAuthenticated(true)
      setWizardCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã xác thực Cloudflare!' : 'Cloudflare authenticated!'))
      addToast(lang === 'vi' ? 'Đã xác thực Cloudflare!' : 'Authenticated!', 'ok')
    } else {
      setWizardCfLog(prev => prev + '\n[LỖI] ' + (lang === 'vi' ? 'Chưa xác thực. Hãy đăng nhập trước.' : 'Not authenticated. Login first.'))
    }
  }
  const handleWizardSavePaths = async () => {
    if (!isElectron) return
    await window.electronAPI.saveSettings({ paths: wizardPaths })
    setHasPaths(true)
    refreshAll()
    setWizardStep(1)
  }

  const handleQuickSetup = async () => {
    if (!isElectron) return
    if (!wizardPaths.base) return
    setWizardProcessing(true)
    setWizardDockerLog('')
    setWizardWingsLog('')
    setWizardCfLog('')
    // Step 1: Save paths
    setWizardDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang lưu đường dẫn...' : 'Saving paths...'))
    const saveRes = await window.electronAPI.saveSettings({ paths: wizardPaths })
    if (!saveRes?.ok) { setWizardDockerLog(prev => prev + '\n[LỖI] Không lưu được settings'); setWizardProcessing(false); return }
    await refreshAll()
    const t0 = Date.now()
    // Step 2: Install Docker
    setWizardStep(1)
    setWizardDockerLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Bắt đầu cài Docker...' : 'Starting Docker install...'))
    let res = await window.electronAPI.installDocker()
    const dockerTime = ((Date.now() - t0) / 1000).toFixed(1)
    if (res?.ok) {
      setWizardDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `Docker cài thành công! (${dockerTime}s, ${res.version || ''})` : `Docker installed! (${dockerTime}s, ${res.version || ''})`))
    } else {
      setWizardDockerLog(prev => prev + '\n[LỖI] ' + (res?.needAuth ? (lang === 'vi' ? 'Cần quyền root. Hãy xác thực sudo trước.' : 'Needs root. Authenticate sudo first.') : (res?.error || 'Unknown error')))
      setWizardProcessing(false)
      if (res?.needAuth) setAuthOpen(true)
      return
    }
    await refreshAll()
    // Step 3: Install Wings
    setWizardStep(2)
    const t1 = Date.now()
    setWizardWingsLog('[INFO] ' + (lang === 'vi' ? 'Bắt đầu cài Wings...' : 'Starting Wings install...'))
    res = await window.electronAPI.installWings()
    const wingsTime = ((Date.now() - t1) / 1000).toFixed(1)
    if (res?.ok) {
      setWizardWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `Wings cài thành công! (${wingsTime}s, v${res.version || '?'}, ${res.arch || ''})` : `Wings installed! (${wingsTime}s, v${res.version || '?'}, ${res.arch || ''})`))
    } else {
      setWizardWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || 'Unknown error'))
      setWizardProcessing(false)
      return
    }
    setWizardWingsLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Đang tạo config Wings...' : 'Generating Wings config...'))
    const cfgRes = await window.electronAPI.generateWingsConfig()
    if (cfgRes?.ok) {
      setWizardWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `Config Wings đã tạo! (token: ${cfgRes.token ? cfgRes.token.substring(0,8)+'...' : '?'})` : `Wings config generated!`))
      setWingsConfigSaved(true)
    } else {
      setWizardWingsLog(prev => prev + '\n[LỖI] ' + (cfgRes?.error || ''))
    }
    await refreshAll()
    // Step 4: Install Cloudflare
    setWizardStep(3)
    const t2 = Date.now()
    setWizardCfLog('[INFO] ' + (lang === 'vi' ? 'Bắt đầu cài Cloudflared...' : 'Starting Cloudflared install...'))
    const sysInfo = await window.electronAPI.getSystemInfo()
    res = await window.electronAPI.installCloudflared(sysInfo?.arch === 'arm64' ? 'aarch64' : 'x86_64')
    const cfTime = ((Date.now() - t2) / 1000).toFixed(1)
    if (res?.ok) {
      setWizardCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `Cloudflared cài thành công! (${cfTime}s, ${res.version || ''})` : `Cloudflared installed! (${cfTime}s, ${res.version || ''})`))
    } else {
      setWizardCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
      setWizardProcessing(false)
      return
    }
    // Step 5: Install Database
    const t3 = Date.now()
    setWizardCfLog(prev => prev + '\n[INFO] ' + (lang === 'vi' ? 'Bắt đầu cài PostgreSQL...' : 'Starting PostgreSQL install...'))
    res = await window.electronAPI.installDatabase()
    const dbTime = ((Date.now() - t3) / 1000).toFixed(1)
    if (res?.ok) {
      setWizardCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `PostgreSQL cài thành công! (${dbTime}s, ${res.version || ''})` : `PostgreSQL installed! (${dbTime}s, ${res.version || ''})`))
    } else {
      setWizardCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    }
    // Done
    const totalTime = ((Date.now() - t0) / 1000).toFixed(1)
    await window.electronAPI.saveSettings({ setupComplete: true })
    setWizardCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? `🎉 Setup hoàn tất! Tổng thời gian: ${totalTime}s` : `Setup complete! Total: ${totalTime}s`))
    setAllInstalled(true)
    setWizardProcessing(false)
    await refreshAll()
    addToast(lang === 'vi' ? `Setup hoàn tất trong ${totalTime}s!` : `Setup complete in ${totalTime}s!`, 'ok')
  }
  const handleWizardPickFolder = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.openFolderPicker(wizardPaths.base || '')
    if (res?.path) {
      const base = res.path
      setWizardPaths({
        base,
        docker: `${base}/docker`,
        wings: `${base}/wings`,
        wingsConfig: `${base}/wings-config`,
        cloudflare: `${base}/cloudflare`,
        database: `${base}/database`,
        downloads: `${base}/downloads`,
        servers: `${base}/servers`,
        logs: `${base}/logs`,
      })
    }
  }

  const dockerColor = !docker ? '#6b7280' : docker.installed ? (docker.running ? '#22c55e' : '#ef4444') : '#6b7280'
  const wingsColor = !wings ? '#6b7280' : wings.installed ? (wings.running ? '#06b6d4' : '#ef4444') : '#6b7280'
  const cfColor = !cloudflare ? '#6b7280' : cloudflare.installed ? (cloudflare.running ? '#22c55e' : '#ef4444') : '#6b7280'
  const dbColor = !database ? '#6b7280' : database.installed ? (database.running ? '#8b5cf6' : '#ef4444') : '#6b7280'

  const tabs = [
    { key: 'status', label: lang === 'vi' ? 'Trạng thái' : 'Status' },
    { key: 'config', label: lang === 'vi' ? 'Cấu hình' : 'Configuration' },
  ]

  return (
    <div className="h-full overflow-auto p-6" style={{ background: bg }}>
      <Toast toasts={toasts} />
      <ConfirmModal open={confirmOpen} title={confirmData.title} message={confirmData.message} confirmLabel={confirmData.confirmLabel} confirmColor={confirmData.confirmColor} theme={theme} lang={lang} onConfirm={handleConfirm} onCancel={() => setConfirmOpen(false)} />

      {firstTimeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-w-sm w-[90vw] rounded-2xl p-6 space-y-4" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${inputBorder}` }}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a78bfa20, #818cf820)' }}>
                <svg className="w-7 h-7" style={{ color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Chào mừng đến Terver Panel!' : 'Welcome to Terver Panel!'}</h3>
              <p className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Chưa có cài đặt nào. Bạn muốn setup như thế nào?' : 'No setup found. How would you like to proceed?'}</p>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setFirstTimeOpen(false); setWizardOpen(true); setWizardStep(0) }} className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', color: '#fff' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {lang === 'vi' ? 'Setup nhanh (tự động)' : 'Quick Setup (auto)'}
              </button>
              <button onClick={() => { setFirstTimeOpen(false) }} className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                {lang === 'vi' ? 'Thủ công (tự cài từng bước)' : 'Manual (install step by step)'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-4">

        {authOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="max-w-sm w-[90vw] rounded-2xl p-5 space-y-3" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${inputBorder}` }}>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Xác thực quyền' : 'Authenticate'}</h3>
              <p className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Nhập sudo password. Chỉ cần 1 lần.' : 'Enter sudo password. Once per session.'}</p>
              <input type="password" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError('') }} onKeyDown={(e) => e.key === 'Enter' && handleAuth()} autoFocus className="w-full px-3 py-2 rounded-lg text-xs outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor, '--tw-ring-color': '#a78bfa' }} />
              {authError && <p className="text-[11px]" style={{ color: '#ef4444' }}>{authError}</p>}
              <button onClick={handleAuth} className="w-full py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#a78bfa', color: '#fff' }}>{lang === 'vi' ? 'Xác nhận' : 'Confirm'}</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7" style={{ color: '#a78bfa' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            <div>
              <h2 className="text-lg font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Quản lý Node' : 'Node Management'}</h2>
              <p className="text-[10px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Cài đặt, trạng thái và cấu hình' : 'Install, status and configuration'}</p>
            </div>
          </div>
          <button onClick={() => { setWizardOpen(true); setWizardStep(allInstalled ? 0 : 0); setWizardDockerLog(''); setWizardWingsLog(''); setWizardCfLog('') }} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95" style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', color: '#fff' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {allInstalled ? (lang === 'vi' ? 'Đã cài đặt' : 'Installed') : (lang === 'vi' ? 'Setup nhanh' : 'Quick Setup')}
          </button>
        </div>

        {sysInfo && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'CPU', value: sysInfo.cpu?.cores ? `${sysInfo.cpu.cores} cores` : '---', Icon: Cpu, color: '#3b82f6' },
              { label: 'RAM', value: sysInfo.memory?.totalGB ? `${sysInfo.memory.totalGB} GB` : '---', Icon: Memory, color: '#8b5cf6' },
              { label: 'Disk', value: sysInfo.disk?.totalGB ? `${sysInfo.disk.totalGB} GB` : '---', Icon: HardDrive, color: '#22c55e' },
              { label: lang === 'vi' ? 'Hệ điều hành' : 'OS', value: sysInfo.os?.distro || '---', Icon: DesktopTower, color: '#f59e0b' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-xl p-3 flex items-center gap-2.5 transition-all hover:scale-[1.02]" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
                <Icon size={18} weight="duotone" style={{ color }} />
                <div>
                  <p className="text-[9px] uppercase font-semibold" style={{ color: labelColor }}>{label}</p>
                  <p className="text-[11px] font-bold" style={{ color: textColor }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 p-1 rounded-xl" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: tab === t.key ? (theme === 'light' ? '#fff' : 'rgba(255,255,255,0.1)') : 'transparent', color: tab === t.key ? textColor : labelColor, boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'status' && (
          <div className="space-y-3">
            <ServiceCard title="Docker Engine" icon={<svg className="w-4 h-4" style={{ color: dockerColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>} color={dockerColor} installed={docker?.installed} running={docker?.running} version={docker?.version} theme={theme} onInstall={handleDockerInstall} onUninstall={handleDockerUninstall} onStart={async () => {
              setDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang khởi động Docker...' : 'Starting Docker...'))
              const res = await window.electronAPI.systemdStart('docker')
              if (res?.ok) { setDockerLog(res.logs || '[OK] Docker đã chạy!'); addToast(lang === 'vi' ? 'Docker đã khởi động!' : 'Docker started!', 'ok') }
              else { const errText = res?.error || res?.startOutput || res?.logs || ''; setDockerLog(errText ? '[LỖI] ' + errText : '[LỖI] Không khởi động được Docker'); addToast(lang === 'vi' ? 'Khởi động Docker thất bại' : 'Docker start failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onStop={async () => {
              setDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng Docker...' : 'Stopping Docker...'))
              const res = await window.electronAPI.systemdStop('docker')
              if (res?.ok) { setDockerLog(res.logs || '[OK] Docker đã dừng!'); addToast(lang === 'vi' ? 'Docker đã dừng!' : 'Docker stopped!', 'ok') }
              else { setDockerLog(res?.logs || '[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Dừng Docker thất bại' : 'Docker stop failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onLoadLogs={async () => { const res = await window.electronAPI.systemdStatus('docker'); if (res?.logs) setDockerLog(res.logs) }} installing={dockerInstalling} uninstalling={dockerUninstalling} progress={dockerProgress} log={dockerLog} logPlaceholder={docker?.installed ? (docker?.running ? (lang === 'vi' ? 'Docker đang chạy.' : 'Docker running.') : (lang === 'vi' ? 'Docker đã cài, chưa chạy.' : 'Docker installed, not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="docker" onCopy={() => copy('docker', dockerLog)} />

            <ServiceCard title="LunarSpace Wings" icon={<svg className="w-4 h-4" style={{ color: wingsColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} color={wingsColor} installed={wings?.installed} running={wings?.running} version={wings?.version} theme={theme} onInstall={handleWingsInstall} onUninstall={handleWingsUninstall} onStart={async () => {
              setWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang khởi động Wings...' : 'Starting Wings...'))
              const res = await window.electronAPI.systemdStart('lunarspace-wings')
              if (res?.ok) { setWingsLog(res.logs || '[OK] Wings đã chạy!'); addToast(lang === 'vi' ? 'Wings đã khởi động!' : 'Wings started!', 'ok') }
              else { const errText = res?.error || res?.startOutput || res?.logs || ''; setWingsLog(errText ? '[LỖI] ' + errText : '[LỖI] Không khởi động được Wings'); addToast(lang === 'vi' ? 'Khởi động Wings thất bại: ' + (res?.error || res?.startOutput || '').slice(0, 80) : 'Wings start failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onStop={async () => {
              setWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng Wings...' : 'Stopping Wings...'))
              const res = await window.electronAPI.systemdStop('lunarspace-wings')
              if (res?.ok) { setWingsLog(res.logs || '[OK] Wings đã dừng!'); addToast(lang === 'vi' ? 'Wings đã dừng!' : 'Wings stopped!', 'ok') }
              else { setWingsLog(res?.logs || '[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Dừng Wings thất bại' : 'Wings stop failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onLoadLogs={async () => { const res = await window.electronAPI.systemdStatus('lunarspace-wings'); if (res?.logs) setWingsLog(res.logs) }} installing={wingsInstalling} uninstalling={wingsUninstalling} progress={wingsProgress} log={wingsLog} logPlaceholder={wings?.installed ? (wings?.running ? (lang === 'vi' ? 'Wings đang chạy.' : 'Wings running.') : (lang === 'vi' ? 'Wings đã cài, chưa chạy.' : 'Wings installed, not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="wings" onCopy={() => copy('wings', wingsLog)}>
              {wings?.installed && !wings?.hasConfig && (
                <button onClick={handleWingsConfigGenerate} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>
                  {wingsConfigSaved ? (lang === 'vi' ? 'Đã tạo!' : 'Generated!') : (lang === 'vi' ? 'Tạo config.yml' : 'Generate config.yml')}
                </button>
              )}
              {wings?.hasConfig && <p className="text-[10px]" style={{ color: '#22c55e' }}>✓ {lang === 'vi' ? 'Đã cấu hình' : 'Configured'}</p>}
            </ServiceCard>

            <ServiceCard title="Cloudflare Tunnel" icon={<svg className="w-4 h-4" style={{ color: cfColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V4l-8-2-8 2v8c0 6 8 10 8 10z"/></svg>} color={cfColor} installed={cloudflare?.installed} running={cloudflare?.running} version={cloudflare?.version} theme={theme} onInstall={handleCfInstall} onUninstall={handleCfUninstall} onStart={async () => {
              setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang khởi động Cloudflared...' : 'Starting Cloudflared...'))
              const res = await window.electronAPI.systemdStart('cloudflared')
              if (res?.ok) { setCfLog(res.logs || '[OK] Cloudflared đã chạy!'); addToast(lang === 'vi' ? 'Cloudflared đã khởi động!' : 'Cloudflared started!', 'ok') }
              else { const errText = res?.error || res?.startOutput || res?.logs || ''; setCfLog(errText ? '[LỖI] ' + errText : '[LỖI] Không khởi động được Cloudflared'); addToast(lang === 'vi' ? 'Khởi động Cloudflared thất bại' : 'Cloudflared start failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onStop={async () => {
              setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang dừng Cloudflared...' : 'Stopping Cloudflared...'))
              const res = await window.electronAPI.systemdStop('cloudflared')
              if (res?.ok) { setCfLog(res.logs || '[OK] Cloudflared đã dừng!'); addToast(lang === 'vi' ? 'Cloudflared đã dừng!' : 'Cloudflared stopped!', 'ok') }
              else { setCfLog(res?.logs || '[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Dừng Cloudflared thất bại' : 'Cloudflared stop failed', 'error') }
              setTimeout(refreshAll, 2000)
            }} onLoadLogs={async () => { const res = await window.electronAPI.systemdStatus('cloudflared'); if (res?.logs) setCfLog(res.logs) }} installing={cfInstalling} uninstalling={cfUninstalling} progress={cfProgress} log={cfLog} logPlaceholder={cloudflare?.installed ? (cloudflare?.running ? (lang === 'vi' ? 'Cloudflared đang chạy.' : 'Cloudflared running.') : (lang === 'vi' ? 'Đã cài đặt. Chưa chạy.' : 'Installed. Not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="cf" onCopy={() => copy('cf', cfLog)}>
              <div className="flex gap-1.5">
                <button onClick={handleCfLogin} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: cfAuthenticated ? '#22c55e' : '#3b82f6', color: '#fff' }}>{cfAuthenticated ? (lang === 'vi' ? 'Đã đăng nhập' : 'Logged in') : (lang === 'vi' ? 'Đăng nhập' : 'Login')}</button>
                <button onClick={handleCfCheckAuth} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? 'Kiểm tra' : 'Check'}</button>
              </div>
            </ServiceCard>

            <ServiceCard title="PostgreSQL" icon={<svg className="w-4 h-4" style={{ color: dbColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>} color={dbColor} installed={database?.installed} running={database?.running} version={database?.version} theme={theme} onInstall={async () => {
              if (!isElectron) return
              setDbInstalling(true); setDbLog('')
              setDbProgress({ percent: 0, message: 'Đang bắt đầu...' })
              const res = await window.electronAPI.installDatabase()
              if (res?.ok) { setDbLog('[OK] ' + (lang === 'vi' ? 'Cài PostgreSQL thành công!' : 'PostgreSQL installed!') + '\n' + (res.version || '')); refreshAll(); addToast(lang === 'vi' ? 'PostgreSQL đã cài!' : 'PostgreSQL installed!', 'ok') }
              else { setDbLog('[LỖI] ' + (res?.error || '')); addToast(lang === 'vi' ? 'Cài PostgreSQL thất bại' : 'PostgreSQL install failed', 'error') }
              setDbInstalling(false); setDbProgress(null)
            }} onUninstall={() => {
              openConfirm(
                lang === 'vi' ? 'Gỡ PostgreSQL?' : 'Uninstall PostgreSQL?',
                lang === 'vi' ? 'Sẽ xóa toàn bộ database, data, config. Không thể hoàn tác.' : 'Will remove all database, data, config. Cannot undo.',
                async () => {
                  const res = await window.electronAPI.systemCleanup('database')
                  if (res?.ok) { refreshAll(); addToast(lang === 'vi' ? 'Đã gỡ PostgreSQL' : 'PostgreSQL uninstalled', 'ok') }
                  else addToast(lang === 'vi' ? 'Gỡ PostgreSQL thất bại' : 'PostgreSQL uninstall failed', 'error')
                }
              )
            }} onStart={() => {}} onStop={() => {}} installing={false} uninstalling={false} progress={null} log={dbLog} logPlaceholder={database?.installed ? (database?.running ? (lang === 'vi' ? 'PostgreSQL đang chạy.' : 'PostgreSQL running.') : (lang === 'vi' ? 'PostgreSQL đã cài, chưa chạy.' : 'PostgreSQL installed, not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="db-status" onCopy={() => copy('db-status', dbLog)} />
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Docker Config' : 'Docker Config'}</h4>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: labelColor }}>Socket Path</label>
                  <input value={dockerConfig.socketPath} onChange={(e) => { const v = { ...dockerConfig, socketPath: e.target.value }; setDockerConfig(v); saveNodeConfig({ dockerConfig: v }) }} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Thư mục dữ liệu' : 'Data Directory'}</label>
                    <input value={dockerConfig.dataDir} onChange={(e) => { const v = { ...dockerConfig, dataDir: e.target.value }; setDockerConfig(v); saveNodeConfig({ dockerConfig: v }) }} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Network' : 'Network'}</label>
                    <input value={dockerConfig.networkInterface} onChange={(e) => { const v = { ...dockerConfig, networkInterface: e.target.value }; setDockerConfig(v); saveNodeConfig({ dockerConfig: v }) }} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                </div>
              </div>
            </div>

            {wings?.installed && !wings?.hasConfig && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Wings Config' : 'Wings Config'}</h4>
                <p className="text-[10px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Tự cấu hình. Chỉ cần tạo file config.yml.' : 'Auto-configured. Just generate config.yml.'}</p>
                <button onClick={handleWingsConfigGenerate} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>
                  {wingsConfigSaved ? (lang === 'vi' ? 'Đã tạo!' : 'Generated!') : (lang === 'vi' ? 'Tạo config.yml' : 'Generate config.yml')}
                </button>
              </div>
            )}

            {cloudflare?.installed && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Cloudflare Tunnel' : 'Cloudflare Tunnel'}</h4>
                <div className="p-2.5 rounded-lg text-[10px] space-y-1" style={{ background: '#3b82f610', border: '1px solid #3b82f630', color: labelColor }}>
                  <p className="font-semibold" style={{ color: '#3b82f6' }}>{lang === 'vi' ? 'Hướng dẫn:' : 'Guide:'}</p>
                  <p>1. {lang === 'vi' ? 'Bấm "Đăng nhập" trên tab Trạng thái → trình duyệt mở → đăng nhập Cloudflare' : 'Click "Login" on Status tab → browser opens → login Cloudflare'}</p>
                  <p>2. {lang === 'vi' ? 'Bấm "Kiểm tra" để xác nhận đã xác thực' : 'Click "Check" to confirm authentication'}</p>
                  <p>3. {lang === 'vi' ? 'Nhập tên tunnel (tùy ý) và domain đầy đủ bên dưới' : 'Enter tunnel name (any) and full domain below'}</p>
                  <p>4. {lang === 'vi' ? 'Bấm "Tạo Tunnel" — tự route DNS + chạy tunnel' : 'Click "Create Tunnel" — auto route DNS + run tunnel'}</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Tên tunnel (tùy ý)' : 'Tunnel name (any)'}</label>
                    <input value={cfConfig.tunnelName} onChange={(e) => { const v = { ...cfConfig, tunnelName: e.target.value }; setCfConfig(v); saveNodeConfig({ cfConfig: v }) }} placeholder="terver-tunnel" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Domain đầy đủ (phải sở hữu trên Cloudflare)' : 'Full domain (must own on Cloudflare)'}</label>
                    <input value={cfConfig.appDomain} onChange={(e) => { const v = { ...cfConfig, appDomain: e.target.value }; setCfConfig(v); saveNodeConfig({ cfConfig: v }) }} placeholder="panel.example.com" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                </div>
                <button onClick={handleTunnelCreate} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#3b82f6', color: '#fff' }}>
                  {lang === 'vi' ? 'Tạo Tunnel' : 'Create Tunnel'}
                </button>
              </div>
            )}

            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8b5cf6' }}>{lang === 'vi' ? 'Database (PostgreSQL)' : 'Database (PostgreSQL)'}</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: labelColor }}>DB Name</label>
                  <input value={dbConfig.name} onChange={(e) => { const v = { ...dbConfig, name: e.target.value }; setDbConfig(v); saveNodeConfig({ dbConfig: v }) }} className="px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2 w-full" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: labelColor }}>User</label>
                  <input value={dbConfig.user} onChange={(e) => { const v = { ...dbConfig, user: e.target.value }; setDbConfig(v); saveNodeConfig({ dbConfig: v }) }} className="px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2 w-full" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: labelColor }}>Password</label>
                  <input value={dbConfig.pass} onChange={(e) => { const v = { ...dbConfig, pass: e.target.value }; setDbConfig(v); saveNodeConfig({ dbConfig: v }) }} type="password" className="px-3 py-1.5 rounded-lg text-[11px] outline-none transition-all focus:ring-2 w-full" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
              </div>
              <button onClick={async () => { const res = await window.electronAPI.databaseSetup(dbConfig.name, dbConfig.user, dbConfig.pass); setDbLog(res?.ok ? '[OK] ' + (res.message || '') : '[LỖI] ' + (res?.error || '')); addToast(res?.ok ? (lang === 'vi' ? 'Database đã tạo!' : 'Database created!') : (lang === 'vi' ? 'Tạo Database thất bại' : 'Database failed'), res?.ok ? 'ok' : 'error') }} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#8b5cf6', color: '#fff' }}>
                {lang === 'vi' ? 'Tạo Database' : 'Create Database'}
              </button>
              <LogBox value={dbLog} placeholder={lang === 'vi' ? 'Nhập thông tin → Tạo Database.' : 'Enter info → Create Database.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="db" onCopy={() => copy('db', dbLog)} />
            </div>

            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>{lang === 'vi' ? 'Xóa dữ liệu' : 'Cleanup'}</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'docker', label: 'Docker', color: '#2496ed' },
                  { key: 'wings', label: 'Wings', color: '#06b6d4' },
                  { key: 'cloudflare', label: 'Cloudflare', color: '#3b82f6' },
                  { key: 'database', label: 'Database', color: '#8b5cf6' },
                  { key: 'logs', label: 'Logs', color: '#f59e0b' },
                  { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All', color: '#ef4444' },
                ].map(item => (
                  <button key={item.key} onClick={() => openConfirm(
                    lang === 'vi' ? `Xóa ${item.label}?` : `Clean ${item.label}?`,
                    item.key === 'all'
                      ? (lang === 'vi' ? 'Sẽ xóa TOÀN BỘ: Docker, Wings, Cloudflare, Database, Logs. Không thể hoàn tác!' : 'Will remove EVERYTHING: Docker, Wings, Cloudflare, Database, Logs. Cannot undo!')
                      : (lang === 'vi' ? `Sẽ xóa toàn bộ ${item.label}: binary, config, data, logs. Không thể hoàn tác.` : `Will remove all ${item.label}: binary, config, data, logs. Cannot undo.`),
                    async () => {
                      setCleanupLog('[INFO] ' + (lang === 'vi' ? `Đang xóa ${item.label}...` : `Cleaning ${item.label}...`))
                      const res = await window.electronAPI.systemCleanup(item.key)
                      setCleanupLog(prev => prev + '\n' + (res?.ok ? '[OK] ' + (res.results?.join('\n') || '') : '[LỖI] ' + (res?.error || '')))
                      if (res?.ok) { refreshAll(); addToast(lang === 'vi' ? `Đã xóa ${item.label}` : `${item.label} cleaned`, 'ok') }
                    },
                    lang === 'vi' ? `Xóa ${item.label}` : `Clean ${item.label}`,
                    item.color
                  )} className="py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: `${item.color}15`, border: `1px solid ${item.color}40`, color: item.color }}>
                    {item.label}
                  </button>
                ))}
              </div>
              <LogBox value={cleanupLog} placeholder={lang === 'vi' ? 'Chọn loại để xóa.' : 'Select type to clean.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="cleanup" onCopy={() => copy('cleanup', cleanupLog)} />
            </div>
          </div>
        )}

        {wizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setWizardOpen(false)}>
            <div className="max-w-md w-[90vw] rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${inputBorder}` }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${inputBorder}` }}>
                <h3 className="text-sm font-bold" style={{ color: textColor }}>{allInstalled ? (lang === 'vi' ? 'Đã cài đặt' : 'Already Installed') : (lang === 'vi' ? 'Setup nhanh' : 'Quick Setup')}</h3>
                <button onClick={() => setWizardOpen(false)} className="w-5 h-5 rounded flex items-center justify-center transition-all hover:opacity-80 active:scale-95" style={{ color: labelColor }}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-4 space-y-3">
                {/* Step indicators */}
                {!allInstalled && (
                  <div className="flex gap-1">
                    {[{ key: 0, label: lang === 'vi' ? 'Đường dẫn' : 'Paths', color: '#a78bfa' }, { key: 1, label: 'Docker', color: '#2496ed' }, { key: 2, label: 'Wings', color: '#06b6d4' }, { key: 3, label: 'CF Tunnel', color: '#3b82f6' }].map((s, i) => (
                      <div key={s.key} className="flex items-center gap-1 flex-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: wizardStep > i ? s.color : wizardStep === i ? s.color : inputBg, color: wizardStep >= i ? '#fff' : labelColor }}>{wizardStep > i ? '✓' : i + 1}</div>
                        <span className="text-[9px] font-semibold" style={{ color: wizardStep >= i ? s.color : labelColor }}>{s.label}</span>
                        {i < 3 && <div className="flex-1 h-px mx-1" style={{ background: wizardStep > i ? s.color : inputBorder }} />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Already installed view */}
                {allInstalled && (
                  <div className="space-y-3 py-4">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: '#22c55e20' }}>
                        <svg className="w-6 h-6" style={{ color: '#22c55e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-xs font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Tất cả đã được cài đặt!' : 'Everything is installed!'}</p>
                      <p className="text-[10px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Docker, Wings, Cloudflare đã sẵn sàng.' : 'Docker, Wings, Cloudflare are ready.'}</p>
                    </div>
                    <button onClick={() => { setAllInstalled(false); setWizardStep(0) }} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                      {lang === 'vi' ? 'Cài lại / Thay đổi đường dẫn' : 'Reinstall / Change paths'}
                    </button>
                  </div>
                )}

                {/* Step 0: Path selection */}
                {wizardStep === 0 && !allInstalled && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Bước 1: Chọn thư mục lưu trữ' : 'Step 1: Choose storage directory'}</p>
                    <p className="text-[10px]" style={{ color: labelColor, opacity: 0.6 }}>{lang === 'vi' ? 'Chọn một thư mục. Hệ thống tự tạo thư mục con theo loại.' : 'Pick a folder. Subdirectories auto-created by type.'}</p>
                    <button onClick={handleWizardPickFolder} className="w-full py-2.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95 flex items-center justify-center gap-2" style={{ background: wizardPaths.base ? '#22c55e20' : '#a78bfa', border: `1px solid ${wizardPaths.base ? '#22c55e40' : inputBorder}`, color: wizardPaths.base ? '#22c55e' : '#fff' }}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      {wizardPaths.base ? wizardPaths.base : (lang === 'vi' ? 'Chọn thư mục...' : 'Choose folder...')}
                    </button>
                    {wizardPaths.base && (
                      <div className="space-y-1 max-h-[200px] overflow-auto pr-1">
                        {Object.entries({
                          docker: { icon: '🐳', label: 'Docker' },
                          wings: { icon: '🪽', label: 'Wings' },
                          wingsConfig: { icon: '⚙️', label: 'Wings Config' },
                          cloudflare: { icon: '☁️', label: 'Cloudflare' },
                          database: { icon: '🗄️', label: 'PostgreSQL' },
                          downloads: { icon: '📥', label: 'Downloads' },
                          servers: { icon: '🎮', label: 'Game Servers' },
                          logs: { icon: '📋', label: 'Logs' },
                        }).map(([key, info]) => (
                          <div key={key} className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: inputBg }}>
                            <span className="text-xs">{info.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-medium" style={{ color: labelColor }}>{info.label}</span>
                              <p className="text-[10px] truncate" style={{ color: textColor }}>{wizardPaths[key]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 1: Docker */}
                {wizardStep === 1 && !allInstalled && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>Bước 2: Docker Engine</p>
                    {docker?.installed ? (
                      <div className="p-2 rounded-lg text-[10px]" style={{ background: '#22c55e20', color: '#22c55e' }}>✓ Docker {lang === 'vi' ? 'đã cài' : 'installed'}</div>
                    ) : (
                      <button onClick={handleWizardDockerInstall} disabled={wizardProcessing} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#2496ed', color: '#fff', opacity: wizardProcessing ? 0.5 : 1 }}>{wizardProcessing ? '...' : 'Cài Docker'}</button>
                    )}
                    <LogBox value={wizardDockerLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="wd" onCopy={() => copy('wd', wizardDockerLog)} />
                  </div>
                )}

                {/* Step 2: Wings */}
                {wizardStep === 2 && !allInstalled && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>Bước 3: LunarSpace Wings</p>
                    {wings?.installed ? (
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg text-[10px]" style={{ background: '#06b6d420', color: '#06b6d4' }}>✓ Wings {lang === 'vi' ? 'đã cài' : 'installed'}</div>
                        {!wings?.hasConfig ? (
                          <button onClick={handleWingsConfigGenerate} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>{wingsConfigSaved ? '✓' : (lang === 'vi' ? 'Tạo config' : 'Generate config')}</button>
                        ) : (
                          <button onClick={() => setWizardStep(3)} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#06b6d4', color: '#fff' }}>{lang === 'vi' ? 'Tiếp → Cloudflare' : 'Next → Cloudflare'}</button>
                        )}
                      </div>
                    ) : (
                      <button onClick={handleWizardWingsInstall} disabled={wizardProcessing} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#06b6d4', color: '#fff', opacity: wizardProcessing ? 0.5 : 1 }}>{wizardProcessing ? '...' : 'Cài Wings'}</button>
                    )}
                    <LogBox value={wizardWingsLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="ww" onCopy={() => copy('ww', wizardWingsLog)} />
                  </div>
                )}

                {/* Step 3: Cloudflare */}
                {wizardStep === 3 && !allInstalled && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>Bước 4: Cloudflare Tunnel</p>
                    {!cloudflare?.installed ? (
                      <div className="p-2 rounded-lg text-[10px]" style={{ background: '#ef444420', color: '#ef4444' }}>{lang === 'vi' ? 'Cài cloudflared trước.' : 'Install cloudflared first.'}</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <button onClick={handleWizardCfLogin} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: cfAuthenticated ? '#22c55e' : '#3b82f6', color: '#fff' }}>{cfAuthenticated ? (lang === 'vi' ? 'Đã đăng nhập' : 'Logged in') : (lang === 'vi' ? 'Đăng nhập' : 'Login')}</button>
                          <button onClick={handleWizardCfCheckAuth} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? 'Kiểm tra' : 'Check'}</button>
                        </div>
                        <input value={cfConfig.tunnelName} onChange={(e) => setCfConfig({ ...cfConfig, tunnelName: e.target.value })} placeholder={lang === 'vi' ? 'Tên tunnel (tùy ý)' : 'Tunnel name'} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                        <input value={cfConfig.appDomain} onChange={(e) => setCfConfig({ ...cfConfig, appDomain: e.target.value })} placeholder={lang === 'vi' ? 'Domain đầy đủ (ví dụ: panel.example.com)' : 'Full domain (e.g. panel.example.com)'} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                        <button onClick={handleTunnelCreate} className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#3b82f6', color: '#fff' }}>{lang === 'vi' ? 'Tạo Tunnel' : 'Create Tunnel'}</button>
                      </div>
                    )}
                    <LogBox value={wizardCfLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="wc" onCopy={() => copy('wc', wizardCfLog)} />
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex gap-1.5 pt-1">
                  {wizardStep > 0 && !allInstalled && <button onClick={() => setWizardStep(wizardStep - 1)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>←</button>}
                  {wizardStep === 0 && !allInstalled && (
                    <button onClick={handleWizardSavePaths} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#a78bfa', color: '#fff' }}>
                      {lang === 'vi' ? 'Lưu & Tiếp →' : 'Save & Next →'}
                    </button>
                  )}
                  {wizardStep === 1 && docker?.installed && !allInstalled && <button onClick={() => setWizardStep(2)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#06b6d4', color: '#fff' }}>{lang === 'vi' ? 'Tiếp →' : 'Next →'}</button>}
                  {wizardStep === 3 && cloudflare?.installed && !allInstalled && (
                    <button onClick={async () => { await window.electronAPI.saveSettings({ setupComplete: true }); setAllInstalled(true); refreshAll() }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#22c55e', color: '#fff' }}>
                      {lang === 'vi' ? '✓ Hoàn tất' : '✓ Done'}
                    </button>
                  )}
                  <button onClick={() => setWizardOpen(false)} className="ml-auto px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ color: labelColor }}>{lang === 'vi' ? 'Đóng' : 'Close'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NodePage
