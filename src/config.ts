export const GEMINI_LIVE_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export const DEFAULT_MODEL = 'models/gemini-2.5-flash-native-audio-latest'
export const DEFAULT_VOICE = 'Puck'

export const INPUT_SAMPLE_RATE = 16000
export const OUTPUT_SAMPLE_RATE = 24000

export const INPUT_MIME_TYPE = 'audio/pcm;rate=16000'
export const OUTPUT_MIME_TYPE = 'audio/pcm;rate=24000'

export const AUDIO_CHUNK_MS = 100
export const OUTPUT_LEAD_SECONDS = 0.04

export const MAX_KB_FILE_SIZE = 500 * 1024

export const VIOLATION_MARKER = '[VIOLATION]'
export const MAX_VIOLATIONS = 3

export const HANDOFF_PHONE_NUMBER = '+39 02 800 123 45'
export const HANDOFF_PHONE_TEL = 'tel:+390280012345'
export const HANDOFF_FAREWELL =
  'Ho riscontrato difficoltà con la tua richiesta. Ti metto subito in contatto con la nostra segreteria medica.'
export const HANDOFF_TIMEOUT_MS = 8000

export const DEFAULT_SIMLI_FACE_ID = '6926a39d-638b-49c5-9328-79efa034e9a4'
