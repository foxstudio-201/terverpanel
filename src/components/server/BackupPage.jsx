import { useState } from 'react'
import { Archive, Plus, Trash, ArrowClockwise } from '@phosphor-icons/react'

export default function BackupPage({ server, theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const [backups] = useState([])

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Sao lưu' : 'Backups'}</h2>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: '#8b5cf6', color: '#fff' }}>
          <Plus size={13} weight="duotone" /> {lang === 'vi' ? 'Tạo backup' : 'Create backup'}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Archive size={40} weight="duotone" style={{ color: labelColor, opacity: 0.3 }} />
          <p className="text-[11px] mt-2" style={{ color: labelColor }}>{lang === 'vi' ? 'Chưa có backup nào' : 'No backups yet'}</p>
        </div>
      </div>
    </div>
  )
}
