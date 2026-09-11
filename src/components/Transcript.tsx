import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../types/gemini'

interface TranscriptProps {
  entries: TranscriptEntry[]
  showVoiceFeedback: boolean
}

export function Transcript({ entries, showVoiceFeedback }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries, showVoiceFeedback])

  if (entries.length === 0 && !showVoiceFeedback) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        La trascrizione della conversazione apparirà qui.
      </p>
    )
  }

  return (
    <div ref={scrollRef} className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
      {entries.map((entry, index) => (
        <div
          key={index}
          className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div className="flex max-w-[85%] flex-col gap-1">
            <span
              className={`text-xs font-medium ${
                entry.role === 'user' ? 'text-right text-accent' : 'text-slate-400'
              }`}
            >
              {entry.role === 'user' ? 'Tu:' : 'Centro Medico:'}
            </span>
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                entry.role === 'user'
                  ? 'bg-accent-soft text-accent'
                  : 'bg-panel-2 text-slate-200'
              }`}
            >
              {entry.text}
            </div>
          </div>
        </div>
      ))}

      {showVoiceFeedback && (
        <div className="flex justify-start">
          <div className="flex max-w-[85%] flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Centro Medico:</span>
            <div className="flex items-center gap-2 rounded-2xl bg-panel-2 px-4 py-2.5 text-sm text-slate-300">
              <span className="flex items-end gap-0.5">
                {[0, 1, 2].map((bar) => (
                  <span
                    key={bar}
                    className="equalize-bar inline-block h-3 w-1 rounded-full bg-accent"
                    style={{ animationDelay: `${bar * 0.15}s` }}
                  />
                ))}
              </span>
              <span>[Risposta vocale in corso...]</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
