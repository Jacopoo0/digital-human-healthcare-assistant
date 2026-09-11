export interface SpeechRecognitionCallbacks {
  onResult: (text: string) => void
  onError: (message: string) => void
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export class SpeechRecognitionService {
  private recognition: SpeechRecognitionLike | null = null
  private callbacks: SpeechRecognitionCallbacks | null = null
  private running = false

  start(callbacks: SpeechRecognitionCallbacks): void {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      console.warn('[STT] SpeechRecognition non supportato in questo browser.')
      callbacks.onError('Trascrizione vocale non supportata dal browser.')
      return
    }

    const recognition = new Ctor()
    recognition.lang = 'it-IT'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal && result.length > 0) {
          const text = result[0].transcript.trim()
          if (text) {
            this.callbacks?.onResult(text)
          }
        }
      }
    }

    recognition.onerror = (event) => {
      console.warn('[STT] errore riconoscimento:', event.error)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.callbacks?.onError('Permesso microfono negato per la trascrizione.')
      }
    }

    recognition.onend = () => {
      if (this.running && this.recognition === recognition) {
        try {
          recognition.start()
        } catch {
          // il riavvio automatico può fallire in caso di microfono occupato
        }
      }
    }

    this.callbacks = callbacks
    this.running = true
    try {
      recognition.start()
      console.log('[STT] riconoscimento vocale avviato (it-IT, continuous)')
    } catch (cause) {
      console.warn('[STT] impossibile avviare il riconoscimento:', cause)
    }

    this.recognition = recognition
  }

  stop(): void {
    const recognition = this.recognition
    this.recognition = null
    this.callbacks = null
    this.running = false
    if (recognition) {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        // già fermato
      }
      console.log('[STT] riconoscimento vocale fermato')
    }
  }
}
