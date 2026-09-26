import {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {Destination} from '../api/destinations';
import {getRoadRoute, mapsLink, RoadRoute, RoutePoint, travelTime} from '../api/routes';
import {Icon} from './UI';
import JourneyLoading from './JourneyLoading';
const TravelMap = lazy(() => import('./TravelMap'));
const noEntries: [] = [];

export default function TripRoute({origin, originPoint, stops, destination, mode}: {
  origin: string; originPoint?: RoutePoint; stops: Destination[]; destination: Destination; mode: string;
}) {
  const points = useMemo(() => [...(originPoint ? [originPoint] : []), ...stops, destination], [originPoint, stops, destination]);
  const routeKey = JSON.stringify({points: points.map(p => [p.latitude, p.longitude]), mode});
  const [result, setResult] = useState<{key: string; route?: RoadRoute; error?: string}>();
  const [retry, setRetry] = useState(0);
  const current = result?.key === routeKey ? result : undefined;
  const route = current?.route;
  const error = current?.error;
  const loading = !!originPoint && mode === 'driving' && !current;
  useEffect(() => {
    if (!originPoint || mode !== 'driving') return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const debounce = setTimeout(() => {
      getRoadRoute(points, controller.signal).then(route => {if (active) setResult({key: routeKey, route});}).catch(e => {
        if (active) setResult({key: routeKey, error: controller.signal.aborted ? 'Routing took too long. Retry or open directions in Google Maps.' : e instanceof Error ? e.message : 'Could not build the route. Please retry.'});
      }).finally(() => clearTimeout(timeout));
    }, 350);
    return () => {active = false; controller.abort(); clearTimeout(debounce); clearTimeout(timeout);};
  }, [routeKey, retry]);
  const mapRoute = useMemo(() => ({points, coordinates: route?.coordinates}), [points, route]);
  const link = mapsLink(origin, originPoint, stops, destination, mode);
  const transitPoints: (RoutePoint | string)[] = [originPoint || origin, ...stops, destination];
  const coordinateText = (point: RoutePoint | string) => typeof point === 'string' ? point : `${point.latitude},${point.longitude}`;
  return <section className="trip-route" aria-label="Your route">
    <div className="route-heading"><div><span className="eyebrow">The journey is part of the story</span><h3>Your route, unfolding.</h3></div><span className="route-badge"><Icon name="route"/>{points.length} {points.length === 1 ? 'place' : 'places'}</span></div>
    <Suspense fallback={<JourneyLoading label="Unfolding the map…" compact/>}><TravelMap places={stops} entries={noEntries} onSelect={() => {}} route={mapRoute}/></Suspense>
    <div className="route-status" role="status" aria-live="polite">
      {!originPoint ? <p><Icon name="location_on"/>Find your starting city or use your location to build this route.</p> : mode !== 'driving' ? <p><Icon name="info"/>{mode === 'walking' ? 'Walking directions open in Google Maps. Your planned stops are shown here.' : 'Check public transport for each leg below. Your planned stops are shown here.'}</p> : loading ? <p><span className="route-spinner"/>Finding the roads between your places…</p> : error ? <div className="route-error"><p><Icon name="info"/>{error}</p><button className="text-button" onClick={() => {setResult(undefined); setRetry(r => r + 1);}}>Retry route <Icon name="arrow_forward"/></button></div> : route ? <><div className="route-metrics"><span><Icon name="route"/><b>{Math.round(route.distance / 1000).toLocaleString('en-IN')} km</b><small>by road</small></span><span><Icon name="schedule"/><b>{travelTime(route.duration)}</b><small>estimated driving</small></span></div><p className="route-disclaimer">Excludes traffic and breaks. Some places need a walk from the nearest road.</p></> : null}
    </div>
    <ol className="route-stops">{points.map((point, index) => <li key={index}><span className={'stop-number ' + (index === points.length - 1 ? 'last-stop' : '')}>{index + 1}</span><span><small>{index === points.length - 1 ? 'DESTINATION' : index === 0 && originPoint ? 'START' : 'ON THE WAY'}</small><b>{point.name}</b></span></li>)}</ol>
    {mode === 'transit' && stops.length > 0 ? <div className="transit-legs">{transitPoints.slice(1).map((point, index) => <a key={index} className="secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?${new URLSearchParams({api: '1', origin: coordinateText(transitPoints[index]), destination: coordinateText(point), travelmode: 'transit'})}`}>Leg {index + 1}: {typeof point === 'string' ? point : point.name} <Icon name="open_in_new"/></a>)}</div> : <a className="primary full-width route-link" target="_blank" rel="noreferrer" href={link}><Icon name="route"/>Open directions in Google Maps <Icon name="open_in_new"/></a>}
    <small className="route-source">Road routes by <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a> · City search by <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo / GeoNames</a></small>
  </section>;
}
