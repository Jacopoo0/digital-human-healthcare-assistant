import { useEffect, type RefObject } from 'react'
import type { SimliStatus } from '../services/simliService'

interface SimliVideoProps {
  videoRef: RefObject<HTMLVideoElement | null>
  audioRef: RefObject<HTMLAudioElement | null>
  status: SimliStatus
}

export function SimliVideo({ videoRef, audioRef, status }: SimliVideoProps) {
  useEffect(() => {
    if (status === 'connected') {
      videoRef.current?.play().catch((cause) => {
        console.warn('[SIMLI_DEBUG] play() bloccato dal browser:', cause)
      })
    }
  }, [status, videoRef])

  const showOverlay = status !== 'connected'

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        id="simliVideo"
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          showOverlay ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <audio ref={audioRef} autoPlay muted className="hidden" />

      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
          {status === 'error' ? (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <span className="text-sm text-danger">Avatar video non disponibile</span>
              <span className="text-xs text-slate-400">
                Proseguo in modalità solo audio.
              </span>
            </div>
          ) : status === 'connecting' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <span className="text-xs text-slate-400">Connessione avatar…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-xs text-slate-400">Avatar video</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
