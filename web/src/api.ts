const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'streakpot.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable — session will just not persist
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('streakpot:logout'));
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchPhoto(checkInId: number): Promise<string> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/checkins/${checkInId}/photo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'Photo unavailable');
  return URL.createObjectURL(await res.blob());
}

// ---- Types ----

export interface User {
  id: number;
  name: string;
  email: string;
}

export type Phase = 'upcoming' | 'active' | 'settling' | 'finished';
export type CheckInStatus = 'pending' | 'approved' | 'rejected';

export interface Challenge {
  id: number;
  title: string;
  description: string;
  targetPerWeek: number;
  stake: number;
  startDate: string;
  weeks: number;
  inviteCode: string;
  ownerId: number;
}

export interface ChallengeSummary extends Challenge {
  memberCount: number;
  phase: Phase;
  currentWeek: number | null;
  endDate: string;
  pot: number;
  rank: number;
  me?: {
    points: number;
    streak: number;
    alive: boolean;
    thisWeek?: { approved: number; pending: number };
  };
}

export interface WeekResult {
  index: number;
  start: string;
  end: string;
  approved: number;
  pending: number;
  counted: boolean;
  settled: boolean;
  met: boolean | null;
}

export interface Standing {
  userId: number;
  name: string;
  weeks: WeekResult[];
  weeksMet: number;
  weeksMissed: number;
  totalApproved: number;
  streak: number;
  lost: number;
  share: number;
  points: number;
  alive: boolean;
}

export interface CheckIn {
  id: number;
  userId: number;
  userName: string;
  day: string;
  note: string;
  hasPhoto: boolean;
  createdAt: string;
  approvals: number;
  rejections: number;
  myVote: boolean | null;
  status: CheckInStatus;
}

export interface ChallengeDetail {
  challenge: Challenge;
  phase: Phase;
  currentWeek: number | null;
  endDate: string;
  pot: number;
  survivors: number;
  standings: Standing[];
  checkIns: CheckIn[];
  today: string;
}

export interface InvitePreview {
  challenge: Omit<Challenge, 'inviteCode' | 'ownerId'> & { ownerName: string; memberCount: number };
  alreadyMember: boolean;
}

type AuthResponse = { token: string; user: User };

export const api = {
  signup: (body: { name: string; email: string; password: string }) => request<AuthResponse>('POST', '/auth/signup', body),
  login: (body: { email: string; password: string }) => request<AuthResponse>('POST', '/auth/login', body),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  listChallenges: () => request<{ challenges: ChallengeSummary[] }>('GET', '/challenges'),
  createChallenge: (body: Omit<Challenge, 'id' | 'inviteCode' | 'ownerId'>) =>
    request<{ challenge: Challenge }>('POST', '/challenges', body),
  getChallenge: (id: number) => request<ChallengeDetail>('GET', `/challenges/${id}`),
  updateChallenge: (id: number, body: { title?: string; description?: string }) =>
    request<{ challenge: Challenge }>('PATCH', `/challenges/${id}`, body),
  deleteChallenge: (id: number) => request<void>('DELETE', `/challenges/${id}`),
  leaveChallenge: (id: number) => request<void>('DELETE', `/challenges/${id}/membership`),

  checkIn: (id: number, body: { day: string; note: string; photo?: string }) =>
    request<{ id: number }>('POST', `/challenges/${id}/checkins`, body),
  vote: (checkInId: number, approve: boolean) => request<void>('PUT', `/checkins/${checkInId}/vote`, { approve }),
  deleteCheckIn: (checkInId: number) => request<void>('DELETE', `/checkins/${checkInId}`),

  previewInvite: (code: string) => request<InvitePreview>('GET', `/invites/${code}`),
  joinInvite: (code: string) => request<{ challengeId: number }>('POST', `/invites/${code}/join`),
};
