import { useState, useEffect, useRef } from 'react'
import { Memory, Cpu, HardDrive, Lightning, Play, Stop, ArrowsClockwise } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const STATUS_META = {
  running: { color: '#22c55e', labelEn: 'Online', labelVi: 'Trực tuyến' },
  starting: { color: '#eab308', labelEn: 'Starting', labelVi: 'Đang khởi động' },
  stopping: { color: '#eab308', labelEn: 'Stopping', labelVi: 'Đang tắt' },
  installing: { color: '#eab308', labelEn: 'Installing', labelVi: 'Đang cài' },
  stopped: { color: '#ef4444', labelEn: 'Offline', labelVi: 'Ngoại tuyến' },
  offline: { color: '#ef4444', labelEn: 'Offline', labelVi: 'Ngoại tuyến' },
  error: { color: '#ef4444', labelEn: 'Error', labelVi: 'Lỗi' },
}

const ACTION_META = {
  start: { color: '#22c55e', labelEn: 'Server marked as started', labelVi: 'Server đã khởi động', Icon: Play },
  stop: { color: '#ef4444', labelEn: 'Server marked as stopped', labelVi: 'Server đã dừng', Icon: Stop },
  kill: { color: '#dc2626', labelEn: 'Server killed', labelVi: 'Server bị tắt cứng', Icon: Stop },
  restart: { color: '#eab308', labelEn: 'Server restarted', labelVi: 'Server khởi động lại', Icon: ArrowsClockwise },
  install: { color: '#06b6d4', labelEn: 'Server installed', labelVi: 'Server đã cài đặt', Icon: Lightning },
}

function formatBytes(n) {
  if (!n || n <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatMB(n) {
  if (!n || n <= 0) return '0 MB'
  if (n >= 1024) return `${Math.round((n / 1024) * 10) / 10} GB`
  return `${Math.round(n)} MB`
}

function clampPct(n) {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 100) return 100
  return Math.round(n * 10) / 10
}

function usageColor(pct) {
  const p = clampPct(pct)
  if (p >= 90) return '#ef4444'
  if (p >= 75) return '#f97316'
  if (p >= 50) return '#eab308'
  return '#22c55e'
}

function fmtDay(ts, lang) {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return lang === 'vi' ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`
}

function fmtTime(ts) {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

function fmtClock(ts) {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

function StatusDot({ color }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
    </span>
  )
}

function GaugeCard({ label, percent, detail, color, Icon, theme }) {
  const cardBg = theme === 'light' ? '#fff' : '#111111'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const track = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const size = 110
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (clampPct(percent) / 100) * c

  return (
    <div className="flex-1 min-w-0 rounded-xl p-4 flex flex-col items-center gap-2" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-center gap-1.5 self-start">
        <Icon size={14} weight="duotone" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: labelColor }}>{label}</span>
      </div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none" style={{ color: textColor }}>{clampPct(percent)}%</span>
        </div>
      </div>
      <p className="text-[11px] font-mono text-center" style={{ color: labelColor }}>{detail}</p>
    </div>
  )
}

function groupHistory(history, lang) {
  const groups = []
  const byDay = new Map()
  for (const item of history) {
    const key = fmtDay(item.at, lang)
    if (!byDay.has(key)) {
      const g = { day: key, items: [] }
      byDay.set(key, g)
      groups.push(g)
    }
    byDay.get(key).items.push(item)
  }
  return groups
}

export default function OverviewPage({ server, theme, lang, onServerUpdate }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const cardBg = theme === 'light' ? '#fff' : '#111111'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const histBg = theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)'

  const [status, setStatus] = useState(server?.status || 'stopped')
  const [util, setUtil] = useState({})
  const [history, setHistory] = useState([])
  const [now, setNow] = useState(Date.now())
  const [tps, setTps] = useState(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const meta = STATUS_META[status] || STATUS_META.stopped
  const statusColor = meta.color
  const statusLabel = lang === 'vi' ? meta.labelVi : meta.labelEn

  const bgImage = server?.game === 'terraria' ? './terraria_backgound.png' : './Minecraft_backgound.png'
  const gameIcon = server?.game === 'terraria' ? './terraria_icon.png' : './minecraft_icon.png'

  const memLimit = (server?.resources?.memory || 0) * 1024 * 1024
  const cpuLimit = server?.resources?.cpuPercent || 100
  const diskLimit = (server?.resources?.disk || 0) * 1024 * 1024

  const memUsed = util.memory_bytes || util.memoryUsage || 0
  const cpuUsed = util.cpu_absolute ?? util.cpuUsage ?? 0
  const diskUsed = util.disk_bytes || util.diskUsage || 0

  const memPct = memLimit > 0 ? (memUsed / memLimit) * 100 : 0
  const cpuPct = cpuLimit > 0 ? (cpuUsed / cpuLimit) * 100 : 0
  const diskPct = diskLimit > 0 ? (diskUsed / diskLimit) * 100 : 0

  const tpsValue = status === 'running' ? (tps != null ? tps : (server?.lastTps ?? null)) : null
  const tpsDisplay = tpsValue != null ? tpsValue : 0
  const tpsPct = (tpsDisplay / 20) * 100
  const tpsColor = tpsValue == null
    ? (status === 'running' ? '#eab308' : '#6b7280')
    : tpsValue >= 19 ? '#22c55e' : tpsValue >= 15 ? '#eab308' : tpsValue >= 10 ? '#f97316' : '#ef4444'

  useEffect(() => {
    setStatus(server?.status || 'stopped')
  }, [server?.status])

  useEffect(() => {
    if (!isElectron) return
    const tickClock = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tickClock)
  }, [])

  useEffect(() => {
    if (!isElectron || !server?.id) return
    let cancelled = false
    const loadHistory = async () => {
      try {
        const res = await window.electronAPI.getServerHistory?.(server.id)
        if (!cancelled && res?.ok) setHistory(res.history || [])
      } catch {}
    }
    const loadTps = async () => {
      try {
        const res = await window.electronAPI.getServerTps?.(server.id)
        if (!cancelled && res?.ok) setTps(res.tps ?? null)
      } catch {}
    }
    const poll = async () => {
      try {
        const res = await window.electronAPI.getServerStatus(server.id)
        if (cancelled || !res?.ok) return
        setUtil(res.resources || {})
        if (res.status) setStatus(res.status)
        if (res.tps !== undefined) setTps(res.tps ?? null)
        if (res.status && res.status !== (server.status) && typeof onServerUpdate === 'function') {
          try {
            const cfg = await window.electronAPI.getServerConfig(server.id)
            if (!cancelled && cfg?.ok && cfg.server) onServerUpdate(cfg.server)
          } catch {}
        }
      } catch {}
      try {
        const hr = await window.electronAPI.getServerHistory?.(server.id)
        if (!cancelled && hr?.ok) setHistory(hr.history || [])
      } catch {}
      loadTps()
    }
    loadHistory()
    loadTps()
    poll()
    const iv = setInterval(poll, 2500)
    const offTps = typeof window.electronAPI.onServerTps === 'function'
      ? window.electronAPI.onServerTps(({ serverId, tps: v }) => {
          if (!cancelled && serverId === server.id) setTps(v ?? null)
        })
      : null
    return () => {
      cancelled = true
      clearInterval(iv)
      if (typeof offTps === 'function') offTps()
    }
  }, [server?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = groupHistory(history, lang).slice(0, 20)
  const totalEvents = history.length

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-4">
      {/* Top: hero 2/3 + history 1/3 */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        {/* Hero */}
        <div className="col-span-2 rounded-2xl overflow-hidden relative group transition-all hover:shadow-xl" style={{ border: `1px solid ${borderColor}`, minHeight: 240 }}>
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.25) 100%)' }} />
          <div className="relative z-10 h-full p-5 flex flex-col justify-between min-h-[240px]">
            <div className="flex items-start gap-3">
              <img src={gameIcon} alt="" className="w-14 h-14 rounded-2xl object-contain shadow-lg" style={{ background: 'rgba(0,0,0,0.35)' }} />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{server?.name || 'Server'}</h2>
                <p className="text-xs text-white/60 truncate">{server?.egg || server?.game || ''}{server?.version ? ` · ${server.version}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', border: `1px solid ${statusColor}44` }}>
                <StatusDot color={statusColor} />
                <span className="text-[11px] font-bold" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">{lang === 'vi' ? 'Địa chỉ' : 'Address'}</p>
                <p className="text-sm font-mono text-white/90">127.0.0.1:{server?.port || 25565}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">{lang === 'vi' ? 'Mã' : 'UUID'}</p>
                <p className="text-[11px] font-mono text-white/70 truncate max-w-[220px]">{server?.id || ''}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">{lang === 'vi' ? 'Tạo lúc' : 'Created'}</p>
                <p className="text-[11px] font-mono text-white/70">{server?.createdAt ? fmtDay(server.createdAt, lang) : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History / clock */}
        <div className="col-span-1 rounded-2xl flex flex-col overflow-hidden" style={{ border: `1px solid ${borderColor}`, background: cardBg, minHeight: 240 }}>
          <div className="px-4 pt-4 pb-3 text-center" style={{ borderBottom: `1px solid ${borderColor}` }}>
            <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: labelColor }}>
              {lang === 'vi' ? 'Thời gian' : 'Time'}
            </p>
            <p className="text-3xl font-bold font-mono tracking-tight" style={{ color: textColor }}>{fmtClock(now)}</p>
            <p className="text-xs mt-0.5" style={{ color: labelColor }}>{fmtDay(now, lang)}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0" style={{ maxHeight: 200 }}>
            <p className="text-[10px] uppercase font-bold tracking-wider px-2 mb-1.5" style={{ color: labelColor }}>
              {lang === 'vi' ? `Lịch sử (${totalEvents})` : `History (${totalEvents})`}
            </p>
            {groups.length === 0 ? (
              <p className="text-[11px] px-2 py-4 text-center" style={{ color: labelColor }}>
                {lang === 'vi' ? 'Chưa có sự kiện khởi động/dừng' : 'No start/stop events yet'}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.day} className="mb-2">
                  <p className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: histBg, color: labelColor }}>{g.day}</p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {g.items.map((item, i) => {
                      const am = ACTION_META[item.action] || ACTION_META.start
                      const Icon = am.Icon || Play
                      return (
                        <div key={`${item.at}-${i}`} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: histBg }}>
                          <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${am.color}22` }}>
                            <Icon size={11} weight="fill" style={{ color: am.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold leading-tight" style={{ color: textColor }}>
                              {lang === 'vi' ? am.labelVi : am.labelEn}
                            </p>
                            <p className="text-[10px] font-mono" style={{ color: labelColor }}>{fmtTime(item.at)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resource gauges — outer wrapper has NO card background/border */}
      <div className="flex flex-row gap-3 shrink-0">
        <GaugeCard
          theme={theme}
          label="RAM"
          percent={memPct}
          detail={`${formatBytes(memUsed)} / ${formatBytes(memLimit)}`}
          color={usageColor(memPct)}
          Icon={Memory}
        />
        <GaugeCard
          theme={theme}
          label="CPU"
          percent={cpuPct}
          detail={`${Math.round(cpuUsed * 10) / 10}% / ${cpuLimit}%`}
          color={usageColor(cpuPct)}
          Icon={Cpu}
        />
        <GaugeCard
          theme={theme}
          label="Disk"
          percent={diskPct}
          detail={`${formatMB(Math.round(diskUsed / (1024 * 1024)))} / ${formatMB(server?.resources?.disk || 0)}`}
          color={usageColor(diskPct)}
          Icon={HardDrive}
        />
        <GaugeCard
          theme={theme}
          label="TPS"
          percent={tpsPct}
          detail={tpsValue != null ? `${tpsDisplay.toFixed(1)} / 20.0` : (status === 'running' ? 'đang đo… / 20.0' : `0.0 / 20.0`)}
          color={tpsColor}
          Icon={Lightning}
        />
      </div>
    </div>
  )
}
