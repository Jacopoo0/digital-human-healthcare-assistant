import { AUDIO_CHUNK_MS, INPUT_SAMPLE_RATE } from '../config'
import { floatToInt16, int16ToBase64 } from './audioUtils'

export interface AudioInputCallbacks {
  onChunk: (base64Pcm: string) => void
  onError: (error: Error) => void
}

export class AudioInputService {
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private callbacks: AudioInputCallbacks | null = null

  get isRunning(): boolean {
    return this.audioContext !== null
  }

  async start(callbacks: AudioInputCallbacks): Promise<void> {
    if (this.audioContext) {
      return
    }

    this.callbacks = callbacks

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (cause) {
      const error =
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? new Error('Permesso microfono negato. Concedi l’accesso al microfono e riprova.')
          : new Error('Impossibile accedere al microfono. Verifica che sia collegato e disponibile.')
      this.callbacks?.onError(error)
      this.callbacks = null
      throw error
    }

    this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })

    try {
      await this.audioContext.audioWorklet.addModule('/pcm-worklet.js')
    } catch {
      const error = new Error('Errore nel caricamento del processore audio.')
      await this.cleanup()
      this.callbacks?.onError(error)
      this.callbacks = null
      throw error
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      processorOptions: {
        targetSampleRate: INPUT_SAMPLE_RATE,
        chunkSize: Math.round((INPUT_SAMPLE_RATE * AUDIO_CHUNK_MS) / 1000),
      },
    })

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const float32 = event.data
      const int16 = floatToInt16(float32)
      this.callbacks?.onChunk(int16ToBase64(int16))
    }

    this.sourceNode.connect(this.workletNode)
    await this.audioContext.resume()
  }

  async stop(): Promise<void> {
    await this.cleanup()
    this.callbacks = null
  }

  private async cleanup(): Promise<void> {
    this.workletNode?.port.close()
    this.workletNode?.disconnect()
    this.workletNode = null
    this.sourceNode?.disconnect()
    this.sourceNode = null

    const context = this.audioContext
    this.audioContext = null
    if (context && context.state !== 'closed') {
      await context.close()
    }

    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}
