import { useId, useState } from 'react'

interface ApiKeyInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  placeholder?: string
  minLength?: number
}

export function ApiKeyInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  minLength,
}: ApiKeyInputProps) {
  const [revealed, setRevealed] = useState(false)
  const inputId = useId()

  const trimmed = value.trim()
  const hasContent = trimmed.length > 0
  const tooShort = minLength !== undefined && hasContent && trimmed.length < minLength
  const hasSpace = /\s/.test(trimmed)
  const valid = !tooShort && !hasSpace

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-xl border bg-panel-2 px-4 py-3 pr-12 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2 disabled:opacity-50 ${
            valid
              ? 'border-line focus:ring-accent/40'
              : 'border-danger/60 focus:ring-danger/40'
          }`}
        />

        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          disabled={disabled}
          aria-label={revealed ? 'Nascondi chiave' : 'Mostra chiave'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
        >
          {revealed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {!valid && (
        <p className="text-xs text-danger">
          {tooShort
            ? `La chiave deve avere almeno ${minLength} caratteri.`
            : 'La chiave non deve contenere spazi.'}
        </p>
      )}
    </div>
  )
}
