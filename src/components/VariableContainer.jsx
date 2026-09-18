import { useState } from 'react'

function parseRules(rulesStr) {
  if (!rulesStr) return []
  return rulesStr.split('|').map(r => r.trim())
}

function VariableContainer({ variable, value, onChange, theme }) {
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'
  const inputBg = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
  const inputBorder = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const rules = parseRules(variable.rules)
  const isRequired = rules.includes('required')
  const description = variable.description?.split('\n')[0] || ''

  const inRule = rules.find(r => r.startsWith('in:'))
  const isBoolean = rules.includes('boolean') ||
    (rules.includes('string') && (rules.includes('in:1,0') || rules.includes('in:0,1') || rules.includes('in:true,false') || rules.includes('in:false,true')))
  const isNumber = rules.includes('integer') || rules.includes('int') || rules.includes('numeric') || rules.includes('num')
  const isDropdown = !!inRule && !isBoolean
  const isSecret = variable.isSecret

  if (isBoolean) {
    const boolValue = value === '1' || value === 'true'
    return (
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: labelColor }}>
            {variable.name}
            {isRequired && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <button
            onClick={() => onChange(boolValue ? '0' : '1')}
            className="relative w-9 h-5 rounded-full transition-colors"
            style={{ background: boolValue ? '#a78bfa' : inputBorder }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
              style={{ left: boolValue ? '18px' : '2px' }}
            />
          </button>
        </div>
        {description && <p className="text-[10px] mt-1" style={{ color: labelColor }}>{description}</p>}
      </div>
    )
  }

  if (isDropdown) {
    const options = inRule.replace('in:', '').split(',').map(o => o.trim())
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: labelColor }}>
          {variable.name}
          {isRequired && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: labelColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {description && <p className="text-[10px] mt-1" style={{ color: labelColor }}>{description}</p>}
      </div>
    )
  }

  if (isNumber) {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: labelColor }}>
          {variable.name}
          {isRequired && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
          placeholder={variable.default_value || ''}
        />
        {description && <p className="text-[10px] mt-1" style={{ color: labelColor }}>{description}</p>}
      </div>
    )
  }

  if (isSecret) {
    const [show, setShow] = useState(false)
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: labelColor }}>
          {variable.name}
          {isRequired && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 pr-9 rounded-lg text-sm outline-none"
            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
          />
          <button
            onClick={() => setShow(!show)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: labelColor }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {show
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              }
            </svg>
          </button>
        </div>
        {description && <p className="text-[10px] mt-1" style={{ color: labelColor }}>{description}</p>}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: labelColor }}>
        {variable.name}
        {isRequired && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-8 rounded-lg text-sm outline-none"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor }}
          placeholder={variable.default_value || ''}
        />
        {variable.default_value && value !== variable.default_value && (
          <button
            onClick={() => onChange(variable.default_value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0.5 rounded"
            style={{ color: '#a78bfa' }}
            title="Reset to default"
          >
            ↺
          </button>
        )}
      </div>
      {description && <p className="text-[10px] mt-1" style={{ color: labelColor }}>{description}</p>}
    </div>
  )
}

export default VariableContainer
