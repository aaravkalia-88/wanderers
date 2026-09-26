import {Destination} from './destinations';

export interface RoutePoint {name: string; latitude: number; longitude: number}
export interface RoadRoute {coordinates: [number, number][]; distance: number; duration: number}
const routeCache = new Map<string, RoadRoute>();
const cityCache = new Map<string, RoutePoint[]>();
export const delhi: RoutePoint = {name: 'New Delhi', latitude: 28.6139, longitude: 77.2090};

export function localOrigin(name: string, places: Destination[]): RoutePoint | undefined {
  const normalized = name.trim().toLowerCase();
  return ['delhi', 'new delhi'].includes(normalized) ? {...delhi, name} : places.find(p => p.name.toLowerCase() === normalized);
}

export async function findOrigin(name: string, signal: AbortSignal): Promise<RoutePoint[]> {
  const key = name.trim().toLowerCase();
  if (cityCache.has(key)) return cityCache.get(key)!;
  const params = new URLSearchParams({name: name.trim(), count: '5', language: 'en', countryCode: 'IN'});
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {signal});
  if (!response.ok) throw new Error('City search is unavailable. Try again or use your location.');
  const data = await response.json();
  const results: RoutePoint[] = (data.results || []).filter((p: {latitude: number; longitude: number}) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map((p: {name: string; admin1?: string; latitude: number; longitude: number}) => ({name: [p.name, p.admin1].filter(Boolean).join(', '), latitude: p.latitude, longitude: p.longitude}));
  cityCache.set(key, results);
  return results;
}

export async function getRoadRoute(points: RoutePoint[], signal: AbortSignal): Promise<RoadRoute> {
  const key = points.map(p => `${p.longitude.toFixed(5)},${p.latitude.toFixed(5)}`).join(';');
  if (routeCache.has(key)) return routeCache.get(key)!;
  const base = (import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const response = await fetch(`${base}/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false&radiuses=${points.map(() => '5000').join(';')}`, {signal});
  if (!response.ok) throw new Error('Road routing is unavailable right now. Retry or open directions in Google Maps.');
  const data = await response.json();
  const result = data.routes?.[0];
  if (data.code !== 'Ok' || !result?.geometry?.coordinates?.length) throw new Error('No connected road route was found for these stops. Try another stop or check access in Google Maps.');
  if (!Number.isFinite(result.distance) || !Number.isFinite(result.duration) || !result.geometry.coordinates.every((c: number[]) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))) throw new Error('The route response was incomplete. Please retry.');
  const route: RoadRoute = {coordinates: result.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]), distance: result.distance, duration: result.duration};
  if (routeCache.size >= 30) routeCache.delete(routeCache.keys().next().value!);
  routeCache.set(key, route);
  return route;
}

export function mapsLink(origin: string, point: RoutePoint | undefined, stops: Destination[], destination: Destination, mode: string) {
  const params = new URLSearchParams({api: '1', origin: point ? `${point.latitude},${point.longitude}` : origin, destination: `${destination.latitude},${destination.longitude}`, travelmode: mode});
  if (stops.length && mode !== 'transit') params.set('waypoints', stops.map(p => `${p.latitude},${p.longitude}`).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

export function travelTime(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}
