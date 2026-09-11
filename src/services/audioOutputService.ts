import { OUTPUT_LEAD_SECONDS, OUTPUT_SAMPLE_RATE } from '../config'
import { base64ToInt16, int16ToFloat32, resampleLinear } from './audioUtils'

export class AudioOutputService {
  private audioContext: AudioContext | null = null
  private nextPlayTime = 0

  async start(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.nextPlayTime = 0
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  playPcmChunk(base64Pcm: string): void {
    if (!this.audioContext) {
      return
    }

    const int16 = base64ToInt16(base64Pcm)
    if (int16.length === 0) {
      return
    }

    const float32 = int16ToFloat32(int16)
    const resampled = resampleLinear(
      float32,
      OUTPUT_SAMPLE_RATE,
      this.audioContext.sampleRate,
    )

    const buffer = this.audioContext.createBuffer(
      1,
      resampled.length,
      this.audioContext.sampleRate,
    )
    buffer.copyToChannel(resampled, 0)

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + OUTPUT_LEAD_SECONDS
    }

    source.start(this.nextPlayTime)
    this.nextPlayTime += buffer.duration
  }

  reset(): void {
    this.nextPlayTime = 0
  }

  async stop(): Promise<void> {
    const context = this.audioContext
    this.audioContext = null
    this.nextPlayTime = 0
    if (context && context.state !== 'closed') {
      await context.close()
    }
  }
}
