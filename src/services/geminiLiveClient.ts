import { GEMINI_LIVE_ENDPOINT, INPUT_MIME_TYPE } from '../config'
import type {
  ClientContentMessage,
  RealtimeInputMessage,
  ServerMessage,
  SetupMessage,
} from '../types/gemini'

export type ClientStatus = 'connecting' | 'open' | 'closed' | 'error'

export interface GeminiLiveClientOptions {
  apiKey: string
  model: string
  systemInstruction: string
  voiceName: string
  onStatusChange: (status: ClientStatus) => void
  onMessage: (message: ServerMessage) => void
  onError: (error: Error) => void
  onClose: (code: number, reason: string) => void
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private readonly options: GeminiLiveClientOptions
  private setupComplete = false

  constructor(options: GeminiLiveClientOptions) {
    this.options = options
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(): void {
    const url = `${GEMINI_LIVE_ENDPOINT}?key=${encodeURIComponent(this.options.apiKey.trim())}`

    this.options.onStatusChange('connecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch {
      this.options.onError(new Error('Impossibile aprire la connessione WebSocket.'))
      this.options.onStatusChange('error')
      return
    }

    this.ws = socket
    this.setupComplete = false

    socket.onopen = () => {
      this.options.onStatusChange('open')
      this.sendSetup()
    }

    socket.onmessage = async (event: MessageEvent) => {
      let raw: string

      try {
        if (typeof event.data === 'string') {
          raw = event.data
        } else if (event.data instanceof Blob) {
          raw = await event.data.text()
        } else if (event.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(event.data)
        } else if (ArrayBuffer.isView(event.data)) {
          raw = new TextDecoder().decode(event.data)
        } else {
          console.error('Tipo di payload WebSocket non supportato:', event.data)
          return
        }
      } catch (error) {
        console.error('Errore nella lettura del payload WebSocket:', error)
        return
      }

      let message: ServerMessage
      try {
        message = JSON.parse(raw) as ServerMessage
      } catch (error) {
        console.error('Payload grezzo ricevuto:', event.data)
        console.error('Errore di parsing JSON:', error)
        return
      }

      if ('setupComplete' in message) {
        this.setupComplete = true
        console.log('Gemini Live Setup completato con successo.')
      }

      this.options.onMessage(message)
    }

    socket.onerror = () => {
      this.options.onStatusChange('error')
    }

    socket.onclose = (event: CloseEvent) => {
      this.setupComplete = false
      this.options.onClose(event.code, event.reason)
      this.options.onStatusChange('closed')
    }
  }

  sendAudioChunk(base64Pcm: string): void {
    if (!this.isOpen || !this.setupComplete) {
      return
    }

    const message: RealtimeInputMessage = {
      realtimeInput: {
        mediaChunks: [{ mimeType: INPUT_MIME_TYPE, data: base64Pcm }],
      },
    }

    this.send(message)
  }

  sendText(text: string): void {
    if (!this.isOpen || !this.setupComplete) {
      return
    }

    const message: ClientContentMessage = {
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    }

    this.send(message)
  }

  disconnect(): void {
    const socket = this.ws
    this.ws = null
    this.setupComplete = false
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
  }

  private sendSetup(): void {
    const setupMessage: SetupMessage = {
      setup: {
        model: this.options.model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.options.voiceName,
              },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.options.systemInstruction }],
        },
      },
    }

    this.send(setupMessage)
  }

  private send(payload: SetupMessage | RealtimeInputMessage | ClientContentMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}
