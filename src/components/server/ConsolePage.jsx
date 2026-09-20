import { useState, useEffect, useRef } from 'react'
import { Play, Stop, ArrowClockwise, ArrowDown } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function ConsolePage({ server, theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const bgTerminal = '#0a0a0a'

  const [logs, setLogs] = useState('')
  const [serverState, setServerState] = useState('stopped')
  const [command, setCommand] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isElectron || !server?.uuid) return
    const fetchState = async () => {
      try {
        const res = await window.electronAPI.wingsServerState(server.uuid)
        if (res?.state) setServerState(res.state)
      } catch {}
    }
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [server?.uuid])

  useEffect(() => {
    if (!isElectron || !server?.uuid) return
    const fetchLogs = async () => {
      try {
        const res = await window.electronAPI.wingsServerLogs(server.uuid)
        if (res?.logs !== undefined) setLogs(res.logs)
      } catch {}
    }
    fetchLogs()
    const interval = setInterval(fetchLogs, 2000)
    return () => clearInterval(interval)
  }, [server?.uuid])

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handlePower = async (action) => {
    if (!isElectron) return
    setServerState(action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'starting')
    try {
      await window.electronAPI.wingsServerPower(server.uuid, action)
    } catch {}
  }

  const handleSendCommand = async () => {
    if (!command.trim() || !isElectron) return
    try {
      await window.electronAPI.wingsServerCommand(server.uuid, command)
      setCommand('')
    } catch {}
  }

  const stateColors = {
    running: '#22c55e',
    starting: '#eab308',
    stopping: '#eab308',
    stopped: '#ef4444',
    offline: '#ef4444',
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <span className="text-[11px] font-semibold mr-2" style={{ color: textColor }}>
          {lang === 'vi' ? 'Trạng thái:' : 'Status:'}
        </span>
        <span className="w-2 h-2 rounded-full" style={{ background: stateColors[serverState] || '#888' }} />
        <span className="text-[11px] font-medium" style={{ color: stateColors[serverState] || '#888' }}>{serverState}</span>

        <div className="flex-1" />

        {serverState === 'stopped' || serverState === 'offline' ? (
          <button onClick={() => handlePower('start')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#22c55e', color: '#fff' }}>
            <Play size={13} weight="fill" /> {lang === 'vi' ? 'Khởi động' : 'Start'}
          </button>
        ) : (
          <>
            <button onClick={() => handlePower('stop')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#f59e0b', color: '#fff' }}>
              <Stop size={13} weight="fill" /> {lang === 'vi' ? 'Dừng' : 'Stop'}
            </button>
            <button onClick={() => handlePower('restart')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#3b82f6', color: '#fff' }}>
              <ArrowClockwise size={13} weight="duotone" /> {lang === 'vi' ? 'Khởi động lại' : 'Restart'}
            </button>
            <button onClick={() => handlePower('kill')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95" style={{ background: '#ef4444', color: '#fff' }}>
              {lang === 'vi' ? 'Tắt' : 'Kill'}
            </button>
          </>
        )}
      </div>

      {/* Log terminal */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
        style={{ background: bgTerminal, color: '#22c55e' }}
        onClick={() => inputRef.current?.focus()}
      >
        {logs || (lang === 'vi' ? 'Chưa có log. Khởi động server để xem.' : 'No logs. Start the server to see output.')}
      </div>

      {/* Command input */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2" style={{ borderTop: `1px solid ${borderColor}`, background: theme === 'light' ? '#fafafa' : '#111' }}>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendCommand() }}
          placeholder={lang === 'vi' ? 'Nhập lệnh...' : 'Enter command...'}
          className="flex-1 px-3 py-1.5 rounded-lg text-[11px] outline-none font-mono"
          style={{ background: bgTerminal, border: `1px solid ${borderColor}`, color: '#22c55e' }}
        />
        <button onClick={handleSendCommand} disabled={!command.trim()} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95 disabled:opacity-40" style={{ background: '#a78bfa', color: '#fff' }}>
          {lang === 'vi' ? 'Gửi' : 'Send'}
        </button>
        <button onClick={() => setAutoScroll(!autoScroll)} className="p-1.5 rounded-lg transition-all" style={{ background: autoScroll ? '#a78bfa20' : 'transparent', color: autoScroll ? '#a78bfa' : labelColor }}>
          <ArrowDown size={14} weight="duotone" />
        </button>
      </div>
    </div>
  )
}
