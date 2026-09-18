import { useState } from 'react'
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useApp } from '../i18n/AppContext'
import { t } from '../i18n/translations'

function getPasswordStrength(pw) {
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a78bfa']
const strengthKeys = ['strength.veryWeak', 'strength.weak', 'strength.fair', 'strength.strong', 'strength.veryStrong']

function StrengthBar({ score, lang }) {
  return (
    <div className="flex gap-1.5 mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-all duration-300"
          style={{
            background: i < score ? strengthColors[Math.min(score, 5)] : 'rgba(255,255,255,0.08)',
          }}
        />
      ))}
      {score > 0 && (
        <span className="text-[11px] ml-1 whitespace-nowrap" style={{ color: strengthColors[Math.min(score, 5)] }}>
          {t(lang, strengthKeys[Math.min(score, 5) - 1])}
        </span>
      )}
    </div>
  )
}

function LoginPage({ onLogin, initialUsername, initialPassword, initialRememberMe }) {
  const { lang, theme } = useApp()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState(initialUsername || '')
  const [password, setPassword] = useState(initialPassword || '')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(initialRememberMe !== undefined ? initialRememberMe : true)

  const isElectron = typeof window !== 'undefined' && window.electronAPI
  const pwScore = getPasswordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError(t(lang, 'login.error.empty'))
      return
    }
    if (password.length < 6) {
      setError(t(lang, 'login.error.shortPassword'))
      return
    }
    if (isRegister && password !== confirmPassword) {
      setError(t(lang, 'login.password.mismatch'))
      return
    }

    setLoading(true)
    setError('')

    try {
      let result
      if (isRegister) {
        result = await window.electronAPI.register(username, password)
        if (!result?.error) {
          result = await window.electronAPI.login(username, password, rememberMe)
        }
      } else {
        result = await window.electronAPI.login(username, password, rememberMe)
      }

      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        onLogin({ user: result.user, session: result.session })
      }
    } catch (err) {
      setError(t(lang, 'login.error.general'))
    } finally {
      setLoading(false)
    }
  }

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'
  const textColor = theme === 'light' ? '#111' : '#fff'
  const labelColor = theme === 'light' ? '#555' : 'rgba(255,255,255,0.6)'

  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: bg }}>
      <div className="relative z-10 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: textColor }}>{t(lang, 'login.title')}</h1>
          <p style={{ color: labelColor }}>{t(lang, 'login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-2" style={{ color: labelColor }}>{t(lang, 'login.username')}</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 pl-10 rounded-lg text-sm outline-none"
                style={{
                  background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                  color: textColor,
                }}
                placeholder={t(lang, 'login.username.placeholder')}
                minLength={3}
                maxLength={16}
                required
              />
              <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: labelColor }}>{t(lang, 'login.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pl-10 pr-12 rounded-lg text-sm outline-none"
                style={{
                  background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                  color: textColor,
                }}
                placeholder={t(lang, 'login.password.placeholder')}
                minLength={6}
                required
              />
              <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: labelColor }}
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {isRegister && password.length > 0 && <StrengthBar score={pwScore} lang={lang} />}
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm mb-2" style={{ color: labelColor }}>{t(lang, 'login.confirmPassword')}</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-10 pr-12 rounded-lg text-sm outline-none"
                  style={{
                    background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                    color: textColor,
                  }}
                  placeholder={t(lang, 'login.confirmPassword.placeholder')}
                  minLength={6}
                  required
                />
                <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: labelColor }} />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: labelColor }}
                >
                  {showConfirm ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[11px] mt-1.5" style={{ color: '#f87171' }}>{t(lang, 'login.password.mismatch')}</p>
              )}
            </div>
          )}

          {!isRegister && (
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded border-2 peer-checked:border-purple-500 peer-checked:bg-purple-500/20 transition-all flex items-center justify-center" style={{ borderColor: theme === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }}>
                  {rememberMe && (
                    <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </label>
              <span className="text-sm select-none" style={{ color: labelColor }}>{t(lang, 'login.rememberMe')}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? t(lang, 'login.processing') : isRegister ? t(lang, 'login.register') : t(lang, 'login.login')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
              setUsername('')
              setPassword('')
              setConfirmPassword('')
            }}
            className="text-sm transition-colors"
            style={{ color: labelColor }}
          >
            {isRegister ? t(lang, 'login.hasAccount') : t(lang, 'login.noAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
