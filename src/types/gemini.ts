export type AvatarState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error'

export type GeminiRole = 'user' | 'model'

export interface GeminiTextPart {
  text: string
  thought?: boolean
}

export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string
    data: string
  }
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart

export interface GeminiContent {
  role?: GeminiRole
  parts: GeminiPart[]
}

export interface GeminiSpeechConfig {
  voiceConfig: {
    prebuiltVoiceConfig: {
      voiceName: string
    }
  }
}

export interface GeminiGenerationConfig {
  responseModalities: string[]
  speechConfig?: GeminiSpeechConfig
}

export interface GeminiSetup {
  model: string
  generationConfig: GeminiGenerationConfig
  systemInstruction: GeminiContent
}

export interface SetupMessage {
  setup: GeminiSetup
}

export interface MediaChunk {
  mimeType: string
  data: string
}

export interface RealtimeInputMessage {
  realtimeInput: {
    mediaChunks: MediaChunk[]
  }
}

export interface ClientContentMessage {
  clientContent: {
    turns: GeminiContent[]
    turnComplete: boolean
  }
}

export interface ServerContent {
  modelTurn: { parts: GeminiPart[] } | null
  turnComplete?: boolean
  interrupted?: boolean
}

export interface ServerContentMessage {
  serverContent: ServerContent
}

export interface SetupCompleteMessage {
  setupComplete: Record<string, never>
}

export interface TurnCompleteMessage {
  turnComplete: boolean
}

export interface InterruptedMessage {
  interrupted: boolean
}

export type ServerMessage =
  | ServerContentMessage
  | SetupCompleteMessage
  | TurnCompleteMessage
  | InterruptedMessage

export interface TranscriptEntry {
  role: GeminiRole
  text: string
}
