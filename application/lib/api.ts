import Constants from 'expo-constants';

// The backend URL is configurable via the EXPO_PUBLIC_API_URL env var (see
// .env.example) so nobody has to hardcode a LAN IP in source again. Falls
// back to localhost for the web/simulator dev experience.
const FALLBACK_URL = 'http://localhost:8000/api/v1';

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra = (Constants.expoConfig?.extra as any)?.apiUrl;
  return (fromEnv || fromExtra || FALLBACK_URL).replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl();

// The API root without the /api/v1 suffix, used for building media URLs
// (e.g. /media/audio/xyz.m4a) which are served outside the versioned API.
export const SERVER_ROOT = API_URL.replace(/\/api\/v1$/, '');

export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${SERVER_ROOT}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

/** Called by AuthContext whenever the token changes so every request
 * automatically carries the right Authorization header. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!options.skipAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Could not connect to the server. Check your network and API URL.');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    let message = 'Something went wrong';
    if (data) {
      if (typeof data === 'string') message = data;
      else if (typeof data.message === 'string') message = data.message;
      else if (typeof data.detail === 'string') message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((d: any) => d.msg).join('\n');
    }
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Mood = 'Calm' | 'Low' | 'Frustrated' | 'Happy' | 'Anxious';
export type JournalStatus = 'processing' | 'ready' | 'failed';
export type MessageRole = 'user' | 'assistant';

export interface UserProfile {
  _id: string;
  email: string;
  full_name?: string | null;
  picture?: string | null;
  created_at: string;
}

export interface AIReflection {
  title: string;
  body: string[];
  highlight_word?: string | null;
}

export interface Journal {
  _id: string;
  title?: string | null;
  transcript: string;
  mood: Mood;
  duration_seconds: number;
  audio_url?: string | null;
  status: JournalStatus;
  reflection?: AIReflection | null;
  created_at: string;
  updated_at: string;
}

export interface JournalSummary {
  _id: string;
  title?: string | null;
  preview: string;
  mood: Mood;
  duration_seconds: number;
  status: JournalStatus;
  created_at: string;
}

export interface Message {
  _id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface ChatTurn {
  user_message: Message;
  assistant_message: Message;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  register: (email: string, password: string) =>
    request<UserProfile>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  me: () => request<UserProfile>('/auth/me'),
};

// ---------------------------------------------------------------------------
// Journals
// ---------------------------------------------------------------------------

export const journalsApi = {
  list: () => request<JournalSummary[]>('/journals'),

  get: (id: string) => request<Journal>(`/journals/${id}`),

  update: (id: string, updates: { title?: string; mood?: Mood }) =>
    request<Journal>(`/journals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  remove: (id: string) => request<void>(`/journals/${id}`, { method: 'DELETE' }),

  /**
   * Upload a recorded audio file to create a journal entry. The backend
   * transcribes it, generates the first AI reflection, and returns the
   * complete entry in one round trip.
   */
  createFromRecording: (params: {
    uri: string;
    mood: Mood;
    durationSeconds: number;
    fileName?: string;
    mimeType?: string;
  }) => {
    const form = new FormData();
    form.append('file', {
      uri: params.uri,
      name: params.fileName || 'recording.m4a',
      type: params.mimeType || 'audio/m4a',
    } as any);
    form.append('mood', params.mood);
    form.append('duration_seconds', String(params.durationSeconds));

    return request<Journal>('/journals', { method: 'POST', body: form });
  },

  listMessages: (journalId: string) => request<Message[]>(`/journals/${journalId}/messages`),

  sendMessage: (journalId: string, content: string) =>
    request<ChatTurn>(`/journals/${journalId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

// ---------------------------------------------------------------------------
// AI utilities (standalone, outside a journal's lifecycle)
// ---------------------------------------------------------------------------

export const aiApi = {
  transcribe: (uri: string, mimeType = 'audio/m4a') => {
    const form = new FormData();
    form.append('file', { uri, name: 'clip.m4a', type: mimeType } as any);
    return request<{ text: string; language: string }>('/ai/transcribe', {
      method: 'POST',
      body: form,
    });
  },

  textToSpeech: (text: string) =>
    request<{ audio_url: string; format: string }>('/ai/tts', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

export { request };
