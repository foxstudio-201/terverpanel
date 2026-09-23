import { useState, useEffect } from 'react'
import { Warning, Trash, ArrowClockwise, PencilSimple } from '@phosphor-icons/react'
import { showToast } from '../../lib/toast'
import { t } from '../../i18n/translations'

const isElectron = typeof window !== 'undefined' && window.electronAPI

const btn = 'px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 hover:opacity-80 active:scale-95'

export default function ServerSettingsPage({ server, theme, lang, onBack, onServerDeleted, onServerUpdate }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const [name, setName] = useState(server?.name || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReinstallConfirm, setShowReinstallConfirm] = useState(false)

  const handleRename = async () => {
    if (!isElectron || !name.trim()) return
    try {
      await window.electronAPI.wingsSyncConfig(server.id, { name: name.trim() })
      showToast(lang === 'vi' ? 'Đã đổi tên server' : 'Server renamed', 'success')
      onServerUpdate?.({ ...server, name: name.trim() })
    } catch {
      showToast(t(lang, 'toast.failed'), 'error')
    }
  }

  const handleReinstall = async () => {
    if (!isElectron) return
    try {
      const res = await window.electronAPI.installServer(server.id)
      if (res?.ok) {
        showToast(t(lang, 'toast.reinstalling'), 'success')
        onServerUpdate?.({ ...server, status: 'installing', installProgress: 0 })
      } else {
        showToast(res?.error || t(lang, 'toast.failed'), 'error')
      }
      setShowReinstallConfirm(false)
    } catch {
      showToast(t(lang, 'toast.failed'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!isElectron) return
    try { await window.electronAPI.wingsDeleteServer(server.id) } catch {}
    try { await window.electronAPI.removeServerConfig(server.id) } catch {}
    setShowDeleteConfirm(false)
    showToast(t(lang, 'toast.deleted'), 'success')
    if (onServerDeleted) onServerDeleted()
    if (onBack) onBack()
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
          <input value={name} onChange={e => setName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] outline-none transition-colors focus:border-[#a78bfa]" style={{ background: theme === 'light' ? '#fff' : '#1a1a1a', border: `1px solid ${borderColor}`, color: textColor }} />
          <button onClick={handleRename} className={`${btn}`} style={{ background: '#a78bfa', color: '#fff' }}>{lang === 'vi' ? 'Lưu' : 'Save'}</button>
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
            <button onClick={handleReinstall} className={btn} style={{ background: '#f59e0b', color: '#fff' }}>{lang === 'vi' ? 'Xác nhận' : 'Confirm'}</button>
            <button onClick={() => setShowReinstallConfirm(false)} className={btn} style={{ background: borderColor, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </div>
        ) : (
          <button onClick={() => setShowReinstallConfirm(true)} className={btn} style={{ background: '#f59e0b20', color: '#f59e0b' }}>{lang === 'vi' ? 'Cài lại' : 'Reinstall'}</button>
        )}
      </div>

      {/* Delete */}
      <div className="p-3 rounded-xl" style={{ background: '#ef444410', border: '1px solid #ef444430' }}>
        <div className="flex items-center gap-2 mb-2">
          <Trash size={14} weight="duotone" style={{ color: '#ef4444' }} />
          <label className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>{lang === 'vi' ? 'Xóa server' : 'Delete Server'}</label>
        </div>
        <p className="text-[10px] mb-2" style={{ color: labelColor }}>{lang === 'vi' ? 'Xóa vĩnh viễn server và tất cả dữ liệu. Không thể hoàn tác.' : 'Permanently delete this server and all data. Cannot be undone.'}</p>
        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <button onClick={handleDelete} className={btn} style={{ background: '#ef4444', color: '#fff' }}>{lang === 'vi' ? 'Xóa vĩnh viễn' : 'Delete permanently'}</button>
            <button onClick={() => setShowDeleteConfirm(false)} className={btn} style={{ background: borderColor, color: labelColor }}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)} className={btn} style={{ background: '#ef444420', color: '#ef4444' }}>{lang === 'vi' ? 'Xóa' : 'Delete'}</button>
        )}
      </div>
    </div>
  )
}
