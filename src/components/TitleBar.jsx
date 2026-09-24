import { useState, useEffect } from 'react'
import { User, Power } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k))
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getPingColor(ms) {
  if (ms < 0) return '#6b7280'
  if (ms < 30) return '#22c55e'
  if (ms < 60) return '#84cc16'
  if (ms < 100) return '#eab308'
  if (ms < 200) return '#f97316'
  return '#ef4444'
}

function DockerIcon({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.888c0 .102.084.186.186.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.186H8.1a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
    </svg>
  )
}

function WingsIcon({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  )
}

function StatusDot({ color }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  )
}

export default function TitleBar({ onCloseRequest, user, onLogout, lang, theme, server, appMode }) {
  const isDark = theme === 'dark'
  const isBasic = appMode === 'basic'
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
  const textHover = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const hoverBgRed = isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'
  const closeHoverBg = 'rgba(239,68,68,0.8)'
  const userBg = isDark ? 'rgba(167,139,250,0.15)' : 'rgba(139,92,246,0.12)'
  const userColor = isDark ? '#a78bfa' : '#7c3aed'
  const usernameColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
  const statBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const statBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const [docker, setDocker] = useState({ running: false, version: '', containers: 0 })
  const [wings, setWings] = useState({ installed: false, running: false, version: '', hasConfig: false })
  const [ping, setPing] = useState(-1)
  const [net, setNet] = useState({ rxSpeed: 0, txSpeed: 0 })
  const [serverCount, setServerCount] = useState(0)
  const [serverNet, setServerNet] = useState({ rxSpeed: 0, txSpeed: 0 })

  useEffect(() => {
    if (!isElectron) return
    const interval = setInterval(async () => {
      try {
        const [p, n, servers] = await Promise.all([
          window.electronAPI.getPing(),
          window.electronAPI.getNetworkStats(),
          window.electronAPI.listServers(),
        ])
        if (p?.ok) setPing(p.ms)
        if (n?.ok) setNet({ rxSpeed: n.rxSpeed, txSpeed: n.txSpeed })
        if (Array.isArray(servers)) setServerCount(servers.length)
        if (!isBasic) {
          const [d, w] = await Promise.all([
            window.electronAPI.getDockerStatus(),
            window.electronAPI.getWingsStatus(),
          ])
          if (d?.ok) setDocker(d)
          if (w?.ok) setWings(w)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [isBasic])

  const serverId = server?.id || null

  useEffect(() => {
    if (!isElectron || !serverId) {
      setServerNet({ rxSpeed: 0, txSpeed: 0 })
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const n = await window.electronAPI.getServerNetworkStats(serverId)
        if (!cancelled && n?.ok) setServerNet({ rxSpeed: n.rxSpeed, txSpeed: n.txSpeed })
      } catch {}
    }
    tick()
    const interval = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [serverId])

  const handleMinimize = () => isElectron && window.electronAPI.minimizeWindow()
  const handleClose = () => {
    if (isElectron) {
      if (onCloseRequest) onCloseRequest()
      else window.electronAPI.closeWindow()
    }
  }

  const getDockerColor = () => {
    if (!docker.running && docker.version) return '#f59e0b'
    if (!docker.running) return '#ef4444'
    return '#22c55e'
  }

  const getDockerLabel = () => {
    if (!docker.running && docker.version) return lang === 'vi' ? 'Docker dừng' : 'Docker stopped'
    if (!docker.running) return 'Docker'
    return 'Docker'
  }

  const getWingsColor = () => {
    if (!wings.installed) return '#6b7280'
    if (!wings.running && wings.hasConfig) return '#f59e0b'
    if (!wings.running) return '#ef4444'
    return '#06b6d4'
  }

  const getWingsLabel = () => {
    if (!wings.installed) return 'Wings'
    if (!wings.running && wings.hasConfig) return lang === 'vi' ? 'Wings dừng' : 'Wings stopped'
    if (!wings.running) return 'Wings'
    return 'Wings'
  }

  return (
    <div className="drag-region flex items-center justify-between h-11 px-4 fixed top-0 left-0 right-0" style={{ zIndex: 9999 }}>
      <div className="flex items-center gap-3 no-drag" style={{ marginLeft: '72px' }}>
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: userBg }}>
              <User size={18} weight="duotone" style={{ color: userColor }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold leading-tight" style={{ color: usernameColor }}>
                {lang === 'vi' ? 'Chào mừng trở lại' : 'Welcome back'}
              </span>
              <span className="text-[13px] font-bold leading-tight" style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}>
                {user.username || user.email || ''}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 no-drag flex items-center gap-2">
        {isElectron && (
          <>
            {!isBasic && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: statBg, border: `1px solid ${statBorder}` }}>
                  <StatusDot color={getDockerColor()} />
                  <DockerIcon color={getDockerColor()} />
                  <span className="text-[10px] font-medium" style={{ color: getDockerColor() }}>
                    {getDockerLabel()}
                  </span>
                  {docker.running && docker.containers > 0 && (
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                      {docker.containers}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: statBg, border: `1px solid ${statBorder}` }}>
                  <StatusDot color={getWingsColor()} />
                  <WingsIcon color={getWingsColor()} />
                  <span className="text-[10px] font-medium" style={{ color: getWingsColor() }}>
                    {getWingsLabel()}
                  </span>
                  {wings.installed && wings.version && (
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                      {wings.version}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: statBg, border: `1px solid ${statBorder}` }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={getPingColor(ping)} strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill={getPingColor(ping)} />
              </svg>
              <span className="text-[10px] font-medium" style={{ color: getPingColor(ping) }}>
                {ping < 0 ? '---' : `${Math.round(ping)}ms`}
              </span>
            </div>

            {(serverId || serverCount > 0) && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: statBg, border: `1px solid ${statBorder}` }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-medium" style={{ color: '#22c55e' }}>
                    {formatSpeed(serverId ? serverNet.rxSpeed : net.rxSpeed)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: statBg, border: `1px solid ${statBorder}` }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>
                    {formatSpeed(serverId ? serverNet.txSpeed : net.txSpeed)}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="no-drag flex items-center gap-1">
        {user && onLogout && (
          <button onClick={onLogout}
            data-tip={lang === 'vi' ? 'Đăng xuất' : 'Logout'}
            className="w-8 h-8 flex items-center justify-center rounded transition-colors mr-1"
            style={{ color: textColor }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = hoverBgRed }}
            onMouseLeave={(e) => { e.currentTarget.style.color = textColor; e.currentTarget.style.background = 'transparent' }}>
            <Power size={18} weight="duotone" />
          </button>
        )}
        <button onClick={handleMinimize}
          data-tip="Minimize"
          className="w-8 h-7 flex items-center justify-center rounded transition-colors"
          style={{ color: textColor }}
          onMouseEnter={(e) => { e.currentTarget.style.color = textHover; e.currentTarget.style.background = hoverBg }}
          onMouseLeave={(e) => { e.currentTarget.style.color = textColor; e.currentTarget.style.background = 'transparent' }}>
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
        </button>
        <button onClick={handleClose}
          data-tip="Close"
          className="w-8 h-7 flex items-center justify-center rounded transition-colors"
          style={{ color: textColor }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = closeHoverBg }}
          onMouseLeave={(e) => { e.currentTarget.style.color = textColor; e.currentTarget.style.background = 'transparent' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
            <line x1="0" y1="0" x2="10" y2="10"/>
            <line x1="10" y1="0" x2="0" y2="10"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
