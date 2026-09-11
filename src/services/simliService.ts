import {
  LogLevel,
  SimliClient,
  generateIceServers,
  generateSimliSessionToken,
} from 'simli-client'
import { DEFAULT_SIMLI_FACE_ID, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from '../config'
import { base64ToInt16, floatToInt16, int16ToFloat32, resampleLinear } from './audioUtils'

export type SimliStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface SimliCallbacks {
  onStatusChange: (status: SimliStatus) => void
  onError: (error: Error) => void
}

function normalizeSimliError(cause: unknown): Error {
  if (cause instanceof Error) {
    return cause
  }
  const text = String(cause)
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string; detail?: string }
    const message = parsed.message || parsed.error || parsed.detail
    if (message) {
      return new Error(message)
    }
  } catch {
    // il payload non è JSON: usiamo il testo grezzo
  }
  return new Error(text)
}

export class SimliService {
  private client: SimliClient | null = null
  private hasSentAudio = false

  async start(
    apiKey: string,
    faceId: string,
    videoElement: HTMLVideoElement,
    audioElement: HTMLAudioElement,
    callbacks: SimliCallbacks,
  ): Promise<void> {
    const resolvedFaceId = (faceId || DEFAULT_SIMLI_FACE_ID).trim()
    callbacks.onStatusChange('connecting')
    console.log('[SIMLI_DEBUG] avvio sessione — faceId:', resolvedFaceId)

    try {
      const { session_token } = await generateSimliSessionToken({
        config: {
          faceId: resolvedFaceId,
          handleSilence: true,
          maxSessionLength: 3600,
          maxIdleTime: 300,
        },
        apiKey: apiKey.trim(),
      })
      console.log('[SIMLI_DEBUG] session_token ottenuto')

      const iceServers = await generateIceServers(apiKey.trim())
      console.log('[SIMLI_DEBUG] ICE servers ricevuti:', iceServers.length)

      const client = new SimliClient(
        session_token,
        videoElement,
        audioElement,
        iceServers,
        LogLevel.ERROR,
      )
      this.client = client

      client.on('start', () => {
        console.log('[SIMLI_DEBUG] avatar video connesso')
        callbacks.onStatusChange('connected')
      })
      client.on('speaking', () => console.log('[SIMLI_DEBUG] avatar speaking'))
      client.on('silent', () => console.log('[SIMLI_DEBUG] avatar silent'))
      client.on('error', (detail: string) => {
        console.error('[SIMLI_DEBUG] errore Simli:', detail)
        callbacks.onStatusChange('error')
        callbacks.onError(new Error(detail || 'Errore Simli'))
      })
      client.on('startup_error', (detail: string) => {
        console.error('[SIMLI_DEBUG] startup error:', detail)
        callbacks.onStatusChange('error')
        callbacks.onError(new Error(detail || 'Errore di avvio Simli'))
      })

      console.log('[SIMLI_DEBUG] connessione WebRTC in corso…')
      await client.start()
      console.log('[SIMLI_DEBUG] client.start() completato')
    } catch (cause) {
      const error = normalizeSimliError(cause)
      console.error('[SIMLI_DEBUG] avvio fallito:', error.message)
      await this.stop()
      callbacks.onStatusChange('error')
      callbacks.onError(error)
      throw error
    }
  }

  sendPcm24kBase64(base64Pcm: string): void {
    const client = this.client
    if (!client) {
      return
    }

    const int16 = base64ToInt16(base64Pcm)
    if (int16.length === 0) {
      return
    }

    const float32 = int16ToFloat32(int16)
    const resampled = resampleLinear(float32, OUTPUT_SAMPLE_RATE, INPUT_SAMPLE_RATE)
    const pcm16 = floatToInt16(resampled)
    client.sendAudioData(new Uint8Array(pcm16.buffer))

    if (!this.hasSentAudio) {
      console.log('[SIMLI_DEBUG] primo chunk audio inoltrato (PCM16 16kHz)')
      this.hasSentAudio = true
    }
  }

  async stop(): Promise<void> {
    const client = this.client
    this.client = null
    this.hasSentAudio = false
    if (client) {
      console.log('[SIMLI_DEBUG] chiusura sessione')
      try {
        await client.stop()
      } catch (cause) {
        console.warn('[SIMLI_DEBUG] errore in stop():', cause)
      }
    }
  }
}
