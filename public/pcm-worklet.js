class PCMWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = options.processorOptions || {}
    this.targetRate = opts.targetSampleRate || 16000
    this.chunkSize = opts.chunkSize || 1600
    this.raw = []
    this.out = []
    this.phase = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length > 0) {
      for (let i = 0; i < channel.length; i += 1) {
        this.raw.push(channel[i])
      }
      this.resample()
    }
    return true
  }

  resample() {
    const step = sampleRate / this.targetRate

    while (this.phase < this.raw.length) {
      const i = Math.floor(this.phase)
      const frac = this.phase - i
      const s0 = this.raw[i]
      const s1 = i + 1 < this.raw.length ? this.raw[i + 1] : s0
      this.out.push(s0 + (s1 - s0) * frac)
      this.phase += step
    }

    const consumed = Math.floor(this.phase)
    if (consumed > 0) {
      this.raw.splice(0, consumed)
      this.phase -= consumed
    }

    while (this.out.length >= this.chunkSize) {
      const chunk = this.out.splice(0, this.chunkSize)
      this.port.postMessage(new Float32Array(chunk))
    }
  }
}

registerProcessor('pcm-worklet', PCMWorklet)
