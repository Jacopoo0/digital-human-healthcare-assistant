import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  HANDOFF_FAREWELL,
  HANDOFF_TIMEOUT_MS,
  MAX_VIOLATIONS,
  VIOLATION_MARKER,
} from '../config'
import { AudioInputService } from '../services/audioInputService'
import { AudioOutputService } from '../services/audioOutputService'
import { GeminiLiveClient } from '../services/geminiLiveClient'
import { SimliService, type SimliStatus } from '../services/simliService'
import { SpeechRecognitionService } from '../services/speechRecognitionService'
import { buildSystemInstruction } from '../services/systemPrompt'
import type {
  AvatarState,
  ServerMessage,
  TranscriptEntry,
} from '../types/gemini'

export interface ConnectOptions {
  apiKey: string
  knowledgeBase: string
  simliApiKey: string
  simliFaceId: string
}

export interface UseGeminiLive {
  avatarState: AvatarState
  error: string | null
  transcript: TranscriptEntry[]
  isConnected: boolean
  showVoiceFeedback: boolean
  violationCount: number
  handoffActive: boolean
  simliVideoRef: RefObject<HTMLVideoElement | null>
  simliAudioRef: RefObject<HTMLAudioElement | null>
  simliStatus: SimliStatus
  simliError: string | null
  connect: (options: ConnectOptions) => Promise<void>
  disconnect: () => Promise<void>
  dismissHandoff: () => void
  clearSimliError: () => void
  clearTranscript: () => void
}

function describeClose(code: number, reason: string): string {
  const detail = reason.trim()
  if (detail) {
    return `La connessione è stata chiusa dal server: ${detail}`
  }
  switch (code) {
    case 1000:
      return 'La sessione è stata chiusa dal server.'
    case 1001:
      return 'Il server sta terminando la connessione.'
    case 1006:
      return 'Connessione persa: verifica la rete e riprova.'
    case 1008:
      return 'La richiesta è stata rifiutata dal server.'
    case 1011:
      return 'Errore interno del server.'
    default:
      return `La connessione è stata chiusa (codice ${code}).`
  }
}

function processAssistantText(text: string): { display: string; violations: number } {
  let violations = 0
  let cleaned = text
  while (cleaned.includes(VIOLATION_MARKER)) {
    cleaned = cleaned.replace(VIOLATION_MARKER, ' ')
    violations += 1
  }
  cleaned = cleaned.replace(/^\s*\*\*[^*\n]+\*\*\s*/u, '')
  cleaned = cleaned.replace(/\*\*/g, '')
  const display = cleaned.replace(/\s+/g, ' ').trim()
  return { display, violations }
}

export function useGeminiLive(): UseGeminiLive {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [violationCount, setViolationCount] = useState(0)
  const [handoffActive, setHandoffActive] = useState(false)
  const [simliStatus, setSimliStatus] = useState<SimliStatus>('idle')
  const [simliError, setSimliError] = useState<string | null>(null)
  const [turnHasVisibleText, setTurnHasVisibleText] = useState(false)

  const clientRef = useRef<GeminiLiveClient | null>(null)
  const inputRef = useRef<AudioInputService | null>(null)
  const outputRef = useRef<AudioOutputService | null>(null)
  const simliRef = useRef<SimliService | null>(null)
  const simliVideoRef = useRef<HTMLVideoElement | null>(null)
  const simliAudioRef = useRef<HTMLAudioElement | null>(null)
  const speechRef = useRef<SpeechRecognitionService | null>(null)
  const activeRef = useRef(false)
  const violationCountRef = useRef(0)
  const handingOffRef = useRef(false)
  const handoffTimerRef = useRef<number | null>(null)

  const stopMedia = useCallback(async () => {
    await inputRef.current?.stop()
    inputRef.current = null
    await outputRef.current?.stop()
    outputRef.current = null
    await simliRef.current?.stop()
    simliRef.current = null
    speechRef.current?.stop()
    speechRef.current = null
    setSimliStatus('idle')
    setSimliError(null)
  }, [])

  const teardown = useCallback(
    async (message: string | null, state: AvatarState) => {
      activeRef.current = false
      clientRef.current?.disconnect()
      clientRef.current = null
      await stopMedia()
      if (message !== null) {
        setError(message)
      }
      setAvatarState(state)
    },
    [stopMedia],
  )

  const finalizeHandoff = useCallback(async () => {
    if (handoffTimerRef.current !== null) {
      window.clearTimeout(handoffTimerRef.current)
      handoffTimerRef.current = null
    }
    handingOffRef.current = false
    await teardown(null, 'idle')
    setHandoffActive(true)
  }, [teardown])

  const beginHandoff = useCallback(() => {
    if (handingOffRef.current) {
      return
    }
    handingOffRef.current = true
    setAvatarState('speaking')
    clientRef.current?.sendText(
      `Ripeti ad alta voce, esattamente e senza aggiungere altro: "${HANDOFF_FAREWELL}"`,
    )
    handoffTimerRef.current = window.setTimeout(() => {
      void finalizeHandoff()
    }, HANDOFF_TIMEOUT_MS)
  }, [finalizeHandoff])

  const registerViolation = useCallback(() => {
    const next = violationCountRef.current + 1
    violationCountRef.current = next
    setViolationCount(next)
    if (next >= MAX_VIOLATIONS) {
      beginHandoff()
    }
  }, [beginHandoff])

  const disconnect = useCallback(async () => {
    if (handoffTimerRef.current !== null) {
      window.clearTimeout(handoffTimerRef.current)
      handoffTimerRef.current = null
    }
    handingOffRef.current = false
    violationCountRef.current = 0
    setViolationCount(0)
    setHandoffActive(false)
    await teardown(null, 'idle')
  }, [teardown])

  const appendUserText = useCallback((text: string) => {
    setTranscript((prev) => [...prev, { role: 'user', text }])
  }, [])

  const appendAssistantText = useCallback((text: string) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'model') {
        return [...prev.slice(0, -1), { role: 'model', text: last.text + text }]
      }
      return [...prev, { role: 'model', text }]
    })
  }, [])

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      if ('setupComplete' in message) {
        if (!activeRef.current) {
          return
        }

        inputRef.current
          ?.start({
            onChunk: (base64) => clientRef.current?.sendAudioChunk(base64),
            onError: (err) => {
              void teardown(err.message, 'error')
            },
          })
          .then(() => {
            if (activeRef.current) {
              setAvatarState('listening')
            }
          })
          .catch(() => {
            // L'errore è già stato gestito dal callback onError.
          })
        return
      }

      if ('serverContent' in message) {
        const parts = message.serverContent.modelTurn?.parts ?? []
        for (const part of parts) {
          if ('thought' in part && part.thought) {
            // I pensieri interni di Gemini non devono MAI comparire nella
            // trascrizione né essere riprodotti: li scansioniamo solo per il guardrail.
            const { violations } = processAssistantText(part.text)
            for (let i = 0; i < violations; i += 1) {
              registerViolation()
            }
            continue
          }

          if ('inlineData' in part) {
            outputRef.current?.playPcmChunk(part.inlineData.data)
            simliRef.current?.sendPcm24kBase64(part.inlineData.data)
            setAvatarState('speaking')
          } else if ('text' in part && part.text) {
            const { display } = processAssistantText(part.text)
            if (display) {
              setTurnHasVisibleText(true)
              appendAssistantText(display)
            }
          }
        }
        return
      }

      if ('turnComplete' in message) {
        if (message.turnComplete) {
          setTurnHasVisibleText(false)
          if (activeRef.current) {
            if (handingOffRef.current) {
              void finalizeHandoff()
            } else {
              setAvatarState('listening')
            }
          }
        }
        return
      }

      if ('interrupted' in message) {
        outputRef.current?.reset()
        setTurnHasVisibleText(false)
        if (activeRef.current && !handingOffRef.current) {
          setAvatarState('listening')
        }
      }
    },
    [appendAssistantText, finalizeHandoff, registerViolation, teardown],
  )

  const connect = useCallback(
    async (options: ConnectOptions) => {
      const trimmedKey = options.apiKey.trim()
      if (!trimmedKey) {
        setError('Inserisci una API Key valida per continuare.')
        setAvatarState('error')
        return
      }
      if (trimmedKey.length < 20 || /\s/.test(trimmedKey)) {
        setError('La API Key non sembra valida: deve avere almeno 20 caratteri e nessuno spazio.')
        setAvatarState('error')
        return
      }

      await disconnect()

      setError(null)
      setTranscript([])
      setAvatarState('connecting')

      const input = new AudioInputService()
      const output = new AudioOutputService()
      inputRef.current = input
      outputRef.current = output

      try {
        await output.start()
      } catch {
        void teardown('Impossibile inizializzare l’uscita audio.', 'error')
        return
      }

      const simliKey = options.simliApiKey.trim()
      if (simliKey) {
        setSimliStatus('connecting')
        const videoElement = simliVideoRef.current
        const audioElement = simliAudioRef.current
        if (!videoElement || !audioElement) {
          setSimliStatus('error')
          setSimliError(
            'Elemento video/audio Simli non disponibile: proseguo in modalità solo audio.',
          )
        } else {
          const simli = new SimliService()
          simliRef.current = simli
          void simli
            .start(simliKey, options.simliFaceId.trim(), videoElement, audioElement, {
              onStatusChange: (status) => setSimliStatus(status),
              onError: (err) => {
                setSimliStatus('error')
                setSimliError(err.message)
              },
            })
            .catch((cause) => {
              setSimliStatus('error')
              setSimliError(
                cause instanceof Error ? cause.message : 'Errore Simli sconosciuto.',
              )
            })
        }
      }

      const speech = new SpeechRecognitionService()
      speechRef.current = speech
      speech.start({
        onResult: (text) => appendUserText(text),
        onError: (message) => console.warn('[STT]', message),
      })

      const client = new GeminiLiveClient({
        apiKey: trimmedKey,
        model: DEFAULT_MODEL,
        voiceName: DEFAULT_VOICE,
        systemInstruction: buildSystemInstruction(options.knowledgeBase),
        onStatusChange: () => {
          // Gli stati informativi ('connecting'/'open') non richiedono azioni;
          // la terminazione della connessione è gestita da onClose.
        },
        onClose: (code, reason) => {
          if (!activeRef.current) {
            return
          }
          void teardown(describeClose(code, reason), 'error')
        },
        onMessage: handleMessage,
        onError: (err) => {
          void teardown(err.message, 'error')
        },
      })

      clientRef.current = client
      activeRef.current = true
      client.connect()
    },
    [appendUserText, disconnect, handleMessage, teardown],
  )

  const dismissHandoff = useCallback(() => {
    setHandoffActive(false)
  }, [])

  const clearSimliError = useCallback(() => {
    setSimliError(null)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript([])
  }, [])

  useEffect(() => {
    const active = activeRef
    return () => {
      active.current = false
      clientRef.current?.disconnect()
      clientRef.current = null
      if (handoffTimerRef.current !== null) {
        window.clearTimeout(handoffTimerRef.current)
        handoffTimerRef.current = null
      }
      void inputRef.current?.stop()
      void outputRef.current?.stop()
      void simliRef.current?.stop()
      speechRef.current?.stop()
    }
  }, [])

  return {
    avatarState,
    error,
    transcript,
    isConnected: avatarState === 'listening' || avatarState === 'speaking',
    showVoiceFeedback: avatarState === 'speaking' && !turnHasVisibleText,
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
  }
}
