import { useState, useEffect } from 'react'
import { subscribeToasts } from '../../lib/toast'

const COLORS = {
  info: '#2496ed',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
}

const ICONS = {
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
}

function ToastItem({ toast, theme, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, toast.duration || 4500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [toast, onClose])

  const c = COLORS[toast.type] || COLORS.info

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all duration-300 pointer-events-auto"
      style={{
        background: theme === 'light' ? '#fff' : '#1a1a1a',
        border: `1px solid ${c}30`,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        minWidth: '300px',
        maxWidth: '400px',
      }}
    >
      <svg className="w-5 h-5 shrink-0" style={{ color: c }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[toast.type] || ICONS.info} />
      </svg>
      <span className="text-xs flex-1" style={{ color: theme === 'light' ? '#111' : '#fff' }}>{toast.message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
        className="w-5 h-5 flex items-center justify-center shrink-0 transition-opacity hover:opacity-70"
        style={{ color: theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

export default function ToastHost({ theme }) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsub = subscribeToasts((toast) => {
      setToasts((prev) => [...prev, toast].slice(-5))
    })
    return unsub
  }, [])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          theme={theme}
          onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
        />
      ))}
    </div>
  )
}
