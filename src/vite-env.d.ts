/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_SIMLI_API_KEY?: string
  readonly VITE_SIMLI_FACE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
