import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Eye, EyeOff, Check, X, Loader2, Mail, User, Lock, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTranslation } from '@/lib/translations'

type Mode = 'login' | 'register' | 'verify'
type RegisterRole = 'guest' | 'agent'

// ── Password strength ─────────────────────────────────────────────────────────

interface PwStrength {
  minLength: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  score: number
}

function getPwStrength(pw: string): PwStrength {
  const minLength = pw.length >= 8
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const score = [minLength, hasUpper, hasLower, hasNumber].filter(Boolean).length
  return { minLength, hasUpper, hasLower, hasNumber, score }
}

function isPwValid(s: PwStrength) {
  return s.minLength && s.hasUpper && s.hasLower && s.hasNumber
}

// ── Reusable field ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: React.ReactNode
  error?: string
  hint?: React.ReactNode
  autoFocus?: boolean
  maxLength?: number
}

const Field: React.FC<FieldProps> = ({
  label, type = 'text', value, onChange, placeholder, icon, error, hint, autoFocus, maxLength,
}) => (
  <div>
    <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4">
          {icon}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className={`
          w-full bg-white/[0.05] border rounded-lg py-2.5 text-sm text-white
          placeholder-neutral-600 outline-none transition-colors
          ${icon ? 'pl-10 pr-4' : 'px-4'}
          ${error
            ? 'border-red-500/60 focus:border-red-500'
            : 'border-white/[0.08] focus:border-primary-500/60'
          }
        `}
      />
    </div>
    {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    {hint && !error && <div className="mt-1">{hint}</div>}
  </div>
)

// ── PasswordField with show/hide ──────────────────────────────────────────────

interface PwFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
  showStrength?: boolean
}

const PwField: React.FC<PwFieldProps> = ({ label, value, onChange, placeholder, error, showStrength }) => {
  const [show, setShow] = useState(false)
  const strength = getPwStrength(value)

  const barColor = (score: number) => {
    if (score <= 1) return 'bg-red-500'
    if (score === 2) return 'bg-yellow-500'
    if (score === 3) return 'bg-blue-500'
    return 'bg-green-500'
  }
  const { t } = useTranslation()
  const pw = t.login.pwStrength
  const barLabel = ['', pw.weak, pw.weak, pw.medium, pw.strong]

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full bg-white/[0.05] border rounded-lg py-2.5 text-sm text-white
            placeholder-neutral-600 outline-none transition-colors pl-10 pr-10
            ${error
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-white/[0.08] focus:border-primary-500/60'
            }
          `}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {showStrength && value.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {/* Strength bar */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  n <= strength.score ? barColor(strength.score) : 'bg-white/10'
                }`}
              />
            ))}
            <span className={`text-xs ml-1 ${barColor(strength.score).replace('bg-', 'text-')}`}>
              {barLabel[strength.score]}
            </span>
          </div>
          {/* Criteria */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {[
              { ok: strength.minLength, label: t.login.pwCriteria.minLength },
              { ok: strength.hasUpper,  label: t.login.pwCriteria.uppercase },
              { ok: strength.hasLower,  label: t.login.pwCriteria.lowercase },
              { ok: strength.hasNumber, label: t.login.pwCriteria.number },
            ].map(({ ok, label }) => (
              <span key={label} className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-neutral-500'}`}>
                {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CheckMark for availability ────────────────────────────────────────────────

interface AvailStatus {
  checking: boolean
  available: boolean | null
  error: string
}

function AvailBadge({ status }: { status: AvailStatus }) {
  if (status.checking) return <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
  if (status.available === true) return <Check className="w-3 h-3 text-green-400" />
  if (status.available === false) return <X className="w-3 h-3 text-red-400" />
  return null
}

// ── Main LoginPage ────────────────────────────────────────────────────────────

const LoginPage: React.FC = () => {
  const { login, register, verifyEmail, resendCode, isLoading } = useAuthStore()
  const { t } = useTranslation()
  const lt = t.login

  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<RegisterRole>('guest')
  const [pendingEmail, setPendingEmail] = useState('')
  const [error, setError] = useState('')

  // Login form
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')

  // Register form
  const [regEmail, setRegEmail] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPw, setRegPw] = useState('')
  const [regPwConfirm, setRegPwConfirm] = useState('')

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Availability status
  const [emailStatus, setEmailStatus] = useState<AvailStatus>({ checking: false, available: null, error: '' })
  const [usernameStatus, setUsernameStatus] = useState<AvailStatus>({ checking: false, available: null, error: '' })

  // Verify form
  const [code, setCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Debounced availability checks ─────────────────────────────────────────

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkEmail = useCallback((email: string) => {
    if (emailTimer.current) clearTimeout(emailTimer.current)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus({ checking: false, available: null, error: '' })
      return
    }
    setEmailStatus(s => ({ ...s, checking: true }))
    emailTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        setEmailStatus({ checking: false, available: data.available, error: data.error || '' })
      } catch {
        setEmailStatus({ checking: false, available: null, error: '' })
      }
    }, 500)
  }, [])

  const checkUsername = useCallback((username: string) => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, error: '' })
      return
    }
    setUsernameStatus(s => ({ ...s, checking: true }))
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
        const data = await res.json()
        setUsernameStatus({ checking: false, available: data.available, error: data.error || '' })
      } catch {
        setUsernameStatus({ checking: false, available: null, error: '' })
      }
    }, 500)
  }, [])

  useEffect(() => { if (role === 'guest') checkEmail(regEmail) }, [regEmail, role, checkEmail])
  useEffect(() => { if (role === 'agent') checkUsername(regUsername) }, [regUsername, role, checkUsername])

  // ── Cooldown timer ────────────────────────────────────────────────────────

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return s - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function clearErrors() { setError(''); setFieldErrors({}) }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()
    if (!loginId.trim()) { setFieldErrors({ loginId: lt.errors.requireAccount }); return }
    if (!loginPw) { setFieldErrors({ loginPw: lt.errors.requirePassword }); return }

    try {
      await login(loginId.trim(), loginPw)
      // useAuthStore updates user → AppRoot re-renders → redirect happens automatically
    } catch (err: unknown) {
      const e = err as { message?: string; requiresVerification?: boolean; email?: string }
      if (e.requiresVerification && e.email) {
        setPendingEmail(e.email)
        setMode('verify')
      } else {
        setError(e.message || lt.errors.loginFailed)
      }
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()

    const pwStrength = getPwStrength(regPw)
    if (!isPwValid(pwStrength)) {
      setFieldErrors({ regPw: lt.errors.passwordInvalid })
      return
    }
    if (regPw !== regPwConfirm) {
      setFieldErrors({ regPwConfirm: lt.errors.passwordMismatch })
      return
    }

    if (role === 'guest') {
      if (!regEmail.trim()) { setFieldErrors({ regEmail: lt.errors.requireEmail }); return }
      if (emailStatus.available === false) { setFieldErrors({ regEmail: emailStatus.error || lt.emailTaken }); return }
    } else {
      if (!regUsername.trim()) { setFieldErrors({ regUsername: lt.errors.requireUsername }); return }
      if (usernameStatus.available === false) { setFieldErrors({ regUsername: usernameStatus.error || lt.usernameTaken }); return }
    }

    try {
      const result = await register({
        role,
        password: regPw,
        email: role === 'guest' ? regEmail.trim().toLowerCase() : undefined,
        username: role === 'agent' ? regUsername.trim() : undefined,
      })

      if (result.requiresVerification && result.email) {
        setPendingEmail(result.email)
        setMode('verify')
        startCooldown()
      }
      // Agent: store updated → redirect handled by AppRoot
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || lt.errors.registerFailed)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()
    if (code.trim().length !== 6) { setFieldErrors({ code: lt.errors.invalidCode }); return }

    try {
      await verifyEmail(pendingEmail, code.trim())
      // user updated → redirect
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || lt.errors.verifyFailed)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    clearErrors()
    try {
      await resendCode(pendingEmail)
      startCooldown()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || lt.errors.sendFailed)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const switchMode = (m: Mode) => { clearErrors(); setCode(''); setMode(m) }

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/bornfly_logo.png" alt="Bornfly" className="h-8 w-auto" />
            <span className="text-xl font-semibold text-white tracking-wide">Egonetics</span>
          </div>
          <p className="text-sm text-neutral-500">{lt.tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* ── Login ─────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <h2 className="text-lg font-semibold text-white">{lt.loginTitle}</h2>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Field
                label={lt.accountLabel}
                value={loginId}
                onChange={setLoginId}
                placeholder={lt.accountPlaceholder}
                icon={<User className="w-4 h-4" />}
                error={fieldErrors.loginId}
                autoFocus
              />

              <PwField
                label={lt.passwordLabel}
                value={loginPw}
                onChange={setLoginPw}
                placeholder={lt.passwordPlaceholder}
                error={fieldErrors.loginPw}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50
                           disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg
                           transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {lt.loginButton}
              </button>

              <p className="text-center text-sm text-neutral-500">
                {lt.noAccount}{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {lt.registerLink}
                </button>
              </p>
            </form>
          )}

          {/* ── Register ──────────────────────────────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <h2 className="text-lg font-semibold text-white">{lt.registerTitle}</h2>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Role selector */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">{lt.roleLabel}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['guest', 'agent'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRole(r); clearErrors() }}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors border
                        ${role === r
                          ? 'bg-primary-600/30 border-primary-500/50 text-primary-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:border-white/20'
                        }`}
                    >
                      {r === 'guest' ? lt.guestRole : lt.agentRole}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-neutral-600">
                  {role === 'guest' ? lt.guestDesc : lt.agentDesc}
                </p>
              </div>

              {/* Guest: email */}
              {role === 'guest' && (
                <Field
                  label={lt.emailLabel}
                  type="email"
                  value={regEmail}
                  onChange={setRegEmail}
                  placeholder={lt.emailPlaceholder}
                  icon={<Mail className="w-4 h-4" />}
                  error={fieldErrors.regEmail || (emailStatus.available === false ? (emailStatus.error || lt.emailTaken) : '')}
                  hint={
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <AvailBadge status={emailStatus} />
                      {emailStatus.available === true && <span className="text-green-400">{lt.emailAvailable}</span>}
                    </span>
                  }
                  autoFocus
                />
              )}

              {/* Agent: username */}
              {role === 'agent' && (
                <Field
                  label={lt.usernameLabel}
                  value={regUsername}
                  onChange={setRegUsername}
                  placeholder={lt.usernamePlaceholder}
                  icon={<User className="w-4 h-4" />}
                  maxLength={20}
                  error={fieldErrors.regUsername || (usernameStatus.available === false ? (usernameStatus.error || lt.usernameTaken) : '')}
                  hint={
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <AvailBadge status={usernameStatus} />
                      {usernameStatus.available === true && <span className="text-green-400">{lt.usernameAvailable}</span>}
                    </span>
                  }
                  autoFocus
                />
              )}

              <PwField
                label={lt.passwordLabel}
                value={regPw}
                onChange={setRegPw}
                placeholder={lt.passwordHintPlaceholder}
                error={fieldErrors.regPw}
                showStrength
              />

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">{lt.confirmPasswordLabel}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
                  <input
                    type="password"
                    value={regPwConfirm}
                    onChange={e => setRegPwConfirm(e.target.value)}
                    placeholder={lt.confirmPasswordPlaceholder}
                    className={`
                      w-full bg-white/[0.05] border rounded-lg py-2.5 text-sm text-white
                      placeholder-neutral-600 outline-none transition-colors pl-10 pr-4
                      ${fieldErrors.regPwConfirm
                        ? 'border-red-500/60'
                        : regPwConfirm && regPwConfirm === regPw
                          ? 'border-green-500/40'
                          : 'border-white/[0.08] focus:border-primary-500/60'}
                    `}
                  />
                  {regPwConfirm && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {regPwConfirm === regPw
                        ? <Check className="w-4 h-4 text-green-400" />
                        : <X className="w-4 h-4 text-red-400" />}
                    </span>
                  )}
                </div>
                {fieldErrors.regPwConfirm && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.regPwConfirm}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50
                           disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg
                           transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {role === 'guest' ? lt.guestSubmit : lt.agentSubmit}
              </button>

              <p className="text-center text-sm text-neutral-500">
                {lt.hasAccount}{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {lt.loginLink}
                </button>
              </p>
            </form>
          )}

          {/* ── Verify Email ───────────────────────────────────────────── */}
          {mode === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <h2 className="text-lg font-semibold text-white">{lt.verifyTitle}</h2>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-300">
                  {lt.verifyCodeSent}
                </p>
                <p className="text-sm font-medium text-white mt-0.5">{pendingEmail}</p>
                <p className="text-xs text-blue-400/70 mt-1">{lt.verifyValidity}</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">{lt.codeLabel}</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={lt.codePlaceholder}
                  autoFocus
                  className={`
                    w-full bg-white/[0.05] border rounded-lg py-3 px-4 text-center
                    text-2xl font-mono font-bold tracking-[0.5em] text-white
                    placeholder-neutral-700 outline-none transition-colors
                    ${fieldErrors.code
                      ? 'border-red-500/60'
                      : 'border-white/[0.08] focus:border-primary-500/60'}
                  `}
                />
                {fieldErrors.code && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.code}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50
                           disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg
                           transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {lt.verifyButton}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {lt.backToEdit}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300
                             disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `${lt.resend} (${resendCooldown}s)` : lt.resend}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
