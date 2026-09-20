import { useState } from 'react'
import { Warning, Trash, ArrowClockwise, PencilSimple } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function ServerSettingsPage({ server, theme, lang, onBack, onServerDeleted }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const [name, setName] = useState(server?.name || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false)

  const handleRename = async () => {
    if (!isElectron || !name.trim()) return
    try {
      await window.electronAPI.wingsSyncConfig(server.uuid, { name: name.trim() })
    } catch {}
  }

  const handleReinstall = async () => {
    if (!isElectron) return
    try {
      await window.electronAPI.wingsReinstall(server.uuid)
      setShowReinstallConfirm(false)
    } catch {}
  }

  const handleDelete = async () => {
    if (!isElectron) return
    try {
      await window.electronAPI.wingsDeleteServer(server.uuid)
      await window.electronAPI.removeServerConfig(server.id)
      setShowDeleteConfirm(false)
      if (onServerDeleted) onServerDeleted()
      if (onBack) onBack()
    } catch {}
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 gap-4">
      <h2 className="text-sm font-bold" style={{ color: textColor }}>{lang === 'vi' ? 'Cài đặt server' : 'Server Settings'}</h2>

      {/* Rename */}
      <div className="p-3 rounded-xl" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 mb-2">
          <PencilSimple size={14} weight="duotone" style={{ color: '#a78bfa' }} />
          <label className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Đổi tên' : 'Rename Server'}</label>
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
          <button onClick={handleRename} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#a78bfa', color: '#fff' }}>{lang === 'vi' ? 'Lưu' : 'Save'}</button>
        </div>
      </div>

      {/* Reinstall */}
      <div className="p-3 rounded-xl" style={{ background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 mb-2">
          <ArrowClockwise size={14} weight="duotone" style={{ color: '#f59e0b' }} />
          <label className="text-[11px] font-semibold" style={{ color: textColor }}>{lang === 'vi' ? 'Cài lại server' : 'Reinstall Server'}</label>
        </div>
        <p className="text-[10px] mb-2" style={{ color: labelColor }}>{lang === 'vi' ? 'Chạy lại script cài đặt. Dữ liệu trong thư mục gốc sẽ bị xóa.' : 'Re-run the install script. Data in the root directory will be wiped.'}</p>
        {showReinstallConfirm ? (
          <div className="flex gap-2">
            <button onClick={handleReinstall} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#f59e0b', color: '#fff' }}>{lang === 'vi' ? 'Xác nhận' : 'Confirm'}</button>
            <button onClick={() => setShowReinstallConfirm(false)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: borderColor, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </div>
        ) : (
          <button onClick={() => setShowReinstallConfirm(true)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#f59e0b20', color: '#f59e0b' }}>{lang === 'vi' ? 'Cài lại' : 'Reinstall'}</button>
        )}
      </div>

      {/* Delete */}
      <div className="p-3 rounded-xl" style={{ background: '#ef444410', border: `1px solid #ef444430` }}>
        <div className="flex items-center gap-2 mb-2">
          <Trash size={14} weight="duotone" style={{ color: '#ef4444' }} />
          <label className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>{lang === 'vi' ? 'Xóa server' : 'Delete Server'}</label>
        </div>
        <p className="text-[10px] mb-2" style={{ color: labelColor }}>{lang === 'vi' ? 'Xóa vĩnh viễn server và tất cả dữ liệu. Không thể hoàn tác.' : 'Permanently delete this server and all data. Cannot be undone.'}</p>
        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <button onClick={handleDelete} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#ef4444', color: '#fff' }}>{lang === 'vi' ? 'Xóa vĩnh viễn' : 'Delete permanently'}</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: borderColor, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#ef444420', color: '#ef4444' }}>{lang === 'vi' ? 'Xóa' : 'Delete'}</button>
        )}
      </div>
    </div>
  )
}
