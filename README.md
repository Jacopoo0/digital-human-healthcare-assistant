
# Digital Human — Centro Medico San Marco

<img width="1915" height="938" alt="Screenshot 2026-09-11 114310" src="https://github.com/user-attachments/assets/e26be70a-9216-413d-8fcc-fa624fe9062c" />

Assistente vocale sanitario in tempo reale: conversazione a voce bidirezionale con Google Gemini Live, avatar video fotorealistico in lip-sync (Simli), knowledge base locale e guardrail clinico con trasferimento automatico a operatore umano.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-PCM_16k%2F24k-FF6F00)

---

## Indice

- [Panoramica](#panoramica)
- [Funzionalità principali](#funzionalità-principali)
- [Architettura tecnica](#architettura-tecnica)
  - [Audio streaming bidirezionale (Gemini Live)](#1-audio-streaming-bidirezionale-gemini-live)
  - [Avatar video in lip-sync (Simli)](#2-avatar-video-in-lip-sync-simli)
  - [RAG restrittivo via context window](#3-rag-restrittivo-via-context-window)
  - [Guardrail clinico e hand-off](#4-guardrail-clinico-e-hand-off-3-strike)
  - [Trascrizione](#5-trascrizione)
  - [Gestione errori e degradazione](#6-gestione-errori-e-degradazione)
- [Stack tecnologico](#stack-tecnologico)
- [Struttura del progetto](#struttura-del-progetto)
- [Guida rapida all'avvio](#guida-rapida-allavvio)
- [Variabili d'ambiente](#variabili-dambiente)
- [Configurazione](#configurazione)
- [Sicurezza e privacy](#sicurezza-e-privacy)
- [Troubleshooting](#troubleshooting)
- [Script disponibili](#script-disponibili)

---

## Panoramica

**Digital Human** è una Single Page Application che simula un operatore di segreteria sanitaria. L'utente parla liberamente al microfono: l'assistente risponde a voce in tempo reale, con un avatar video che muove le labbra in sincrono con la risposta, e può essere interrogato esclusivamente sulle informazioni contenute in un documento di testo caricato a runtime.

Il progetto nasce per il **Centro Medico San Marco** e copre prenotazioni, orari, servizi, listino e convenzioni, applicando vincoli rigidi di sicurezza clinica:

- **Zero allucinazioni**: le risposte provengono solo dalla knowledge base caricata.
- **Nessun consiglio medico**: diagnosi, terapie e dosaggi sono bloccati dal guardrail.
- **Escalation automatica**: dopo 3 violazioni la sessione viene chiusa e l'utente viene indirizzato a un operatore umano.

Tutta l'elaborazione vocale avviene lato client tramite **Web Audio API** e **WebSocket**, senza backend intermedio.

---

## Funzionalità principali

| Area | Descrizione |
|------|-------------|
| Conversazione vocale full-duplex | Cattura microfono e riproduzione risposta in streaming continuo, senza push-to-talk |
| Avatar video | Volto fotorealistico in lip-sync opzionale via Simli WebRTC |
| Knowledge base locale | Upload `.txt` client-side (`FileReader`), iniettato nelle istruzioni di sistema |
| Guardrail clinico | Blocco di diagnosi/terapie + marcatore nascosto `[VIOLATION]` |
| Regola dei 3 strike | Contatore avvisi, commiato vocale, chiusura sessione, modale di hand-off con click-to-call |
| Trascrizione | Riconoscimento vocale utente (Web Speech API) + feedback di riproduzione assistente |
| Resilienza | Gestione permessi negati, errori WebSocket/WebRTC, degradazione a solo-audio |

---

## Architettura tecnica

### Flusso end-to-end

```
                              ┌──────────────────────────────────────────────┐
                              │                  BROWSER                     │
                              │                                              │
  🎙️ Microfono ──► AudioWorklet ──► PCM16 @16 kHz ──► Base64                 │
                              │            │                                 │
                              │            ▼                                 │
                              │     ┌──────────────┐   WebSocket   ┌───────────────────┐
                              │     │ GeminiLive   │◄─────────────►│ Google Gemini Live │
                              │     │   Client     │               │   (native audio)   │
                              │     └──────┬───────┘               └───────────────────┘
                              │            │  PCM24 @24 kHz (Base64)
                              │            ├──────────────► AudioOutputService ──► 🔊 Speaker
                              │            │                (resample + scheduling)
                              │            └──────────────► SimliService ──► WebRTC ──► 🎭 Avatar video
                              │                                              │
                              │     Web Speech API ──► Trascrizione utente   │
                              └──────────────────────────────────────────────┘
```

### 1. Audio streaming bidirezionale (Gemini Live)

- **Endpoint**: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- **Modello**: `models/gemini-2.5-flash-native-audio-latest` (configurabile in `src/config.ts`)
- **Setup**: `responseModalities: ["AUDIO"]`, voce prebuilt (`Puck`), `systemInstruction` contenente il prompt di sistema + knowledge base.

**Ingresso (mic → Gemini)**
1. `getUserMedia` acquisisce il microfono mono.
2. Un `AudioWorklet` dedicato (`public/pcm-worklet.js`) esegue il **resampling lineare a 16 kHz** e accumula chunk da ~100 ms.
3. Il main thread converte `Float32 → Int16 → Base64`.
4. I chunk vengono inviati come `realtimeInput.mediaChunks` con `mimeType: audio/pcm;rate=16000`, solo dopo la ricezione di `setupComplete`.

**Uscita (Gemini → speaker)**
1. I chunk `inlineData` (`audio/pcm;rate=24000`) vengono decodificati in `Int16`.
2. Resampling verso il `sampleRate` effettivo dell'`AudioContext`.
3. Playback **gapless** tramite una coda con *playhead* (`nextPlayTime`): ogni buffer viene schedulato in modo contiguo per evitare glitch e sovrapposizioni.
4. In caso di `interrupted`, la coda viene resettata.

### 2. Avatar video in lip-sync (Simli)

L'integrazione usa l'SDK ufficiale **`simli-client`** (WebRTC).

1. `generateSimliSessionToken()` → `POST https://api.simli.ai/compose/token` (header `x-simli-api-key`).
2. `generateIceServers()` → `GET https://api.simli.ai/compose/ice` (fallback automatico su STUN pubblico).
3. `new SimliClient(session_token, videoElement, audioElement, iceServers)` + `start()`.
4. L'SDK aggancia da solo la `MediaStream` remota all'elemento `<video>`.

**Audio forwarding (doppio percorso)**
Gli stessi chunk PCM 24 kHz ricevuti da Gemini vengono:
- riprodotti localmente (voce dell'assistente), **e contemporaneamente**
- riscampionati a **16 kHz PCM16** e inviati a Simli via `sendAudioData(Uint8Array)` per pilotare il lip-sync.

Se la chiave Simli manca o non è valida, l'app **continua a funzionare in modalità solo-audio** con l'avatar circolare, senza bloccare la conversazione.

### 3. RAG restrittivo via context window

- L'utente carica un file `.txt` (max 500 KB) tramite `FileReader`.
- Il contenuto viene inserito in una sezione delimitata `"""..."""` dentro le `systemInstruction`.
- Il prompt impone di rispondere **esclusivamente** con le informazioni presenti nel documento; in assenza di risposta, l'assistente invita a contattare la struttura.
- È incluso un documento di esempio: [`knowledge-base-san-marco.txt`](./knowledge-base-san-marco.txt).

### 4. Guardrail clinico e hand-off (3 strike)

1. Il system prompt vieta diagnosi, terapie e dosaggi e impone, in caso di rifiuto, il marcatore nascosto `[VIOLATION]`.
2. Il client scansiona i `parts` testuali, **rimuove il marcatore dalla trascrizione** e incrementa `violationCount`.
3. La UI mostra il badge `Avvisi di sistema: X/3`.
4. Al **3° strike**:
   - l'avatar pronuncia una frase di commiato;
   - WebSocket Gemini e sessione Simli vengono chiusi automaticamente;
   - compare un modale prioritario **"Chiamata trasferita a operatore umano"** con numero `+39 02 800 123 45` e link click-to-call (`tel:+390280012345`).

I `parts` con `thought: true` (reasoning interno del modello) sono **scartati** dalla UI e dall'audio e vengono usati solo per il conteggio dei guardrail.

### 5. Trascrizione

- **Utente**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang: it-IT`, `continuous: true`; ogni frase finale viene accodata come `Tu: ...`.
- **Assistente**: vengono mostrati solo i `parts` testuali destinati all'utente, ripuliti da `[VIOLATION]` e dal markdown. Se il turno è composto solo da audio, appare il feedback `Centro Medico: [Risposta vocale in corso...]`.
- Il pannello gestisce **autoscroll** automatico.

### 6. Gestione errori e degradazione

- **WebSocket**: il `close` code/reason reali vengono tradotti in messaggi leggibili.
- **Simli**: errori HTTP (401/402/404/429) esposti in un banner dedicato, senza impatti sull'audio.
- **Microfono**: permessi negati e dispositivi assenti gestiti con messaggi espliciti.
- **Cleanup**: su "Termina sessione", hand-off e unmount vengono rilasciati microfono, `AudioContext`, sessioni WebRTC, timer e WebSocket.

---

## Stack tecnologico

| Categoria | Tecnologia |
|-----------|------------|
| Framework UI | React 19 |
| Build tool | Vite 8 |
| Linguaggio | TypeScript 6 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Audio | Web Audio API (`AudioContext`, `AudioWorklet`), resampling PCM 16 kHz / 24 kHz |
| Realtime | WebSocket nativo (Gemini Live), WebRTC (Simli) |
| Avatar video | `simli-client` v3 |
| Speech-to-text | Web Speech API |
| Linting | Oxlint |

---

## Struttura del progetto

```
digital human/
├── public/
│   └── pcm-worklet.js              # AudioWorklet: resampling mic → PCM 16 kHz
├── src/
│   ├── components/
│   │   ├── ApiKeyInput.tsx         # Input chiave protetto con validazione
│   │   ├── AvatarStatus.tsx        # Avatar circolare di fallback
│   │   ├── KnowledgeBaseUpload.tsx # Upload .txt (FileReader)
│   │   ├── SimliVideo.tsx          # Elemento <video>/<audio> + overlay di stato
│   │   ├── Transcript.tsx          # Log conversazione con autoscroll
│   │   └── ViolationModal.tsx      # Modale hand-off + click-to-call
│   ├── hooks/
│   │   └── useGeminiLive.ts        # Orchestrazione sessione, stato, guardrail, errori
│   ├── services/
│   │   ├── audioUtils.ts           # Conversioni base64/Int16/Float32 e resampling
│   │   ├── audioInputService.ts    # Mic → worklet → PCM16@16k → base64
│   │   ├── audioOutputService.ts   # PCM24@24k → playback schedulato
│   │   ├── geminiLiveClient.ts     # Client WebSocket Gemini Live
│   │   ├── simliService.ts         # Integrazione simli-client + audio forwarding
│   │   ├── speechRecognitionService.ts # Web Speech API wrapper
│   │   └── systemPrompt.ts         # System instruction + knowledge base
│   ├── types/
│   │   └── gemini.ts               # Tipi protocollo + stato applicativo
│   ├── App.tsx                     # Composizione UI
│   ├── config.ts                   # Costanti (endpoint, modello, audio, guardrail)
│   ├── index.css                   # Tailwind + tema dark
│   ├── main.tsx                    # Bootstrap React
│   └── vite-env.d.ts               # Tipizzazione variabili d'ambiente
├── .env.example                    # Template variabili d'ambiente
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

---

## Guida rapida all'avvio

### Requisiti

- **Node.js** ≥ 20 (consigliato 22+)
- Browser **Chromium-based** (Chrome/Edge) per `AudioWorklet` + Web Speech API
- Un contesto sicuro: `localhost` oppure `https://`
- **Google Gemini API Key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Simli API Key** (opzionale) — [app.simli.com](https://app.simli.com)

### Installazione

```bash
git clone <repository-url>
cd "digital human"
npm install
```

### Avvio in sviluppo

```bash
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173), quindi:

1. Inserisci la **API Key Gemini** (obbligatoria).
2. (Opzionale) Inserisci la **API Key Simli** e un **Face ID** per l'avatar video.
3. Carica il file [`knowledge-base-san-marco.txt`](./knowledge-base-san-marco.txt).
4. Clicca **Avvia conversazione** e concedi il permesso microfono.

---

## Variabili d'ambiente

Le chiavi possono essere inserite direttamente dall'interfaccia a runtime (consigliato). In alternativa, per comodità in sviluppo locale, puoi precompilare gli input tramite un file `.env`:

```bash
cp .env.example .env
```

| Variabile | Obbligatoria | Descrizione |
|-----------|:------------:|-------------|
| `VITE_GEMINI_API_KEY` | No | Precompila l'input della Gemini API Key |
| `VITE_SIMLI_API_KEY` | No | Precompila l'input della Simli API Key (assente ⇒ solo audio) |
| `VITE_SIMLI_FACE_ID` | No | Face ID Simli; se vuoto usa il volto predefinito |

> **Nota**: le variabili `VITE_*` vengono incorporate nel bundle client e sono visibili nel browser. Non usare `.env` per segreti di produzione: il file è già escluso da Git (`.gitignore`), mentre `.env.example` è versionato.

---

## Configurazione

### Parametri principali (`src/config.ts`)

| Costante | Valore di default | Descrizione |
|----------|-------------------|-------------|
| `DEFAULT_MODEL` | `models/gemini-2.5-flash-native-audio-latest` | Modello Gemini Live |
| `DEFAULT_VOICE` | `Puck` | Voce prebuilt |
| `INPUT_SAMPLE_RATE` | `16000` | Sample rate ingresso (mic) |
| `OUTPUT_SAMPLE_RATE` | `24000` | Sample rate uscita (modello) |
| `AUDIO_CHUNK_MS` | `100` | Dimensione chunk di invio |
| `MAX_VIOLATIONS` | `3` | Soglia hand-off |
| `HANDOFF_PHONE_TEL` | `tel:+390280012345` | Numero click-to-call |

> Il modello deve supportare `bidiGenerateContent`. Puoi verificare i modelli abilitati sulla tua chiave con:
> `GET https://generativelanguage.googleapis.com/v1beta/models?key=<API_KEY>`

### System prompt e knowledge base

- Prompt: `src/services/systemPrompt.ts` (regole RAG, tono, concisione, guardrail clinico).
- Documento: caricato dall'UI; esempio fornito in `knowledge-base-san-marco.txt`.

---

## Sicurezza e privacy

- **Nessun backend**: audio e testo non transitano da server propri, ma direttamente verso le API di Google Gemini e (opzionalmente) Simli.
- **Chiavi API**: inserite a runtime nell'interfaccia o precompilate via `.env` locale. Il file `.env` è ignorato da Git.
- **Dati sanitari**: il progetto è dimostrativo. Non inserire dati reali di pazienti senza adeguata valutazione di conformità (GDPR) e accordi con i fornitori.
- **Guardrail**: le risposte sono vincolate alla knowledge base; nessun consiglio clinico viene erogato.

---

## Troubleshooting

| Sintomo | Causa probabile | Soluzione |
|---------|-----------------|-----------|
| `La connessione è stata chiusa dal server: ... not supported for bidiGenerateContent` | Modello non abilitato per il Live API | Usa un modello che supporta `bidiGenerateContent` e aggiorna `DEFAULT_MODEL` |
| Chiusura WebSocket `code=1007` | Payload di setup non valido | Verifica di non aver aggiunto campi non supportati al `setup` |
| `Permesso microfono negato` | Consenso negato al browser | Riabilita il microfono nelle impostazioni del sito |
| Banner Simli `401` | Chiave Simli non valida | Verifica la chiave su app.simli.com |
| Banner Simli `402` | Credito Simli esaurito | Ricarica il piano o usa la modalità solo-audio |
| Trascrizione utente assente | Browser senza Web Speech API (es. Firefox) | Usa Chrome/Edge |
| Nessun video avatar | Chiave Simli assente o errore di sessione | Controlla i log `[SIMLI_DEBUG]` in console; l'audio resta funzionante |

---

## Script disponibili

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia il server di sviluppo Vite con HMR |
| `npm run build` | Type-check (`tsc -b`) + build di produzione in `dist/` |
| `npm run preview` | Anteprima locale della build di produzione |
| `npm run lint` | Analisi statica con Oxlint |

---

<p align="center">
  <sub>Digital Human · Centro Medico San Marco — progetto dimostrativo a scopo informativo.</sub>
</p>
