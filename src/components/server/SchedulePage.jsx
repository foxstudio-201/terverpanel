import { useState, useEffect } from 'react'
import { Plus, Trash, Play, Pause } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function SchedulePage({ server, theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const [schedules, setSchedules] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ name: '', cron: '', action: 'command', command: '' })

  useEffect(() => {
    if (!isElectron || !server?.uuid) return
    window.electronAPI.wingsGetSchedules(server.uuid).then(res => {
      if (res?.schedules) setSchedules(res.schedules)
    }).catch(() => {})
  }, [server?.uuid])

  const handleCreate = async () => {
    if (!isElectron || !newSchedule.name || !newSchedule.cron) return
    try {
      await window.electronAPI.wingsCreateSchedule(server.uuid, newSchedule)
      setShowCreate(false)
      setNewSchedule({ name: '', cron: '', action: 'command', command: '' })
      const res = await window.electronAPI.wingsGetSchedules(server.uuid)
      if (res?.schedules) setSchedules(res.schedules)
    } catch {}
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Lịch trình' : 'Schedules'}</h2>
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: '#8b5cf6', color: '#fff' }}>
          <Plus size={13} weight="duotone" /> {lang === 'vi' ? 'Tạo mới' : 'Create'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-3 rounded-xl" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={newSchedule.name} onChange={e => setNewSchedule({...newSchedule, name: e.target.value})} placeholder={lang === 'vi' ? 'Tên lịch trình' : 'Schedule name'} className="px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
            <input value={newSchedule.cron} onChange={e => setNewSchedule({...newSchedule, cron: e.target.value})} placeholder="Cron: */5 * * * *" className="px-3 py-1.5 rounded-lg text-[11px] outline-none font-mono" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
          </div>
          <input value={newSchedule.command} onChange={e => setNewSchedule({...newSchedule, command: e.target.value})} placeholder={lang === 'vi' ? 'Lệnh (backup, command, ...)' : 'Command'} className="w-full px-3 py-1.5 rounded-lg text-[11px] outline-none mb-2" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#22c55e', color: '#fff' }}>{lang === 'vi' ? 'Tạo' : 'Create'}</button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: borderColor, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {schedules.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Chưa có lịch trình' : 'No schedules yet'}</span>
          </div>
        ) : schedules.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.is_active ? '#22c55e20' : '#ef444420' }}>
              {s.is_active ? <Play size={12} weight="fill" style={{ color: '#22c55e' }} /> : <Pause size={12} weight="fill" style={{ color: '#ef4444' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate" style={{ color: textColor }}>{s.name}</p>
              <p className="text-[10px] font-mono truncate" style={{ color: labelColor }}>{s.cron}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
