import { useState, useEffect } from 'react'
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

function LogBox({ value, placeholder, theme, labelColor, inputBg, inputBorder, copiedKey, copyKey, onCopy }) {
  return (
    <div className="relative">
      <button onClick={() => value && onCopy()} className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-all z-10" style={{ background: copiedKey === copyKey ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === copyKey ? '#fff' : labelColor }}>
        {copiedKey === copyKey ? '✓' : 'Copy'}
      </button>
      <pre className="p-3 pr-12 rounded-xl text-[10px] whitespace-pre-wrap max-h-32 overflow-auto" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
        {value || placeholder}
      </pre>
    </div>
  )
}

function ServiceCard({ title, icon, color, installed, running, version, theme, onInstall, onUninstall, onStart, onStop, installing, uninstalling, log, logPlaceholder, copiedKey, copyKey, onCopy, children }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const sectionBg = theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${inputBorder}` }}>
        <div className="flex items-center gap-2.5">
          {icon}
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{title}</h4>
          <StatusDot color={installed ? (running ? '#22c55e' : '#ef4444') : '#6b7280'} />
          {version && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: inputBg, color: labelColor }}>v{version}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!installed ? (
            <button onClick={onInstall} disabled={installing} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all" style={{ background: '#22c55e', color: '#fff', opacity: installing ? 0.5 : 1 }}>
              {installing ? '...' : 'Cài'}
            </button>
          ) : (
            <>
              {running ? (
                <button onClick={onStop} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all" style={{ background: '#ef4444', color: '#fff' }}>Dừng</button>
              ) : (
                <button onClick={onStart} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all" style={{ background: '#22c55e', color: '#fff' }}>Khởi động</button>
              )}
              <button onClick={onUninstall} disabled={uninstalling} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all" style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', opacity: uninstalling ? 0.5 : 1 }}>
                {uninstalling ? '...' : 'Gỡ'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
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
  const [dbConfig, setDbConfig] = useState({ name: 'terver_db', user: 'terver', pass: '' })
  const [dbLog, setDbLog] = useState('')
  const [cleanupLog, setCleanupLog] = useState('')
  const [activeDoc, setActiveDoc] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [cfConfig, setCfConfig] = useState({ tunnelName: 'terver-tunnel', appDomain: '', token: '' })

  const [authenticated, setAuthenticated] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardDockerLog, setWizardDockerLog] = useState('')
  const [wizardWingsLog, setWizardWingsLog] = useState('')
  const [wizardCfLog, setWizardCfLog] = useState('')
  const [wizardProcessing, setWizardProcessing] = useState(false)
  const [wingsConfig, setWingsConfig] = useState({})

  const [dockerConfig, setDockerConfig] = useState({ socketPath: '/var/run/docker.sock', dataDir: '/var/lib/docker', networkInterface: 'docker0' })

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.systemCheckAuth().then((res) => {
      if (res?.authenticated) setAuthenticated(true)
      else setAuthOpen(true)
    }).catch(() => setAuthOpen(true))
    refreshAll()
    const interval = setInterval(refreshAll, 5000)
    return () => clearInterval(interval)
  }, [])

  const refreshAll = async () => {
    try {
      const [d, w, info, cf] = await Promise.all([
        window.electronAPI.checkDocker(),
        window.electronAPI.getWingsStatus(),
        window.electronAPI.getSystemInfo(),
        window.electronAPI.checkCloudflared(),
      ])
      if (d?.ok !== false) setDocker(d)
      if (w?.ok) setWings(w)
      if (info?.ok) setSysInfo(info)
      if (cf?.ok) setCloudflare(cf)
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

  const handleDockerInstall = async () => {
    if (!isElectron) return
    setDockerInstalling(true)
    setDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Docker...' : 'Installing Docker...'))
    const res = await window.electronAPI.installDocker()
    if (res?.ok) { setDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!') + '\n' + (res.version || '')); refreshAll() }
    else setDockerLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setDockerInstalling(false)
  }

  const handleDockerUninstall = async () => {
    if (!isElectron) return
    setDockerUninstalling(true)
    setDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang gỡ Docker...' : 'Uninstalling Docker...'))
    const res = await window.electronAPI.systemCleanup('docker')
    if (res?.ok) { setDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ Docker!' : 'Docker uninstalled!')); refreshAll() }
    else setDockerLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setDockerUninstalling(false)
  }

  const handleWingsInstall = async () => {
    if (!isElectron) return
    setWingsInstalling(true)
    setWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Wings...' : 'Installing Wings...'))
    const res = await window.electronAPI.installWings()
    if (res?.ok) { setWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!') + `\nVersion: ${res.version}\nArch: ${res.arch}`); refreshAll() }
    else setWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setWingsInstalling(false)
  }

  const handleWingsUninstall = async () => {
    if (!isElectron) return
    setWingsUninstalling(true)
    setWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang gỡ Wings...' : 'Uninstalling Wings...'))
    const res = await window.electronAPI.systemCleanup('wings')
    if (res?.ok) { setWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ Wings!' : 'Wings uninstalled!')); refreshAll() }
    else setWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setWingsUninstalling(false)
  }

  const handleWingsConfigGenerate = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.generateWingsConfig()
    if (res?.ok) { setWingsConfigSaved(true); setTimeout(() => setWingsConfigSaved(false), 2000); refreshAll() }
  }

  const handleCfInstall = async () => {
    if (!isElectron) return
    setCfInstalling(true)
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang cài cloudflared...' : 'Installing cloudflared...'))
    const info = await window.electronAPI.getSystemInfo()
    const res = await window.electronAPI.installCloudflared(info?.os?.arch || 'x86_64')
    if (res?.ok) { setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!') + `\nVersion: ${res.version}`); refreshAll() }
    else setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setCfInstalling(false)
  }

  const handleCfUninstall = async () => {
    if (!isElectron) return
    setCfUninstalling(true)
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang gỡ cloudflared...' : 'Uninstalling cloudflared...'))
    const res = await window.electronAPI.systemCleanup('cloudflare')
    if (res?.ok) { setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Đã gỡ cloudflared!' : 'cloudflared uninstalled!')); refreshAll() }
    else setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setCfUninstalling(false)
  }

  const handleTunnelCreate = async () => {
    if (!isElectron) return
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang tạo tunnel...' : 'Creating tunnel...'))
    const res = await window.electronAPI.createTunnel(cfConfig.tunnelName, cfConfig.token, cfConfig.appDomain)
    if (res?.ok) setCfLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Tunnel đã tạo!' : 'Tunnel created!'))
    else setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
  }

  const handleCfLogin = async () => {
    if (!isElectron) return
    setCfLog('[INFO] ' + (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...'))
    const res = await window.electronAPI.cloudflaredLogin()
    if (res?.ok) setCfLog(prev => prev + '\n[OK] ' + (res.message || ''))
    else setCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
  }

  const handleCfCheckAuth = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.cloudflaredCheckAuth()
    setCfLog(prev => prev + '\n' + (res?.authenticated ? '[OK] ' + (lang === 'vi' ? 'Đã xác thực!' : 'Authenticated!') : '[INFO] ' + (lang === 'vi' ? 'Chưa xác thực.' : 'Not authenticated.')))
  }

  const handleWizardDockerInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardDockerLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Docker...' : 'Installing Docker...'))
    const res = await window.electronAPI.installDocker()
    if (res?.ok) { setWizardDockerLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!')); setTimeout(() => { setWizardStep(1); setWizardProcessing(false) }, 1000) }
    else { setWizardDockerLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); setWizardProcessing(false) }
  }

  const handleWizardWingsInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardWingsLog('[INFO] ' + (lang === 'vi' ? 'Đang cài Wings...' : 'Installing Wings...'))
    const res = await window.electronAPI.installWings()
    if (res?.ok) { setWizardWingsLog(prev => prev + '\n[OK] ' + (lang === 'vi' ? 'Cài thành công!' : 'Installed!')); refreshAll() }
    else { setWizardWingsLog(prev => prev + '\n[LỖI] ' + (res?.error || '')); setWizardProcessing(false) }
  }

  const handleWizardCfLogin = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardCfLog('[INFO] ' + (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...'))
    const res = await window.electronAPI.cloudflaredLogin()
    if (res?.ok) setWizardCfLog(prev => prev + '\n[OK] ' + (res.message || ''))
    else setWizardCfLog(prev => prev + '\n[LỖI] ' + (res?.error || ''))
    setWizardProcessing(false)
  }

  const handleWizardCfCheckAuth = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.cloudflaredCheckAuth()
    setWizardCfLog(prev => prev + '\n' + (res?.authenticated ? '[OK] ' + (lang === 'vi' ? 'Đã xác thực!' : 'Authenticated!') : '[INFO] ' + (lang === 'vi' ? 'Chưa xác thực.' : 'Not authenticated.')))
  }

  const dockerColor = !docker ? '#6b7280' : docker.installed ? (docker.running ? '#22c55e' : '#ef4444') : '#6b7280'
  const wingsColor = !wings ? '#6b7280' : wings.installed ? (wings.running ? '#06b6d4' : '#ef4444') : '#6b7280'
  const cfColor = !cloudflare ? '#6b7280' : cloudflare.installed ? '#3b82f6' : '#ef4444'

  const tabs = [
    { key: 'status', label: lang === 'vi' ? 'Trạng thái' : 'Status' },
    { key: 'config', label: lang === 'vi' ? 'Cấu hình' : 'Configuration' },
  ]

  return (
    <div className="h-full overflow-auto p-6" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto space-y-4">

        {authOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="max-w-sm w-[90vw] rounded-2xl p-5 space-y-3" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${inputBorder}` }}>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Xác thực quyền' : 'Authenticate'}</h3>
              <p className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Nhập sudo password. Chỉ cần 1 lần.' : 'Enter sudo password. Once per session.'}</p>
              <input type="password" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError('') }} onKeyDown={(e) => e.key === 'Enter' && handleAuth()} autoFocus className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
              {authError && <p className="text-[11px]" style={{ color: '#ef4444' }}>{authError}</p>}
              <button onClick={handleAuth} className="w-full py-2 rounded-xl text-xs font-semibold" style={{ background: '#a78bfa', color: '#fff' }}>{lang === 'vi' ? 'Xác nhận' : 'Confirm'}</button>
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
          <button onClick={() => { setWizardOpen(true); setWizardStep(0); setWizardDockerLog(''); setWizardWingsLog(''); setWizardCfLog('') }} className="px-3 py-1.5 rounded-xl text-[10px] font-semibold flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', color: '#fff' }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {lang === 'vi' ? 'Setup nhanh' : 'Quick Setup'}
          </button>
        </div>

        {sysInfo && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'CPU', value: sysInfo.cpu?.cores ? `${sysInfo.cpu.cores} cores` : '---', Icon: Cpu, color: '#3b82f6' },
              { label: lang === 'vi' ? 'RAM' : 'RAM', value: sysInfo.memory?.totalGB ? `${sysInfo.memory.totalGB} GB` : '---', Icon: Memory, color: '#8b5cf6' },
              { label: 'Disk', value: sysInfo.disk?.totalGB ? `${sysInfo.disk.totalGB} GB` : '---', Icon: HardDrive, color: '#22c55e' },
              { label: lang === 'vi' ? 'Hệ điều hành' : 'OS', value: sysInfo.os?.distro || '---', Icon: DesktopTower, color: '#f59e0b' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
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
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: tab === t.key ? (theme === 'light' ? '#fff' : 'rgba(255,255,255,0.1)') : 'transparent', color: tab === t.key ? textColor : labelColor, boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'status' && (
          <div className="space-y-3">
            <ServiceCard title="Docker Engine" icon={<svg className="w-4 h-4" style={{ color: dockerColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>} color={dockerColor} installed={docker?.installed} running={docker?.running} version={docker?.version} theme={theme} onInstall={handleDockerInstall} onUninstall={handleDockerUninstall} onStart={() => {}} onStop={() => {}} installing={dockerInstalling} uninstalling={dockerUninstalling} log={dockerLog} logPlaceholder={docker?.installed ? (docker?.running ? (lang === 'vi' ? 'Docker đang chạy.' : 'Docker running.') : (lang === 'vi' ? 'Docker đã cài, chưa chạy.' : 'Docker installed, not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="docker" onCopy={() => copy('docker', dockerLog)} />

            <ServiceCard title="LunarSpace Wings" icon={<svg className="w-4 h-4" style={{ color: wingsColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} color={wingsColor} installed={wings?.installed} running={wings?.running} version={wings?.version} theme={theme} onInstall={handleWingsInstall} onUninstall={handleWingsUninstall} onStart={async () => { await window.electronAPI.startWings(); setTimeout(refreshAll, 1000) }} onStop={async () => { await window.electronAPI.stopWings(); setTimeout(refreshAll, 1000) }} installing={wingsInstalling} uninstalling={wingsUninstalling} log={wingsLog} logPlaceholder={wings?.installed ? (wings?.running ? (lang === 'vi' ? 'Wings đang chạy.' : 'Wings running.') : (lang === 'vi' ? 'Wings đã cài, chưa chạy.' : 'Wings installed, not running.')) : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="wings" onCopy={() => copy('wings', wingsLog)}>
              {wings?.installed && !wings?.hasConfig && (
                <button onClick={handleWingsConfigGenerate} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>
                  {wingsConfigSaved ? (lang === 'vi' ? 'Đã tạo!' : 'Generated!') : (lang === 'vi' ? 'Tạo config.yml' : 'Generate config.yml')}
                </button>
              )}
              {wings?.hasConfig && <p className="text-[10px]" style={{ color: '#22c55e' }}>✓ {lang === 'vi' ? 'Đã cấu hình' : 'Configured'}</p>}
            </ServiceCard>

            <ServiceCard title="Cloudflare Tunnel" icon={<svg className="w-4 h-4" style={{ color: cfColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V4l-8-2-8 2v8c0 6 8 10 8 10z"/></svg>} color={cfColor} installed={cloudflare?.installed} running={false} version={cloudflare?.version} theme={theme} onInstall={handleCfInstall} onUninstall={handleCfUninstall} onStart={() => {}} onStop={() => {}} installing={cfInstalling} uninstalling={cfUninstalling} log={cfLog} logPlaceholder={cloudflare?.installed ? (lang === 'vi' ? 'Đã cài đặt. Nhập thông tin tunnel.' : 'Installed. Enter tunnel info.') : (lang === 'vi' ? 'Chưa cài đặt.' : 'Not installed.')} copiedKey={copiedKey} copyKey="cf" onCopy={() => copy('cf', cfLog)}>
              <div className="flex gap-1.5">
                <button onClick={handleCfLogin} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#3b82f6', color: '#fff' }}>{lang === 'vi' ? 'Đăng nhập' : 'Login'}</button>
                <button onClick={handleCfCheckAuth} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? 'Kiểm tra' : 'Check'}</button>
              </div>
            </ServiceCard>
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Docker Config' : 'Docker Config'}</h4>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: labelColor }}>Socket Path</label>
                  <input value={dockerConfig.socketPath} onChange={(e) => setDockerConfig({ ...dockerConfig, socketPath: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Thư mục dữ liệu' : 'Data Directory'}</label>
                    <input value={dockerConfig.dataDir} onChange={(e) => setDockerConfig({ ...dockerConfig, dataDir: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Network' : 'Network'}</label>
                    <input value={dockerConfig.networkInterface} onChange={(e) => setDockerConfig({ ...dockerConfig, networkInterface: e.target.value })} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  </div>
                </div>
              </div>
            </div>

            {wings?.installed && !wings?.hasConfig && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Wings Config' : 'Wings Config'}</h4>
                <p className="text-[10px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Tự cấu hình. Chỉ cần tạo file config.yml.' : 'Auto-configured. Just generate config.yml.'}</p>
                <button onClick={handleWingsConfigGenerate} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>
                  {wingsConfigSaved ? (lang === 'vi' ? 'Đã tạo!' : 'Generated!') : (lang === 'vi' ? 'Tạo config.yml' : 'Generate config.yml')}
                </button>
              </div>
            )}

            {cloudflare?.installed && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Cloudflare Tunnel' : 'Cloudflare Tunnel'}</h4>
                <div className="grid grid-cols-1 gap-2">
                  <input value={cfConfig.tunnelName} onChange={(e) => setCfConfig({ ...cfConfig, tunnelName: e.target.value })} placeholder="Tunnel Name" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  <input value={cfConfig.appDomain} onChange={(e) => setCfConfig({ ...cfConfig, appDomain: e.target.value })} placeholder={lang === 'vi' ? 'Domain app (ví dụ: app.example.com)' : 'App domain'} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                  <input value={cfConfig.token} onChange={(e) => setCfConfig({ ...cfConfig, token: e.target.value })} type="password" placeholder="Tunnel Token" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                </div>
                <button onClick={handleTunnelCreate} disabled={!cfConfig.token} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#3b82f6', color: '#fff', opacity: !cfConfig.token ? 0.5 : 1 }}>
                  {lang === 'vi' ? 'Tạo Tunnel' : 'Create Tunnel'}
                </button>
              </div>
            )}

            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{lang === 'vi' ? 'Database' : 'Database'}</h4>
              <div className="grid grid-cols-3 gap-2">
                <input value={dbConfig.name} onChange={(e) => setDbConfig({ ...dbConfig, name: e.target.value })} placeholder="DB Name" className="px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                <input value={dbConfig.user} onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })} placeholder="User" className="px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                <input value={dbConfig.pass} onChange={(e) => setDbConfig({ ...dbConfig, pass: e.target.value })} type="password" placeholder="Password" className="px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
              </div>
              <button onClick={async () => { const res = await window.electronAPI.databaseSetup(dbConfig.name, dbConfig.user, dbConfig.pass); setDbLog(res?.ok ? '[OK] ' + (res.message || '') : '[LỖI] ' + (res?.error || '')) }} className="px-4 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#22c55e', color: '#fff' }}>
                {lang === 'vi' ? 'Tạo Database' : 'Create Database'}
              </button>
              <LogBox value={dbLog} placeholder={lang === 'vi' ? 'Nhập thông tin → Tạo Database.' : 'Enter info → Create Database.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="db" onCopy={() => copy('db', dbLog)} />
            </div>

            <div className="rounded-xl p-4 space-y-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputBorder}` }}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>{lang === 'vi' ? 'Xóa dữ liệu' : 'Cleanup'}</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'docker', label: 'Docker' },
                  { key: 'wings', label: 'Wings' },
                  { key: 'cloudflare', label: 'Cloudflare' },
                  { key: 'database', label: 'Database' },
                  { key: 'logs', label: 'Logs' },
                  { key: 'all', label: lang === 'vi' ? 'Tất cả' : 'All' },
                ].map(item => (
                  <button key={item.key} onClick={async () => { setCleanupLog('[INFO] ' + (lang === 'vi' ? `Đang xóa ${item.label}...` : `Cleaning ${item.label}...`)); const res = await window.electronAPI.systemCleanup(item.key); setCleanupLog(prev => prev + '\n' + (res?.ok ? '[OK] ' + (res.results?.join('\n') || '') : '[LỖI] ' + (res?.error || ''))); if (res?.ok) refreshAll() }} className="py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444' }}>
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
                <h3 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Setup nhanh' : 'Quick Setup'}</h3>
                <button onClick={() => setWizardOpen(false)} className="w-5 h-5 rounded flex items-center justify-center" style={{ color: labelColor }}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-1">
                  {[{ key: 0, label: 'Docker', color: '#2496ed' }, { key: 1, label: 'Wings', color: '#06b6d4' }, { key: 2, label: 'CF Tunnel', color: '#3b82f6' }].map((s, i) => (
                    <div key={s.key} className="flex items-center gap-1 flex-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: wizardStep > i ? s.color : wizardStep === i ? s.color : inputBg, color: wizardStep >= i ? '#fff' : labelColor }}>{wizardStep > i ? '✓' : i + 1}</div>
                      <span className="text-[9px] font-semibold" style={{ color: wizardStep >= i ? s.color : labelColor }}>{s.label}</span>
                      {i < 2 && <div className="flex-1 h-px mx-1" style={{ background: wizardStep > i ? s.color : inputBorder }} />}
                    </div>
                  ))}
                </div>

                {wizardStep === 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Bước 1: Docker Engine' : 'Step 1: Docker Engine'}</p>
                    {docker?.installed ? (
                      <div className="p-2 rounded-lg text-[10px]" style={{ background: '#22c55e20', color: '#22c55e' }}>✓ Docker {lang === 'vi' ? 'đã cài' : 'installed'}</div>
                    ) : (
                      <button onClick={handleWizardDockerInstall} disabled={wizardProcessing} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#2496ed', color: '#fff', opacity: wizardProcessing ? 0.5 : 1 }}>{wizardProcessing ? '...' : 'Cài Docker'}</button>
                    )}
                    <LogBox value={wizardDockerLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="wd" onCopy={() => copy('wd', wizardDockerLog)} />
                  </div>
                )}

                {wizardStep === 1 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Bước 2: LunarSpace Wings' : 'Step 2: LunarSpace Wings'}</p>
                    {wings?.installed ? (
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg text-[10px]" style={{ background: '#06b6d420', color: '#06b6d4' }}>✓ Wings {lang === 'vi' ? 'đã cài' : 'installed'}</div>
                        {!wings?.hasConfig ? (
                          <button onClick={handleWingsConfigGenerate} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}>{wingsConfigSaved ? '✓' : (lang === 'vi' ? 'Tạo config' : 'Generate config')}</button>
                        ) : (
                          <button onClick={() => setWizardStep(2)} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#06b6d4', color: '#fff' }}>{lang === 'vi' ? 'Tiếp → Cloudflare' : 'Next → Cloudflare'}</button>
                        )}
                      </div>
                    ) : (
                      <button onClick={handleWizardWingsInstall} disabled={wizardProcessing} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#06b6d4', color: '#fff', opacity: wizardProcessing ? 0.5 : 1 }}>{wizardProcessing ? '...' : 'Cài Wings'}</button>
                    )}
                    <LogBox value={wizardWingsLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="ww" onCopy={() => copy('ww', wizardWingsLog)} />
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Bước 3: Cloudflare Tunnel' : 'Step 3: Cloudflare Tunnel'}</p>
                    {!cloudflare?.installed ? (
                      <div className="p-2 rounded-lg text-[10px]" style={{ background: '#ef444420', color: '#ef4444' }}>{lang === 'vi' ? 'Cài cloudflared trước.' : 'Install cloudflared first.'}</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <button onClick={handleWizardCfLogin} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#3b82f6', color: '#fff' }}>{lang === 'vi' ? 'Đăng nhập' : 'Login'}</button>
                          <button onClick={handleWizardCfCheckAuth} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? 'Kiểm tra' : 'Check'}</button>
                        </div>
                        <input value={cfConfig.tunnelName} onChange={(e) => setCfConfig({ ...cfConfig, tunnelName: e.target.value })} placeholder="Tunnel Name" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                        <input value={cfConfig.appDomain} onChange={(e) => setCfConfig({ ...cfConfig, appDomain: e.target.value })} placeholder={lang === 'vi' ? 'Domain app' : 'App domain'} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                        <input value={cfConfig.token} onChange={(e) => setCfConfig({ ...cfConfig, token: e.target.value })} type="password" placeholder="Tunnel Token" className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }} />
                        <button onClick={handleTunnelCreate} disabled={!cfConfig.token} className="w-full py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: '#3b82f6', color: '#fff', opacity: !cfConfig.token ? 0.5 : 1 }}>{lang === 'vi' ? 'Tạo Tunnel' : 'Create Tunnel'}</button>
                      </div>
                    )}
                    <LogBox value={wizardCfLog} placeholder={lang === 'vi' ? 'Sẵn sàng.' : 'Ready.'} theme={theme} labelColor={labelColor} inputBg={inputBg} inputBorder={inputBorder} copiedKey={copiedKey} copyKey="wc" onCopy={() => copy('wc', wizardCfLog)} />
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  {wizardStep > 0 && <button onClick={() => setWizardStep(wizardStep - 1)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{lang === 'vi' ? '←' : '←'}</button>}
                  <button onClick={() => setWizardOpen(false)} className="ml-auto px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ color: labelColor }}>{lang === 'vi' ? 'Đóng' : 'Close'}</button>
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
