import {api, ensureSession, token} from './travel';

export type ResearchCategory = 'essentials' | 'stays' | 'experiences';
export interface ResearchInput {
  place_id: number; start: string; days: number; travelers: number; style: string;
  adults: number; rooms: number; checkout: string; category: ResearchCategory;
  mode: 'discovery' | 'live'; source?: string;
}
export interface ResearchCard {
  title: string; description: string; excerpt: string; url: string; source: string; topic: string;
  checked_at: number | null; date_checked: boolean; availability: 'available' | 'unavailable' | 'not_confirmed';
  activity_date?: string | null;
  price: {amount: string; currency: string; basis: string; taxes: string; cancellation: string} | null;
}
export interface ResearchResult {
  id: string | null; status: string; category: ResearchCategory; mode: 'discovery' | 'live';
  cards: ResearchCard[]; notice: string; checked_at: number | null; expires_at: number | null;
  sources: {id: string; label: string; url: string; live_enabled: boolean}[];
}
export function defaultCheckout(start: string, days: number) {
  const day = new Date(start + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() + Math.max(1, days - 1));
  return Number.isFinite(day.getTime()) ? day.toISOString().slice(0, 10) : '';
}
export async function researchKey(input: object, identity = token()) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity + JSON.stringify(input)));
  return 'wanderer-research:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function startResearch(input: ResearchInput, signal: AbortSignal) {
  await ensureSession();
  return api<ResearchResult>('/research', {method: 'POST', body: JSON.stringify(input), signal});
}
export const getResearch = (id: string, signal: AbortSignal) => api<ResearchResult>('/research/' + encodeURIComponent(id), {signal});
export const cancelResearch = (id: string, signal: AbortSignal) => api<ResearchResult>('/research/' + encodeURIComponent(id) + '/cancel', {method: 'POST', signal});
