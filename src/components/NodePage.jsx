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

function SectionCard({ title, icon, theme, children, showInfo, onInfoClick }) {
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const sectionBg = theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: sectionBg, border: `1px solid ${inputBorder}` }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${inputBorder}` }}>
        <div className="flex items-center gap-2.5">
          {icon}
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: labelColor }}>{title}</h4>
          {showInfo && (
            <button
              onClick={onInfoClick}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: labelColor }}
            >
              <Info size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
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

  const [docker, setDocker] = useState(null)
  const [dockerInstalling, setDockerInstalling] = useState(false)
  const [dockerLog, setDockerLog] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [dockerConfig, setDockerConfig] = useState({ socket: '/var/run/docker.sock', dataDir: '/var/lib/terver', networkInterface: 'docker0' })
  const [dockerConfigSaved, setDockerConfigSaved] = useState(false)

  const [wings, setWings] = useState(null)
  const [wingsInstalling, setWingsInstalling] = useState(false)
  const [wingsLog, setWingsLog] = useState('')
  const [wingsConfig, setWingsConfig] = useState({})
  const [wingsConfigSaved, setWingsConfigSaved] = useState(false)

  const [sysInfo, setSysInfo] = useState(null)

  const [cloudflare, setCloudflare] = useState(null)
  const [cfInstalling, setCfInstalling] = useState(false)
  const [cfLog, setCfLog] = useState('')
  const [cfConfig, setCfConfig] = useState({ tunnelName: 'terver-tunnel', appDomain: '', token: '' })

  const [activeDoc, setActiveDoc] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardPanelUrl, setWizardPanelUrl] = useState('')
  const [wizardDockerLog, setWizardDockerLog] = useState('')
  const [wizardWingsLog, setWizardWingsLog] = useState('')
  const [wizardCfLog, setWizardCfLog] = useState('')
  const [wizardProcessing, setWizardProcessing] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.systemCheckAuth().then((res) => {
      if (res?.authenticated) {
        setAuthenticated(true)
      } else {
        setAuthOpen(true)
      }
    }).catch(() => setAuthOpen(true))
    refreshAll()
    window.electronAPI.getDockerConfig().then((res) => {
      if (res?.ok) setDockerConfig(res.config)
    })
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

  const handleDockerInstall = async () => {
    if (!isElectron) return
    setDockerInstalling(true)
    setDockerLog((lang === 'vi' ? '[INFO] Đang kiểm tra hệ thống...\n' : '[INFO] Checking system...\n'))
    setTimeout(() => setDockerLog(prev => prev + (lang === 'vi' ? '[INFO] Đang tải Docker install script...\n' : '[INFO] Downloading Docker install script...\n')), 500)
    try {
      const res = await window.electronAPI.installDocker()
      if (res?.ok) {
        setDockerLog(prev => prev + (lang === 'vi' ? '[OK] Docker cài đặt thành công!\n' : '[OK] Docker installed successfully!\n') + (res.version || ''))
        refreshAll()
      } else {
        setDockerLog(prev => prev + (lang === 'vi' ? '[LỖI] Cài Docker thất bại:\n' : '[ERROR] Docker install failed:\n') + (res?.error || ''))
      }
    } catch (err) {
      setDockerLog(prev => prev + (lang === 'vi' ? '[LỖI] Cài Docker thất bại:\n' : '[ERROR] Docker install failed:\n') + err.message)
    }
    setDockerInstalling(false)
  }

  const handleDockerConfigSave = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.saveDockerConfig(dockerConfig)
    if (res?.ok) { setDockerConfigSaved(true); setTimeout(() => setDockerConfigSaved(false), 2000) }
  }

  const handleWingsInstall = async () => {
    if (!isElectron) return
    setWingsInstalling(true)
    setWingsLog((lang === 'vi' ? '[INFO] Đang kiểm tra kiến trúc hệ thống...\n' : '[INFO] Checking system architecture...\n'))
    setTimeout(() => setWingsLog(prev => prev + (lang === 'vi' ? '[INFO] Đang tải Wings từ GitHub...\n' : '[INFO] Downloading Wings from GitHub...\n')), 500)
    setTimeout(() => setWingsLog(prev => prev + (lang === 'vi' ? '[INFO] Đang cài đặt binary...\n' : '[INFO] Installing binary...\n')), 2000)
    try {
      const res = await window.electronAPI.installWings()
      if (res?.ok) {
        setWingsLog(prev => prev + (lang === 'vi' ? '[OK] Wings cài đặt thành công!\n' : '[OK] Wings installed successfully!\n') + `Version: ${res.version}\nArch: ${res.arch}\nInit: ${res.initSystem}`)
        refreshAll()
      } else {
        setWingsLog(prev => prev + (lang === 'vi' ? '[LỖI] Cài Wings thất bại:\n' : '[ERROR] Wings install failed:\n') + (res?.error || ''))
      }
    } catch (err) {
      setWingsLog(prev => prev + (lang === 'vi' ? '[LỖI] Cài Wings thất bại:\n' : '[ERROR] Wings install failed:\n') + err.message)
    }
    setWingsInstalling(false)
  }

  const handleWingsConfigGenerate = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.generateWingsConfig()
    if (res?.ok) { setWingsConfigSaved(true); setTimeout(() => setWingsConfigSaved(false), 2000); refreshAll() }
  }

  const handleWingsStart = async () => {
    if (!isElectron) return
    await window.electronAPI.startWings()
    setTimeout(refreshAll, 1500)
  }

  const handleWingsStop = async () => {
    if (!isElectron) return
    await window.electronAPI.stopWings()
    setTimeout(refreshAll, 1500)
  }

  const handleCfInstall = async () => {
    if (!isElectron) return
    setCfInstalling(true)
    setCfLog((lang === 'vi' ? '[INFO] Đang kiểm tra kiến trúc hệ thống...\n' : '[INFO] Checking system architecture...\n'))
    setTimeout(() => setCfLog(prev => prev + (lang === 'vi' ? '[INFO] Đang tải cloudflared từ GitHub...\n' : '[INFO] Downloading cloudflared from GitHub...\n')), 500)
    setTimeout(() => setCfLog(prev => prev + (lang === 'vi' ? '[INFO] Đang cài đặt binary...\n' : '[INFO] Installing binary...\n')), 2000)
    try {
      const info = await window.electronAPI.getSystemInfo()
      const arch = info?.os?.arch || 'x86_64'
      const res = await window.electronAPI.installCloudflared(arch)
      if (res?.ok) {
        setCfLog(prev => prev + (lang === 'vi' ? '[OK] cloudflared cài đặt thành công!\n' : '[OK] cloudflared installed successfully!\n') + `Version: ${res.version}`)
        refreshAll()
      } else {
        setCfLog(prev => prev + (lang === 'vi' ? '[LỖI] Cài cloudflared thất bại:\n' : '[ERROR] cloudflared install failed:\n') + (res?.error || ''))
      }
    } catch (err) {
      setCfLog((lang === 'vi' ? 'Cài đặt thất bại\n' : 'Installation failed\n') + err.message)
    }
    setCfInstalling(false)
  }

  const handleTunnelCreate = async () => {
    if (!isElectron) return
    const res = await window.electronAPI.createTunnel(cfConfig.tunnelName, cfConfig.token, cfConfig.appDomain)
    if (res?.ok) {
      setCfLog((lang === 'vi' ? 'Tunnel đã tạo\n' : 'Tunnel created\n') + (res.output || ''))
    } else {
      setCfLog((lang === 'vi' ? 'Lỗi tạo tunnel\n' : 'Tunnel creation error\n') + (res?.error || ''))
    }
  }

  const handleDocsClick = (url) => {
    if (isElectron && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleAuth = async () => {
    if (!authPassword.trim()) return
    setAuthError('')
    const res = await window.electronAPI.systemAuth(authPassword)
    if (res?.ok) {
      setAuthenticated(true)
      setAuthOpen(false)
      setAuthPassword('')
    } else {
      setAuthError(lang === 'vi' ? 'Sai mật khẩu' : 'Wrong password')
      setAuthPassword('')
    }
  }

  const wizardSteps = [
    { key: 'docker', label: 'Docker Engine', color: '#2496ed' },
    { key: 'wings', label: 'LunarSpace Wings', color: '#06b6d4' },
    { key: 'cloudflare', label: 'Cloudflare Tunnel', color: '#3b82f6' },
  ]

  const handleWizardDockerInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardDockerLog(lang === 'vi' ? 'Đang cài đặt Docker...\n' : 'Installing Docker...\n')
    const res = await window.electronAPI.installDocker()
    if (res?.ok) {
      setWizardDockerLog((lang === 'vi' ? 'Docker đã cài đặt thành công!\n' : 'Docker installed successfully!\n') + (res.output || ''))
      setTimeout(() => { setWizardStep(1); setWizardProcessing(false) }, 1500)
    } else {
      setWizardDockerLog((lang === 'vi' ? 'Cài Docker thất bại: ' : 'Docker install failed: ') + (res?.error || 'Unknown error'))
      setWizardProcessing(false)
    }
  }

  const handleWizardWingsInstall = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardWingsLog(lang === 'vi' ? 'Đang cài đặt Wings...\n' : 'Installing Wings...\n')
    const res = await window.electronAPI.installWings()
    if (res?.ok) {
      setWizardWingsLog((lang === 'vi' ? 'Wings đã cài đặt thành công!\n' : 'Wings installed successfully!\n') + (res.output || ''))
      setTimeout(() => { setWizardStep(2); setWizardProcessing(false) }, 1500)
    } else {
      setWizardWingsLog((lang === 'vi' ? 'Cài Wings thất bại: ' : 'Wings install failed: ') + (res?.error || 'Unknown error'))
      setWizardProcessing(false)
    }
  }

  const handleWizardCfLogin = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    setWizardCfLog(lang === 'vi' ? 'Đang mở trình duyệt để đăng nhập Cloudflare...\n' : 'Opening browser for Cloudflare login...\n')
    const res = await window.electronAPI.cloudflaredLogin()
    if (res?.ok) {
      setWizardCfLog((lang === 'vi' ? 'Vui lòng đăng nhập trên trình duyệt. Sau khi hoàn tất, quay lại đây.\n' : 'Please log in on the browser. After completing, come back here.\n') + (res.message || ''))
    } else {
      setWizardCfLog((lang === 'vi' ? 'Lỗi: ' : 'Error: ') + (res?.error || 'Unknown error'))
    }
    setWizardProcessing(false)
  }

  const handleWizardCfCheckAuth = async () => {
    if (!isElectron) return
    setWizardProcessing(true)
    const res = await window.electronAPI.cloudflaredCheckAuth()
    if (res?.authenticated) {
      setWizardCfLog((lang === 'vi' ? 'Đã xác thực Cloudflare thành công!\n' : 'Cloudflare authenticated successfully!\n') + (lang === 'vi' ? 'Bạn có thể tiếp tục cấu hình tunnel.' : 'You can continue configuring the tunnel.'))
    } else {
      setWizardCfLog(lang === 'vi' ? 'Chưa xác thực. Vui lòng đăng nhập trước.' : 'Not authenticated. Please log in first.')
    }
    setWizardProcessing(false)
  }

  const dockerColor = !docker ? '#6b7280' : docker.installed ? (docker.running ? '#22c55e' : '#ef4444') : '#6b7280'
  const dockerLabel = !docker ? (lang === 'vi' ? 'Đang kiểm tra...' : 'Checking...') : docker.installed ? (docker.running ? (lang === 'vi' ? 'Đang chạy' : 'Running') : (lang === 'vi' ? 'Đã dừng' : 'Stopped')) : (lang === 'vi' ? 'Chưa cài đặt' : 'Not installed')

  const wingsColor = !wings ? '#6b7280' : wings.installed ? (wings.running ? '#06b6d4' : '#ef4444') : '#6b7280'
  const wingsLabel = !wings ? (lang === 'vi' ? 'Đang kiểm tra...' : 'Checking...') : wings.installed ? (wings.running ? (lang === 'vi' ? 'Đang chạy' : 'Running') : (lang === 'vi' ? 'Đã dừng' : 'Stopped')) : (lang === 'vi' ? 'Chưa cài đặt' : 'Not installed')

  const cfColor = !cloudflare ? '#6b7280' : cloudflare.installed ? '#3b82f6' : '#ef4444'

  return (
    <div className="h-full overflow-auto p-6" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {authOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative max-w-sm w-[90vw] m-4" onClick={(e) => e.stopPropagation()}>
              <div className="rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                  <h3 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Xác thực quyền' : 'Authenticate'}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Nhập mật khẩu sudo để quản lý hệ thống. Chỉ cần nhập 1 lần cho phiên làm việc này.' : 'Enter sudo password to manage system. Only needed once per session.'}</p>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => { setAuthPassword(e.target.value); setAuthError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                    placeholder={lang === 'vi' ? 'Mật khẩu...' : 'Password...'}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                  />
                  {authError && <p className="text-[11px]" style={{ color: '#ef4444' }}>{authError}</p>}
                  <button onClick={handleAuth} className="w-full py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: '#a78bfa', color: '#fff' }}>
                    {lang === 'vi' ? 'Xác nhận' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" style={{ color: '#a78bfa' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <div>
              <h2 className="text-xl font-bold" style={{ color: textColor }}>
                {lang === 'vi' ? 'Quản lý Node' : 'Node Management'}
              </h2>
              <p className="text-xs" style={{ color: labelColor }}>
                {lang === 'vi' ? 'Cấu hình Docker, LunarSpace Wings, Cloudflare Tunnel và hệ thống' : 'Configure Docker, LunarSpace Wings, Cloudflare Tunnel and system'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setWizardOpen(true); setWizardStep(0); setWizardDockerLog(''); setWizardWingsLog(''); setWizardCfLog('') }}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #a78bfa, #818cf8)', color: '#fff' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {lang === 'vi' ? 'Cài đặt nhanh' : 'Quick Setup'}
          </button>
        </div>

        {sysInfo && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: lang === 'vi' ? 'CPU' : 'CPU', value: sysInfo.cpu?.cores ? `${sysInfo.cpu.cores} ${lang === 'vi' ? 'lõi' : 'cores'}` : '---', Icon: Cpu, iconColor: '#3b82f6' },
              { label: lang === 'vi' ? 'RAM' : 'RAM', value: sysInfo.memory?.total ? `${Math.round(sysInfo.memory.total / 1024 / 1024 / 1024)} GB` : '---', Icon: Memory, iconColor: '#a78bfa' },
              { label: lang === 'vi' ? 'Disk' : 'Disk', value: sysInfo.disk?.total ? `${Math.round(sysInfo.disk.total / 1024 / 1024 / 1024)} GB` : '---', Icon: HardDrive, iconColor: '#f59e0b' },
              { label: lang === 'vi' ? 'OS' : 'OS', value: sysInfo.os?.distro || sysInfo.os?.platform || '---', Icon: DesktopTower, iconColor: '#22c55e' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                <item.Icon size={20} weight="duotone" style={{ color: item.iconColor }} />
                <div>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: labelColor }}>{item.label}</p>
                  <p className="text-xs font-bold" style={{ color: textColor }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionCard
          title={lang === 'vi' ? 'Heartbeat & Kết nối' : 'Heartbeat & Connection'}
          theme={theme}
          icon={<svg className="w-4 h-4" style={{ color: '#22c55e' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase" style={{ color: labelColor }}>
                {lang === 'vi' ? 'Panel → Wings' : 'Panel → Wings'}
              </p>
              <div className="flex items-center gap-2">
                <StatusDot color={wings?.running ? '#22c55e' : '#ef4444'} size={8} />
                <span className="text-xs" style={{ color: wings?.running ? '#22c55e' : '#ef4444' }}>
                  {wings?.running ? (lang === 'vi' ? 'Kết nối OK' : 'Connected') : (lang === 'vi' ? 'Mất kết nối' : 'Disconnected')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase" style={{ color: labelColor }}>
                {lang === 'vi' ? 'Docker → Wings' : 'Docker → Wings'}
              </p>
              <div className="flex items-center gap-2">
                <StatusDot color={docker?.running ? '#22c55e' : '#ef4444'} size={8} />
                <span className="text-xs" style={{ color: docker?.running ? '#22c55e' : '#ef4444' }}>
                  {docker?.running ? (lang === 'vi' ? 'Kết nối OK' : 'Connected') : (lang === 'vi' ? 'Mất kết nối' : 'Disconnected')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-3" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
            <p className="text-[11px] font-semibold mb-2" style={{ color: labelColor }}>
              {lang === 'vi' ? 'Tóm tắt' : 'Summary'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: docker?.running ? '#22c55e' : '#ef4444' }} />
                <span className="text-[11px]" style={{ color: labelColor }}>Docker</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: wings?.running ? '#22c55e' : '#ef4444' }} />
                <span className="text-[11px]" style={{ color: labelColor }}>Wings</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={lang === 'vi' ? 'Docker Engine' : 'Docker Engine'}
          theme={theme}
          icon={<svg className="w-4 h-4" style={{ color: dockerColor }} viewBox="0 0 24 24" fill="currentColor"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.888c0 .102.084.186.186.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.186H8.1a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/></svg>}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot color={dockerColor} />
              <div>
                <p className="text-sm font-semibold" style={{ color: textColor }}>{t(lang, 'docker.status')}</p>
                <p className="text-xs" style={{ color: dockerColor }}>{dockerLabel}</p>
              </div>
            </div>
            {docker?.installed && docker?.version && (
              <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                v{docker.version}
              </span>
            )}
          </div>

          {docker?.installed && docker?.composeVersion && (
            <div className="flex items-center gap-2 pl-5">
              <span className="text-[10px]" style={{ color: labelColor }}>Compose: {docker.composeVersion}</span>
            </div>
          )}

          {docker && docker.installed && docker.running && docker.containers !== undefined && (
            <div className="flex items-center gap-3 pl-5 pt-2">
              <span className="text-xs font-medium" style={{ color: '#22c55e' }}>{docker.containers} {lang === 'vi' ? 'container đang chạy' : 'containers running'}</span>
            </div>
          )}

          {docker && !docker.installed && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: labelColor }}>{t(lang, 'docker.install.desc')}</p>
              <button
                onClick={handleDockerInstall}
                disabled={dockerInstalling}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: dockerInstalling ? '#2496ed80' : '#2496ed', color: '#fff', cursor: dockerInstalling ? 'wait' : 'pointer' }}
              >
                {dockerInstalling ? t(lang, 'docker.install.progress') : t(lang, 'docker.install.btn')}
              </button>
            </div>
          )}
          <div className="pt-2" style={{ borderTop: `1px solid ${inputBorder}` }}>
            <div className="relative">
              <button
                onClick={() => dockerLog && navigator.clipboard.writeText(dockerLog)}
                className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all z-10"
                style={{ background: copiedKey === 'docker' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'docker' ? '#fff' : labelColor, border: `1px solid ${inputBorder}` }}
              >
                {copiedKey === 'docker' ? '✓ Copied' : 'Copy'}
              </button>
              <pre className="p-3 pr-16 rounded-xl text-[11px] whitespace-pre-wrap" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                {dockerLog || (docker?.installed ? (docker?.running ? (lang === 'vi' ? 'Docker đang chạy bình thường.' : 'Docker is running normally.') : (lang === 'vi' ? 'Docker đã cài nhưng chưa chạy.' : 'Docker installed but not running.')) : (lang === 'vi' ? 'Docker chưa cài đặt. Nhấn nút "Cài Docker" để bắt đầu.' : 'Docker not installed. Click "Install Docker" to begin.'))}
              </pre>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="LunarSpace Wings"
          theme={theme}
          icon={<svg className="w-4 h-4" style={{ color: wingsColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot color={wingsColor} />
              <div>
                <p className="text-sm font-semibold" style={{ color: textColor }}>
                  {lang === 'vi' ? 'Trạng thái Wings' : 'Wings Status'}
                </p>
                <p className="text-xs" style={{ color: wingsColor }}>{wingsLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wings?.version && (
                <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                  v{wings.version}
                </span>
              )}
              {wings?.installed && (
                wings.running ? (
                  <button onClick={handleWingsStop} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: '#ef4444', color: '#fff' }}>
                    {lang === 'vi' ? 'Dừng' : 'Stop'}
                  </button>
                ) : (
                  <button onClick={handleWingsStart} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: '#22c55e', color: '#fff' }}>
                    {lang === 'vi' ? 'Khởi động' : 'Start'}
                  </button>
                )
              )}
            </div>
          </div>

          {wings?.installed && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: lang === 'vi' ? 'Binary' : 'Binary', value: wings.binaryPath || '/usr/local/bin/wings', ok: true },
                { label: lang === 'vi' ? 'Config' : 'Config', value: wings.hasConfig ? wings.configPath : (lang === 'vi' ? 'Chưa có' : 'Missing'), ok: wings.hasConfig },
                { label: lang === 'vi' ? 'Service' : 'Service', value: wings.hasService ? (lang === 'vi' ? 'Đã cài' : 'Installed') : (lang === 'vi' ? 'Chưa có' : 'Missing'), ok: wings.hasService },
              ].map((item) => (
                <div key={item.label} className="rounded-lg p-2.5" style={{ background: inputBg, border: `1px solid ${inputBorder}` }}>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: labelColor }}>{item.label}</p>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: item.ok ? '#22c55e' : '#ef4444' }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {wings && !wings.installed && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: labelColor }}>
                {lang === 'vi' ? 'Wings là daemon xử lý các game server. Nó sẽ được tải từ GitHub releases của LunarSpace.' : 'Wings is the daemon that handles game servers. It will be downloaded from LunarSpace GitHub releases.'}
              </p>
              <button
                onClick={handleWingsInstall}
                disabled={wingsInstalling}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: wingsInstalling ? '#06b6d480' : '#06b6d4', color: '#fff', cursor: wingsInstalling ? 'wait' : 'pointer' }}
              >
                {wingsInstalling ? (lang === 'vi' ? 'Đang cài đặt...' : 'Installing...') : (lang === 'vi' ? 'Cài đặt Wings' : 'Install Wings')}
              </button>
            </div>
          )}
          <div className="pt-2" style={{ borderTop: `1px solid ${inputBorder}` }}>
            <div className="relative">
              <button
                onClick={() => wingsLog && navigator.clipboard.writeText(wingsLog)}
                className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all z-10"
                style={{ background: copiedKey === 'wings' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'wings' ? '#fff' : labelColor, border: `1px solid ${inputBorder}` }}
              >
                {copiedKey === 'wings' ? '✓ Copied' : 'Copy'}
              </button>
              <pre className="p-3 pr-16 rounded-xl text-[11px] whitespace-pre-wrap" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                {wingsLog || (wings?.installed ? (wings?.running ? (lang === 'vi' ? 'Wings đang chạy bình thường.' : 'Wings is running normally.') : (lang === 'vi' ? 'Wings đã cài nhưng chưa chạy.' : 'Wings installed but not running.')) : (lang === 'vi' ? 'Wings chưa cài đặt. Nhấn nút "Cài Wings" để bắt đầu.' : 'Wings not installed. Click "Install Wings" to begin.'))}
              </pre>
            </div>
          </div>

          {wings?.installed && !wings.hasConfig && (
              <div className="space-y-3 pt-2" style={{ borderTop: `1px solid ${inputBorder}` }}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold" style={{ color: labelColor }}>
                    {lang === 'vi' ? 'Cấu hình Wings' : 'Wings Configuration'}
                  </p>
                  <button
                    onClick={() => setActiveDoc('wings')}
                    className="w-4 h-4 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ color: labelColor }}
                  >
                    <Info size={10} weight="bold" />
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: labelColor }}>
                  {lang === 'vi' ? 'Wings tự cấu hình khi chạy. Chỉ cần tạo file config.yml.' : 'Wings auto-configures on run. Just generate the config.yml file.'}
                </p>
              <button
                onClick={handleWingsConfigGenerate}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}
              >
                {wingsConfigSaved ? (lang === 'vi' ? 'Đã lưu!' : 'Saved!') : (lang === 'vi' ? 'Tạo config.yml' : 'Generate config.yml')}
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={t(lang, 'docker.config')}
          theme={theme}
          showInfo={true}
          onInfoClick={() => setActiveDoc('docker')}
          icon={<svg className="w-4 h-4" style={{ color: labelColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1z"/></svg>}
        >
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{t(lang, 'docker.config.socket')}</label>
              <input
                value={dockerConfig.socket}
                onChange={(e) => setDockerConfig({ ...dockerConfig, socket: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
              />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{t(lang, 'docker.config.dataDir')}</label>
              <input
                value={dockerConfig.dataDir}
                onChange={(e) => setDockerConfig({ ...dockerConfig, dataDir: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
              />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{t(lang, 'docker.config.network')}</label>
              <input
                value={dockerConfig.networkInterface}
                onChange={(e) => setDockerConfig({ ...dockerConfig, networkInterface: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
              />
            </div>
            <button
              onClick={handleDockerConfigSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold transition-all self-start"
              style={{ background: dockerConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}
            >
              {dockerConfigSaved ? t(lang, 'docker.config.saved') : t(lang, 'docker.config.save')}
            </button>
          </div>
        </SectionCard>

        {(dockerLog || wingsLog) && (
          <SectionCard
            title={lang === 'vi' ? 'Nhật ký hoạt động' : 'Operation Logs'}
            theme={theme}
            icon={<svg className="w-4 h-4" style={{ color: labelColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 12 17 16 11"/></svg>}
          >
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#2496ed' }}>{lang === 'vi' ? 'Docker' : 'Docker'}</p>
                  <button
                    onClick={() => dockerLog && navigator.clipboard.writeText(dockerLog)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{ background: copiedKey === 'docker' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'docker' ? '#fff' : labelColor }}
                  >
                    {copiedKey === 'docker' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl text-[11px] whitespace-pre-wrap" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                  {dockerLog || (docker?.installed ? (docker?.running ? (lang === 'vi' ? 'Docker đang chạy.' : 'Docker running.') : (lang === 'vi' ? 'Docker đã cài, chưa chạy.' : 'Docker installed, not running.')) : (lang === 'vi' ? 'Docker chưa cài.' : 'Docker not installed.'))}
                </pre>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase" style={{ color: '#06b6d4' }}>{lang === 'vi' ? 'Wings' : 'Wings'}</p>
                  <button
                    onClick={() => wingsLog && navigator.clipboard.writeText(wingsLog)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{ background: copiedKey === 'wings-ops' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'wings-ops' ? '#fff' : labelColor }}
                  >
                    {copiedKey === 'wings-ops' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl text-[11px] whitespace-pre-wrap" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                  {wingsLog || (wings?.installed ? (wings?.running ? (lang === 'vi' ? 'Wings đang chạy.' : 'Wings running.') : (lang === 'vi' ? 'Wings đã cài, chưa chạy.' : 'Wings installed, not running.')) : (lang === 'vi' ? 'Wings chưa cài.' : 'Wings not installed.'))}
                </pre>
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Cloudflare Tunnel"
          theme={theme}
          showInfo={true}
          onInfoClick={() => setActiveDoc('cloudflare')}
          icon={<svg className="w-4 h-4" style={{ color: cfColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V4l-8-2-8 2v8c0 6 8 10 8 10z"/></svg>}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot color={cfColor} />
              <div>
                <p className="text-sm font-semibold" style={{ color: textColor }}>{cloudflare?.installed ? (lang === 'vi' ? 'Đã cài đặt' : 'Installed') : (lang === 'vi' ? 'Chưa cài đặt' : 'Not installed')}</p>
                {cloudflare?.version && <p className="text-xs" style={{ color: labelColor }}>{cloudflare.version}</p>}
              </div>
            </div>
            {!cloudflare?.installed && (
              <button
                onClick={handleCfInstall}
                disabled={cfInstalling}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: cfInstalling ? '#3b82f680' : '#3b82f6', color: '#fff', cursor: cfInstalling ? 'wait' : 'pointer' }}
              >
                {cfInstalling ? (lang === 'vi' ? 'Đang cài...' : 'Installing...') : (lang === 'vi' ? 'Cài cloudflared' : 'Install cloudflared')}
              </button>
            )}
          </div>

          {cloudflare?.installed && (
            <div className="space-y-4 pt-3" style={{ borderTop: `1px solid ${inputBorder}` }}>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Tên Tunnel' : 'Tunnel Name'}</label>
                  <input
                    value={cfConfig.tunnelName}
                    onChange={(e) => setCfConfig({ ...cfConfig, tunnelName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Domain App' : 'App Domain'}</label>
                  <input
                    value={cfConfig.appDomain}
                    onChange={(e) => setCfConfig({ ...cfConfig, appDomain: e.target.value })}
                    placeholder="app.example.com"
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: labelColor }}>{lang === 'vi' ? 'Tunnel Token' : 'Tunnel Token'}</label>
                  <input
                    value={cfConfig.token}
                    onChange={(e) => setCfConfig({ ...cfConfig, token: e.target.value })}
                    type="password"
                    placeholder={lang === 'vi' ? 'Từ Cloudflare Dashboard' : 'From Cloudflare Dashboard'}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTunnelCreate}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: '#3b82f6', color: '#fff', opacity: !cfConfig.token ? 0.5 : 1 }}
                  disabled={!cfConfig.token}
                >
                  {lang === 'vi' ? 'Tạo Tunnel' : 'Create Tunnel'}
                </button>
              </div>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => cfLog && navigator.clipboard.writeText(cfLog)}
              className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all z-10"
              style={{ background: copiedKey === 'cf' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'cf' ? '#fff' : labelColor, border: `1px solid ${inputBorder}` }}
            >
              {copiedKey === 'cf' ? '✓ Copied' : 'Copy'}
            </button>
            <pre className="p-3 pr-16 rounded-xl text-[11px] whitespace-pre-wrap" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
              {cfLog || (cloudflare?.installed ? (lang === 'vi' ? 'cloudflared đã cài đặt. Nhập thông tin tunnel để tạo.' : 'cloudflared installed. Enter tunnel info to create.') : (lang === 'vi' ? 'cloudflared chưa cài. Nhấn nút "Cài cloudflared" để bắt đầu.' : 'cloudflared not installed. Click "Install cloudflared" to begin.'))}
            </pre>
          </div>
        </SectionCard>

      </div>

      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveDoc(null)}>
          <div className="relative max-w-2xl w-[90vw] max-h-[80vh] m-4" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                <h3 className="text-sm font-bold" style={{ color: textColor }}>
                  {activeDoc === 'docker' ? (lang === 'vi' ? 'Hướng dẫn Docker Config' : 'Docker Configuration Guide') : activeDoc === 'wings' ? (lang === 'vi' ? 'Hướng dẫn Wings Config' : 'Wings Configuration Guide') : (lang === 'vi' ? 'Hưỡng dẫn Cloudflare Tunnel' : 'Cloudflare Tunnel Guide')}
                </h3>
                <button onClick={() => setActiveDoc(null)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ color: labelColor, background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 overflow-auto" style={{ maxHeight: 'calc(80vh - 48px)' }}>
                {activeDoc === 'docker' ? (
                  <div className="space-y-4 text-xs" style={{ color: labelColor }}>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Socket Path' : 'Socket Path'}</h4>
                      <p>{lang === 'vi' ? 'Đường dẫn tới Docker socket. Mặc định: /var/run/docker.sock' : 'Path to Docker socket. Default: /var/run/docker.sock'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Data Directory' : 'Data Directory'}</h4>
                      <p>{lang === 'vi' ? 'Nơi Docker lưu trữ dữ liệu container, volume và images. Mặc định: /var/lib/docker' : 'Where Docker stores container data, volumes and images. Default: /var/lib/docker'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Network Interface' : 'Network Interface'}</h4>
                      <p>{lang === 'vi' ? 'Bridge network Docker. Mặc định: docker0. Đây là interface mà containers sử dụng để giao tiếp.' : 'Docker bridge network. Default: docker0. This is the network interface containers use to communicate.'}</p>
                    </div>
                    <div className="pt-2" style={{ borderTop: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Tài liệu tham khảo' : 'References'}</h4>
                      <a href="https://docs.docker.com/config/" target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); handleDocsClick('https://docs.docker.com/config/') }} className="text-xs underline" style={{ color: '#2496ed' }}>docs.docker.com/config/</a>
                    </div>
                  </div>
                ) : activeDoc === 'wings' ? (
                  <div className="space-y-4 text-xs" style={{ color: labelColor }}>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Wings Daemon' : 'Wings Daemon'}</h4>
                      <p>{lang === 'vi' ? 'Wings chạy locally trên máy, quản lý game server qua Docker. App tự cấu hình khi cài đặt.' : 'Wings runs locally, manages game servers via Docker. Auto-configured on install.'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Token' : 'Token'}</h4>
                      <p>{lang === 'vi' ? 'Token tự generate khi tạo config. Dùng để xác thực giữa app và Wings daemon.' : 'Token auto-generated when creating config. Used to authenticate between app and Wings daemon.'}</p>
                    </div>
                    <div className="pt-2" style={{ borderTop: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Tài liệu tham khảo' : 'References'}</h4>
                      <a href="https://github.com/calagopus/wings" target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); handleDocsClick('https://github.com/calagopus/wings') }} className="text-xs underline" style={{ color: '#06b6d4' }}>github.com/calagopus/wings</a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs" style={{ color: labelColor }}>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Tên Tunnel' : 'Tunnel Name'}</h4>
                      <p>{lang === 'vi' ? 'Tên định danh cho tunnel. Quản lý và nhận diện tunnel.' : 'Identifier name for the tunnel. Used for managing and identifying.'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Domain App' : 'App Domain'}</h4>
                      <p>{lang === 'vi' ? 'Domain công cộng cho app. Ví dụ: app.example.com' : 'Public domain for the app. e.g., app.example.com'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Tunnel Token' : 'Tunnel Token'}</h4>
                      <p>{lang === 'vi' ? 'Token từ Cloudflare Dashboard → Networking → Tunnels → Create tunnel' : 'Token from Cloudflare Dashboard → Networking → Tunnels → Create tunnel'}</p>
                    </div>
                    <div className="pt-2" style={{ borderTop: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                      <h4 className="font-semibold mb-1" style={{ color: textColor }}>{lang === 'vi' ? 'Tài liệu tham khảo' : 'References'}</h4>
                      <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/" target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); handleDocsClick('https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/') }} className="text-xs underline" style={{ color: '#3b82f6' }}>developers.cloudflare.com</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setWizardOpen(false)}>
          <div className="relative max-w-xl w-[90vw] m-4" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl overflow-hidden" style={{ background: theme === 'light' ? '#fff' : '#141414', border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" style={{ color: '#a78bfa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <h3 className="text-sm font-bold" style={{ color: textColor }}>
                    {lang === 'vi' ? 'Cài đặt nhanh' : 'Quick Setup'}
                  </h3>
                </div>
                <button onClick={() => setWizardOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ color: labelColor, background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  {wizardSteps.map((step, i) => (
                    <div key={step.key} className="flex items-center gap-2 flex-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all" style={{
                        background: wizardStep > i ? step.color : wizardStep === i ? step.color : inputBg,
                        color: wizardStep >= i ? '#fff' : labelColor,
                        border: `1px solid ${wizardStep >= i ? step.color : inputBorder}`
                      }}>
                        {wizardStep > i ? '✓' : i + 1}
                      </div>
                      <span className="text-[10px] font-semibold hidden sm:block" style={{ color: wizardStep >= i ? step.color : labelColor }}>{step.label}</span>
                      {i < wizardSteps.length - 1 && <div className="flex-1 h-0.5" style={{ background: wizardStep > i ? step.color : inputBorder }} />}
                    </div>
                  ))}
                </div>

                {wizardStep === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: textColor }}>
                      {lang === 'vi' ? 'Bước 1: Cài đặt Docker Engine' : 'Step 1: Install Docker Engine'}
                    </p>
                    <p className="text-[11px]" style={{ color: labelColor }}>
                      {lang === 'vi' ? 'Docker cần thiết để chạy game server trong container.' : 'Docker is required to run game servers in containers.'}
                    </p>
                    {docker?.installed ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#22c55e20', border: '1px solid #22c55e40' }}>
                        <span className="text-[11px] font-semibold" style={{ color: '#22c55e' }}>✓ Docker {lang === 'vi' ? 'đã cài đặt' : 'already installed'}</span>
                        <button onClick={() => setWizardStep(1)} className="ml-auto px-3 py-1 rounded-lg text-[10px] font-semibold" style={{ background: '#22c55e', color: '#fff' }}>{lang === 'vi' ? 'Tiếp' : 'Next'}</button>
                      </div>
                    ) : (
                      <button onClick={handleWizardDockerInstall} disabled={wizardProcessing} className="w-full py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: '#2496ed', color: '#fff', opacity: wizardProcessing ? 0.6 : 1 }}>
                        {wizardProcessing ? (lang === 'vi' ? 'Đang cài...' : 'Installing...') : (lang === 'vi' ? 'Cài đặt Docker' : 'Install Docker')}
                      </button>
                    )}
                    <div className="relative">
                      <button onClick={() => wizardDockerLog && navigator.clipboard.writeText(wizardDockerLog)} className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-all z-10" style={{ background: copiedKey === 'wd' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'wd' ? '#fff' : labelColor }}>{copiedKey === 'wd' ? '✓' : 'Copy'}</button>
                      <pre className="p-3 pr-12 rounded-xl text-[10px] whitespace-pre-wrap max-h-32 overflow-auto" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{wizardDockerLog || (lang === 'vi' ? 'Sẵn sàng. Nhấn "Cài đặt Docker" để bắt đầu.' : 'Ready. Click "Install Docker" to begin.')}</pre>
                    </div>
                  </div>
                )}

                {wizardStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: textColor }}>
                      {lang === 'vi' ? 'Bước 2: Cài đặt & cấu hình LunarSpace Wings' : 'Step 2: Install & configure LunarSpace Wings'}
                    </p>
                    <p className="text-[11px]" style={{ color: labelColor }}>
                      {lang === 'vi' ? 'Wings daemon quản lý các game server trên node này.' : 'Wings daemon manages game servers on this node.'}
                    </p>
                    {!wings?.installed && (
                      <button onClick={handleWizardWingsInstall} disabled={wizardProcessing} className="w-full py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: '#06b6d4', color: '#fff', opacity: wizardProcessing ? 0.6 : 1 }}>
                        {wizardProcessing ? (lang === 'vi' ? 'Đang cài...' : 'Installing...') : (lang === 'vi' ? 'Cài đặt Wings' : 'Install Wings')}
                      </button>
                    )}
                    {wings?.installed && (
                      <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: '#06b6d420', border: '1px solid #06b6d440' }}>
                        <span className="text-[11px] font-semibold" style={{ color: '#06b6d4' }}>✓ Wings {lang === 'vi' ? 'đã cài đặt' : 'already installed'}</span>
                      </div>
                    )}
                    <div className="relative">
                      <button onClick={() => wizardWingsLog && navigator.clipboard.writeText(wizardWingsLog)} className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-all z-10" style={{ background: copiedKey === 'ww' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'ww' ? '#fff' : labelColor }}>{copiedKey === 'ww' ? '✓' : 'Copy'}</button>
                      <pre className="p-3 pr-12 rounded-xl text-[10px] whitespace-pre-wrap max-h-24 overflow-auto" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{wizardWingsLog || (lang === 'vi' ? 'Sẵn sàng. Nhấn "Cài đặt Wings" để bắt đầu.' : 'Ready. Click "Install Wings" to begin.')}</pre>
                    </div>
                    {wings?.installed && !wings?.hasConfig && (
                      <button
                        onClick={handleWingsConfigGenerate}
                        className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: wingsConfigSaved ? '#22c55e' : '#a78bfa', color: '#fff' }}
                      >
                        {wingsConfigSaved ? (lang === 'vi' ? 'Đã tạo!' : 'Generated!') : (lang === 'vi' ? 'Tạo cấu hình Wings' : 'Generate Wings Config')}
                      </button>
                    )}
                    {wings?.hasConfig && (
                      <div className="space-y-2">
                        <div className="p-2 rounded-xl text-[10px]" style={{ background: '#22c55e20', border: '1px solid #22c55e40', color: '#22c55e' }}>
                          ✓ {lang === 'vi' ? 'Wings đã được cấu hình' : 'Wings is configured'}
                        </div>
                        <button onClick={() => setWizardStep(2)} className="w-full py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: '#06b6d4', color: '#fff' }}>
                          {lang === 'vi' ? 'Tiếp tục → Cloudflare Tunnel' : 'Continue → Cloudflare Tunnel'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold" style={{ color: textColor }}>
                      {lang === 'vi' ? 'Bước 3: Cloudflare Tunnel' : 'Step 3: Cloudflare Tunnel'}
                    </p>
                    <p className="text-[11px]" style={{ color: labelColor }}>
                      {lang === 'vi' ? 'Tunnel cho phép truy cập panel và wings qua HTTPS mà không cần mở port.' : 'Tunnel allows accessing panel and wings via HTTPS without opening ports.'}
                    </p>
                    {!cloudflare?.installed ? (
                      <div className="text-[11px] p-3 rounded-xl" style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444' }}>
                        {lang === 'vi' ? 'Vui lòng cài đặt cloudflared trước trong phần Cloudflare Tunnel bên dưới.' : 'Please install cloudflared first in the Cloudflare Tunnel section below.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button onClick={handleWizardCfLogin} disabled={wizardProcessing} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: '#3b82f6', color: '#fff', opacity: wizardProcessing ? 0.6 : 1 }}>
                            {lang === 'vi' ? 'Đăng nhập Cloudflare' : 'Login Cloudflare'}
                          </button>
                          <button onClick={handleWizardCfCheckAuth} disabled={wizardProcessing} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor, opacity: wizardProcessing ? 0.6 : 1 }}>
                            {lang === 'vi' ? 'Kiểm tra' : 'Check Auth'}
                          </button>
                        </div>
                        <div className="relative">
                          <button onClick={() => wizardCfLog && navigator.clipboard.writeText(wizardCfLog)} className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-semibold transition-all z-10" style={{ background: copiedKey === 'wc' ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedKey === 'wc' ? '#fff' : labelColor }}>{copiedKey === 'wc' ? '✓' : 'Copy'}</button>
                          <pre className="p-3 pr-12 rounded-xl text-[10px] whitespace-pre-wrap max-h-24 overflow-auto" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>{wizardCfLog || (lang === 'vi' ? 'Sẵn sàng. Nhấn "Đăng nhập Cloudflare" để bắt đầu.' : 'Ready. Click "Login Cloudflare" to begin.')}</pre>
                        </div>
                        <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${inputBorder}` }}>
                          <p className="text-[10px] font-semibold uppercase" style={{ color: labelColor }}>{lang === 'vi' ? 'Cấu hình Tunnel' : 'Tunnel Configuration'}</p>
                          <input
                            value={cfConfig.tunnelName}
                            onChange={(e) => setCfConfig({ ...cfConfig, tunnelName: e.target.value })}
                            placeholder={lang === 'vi' ? 'Tên tunnel (mặc định: terver-tunnel)' : 'Tunnel name (default: terver-tunnel)'}
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                          />
                          <input
                            value={cfConfig.appDomain}
                            onChange={(e) => setCfConfig({ ...cfConfig, appDomain: e.target.value })}
                            placeholder={lang === 'vi' ? 'Domain app (ví dụ: app.example.com)' : 'App domain (e.g. app.example.com)'}
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                          />
                          <input
                            value={cfConfig.token}
                            onChange={(e) => setCfConfig({ ...cfConfig, token: e.target.value })}
                            type="password"
                            placeholder={lang === 'vi' ? 'Tunnel token (từ Cloudflare Dashboard)' : 'Tunnel token (from Cloudflare Dashboard)'}
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
                          />
                          <button
                            onClick={handleTunnelCreate}
                            disabled={!cfConfig.tunnelName.trim() || !cfConfig.token.trim()}
                            className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: '#3b82f6', color: '#fff', opacity: (!cfConfig.tunnelName.trim() || !cfConfig.token.trim()) ? 0.5 : 1 }}
                          >
                            {lang === 'vi' ? 'Tạo & chạy Tunnel' : 'Create & Run Tunnel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {wizardStep > 0 && (
                    <button onClick={() => setWizardStep(wizardStep - 1)} className="px-4 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: labelColor }}>
                      {lang === 'vi' ? 'Quay lại' : 'Back'}
                    </button>
                  )}
                  <button onClick={() => setWizardOpen(false)} className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', color: labelColor }}>
                    {lang === 'vi' ? 'Đóng' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default NodePage
