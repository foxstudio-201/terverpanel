import { useState, useEffect } from 'react'
import { File, Folder, ArrowLeft, ArrowUp, Trash, PencilSimple, Plus, Upload, Download } from '@phosphor-icons/react'

const isElectron = typeof window !== 'undefined' && window.electronAPI

export default function FileManagerPage({ server, theme, lang }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const borderColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const bgSecondary = theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)'

  const [files, setFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(false)
  const [editingFile, setEditingFile] = useState(null)
  const [editContent, setEditContent] = useState('')

  const loadFiles = async (path) => {
    if (!isElectron) return
    setLoading(true)
    try {
      const res = await window.electronAPI.wingsListFiles(server.uuid, path)
      if (res?.files) setFiles(res.files)
    } catch { setFiles([]) }
    setLoading(false)
  }

  useEffect(() => { loadFiles(currentPath) }, [server?.uuid, currentPath])

  const handleClick = (f) => {
    if (f.is_dir) {
      setCurrentPath(currentPath === '/' ? `/${f.name}` : `${currentPath}/${f.name}`)
    } else {
      handleOpenFile(f)
    }
  }

  const handleOpenFile = async (f) => {
    if (!isElectron) return
    const filePath = currentPath === '/' ? `/${f.name}` : `${currentPath}/${f.name}`
    try {
      const res = await window.electronAPI.wingsReadFile(server.uuid, filePath)
      if (res?.content !== undefined) {
        setEditingFile(filePath)
        setEditContent(res.content)
      }
    } catch {}
  }

  const handleSaveFile = async () => {
    if (!isElectron || !editingFile) return
    try {
      await window.electronAPI.wingsWriteFile(server.uuid, editingFile, editContent)
      setEditingFile(null)
      loadFiles(currentPath)
    } catch {}
  }

  const handleDelete = async (f) => {
    if (!isElectron) return
    const filePath = currentPath === '/' ? `/${f.name}` : `${currentPath}/${f.name}`
    try {
      await window.electronAPI.wingsDeleteFile(server.uuid, filePath)
      loadFiles(currentPath)
    } catch {}
  }

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath('/' + parts.join('/'))
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < 3) { size /= 1024; i++ }
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  if (editingFile) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <button onClick={() => setEditingFile(null)} className="p-1 rounded-lg" style={{ color: labelColor }}><ArrowLeft size={16} weight="duotone" /></button>
          <span className="text-[11px] font-mono truncate flex-1" style={{ color: textColor }}>{editingFile}</span>
          <button onClick={handleSaveFile} className="px-3 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#22c55e', color: '#fff' }}>{lang === 'vi' ? 'Lưu' : 'Save'}</button>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="flex-1 w-full px-4 py-3 font-mono text-[11px] outline-none resize-none"
          style={{ background: '#0a0a0a', color: '#22c55e' }}
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${borderColor}` }}>
        <button onClick={() => setCurrentPath('/')} className="text-[11px] font-semibold" style={{ color: '#a78bfa' }}>~</button>
        {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
          <span key={i} className="flex items-center gap-2">
            <span style={{ color: labelColor }}>/</span>
            <button
              onClick={() => setCurrentPath('/' + arr.slice(0, i + 1).join('/'))}
              className="text-[11px] font-semibold"
              style={{ color: i === arr.length - 1 ? textColor : '#a78bfa' }}
            >{part}</button>
          </span>
        ))}
        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: labelColor }}>{files.length} {lang === 'vi' ? 'mục' : 'items'}</span>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {currentPath !== '/' && (
          <button onClick={goUp} className="w-full flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/5" style={{ borderBottom: `1px solid ${borderColor}` }}>
            <ArrowLeft size={14} weight="duotone" style={{ color: labelColor }} />
            <span className="text-[11px] font-medium" style={{ color: labelColor }}>..</span>
          </button>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Đang tải...' : 'Loading...'}</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-[11px]" style={{ color: labelColor }}>{lang === 'vi' ? 'Thư mục trống' : 'Empty directory'}</span>
          </div>
        ) : (
          files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/5 cursor-pointer group" style={{ borderBottom: `1px solid ${borderColor}` }} onClick={() => handleClick(f)}>
              {f.is_dir ? <Folder size={15} weight="duotone" style={{ color: '#eab308' }} /> : <File size={15} weight="duotone" style={{ color: labelColor }} />}
              <span className="text-[11px] font-medium flex-1 truncate" style={{ color: textColor }}>{f.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: labelColor }}>{f.is_dir ? '-' : formatSize(f.size)}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(f) }} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity" style={{ color: '#ef4444' }}>
                <Trash size={12} weight="duotone" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
