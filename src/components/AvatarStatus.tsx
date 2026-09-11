import type { AvatarState } from '../types/gemini'

const LABELS: Record<AvatarState, string> = {
  idle: 'Inattivo',
  connecting: 'Connessione in corso…',
  listening: 'In ascolto…',
  speaking: 'Sto rispondendo…',
  error: 'Errore',
}

const RING: Record<AvatarState, string> = {
  idle: 'ring-line',
  connecting: 'ring-accent',
  listening: 'ring-accent',
  speaking: 'ring-emerald-400',
  error: 'ring-danger',
}

const CORE: Record<AvatarState, string> = {
  idle: 'bg-line',
  connecting: 'bg-accent',
  listening: 'bg-accent',
  speaking: 'bg-emerald-400',
  error: 'bg-danger',
}

const LABEL_COLOR: Record<AvatarState, string> = {
  idle: 'text-slate-400',
  connecting: 'text-accent',
  listening: 'text-accent',
  speaking: 'text-emerald-300',
  error: 'text-danger',
}

interface AvatarStatusProps {
  state: AvatarState
}

export function AvatarStatus({ state }: AvatarStatusProps) {
  const pulsing = state === 'listening' || state === 'connecting'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-32 w-32 items-center justify-center">
        {pulsing && (
          <span
            className={`avatar-pulse absolute inset-0 rounded-full border-2 ${RING[state]}`}
          />
        )}

        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 ${RING[state]}`}
        >
          {state === 'speaking' ? (
            <div className="flex h-10 items-end gap-1">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className="equalize-bar w-2 rounded-full bg-emerald-400"
                  style={{
                    height: `${12 + (bar % 3) * 8}px`,
                    animationDelay: `${bar * 0.12}s`,
                    animationDuration: `${0.8 + (bar % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <span className={`h-12 w-12 rounded-full ${CORE[state]}`} />
          )}
        </div>
      </div>

      <span className={`text-sm font-medium ${LABEL_COLOR[state]}`}>
        {LABELS[state]}
      </span>
    </div>
  )
}
