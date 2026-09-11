import { useState } from 'react'
import { MAX_VIOLATIONS } from './config'
import { ApiKeyInput } from './components/ApiKeyInput'
import { AvatarStatus } from './components/AvatarStatus'
import { KnowledgeBaseUpload } from './components/KnowledgeBaseUpload'
import { SimliVideo } from './components/SimliVideo'
import { Transcript } from './components/Transcript'
import { ViolationModal } from './components/ViolationModal'
import { useGeminiLive } from './hooks/useGeminiLive'

function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY ?? '')
  const [simliApiKey, setSimliApiKey] = useState(import.meta.env.VITE_SIMLI_API_KEY ?? '')
  const [simliFaceId, setSimliFaceId] = useState(import.meta.env.VITE_SIMLI_FACE_ID ?? '')
  const [kbFileName, setKbFileName] = useState<string | null>(null)
  const [kbContent, setKbContent] = useState('')

  const {
    avatarState,
    error,
    transcript,
    isConnected,
    showVoiceFeedback,
    violationCount,
    handoffActive,
    simliVideoRef,
    simliAudioRef,
    simliStatus,
    simliError,
    connect,
    disconnect,
    dismissHandoff,
    clearSimliError,
    clearTranscript,
  } = useGeminiLive()

  const connected = isConnected || avatarState === 'connecting'
  const simliRequested = simliApiKey.trim().length > 0

  const handleConnect = () => {
    void connect({
      apiKey,
      knowledgeBase: kbContent,
      simliApiKey,
      simliFaceId,
    })
  }

  const handleDisconnect = () => {
    void disconnect()
  }

  return (
    <div className="min-h-full bg-surface text-slate-100">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Digital Human</h1>
            <p className="text-sm text-slate-400">
              Assistente vocale · Centro Medico San Marco
            </p>
          </div>

          {violationCount > 0 && (
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                violationCount >= MAX_VIOLATIONS
                  ? 'border-danger/50 bg-danger/10 text-danger'
                  : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              }`}
            >
              Avvisi di sistema: {violationCount}/{MAX_VIOLATIONS}
            </span>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {simliError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-300"
          >
            <div className="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{simliError}</span>
            </div>
            <button
              type="button"
              onClick={clearSimliError}
              className="shrink-0 text-slate-400 transition hover:text-slate-200"
              aria-label="Chiudi avviso"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-6 rounded-2xl border border-line bg-panel p-6">
            <ApiKeyInput
              label="API Key Gemini"
              value={apiKey}
              onChange={setApiKey}
              disabled={connected}
              placeholder="Inserisci la tua Google API Key"
              minLength={20}
            />

            <ApiKeyInput
              label="API Key Simli (opzionale)"
              value={simliApiKey}
              onChange={setSimliApiKey}
              disabled={connected}
              placeholder="Lascia vuoto per la modalità solo audio"
            />

            <div className="flex flex-col gap-2">
              <label htmlFor="face-id" className="text-sm font-medium text-slate-300">
                Face ID Simli (opzionale)
              </label>
              <input
                id="face-id"
                type="text"
                value={simliFaceId}
                onChange={(event) => setSimliFaceId(event.target.value)}
                disabled={connected}
                placeholder="Usa il volto predefinito se vuoto"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
              />
            </div>

            <KnowledgeBaseUpload
              fileName={kbFileName}
              onFile={(content, name) => {
                setKbContent(content)
                setKbFileName(name)
              }}
              onClear={() => {
                setKbContent('')
                setKbFileName(null)
              }}
              disabled={connected}
            />

            <div className="mt-auto flex gap-3">
              {connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger/20"
                >
                  Termina sessione
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Avvia conversazione
                </button>
              )}
            </div>
          </section>

          <section className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-line bg-panel p-6">
            {simliRequested ? (
              <div className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-black">
                <SimliVideo
                  videoRef={simliVideoRef}
                  audioRef={simliAudioRef}
                  status={simliStatus}
                />
              </div>
            ) : (
              <AvatarStatus state={avatarState} />
            )}

            <p className="max-w-sm text-center text-sm text-slate-400">
              {connected
                ? 'Parla liberamente: Aurora ascolta e risponde in tempo reale.'
                : 'Carica la Knowledge Base e avvia la sessione per iniziare.'}
            </p>
          </section>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Trascrizione</h2>
            <button
              type="button"
              onClick={clearTranscript}
              disabled={transcript.length === 0}
              className="text-xs text-slate-400 transition hover:text-slate-200 disabled:opacity-40"
            >
              Svuota
            </button>
          </div>
          <Transcript entries={transcript} showVoiceFeedback={showVoiceFeedback} />
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">
          Connessione WebSocket bidirezionale a Google Gemini Live · Audio PCM 16 kHz in ingresso, 24 kHz in uscita · Avatar video Simli opzionale.
        </footer>
      </div>

      <ViolationModal open={handoffActive} onDismiss={dismissHandoff} />
    </div>
  )
}

export default App
