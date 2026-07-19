# Chronicle

Chronicle is an AI-powered voice journaling app. Speak your entry, and Chronicle transcribes
it, reflects back on it with a CBT-informed AI companion, and lets you keep talking about it
— all saved to your personal journal history.

- **Frontend:** React Native (Expo Router) — iOS, Android, and web
- **Backend:** FastAPI (Python), MongoDB
- **AI:** Whisper (speech-to-text) + Gemini (reflection & chat) + HuggingFace TTS

---

## How it works

1. **Record.** Tap the mic on the dashboard, pick a mood, speak.
2. **Reflect.** The recording is transcribed and Chronicle generates a short, warm reflection
   on what you said — surfaced as its own screen with a "listen to response" option.
3. **Continue the conversation.** Keep talking to Chronicle about the entry in a live chat,
   by voice or text.
4. **Look back.** Every entry and conversation is saved and searchable in your journal history.

---

## Project structure

```
chronicle/
├── backend/                 FastAPI + MongoDB API
│   ├── app/
│   │   ├── core/            settings, JWT auth, shared dependencies
│   │   ├── db/               MongoDB connection + indexes
│   │   ├── models/           Mongo document schemas (User, Journal, Message)
│   │   ├── schemas/          API request/response schemas
│   │   ├── routes/           auth, journals, ai, health
│   │   ├── services/
│   │   │   ├── ai/           Whisper (ASR), Gemini (reflection/chat), TTS
│   │   │   ├── journal_service.py   orchestrates record → transcribe → reflect → save
│   │   │   └── media.py      on-disk audio storage helpers
│   │   └── main.py
│   ├── tests/                pytest suite (fake Mongo + fake AI, no external services needed)
│   ├── media/                 recorded + generated audio (gitignored)
│   ├── requirements.txt
│   └── .env.example
│
└── application/               Expo Router app
    ├── app/                    screens (dashboard, recording, reflection, chat, history…)
    ├── components/chronicle/   shared UI (bottom nav, etc.)
    ├── context/auth-context.tsx  session state, token persistence
    ├── lib/api.ts               typed API client shared by every screen
    └── .env.example
```

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["📱 Chronicle App (Expo Router / React Native)"]
        UI_Dashboard["Dashboard"]
        UI_Record["Active Recording"]
        UI_Reflect["AI Reflection"]
        UI_Chat["Live Conversation"]
        UI_History["Journal History"]
        AuthCtx["AuthContext\n(session + token storage)"]
        ApiClient["lib/api.ts\n(typed fetch client)"]
    end

    subgraph API["⚙️ FastAPI Backend"]
        AuthRoute["/auth\nregister · login · me"]
        JournalRoute["/journals\nCRUD + /messages"]
        AiRoute["/ai\ntranscribe · tts"]
        JournalSvc["journal_service\n(orchestration)"]
        AuthSvc["auth_service"]
        ASR["ai/asr.py"]
        Reflection["ai/reflection.py"]
        Chat["ai/chat.py"]
        TTS["ai/tts.py"]
        Media["media/\n(audio + tts files)"]
    end

    subgraph External["☁️ External AI Services"]
        Whisper["HuggingFace\nWhisper (ASR)"]
        HFTTs["HuggingFace\nTTS"]
        Gemini["Google Gemini\n(reflection + chat)"]
    end

    DB[("🍃 MongoDB\nusers · journals · messages")]

    UI_Record -->|record audio| ApiClient
    UI_Dashboard --> ApiClient
    UI_Reflect --> ApiClient
    UI_Chat --> ApiClient
    UI_History --> ApiClient
    AuthCtx <-.token.-> ApiClient

    ApiClient -->|HTTPS + JWT| AuthRoute
    ApiClient -->|HTTPS + JWT| JournalRoute
    ApiClient -->|HTTPS + JWT| AiRoute

    AuthRoute --> AuthSvc --> DB
    JournalRoute --> JournalSvc
    AiRoute --> ASR
    AiRoute --> TTS

    JournalSvc --> ASR --> Whisper
    JournalSvc --> Reflection --> Gemini
    JournalSvc --> Media
    JournalSvc --> DB
    JournalRoute -->|chat turn| Chat --> Gemini
    TTS --> HFTTs

    Media -->|served at /media/*| ApiClient
```

**Request flow for recording an entry:**
`ActiveRecording` records audio on-device → uploads it to `POST /journals` → the backend
saves the audio, transcribes it (Whisper), generates a structured reflection (Gemini), stores
everything in MongoDB (`journals` + a seeded `messages` entry), and returns the full entry in
one response → the app navigates straight to `AiReflection` with real data.

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- A MongoDB database (Atlas free tier or local `mongod`)
- API keys (free tiers available):
  - [HuggingFace token](https://huggingface.co/settings/tokens) — speech-to-text & text-to-speech
  - [Google Gemini API key](https://aistudio.google.com/apikey) — AI reflection & chat

The app works without the AI keys too — auth, recording, and history all function; you'll
just get a friendly error instead of a reflection until the keys are set.

---

## Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env: set MONGODB_URL, JWT_SECRET_KEY, HUGGINGFACE_API_KEY, LLM_API_KEY

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now at `http://localhost:8000` (docs at `/docs`). Check `GET /api/v1/health` to
confirm MongoDB and the AI keys are configured correctly.

**Run the tests** (no live MongoDB or API keys required — everything is faked):

```bash
pip install -r requirements-dev.txt
pytest
```

---

## Frontend setup

```bash
cd application
npm install

cp .env.example .env
# edit .env: set EXPO_PUBLIC_API_URL to point at your backend (see note below)

npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or `w` (web), or scan the QR code
with Expo Go on a physical device.

**Setting `EXPO_PUBLIC_API_URL`:**
| Running on | Use |
|---|---|
| Web / iOS simulator | `http://localhost:8000/api/v1` |
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical device | `http://<your-computer's-LAN-IP>:8000/api/v1` |

---

## Environment variables

### `backend/.env`
| Variable | Required | Description |
|---|---|---|
| `MONGODB_URL` | ✅ | MongoDB connection string |
| `JWT_SECRET_KEY` | ✅ | Secret for signing auth tokens (`openssl rand -hex 32`) |
| `HUGGINGFACE_API_KEY` | for AI | Powers speech-to-text and text-to-speech |
| `LLM_API_KEY` | for AI | Gemini key, powers reflection + chat |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables "Sign in with Google" |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (default `*`) |

See `backend/.env.example` for the full list with defaults.

### `application/.env`
| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Base URL of the backend API, including `/api/v1` |

---

## API overview

All endpoints except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account |
| POST | `/api/v1/auth/login` | Get an access token |
| GET | `/api/v1/auth/me` | Current user profile |
| POST | `/api/v1/journals` | Upload audio → transcribe → reflect → save (multipart) |
| GET | `/api/v1/journals` | List entries (summaries) |
| GET | `/api/v1/journals/{id}` | Full entry incl. transcript + reflection |
| PATCH | `/api/v1/journals/{id}` | Update title/mood |
| DELETE | `/api/v1/journals/{id}` | Delete an entry and its conversation |
| GET | `/api/v1/journals/{id}/messages` | Conversation history for an entry |
| POST | `/api/v1/journals/{id}/messages` | Send a message, get the AI's reply |
| POST | `/api/v1/ai/transcribe` | Standalone transcription (used by the chat mic) |
| POST | `/api/v1/ai/tts` | Text-to-speech, returns a media URL |
| GET | `/api/v1/health` | Service status (Mongo + AI config) |

Full interactive docs at `http://localhost:8000/docs` once the backend is running.

---

## Data model (MongoDB)

- **`users`** — email, hashed password, profile
- **`journals`** — one per recorded entry: transcript, mood, audio path, AI reflection,
  status (`processing` / `ready` / `failed`)
- **`messages`** — every conversation turn (the initial reflection is seeded as the first
  assistant message, so `AiReflection` and the live chat screen share one source of truth)

---

## Security note

This repository's `backend/.env` previously contained **live, working credentials**
(a MongoDB Atlas password and a JWT signing secret), and `opencode.json` contained a live
OpenRouter API key. Those secrets have been redacted/replaced with placeholders in this
delivery, but **if these values were ever committed to a real git history or shared
elsewhere, rotate them immediately** — treat them as compromised. Going forward, `.env` is
gitignored at the repo root; only commit `.env.example` files.

---

## Known limitations (MVP scope)

- Audio is stored on local disk (`backend/media/`), not object storage — fine for a single
  backend instance, but won't survive a redeploy on most PaaS platforms. Swap `app/services/media.py`
  for an S3-backed implementation for real production use.
- Only Gemini is wired up as an LLM provider; `app/services/ai/client.py` is the single seam
  to add others.
- "Insights" (mood trends over time) is stubbed as "coming soon" in the bottom nav — the data
  (`mood` + `created_at` per entry) is already there for a future dashboard.
- Google Sign-In is implemented server-side but has no button wired up in the app yet (needs
  a native Google client ID to configure `expo-auth-session` on the frontend).
