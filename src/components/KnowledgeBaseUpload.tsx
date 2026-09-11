import { useRef, useState } from 'react'
import { MAX_KB_FILE_SIZE } from '../config'

interface KnowledgeBaseUploadProps {
  fileName: string | null
  onFile: (content: string, name: string) => void
  onClear: () => void
  disabled: boolean
}

export function KnowledgeBaseUpload({
  fileName,
  onFile,
  onClear,
  disabled,
}: KnowledgeBaseUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File | undefined) => {
    setError(null)
    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Seleziona un file di testo (.txt).')
      return
    }

    if (file.size > MAX_KB_FILE_SIZE) {
      setError('Il file supera la dimensione massima di 500 KB.')
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setError('Impossibile leggere il file selezionato.')
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      if (!content.trim()) {
        setError('Il file è vuoto.')
        return
      }
      onFile(content, file.name)
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-300">
        Knowledge Base (documento .txt)
      </span>

      {fileName ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{fileName}</span>
          <button
            type="button"
            onClick={() => {
              onClear()
              if (inputRef.current) {
                inputRef.current.value = ''
              }
            }}
            disabled={disabled}
            className="text-slate-400 transition hover:text-danger disabled:opacity-50"
            aria-label="Rimuovi file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-panel-2 px-4 py-6 text-slate-400 transition hover:border-accent/50 hover:text-slate-200 disabled:opacity-50"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-sm">Carica un file .txt con le informazioni del centro</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      {fileName && (
        <p className="text-xs text-slate-500">
          Il contenuto verrà iniettato nelle istruzioni di sistema al momento della connessione.
        </p>
      )}
    </div>
  )
}
