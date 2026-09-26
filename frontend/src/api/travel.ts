export interface Entry { place_id: number; status: string; visit_date: string | null; notes: string; rating: number; stamp_id: string | null }
export interface Passport { username: string; is_guest?: boolean; entries: Entry[]; xp: number; tier: string; floor: number; next_xp: number | null; states: number; visited: number; achievements: {name: string; count: number; target: number; unlocked: boolean}[] }
export interface Trip { id?: number; place_id: number; origin: string; origin_point?: {name: string; latitude: number; longitude: number}; stop_ids?: number[]; start: string; days: number; travelers: number; budget: number; mode: string; style: string }
export const emptyPassport: Passport = {username: 'Your next chapter', is_guest: true, entries: [], xp: 0, tier: 'Tier III Wanderer', floor: 0, next_xp: 1000, states: 0, visited: 0, achievements: []};
// Older running APIs omit is_guest; explicit server status takes precedence.
export const isGuestPassport = (passport: Passport) => passport.is_guest ?? passport.username.startsWith('Wanderer-');
const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const sessionMessage = 'Your session has expired or is no longer valid. Sign in again to open your passport.';
export class ApiError extends Error {
  constructor(message: string, public status: number) {super(message); this.name = 'ApiError';}
}
const tokenKey = 'wanderer-token';
let memoryToken: string | undefined;
let rejectedToken: string | undefined;
let session: Promise<void> | undefined;
let sessionVersion = 0;
let signInVersion = 0;
function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 8192 && /^[\w.~-]+$/.test(value) && value !== 'undefined' && value !== 'null';
}
function storedToken(storage: 'localStorage' | 'sessionStorage') {
  try {const value = globalThis[storage].getItem(tokenKey); return validToken(value) ? value : '';}
  catch {return '';}
}
// Pin the remembered account to this tab before requests begin. A login elsewhere
// must never change the identity receiving an in-flight response or journal edit.
export function token(): string {
  if (memoryToken !== undefined) return memoryToken;
  try {if (sessionStorage.getItem(tokenKey) === '') return ''; } catch { /* Use memory if storage is blocked. */ }
  const tab = storedToken('sessionStorage');
  if (tab) return tab;
  const remembered = storedToken('localStorage');
  if (remembered) {
    try {sessionStorage.setItem(tokenKey, remembered);} catch {memoryToken = remembered;}
  }
  return remembered;
}
export function isTabSession() {return memoryToken !== undefined || !!storedToken('sessionStorage');}
function resetSession() {
  sessionVersion++;
  session = undefined;
  rejectedToken = undefined;
}
export function clearSessionToken() {
  const current = token();
  signInVersion++;
  resetSession();
  memoryToken = ''; // Prevent falling through to another account after logout.
  try {sessionStorage.setItem(tokenKey, '');} catch { /* The memory override still signs this page out. */ }
  try {if (storedToken('localStorage') === current) localStorage.removeItem(tokenKey);} catch { /* Other tabs retain their own session. */ }
}
// Store only the credential. Remembering is opt-in; passwords are never stored.
function storeSessionToken(accessToken: string, remember: boolean): boolean {
  if (!validToken(accessToken)) throw new ApiError('Wanderer returned an invalid session. Please try again.', 502);
  resetSession();
  memoryToken = accessToken;
  try {
    sessionStorage.setItem(tokenKey, accessToken);
    if (remember) localStorage.setItem(tokenKey, accessToken);
    memoryToken = undefined;
    return true;
  } catch {return false;}
}
export function setSessionToken(accessToken: string, remember = true): boolean {
  const stored = storeSessionToken(accessToken, remember);
  signInVersion++;
  return stored;
}

async function request<T>(path: string, options: RequestInit, accessToken: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
  let response: Response;
  try {
    response = await fetch(base + path, {...options, headers, signal: options.signal || AbortSignal.timeout(15000)});
  } catch {
    throw new ApiError('We could not reach Wanderer. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const validation = Array.isArray(error?.detail) ? error.detail.find((item: {msg?: unknown}) => typeof item?.msg === 'string')?.msg : undefined;
    if (response.status === 401 && accessToken && token() === accessToken) {
      rejectedToken = accessToken;
      window.dispatchEvent(new Event('wanderer-session-expired'));
    }
    throw new ApiError(response.status === 401 && accessToken ? sessionMessage : typeof error?.detail === 'string' ? error.detail : validation ? validation.replace(/^Value error, /, '') : 'Wanderer could not complete this request. Please try again.', response.status);
  }
  try {return await response.json();}
  catch {throw new ApiError('Wanderer returned an unexpected response. Please try again.', 502);}
}

export function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, token());
}

export async function signIn(email: string, password: string, remember = false): Promise<boolean> {
  const version = ++signInVersion;
  const result = await request<{access_token: string}>('/auth/login/access-token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({username: email.trim().toLowerCase(), password}),
  }, '');
  if (version !== signInVersion) throw new ApiError('This sign-in was superseded by a newer session. Please try again if needed.', 409);
  return setSessionToken(result?.access_token, remember);
}

// Only replace an existing passport when the user explicitly chooses a new guest.
// Keep its credential until guest creation succeeds, so a failed request is reversible.
export function startGuestSession(): Promise<void> {
  if (session) return session;
  const previous = token();
  const version = sessionVersion;
  const pending = request<{access_token: string}>('/auth/guest', {method: 'POST'}, '').then(result => {
    if (!validToken(result?.access_token)) throw new ApiError('A guest passport could not be created. Please try again.', 502);
    if (token() !== previous || version !== sessionVersion) return; // A newer sign-in or logout takes precedence.
    storeSessionToken(result.access_token, false);
  }).finally(() => {if (session === pending) session = undefined;});
  session = pending;
  return session;
}
export function ensureSession(): Promise<void> {
  const current = token();
  if (current && current === rejectedToken) return Promise.reject(new ApiError(sessionMessage, 401));
  return current ? Promise.resolve() : startGuestSession();
}
export function dateToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
