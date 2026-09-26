import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {Destination} from '../api/destinations';
import {Entry} from '../api/travel';
import {RoutePoint} from '../api/routes';
import {usePreferences} from '../preferences';
import {Icon} from './UI';

export interface MapRoute {points: RoutePoint[]; coordinates?: [number, number][]}
export default function TravelMap({places, entries, onSelect, selected, route}: {
  places: Destination[]; entries: Entry[]; onSelect: (d: Destination) => void; selected?: number; route?: MapRoute;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const markers = useRef<L.LayerGroup>();
  const tiles = useRef<L.TileLayer>();
  const locationMarker = useRef<L.CircleMarker>();
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const {dark} = usePreferences();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const instance = L.map(ref.current, {scrollWheelZoom: false, zoomAnimation: false, markerZoomAnimation: false, fadeAnimation: false}).setView([23.8, 80], 5);
    map.current = instance;
    markers.current = L.layerGroup().addTo(instance);
    setReady(true);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(ref.current);
    return () => {resize.disconnect(); instance.stop(); instance.remove(); map.current = undefined;};
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    tiles.current?.remove();
    const tileKey = import.meta.env.VITE_CARTO_API_KEY;
    const tileUrl = `https://basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png${tileKey ? '?key=' + encodeURIComponent(tileKey) : ''}`;
    const layer = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', maxZoom: 19,
    }).addTo(map.current);
    tiles.current = layer;
    layer.on('tileerror', () => setError('Map tiles could not load. Check your connection.'));
    layer.on('tileload', () => setError(current => current.startsWith('Map tiles') ? '' : current));
    // Leaflet's remove event detaches its map listeners; keep it until removal.
    return () => {layer.remove();};
  }, [ready, dark]);

  useEffect(() => {
    if (!ready || !map.current || !markers.current) return;
    const layer = markers.current;
    map.current.stop();
    layer.clearLayers();
    if (route) {
      if (route.coordinates?.length) {
        L.polyline(route.coordinates, {color: dark ? '#11131b' : '#fff', weight: 9, opacity: .8}).addTo(layer);
        L.polyline(route.coordinates, {color: dark ? '#60dad0' : '#008780', weight: 5, opacity: 1, className: 'planned-road-route'}).addTo(layer);
      }
      route.points.forEach((point, index) => {
        const label = document.createElement('span');
        label.className = 'route-pin ' + (index === route.points.length - 1 ? 'destination-pin' : '');
        label.textContent = String(index + 1);
        const tooltip = document.createElement('span');
        tooltip.textContent = `${index + 1}. ${point.name}`;
        L.marker([point.latitude, point.longitude], {icon: L.divIcon({className: 'route-marker', html: label, iconSize: [32, 32], iconAnchor: [16, 16]}), title: tooltip.textContent, alt: tooltip.textContent}).addTo(layer).bindTooltip(tooltip);
      });
      const bounds: [number, number][] = [...(route.coordinates || []), ...route.points.map(p => [p.latitude, p.longitude] as [number, number])];
      if (bounds.length) map.current.fitBounds(bounds, {padding: [45, 45], maxZoom: 11});
      return;
    }
    places.forEach(p => {
      const status = entries.find(e => e.place_id === p.id)?.status || 'Not Visited';
      const color = status === 'Visited' ? '#008780' : status === 'Saved' || status === 'Want To Visit' ? '#d43848' : status === 'Exploring' ? '#4884ac' : '#8990a4';
      const marker = L.circleMarker([p.latitude, p.longitude], {radius: p.id === selected ? 12 : 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1}).addTo(layer);
      const label = document.createElement('span'); label.textContent = p.name + ' · ' + status;
      marker.bindTooltip(label).on('click', () => callback.current(p));
    });
    const place = places.find(p => p.id === selected);
    if (place) map.current.flyTo([place.latitude, place.longitude], 9, {duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : .6});
    else if (places.length) map.current.fitBounds(places.map(p => [p.latitude, p.longitude]), {padding: [45, 45], maxZoom: 9});
  }, [places, entries, selected, ready, route, dark]);

  function locate() {
    if (!navigator.geolocation) {setError('Your browser does not support location.'); return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      if (!map.current) return;
      locationMarker.current?.remove();
      locationMarker.current = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {radius: 9, color: '#4884ac'}).addTo(map.current).bindTooltip('You are here');
      map.current.setView([pos.coords.latitude, pos.coords.longitude], 8);
      setError(''); setLocating(false);
    }, () => {if (map.current) {setError('Location is unavailable. You can still explore the map.'); setLocating(false);}}, {timeout: 10000});
  }
  return <div className="map-wrap"><div ref={ref} className="travel-map" aria-label={route ? 'Planned trip route map' : 'Interactive destination map'}/>{error && <div className="map-message" role="status">{error}</div>}<button type="button" className="map-locate" onClick={locate} disabled={!ready || locating}><Icon name="my_location"/>{locating ? 'Locating…' : 'My location'}</button>{!route && <div className="map-legend"><span><i/>To discover</span><span><i className="saved"/>Saved</span><span><i className="visited"/>Visited</span></div>}</div>;
}
