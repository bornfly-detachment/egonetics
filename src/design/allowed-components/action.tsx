/**
 * Action Components — 行为原语
 * Button / IconButton / PrimaryAction / SecondaryAction /
 * Link / Toggle / Slider / Input / SearchBar
 */
import { useState } from 'react'
import { Search } from 'lucide-react'
import type {
  ButtonProps, IconButtonProps, PrimaryActionProps, SecondaryActionProps,
  LinkProps, ToggleProps, SliderProps, InputProps, SearchBarProps,
} from './types'

export function Button({ label, variant = 'default', size = 'md', disabled, loading, icon }: ButtonProps) {
  const sizeCls = { sm: 'px-2.5 py-1 text-[10px]', md: 'px-3.5 py-1.5 text-[11px]', lg: 'px-5 py-2 text-sm' }[size]
  const variantStyle = {
    default: { background: '#3b82f620', color: '#93c5fd', border: '1px solid #3b82f640' },
    ghost:   { background: 'transparent', color: '#ffffff60', border: '1px solid #ffffff15' },
    danger:  { background: '#ef444418', color: '#fca5a5', border: '1px solid #ef444435' },
  }[variant]
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all
        disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 ${sizeCls}`}
      style={variantStyle}
    >
      {icon && <span className="text-[12px]">{icon}</span>}
      {loading ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : null}
      {label}
    </button>
  )
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md' }: IconButtonProps) {
  const sizeCls = { sm: 'w-6 h-6 text-[11px]', md: 'w-8 h-8 text-sm' }[size]
  const variantStyle = {
    default: { background: '#ffffff10', border: '1px solid #ffffff15', color: '#ffffff70' },
    ghost:   { background: 'transparent', border: 'none', color: '#ffffff40' },
  }[variant]
  return (
    <button
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-lg transition-all hover:opacity-80 ${sizeCls}`}
      style={variantStyle}
    >
      {icon}
    </button>
  )
}

export function PrimaryAction({ label, description, disabled }: PrimaryActionProps) {
  return (
    <button
      disabled={disabled}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl
        text-left transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
      style={{
        background: 'linear-gradient(135deg, #3b82f625, #8b5cf618)',
        border: '1px solid #3b82f640',
      }}
    >
      <div>
        <div className="text-[12px] font-bold text-white/90">{label}</div>
        {description && <div className="text-[10px] text-white/40 mt-0.5">{description}</div>}
      </div>
      <span className="text-white/30 text-base">→</span>
    </button>
  )
}

export function SecondaryAction({ label, disabled }: SecondaryActionProps) {
  return (
    <button
      disabled={disabled}
      className="w-full px-4 py-2 rounded-lg text-[11px] font-medium text-white/50
        bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition-all disabled:opacity-40"
    >
      {label}
    </button>
  )
}

export function Link({ label, href, external, muted }: LinkProps) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`text-[12px] underline underline-offset-2 transition-colors hover:opacity-80
        ${muted ? 'text-white/40' : 'text-blue-400'}`}
    >
      {label}
      {external && <span className="ml-0.5 text-[9px] opacity-60">↗</span>}
    </a>
  )
}

export function Toggle({ label, checked: initialChecked, size = 'md' }: ToggleProps) {
  const [checked, setChecked] = useState(initialChecked ?? false)
  const trackW = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5'
  const knobSz = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const translateX = size === 'sm' ? 'translate-x-4' : 'translate-x-5'
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked(p => !p)}
        className={`relative rounded-full transition-all duration-300 ${trackW}`}
        style={{ background: checked ? '#3b82f6' : '#ffffff20' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${knobSz}
            ${checked ? translateX : 'translate-x-0'}`}
        />
      </button>
      {label && <span className="text-[11px] text-white/60">{label}</span>}
    </label>
  )
}

export function Slider({
  value: initialValue = 0.5, min = 0, max = 1, step = 0.01,
  leftLabel, rightLabel, readOnly,
}: SliderProps) {
  const [value, setValue] = useState(initialValue)
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 rounded-full" style={{ background: '#ffffff10' }}>
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: '#3b82f6' }} />
        {!readOnly && (
          <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => setValue(Number(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          />
        )}
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between">
          {leftLabel  && <span className="text-[8px] text-white/25">{leftLabel}</span>}
          {rightLabel && <span className="text-[8px] text-white/25">{rightLabel}</span>}
        </div>
      )}
    </div>
  )
}

export function Input({ placeholder, value: initialValue, label, type = 'text', disabled }: InputProps) {
  const [value, setValue] = useState(initialValue ?? '')
  return (
    <div className="space-y-1">
      {label && <label className="text-[10px] text-white/40 font-medium">{label}</label>}
      <input
        type={type} value={value} disabled={disabled}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg text-[12px] bg-white/[0.04] border border-white/10
          text-white/80 placeholder-white/20 outline-none focus:border-white/25 transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  )
}

export function SearchBar({ placeholder = '搜索…', value: initialValue }: SearchBarProps) {
  const [value, setValue] = useState(initialValue ?? '')
  return (
    <div className="relative">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[12px] bg-white/[0.04] border border-white/10
          text-white/80 placeholder-white/20 outline-none focus:border-white/25 transition-colors"
      />
    </div>
  )
}
