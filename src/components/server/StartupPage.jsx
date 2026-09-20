import { useState } from 'react'
import { Play, ArrowsClockwise } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function StartupPage({ server, theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const [startup, setStartup] = useState(server?.startup || 'java -Xms512M -Xmx1G -jar server.jar nogui')
  const [dockerImage, setDockerImage] = useState(server?.image || 'itzg/minecraft-server')
  const [envVars, setEnvVars] = useState(server?.environment || {})
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!isElectron) return
    try {
      await window.electronAPI.wingsSyncConfig(server.uuid, { startup, docker_image: dockerImage, environment: envVars })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Khởi động' : 'Startup Configuration'}</h2>
        <div className="flex-1" />
        <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: saved ? '#22c55e' : '#8b5cf6', color: '#fff' }}>
          {saved ? (lang === 'vi' ? 'Đã lưu!' : 'Saved!') : (lang === 'vi' ? 'Lưu' : 'Save')}
        </button>
      </div>

      {/* Startup Command */}
      <div>
        <label className="text-[11px] font-semibold mb-1 block" style={{ color: labelColor }}>{lang === 'vi' ? 'Lệnh khởi động' : 'Startup Command'}</label>
        <input value={startup} onChange={e => setStartup(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[11px] font-mono outline-none" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
      </div>

      {/* Docker Image */}
      <div>
        <label className="text-[11px] font-semibold mb-1 block" style={{ color: labelColor }}>{lang === 'vi' ? 'Docker Image' : 'Docker Image'}</label>
        <input value={dockerImage} onChange={e => setDockerImage(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[11px] font-mono outline-none" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
      </div>

      {/* Environment Variables */}
      <div>
        <label className="text-[11px] font-semibold mb-2 block" style={{ color: labelColor }}>{lang === 'vi' ? 'Biến môi trường' : 'Environment Variables'}</label>
        {Object.entries(envVars).map(([key, val], i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={key} readOnly className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-mono outline-none" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}`, color: labelColor }} />
            <input value={val} onChange={e => { const n = {...envVars}; n[key] = e.target.value; setEnvVars(n) }} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-mono outline-none" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
          </div>
        ))}
        <button onClick={() => setEnvVars(prev => ({...prev, '': ''}))} className="text-[11px] font-semibold mt-1" style={{ color: '#a78bfa' }}>+ {lang === 'vi' ? 'Thêm biến' : 'Add variable'}</button>
      </div>
    </div>
  )
}
