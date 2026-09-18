import { useEffect, useState } from 'react'



export default function TooltipProvider() {
  const [tip, setTip] = useState(null) 

  useEffect(() => {
    let moveRaf = 0
    function compute(el) {
      const text = el.getAttribute('data-tip')
      if (!text) return null
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      let dir = 'top'
      if (r.left < 90) dir = 'right'
      else if (r.right > vw - 90) dir = 'left'
      else if (r.top > vh / 2) dir = 'top'
      else dir = 'bottom'
      return { text, r, dir }
    }
    function onOver(e) {
      const el = e.target.closest('[data-tip]')
      if (!el) { setTip(null); return }
      setTip(compute(el))
    }
    function onMove(e) {
      const el = e.target.closest('[data-tip]')
      if (el) {
        cancelAnimationFrame(moveRaf)
        moveRaf = requestAnimationFrame(() => {
          const c = compute(el)
          if (c) setTip(t => (t ? { ...t, r: c.r, dir: c.dir } : t))
        })
      }
    }
    function onOut(e) {
      const el = e.target.closest('[data-tip]')
      if (el && !el.contains(e.relatedTarget)) setTip(null)
    }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  if (!tip) return null

  const { r, dir } = tip
  const centerX = r.left + r.width / 2
  const centerY = r.top + r.height / 2
  const GAP = 8

  let pos
  if (dir === 'top') pos = { left: centerX, top: r.top - GAP, transform: 'translate(-50%, -100%)' }
  else if (dir === 'bottom') pos = { left: centerX, top: r.bottom + GAP, transform: 'translate(-50%, 0)' }
  else if (dir === 'left') pos = { left: r.left - GAP, top: centerY, transform: 'translate(-100%, -50%)' }
  else pos = { left: r.right + GAP, top: centerY, transform: 'translate(0, -50%)' }

  const ARROW = 'rgba(26,22,37,0.92)'
  const triBase = { position: 'absolute', width: 0, height: 0, border: '5px solid transparent' }
  const arrowEl =
    dir === 'top' ? <span style={{ ...triBase, borderTop: `6px solid ${ARROW}`, left: '50%', bottom: '-6px', transform: 'translateX(-50%)' }} />
    : dir === 'bottom' ? <span style={{ ...triBase, borderBottom: `6px solid ${ARROW}`, left: '50%', top: '-6px', transform: 'translateX(-50%)' }} />
    : dir === 'left' ? <span style={{ ...triBase, borderLeft: `6px solid ${ARROW}`, top: '50%', right: '-6px', transform: 'translateY(-50%)' }} />
    : <span style={{ ...triBase, borderRight: `6px solid ${ARROW}`, top: '50%', left: '-6px', transform: 'translateY(-50%)' }} />

  return (
    <div className="fixed z-[2147483000] pointer-events-none" style={pos}>
      <div
        className="px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-semibold text-white/95 whitespace-nowrap"
        style={{ background: ARROW, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(167,139,250,0.08)' }}
      >
        {tip.text}
        {arrowEl}
      </div>
    </div>
  )
}
