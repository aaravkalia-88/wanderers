import {useEffect, useMemo, useRef, useState} from 'react';
import {Destination} from '../api/destinations';
import {Trip, dateToday, rupees} from '../api/travel';
import {findOrigin, localOrigin, RoutePoint} from '../api/routes';
import {Icon} from './UI';
import Weather from './Weather';
import TripRoute from './TripRoute';

export default function TripPlanner({place, places, onPlace, onSave, initialTrip}: {
  initialTrip?: Trip; place: Destination; places: Destination[]; onPlace: (p: Destination) => void; onSave: (t: Trip) => Promise<void>;
}) {
  const [origin, setOrigin] = useState(initialTrip?.origin || 'New Delhi');
  const [originPoint, setOriginPoint] = useState<RoutePoint | undefined>(() => initialTrip?.origin_point || localOrigin(initialTrip?.origin || 'New Delhi', places));
  const [stopIds, setStopIds] = useState<number[]>(initialTrip?.stop_ids || []);
  const [start, setStart] = useState(initialTrip?.start || dateToday());
  const [days, setDays] = useState(initialTrip?.days || 3);
  const [travelers, setTravelers] = useState(initialTrip?.travelers || 2);
  const [budget, setBudget] = useState(initialTrip?.budget || 15000);
  const [mode, setMode] = useState(initialTrip?.mode || 'driving');
  const [style, setStyle] = useState(initialTrip?.style || 'Slow travel');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originError, setOriginError] = useState('');
  const [finding, setFinding] = useState(false);
  const [candidates, setCandidates] = useState<RoutePoint[]>([]);
  const lookup = useRef<AbortController>();
  const lookupVersion = useRef(0);
  useEffect(() => () => {lookup.current?.abort(); lookupVersion.current++;}, []);
  const stops = useMemo(() => stopIds.map(id => places.find(p => p.id === id)).filter((p): p is Destination => !!p && p.id !== place.id), [stopIds, places, place.id]);
  const available = useMemo(() => places.filter(p => p.id !== place.id && !stopIds.includes(p.id)).sort((a, b) => ((a.latitude - place.latitude) ** 2 + (a.longitude - place.longitude) ** 2) - ((b.latitude - place.latitude) ** 2 + (b.longitude - place.longitude) ** 2)), [places, place, stopIds]);
  const estimate = place.budget_per_day * days * travelers;

  function changeOrigin(value: string) {
    lookup.current?.abort(); lookupVersion.current++;
    setOrigin(value); setOriginPoint(localOrigin(value, places)); setCandidates([]); setOriginError(''); setFinding(false);
  }
  function chooseOrigin(point: RoutePoint) {
    setOrigin(point.name); setOriginPoint(point); setCandidates([]); setOriginError('');
  }
  async function searchOrigin() {
    lookup.current?.abort();
    const version = ++lookupVersion.current;
    const controller = new AbortController(); lookup.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setFinding(true); setOriginError(''); setCandidates([]);
    try {
      const results = await findOrigin(origin, controller.signal);
      if (version !== lookupVersion.current) return;
      if (!results.length) setOriginError('No matching city found. Try a nearby city or use your location.');
      else setCandidates(results);
    } catch (e) {if (version === lookupVersion.current) setOriginError(controller.signal.aborted ? 'City search timed out. Please try again.' : e instanceof Error ? e.message : 'City search is unavailable.');}
    finally {clearTimeout(timeout); if (version === lookupVersion.current) setFinding(false);}
  }
  function locateOrigin() {
    if (!navigator.geolocation) {setOriginError('Your browser does not support location. Enter a starting city.'); return;}
    lookup.current?.abort(); const version = ++lookupVersion.current;
    setFinding(true); setOriginError(''); setCandidates([]);
    navigator.geolocation.getCurrentPosition(pos => {
      if (version !== lookupVersion.current) return;
      chooseOrigin({name: 'My current location', latitude: pos.coords.latitude, longitude: pos.coords.longitude}); setFinding(false);
    }, () => {if (version === lookupVersion.current) {setOriginError('Location is unavailable. Enter a starting city instead.'); setFinding(false);}}, {timeout: 10000});
  }
  function moveStop(index: number, direction: number) {
    const ids = stops.map(p => p.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; setStopIds(ids);
  }

  return <section className="planner-page">
    <span className="eyebrow">A good trip starts with a little curiosity</span><h1>Turn “someday” into a plan.</h1><p className="page-intro">Pick your places. Follow the road. Make room for the unexpected.</p>
    <div className="planner-layout">
      <form className="planner-form" onSubmit={async e => {e.preventDefault(); setSaving(true); setError(''); try {await onSave({place_id: place.id, origin: origin.trim(), origin_point: originPoint, stop_ids: stops.map(p => p.id), start, days, travelers, budget, mode, style});} catch (e) {setError(e instanceof Error ? e.message : 'Could not save trip.');} finally {setSaving(false);}}}>
        <h3>Your escape, your way.</h3>
        <div className="origin-field"><label>Where from?<input required maxLength={120} value={origin} placeholder="Your starting city" onChange={e => changeOrigin(e.target.value)} list="origin-places"/></label><datalist id="origin-places"><option value="New Delhi"/>{places.map(p => <option key={p.id} value={p.name}/>)}</datalist>
          <div className="origin-actions">{!originPoint && <button type="button" className="text-button" disabled={finding || origin.trim().length < 2} onClick={searchOrigin}><Icon name="search"/>{finding ? 'Finding…' : 'Find city'}</button>}<button type="button" className="text-button" disabled={finding} onClick={locateOrigin}><Icon name="my_location"/>Use my location</button></div>
          {originPoint && <small className="origin-resolved"><Icon name="check_circle"/>Starting point set</small>}
          {originError && <p className="form-error" role="alert">{originError}</p>}
          {candidates.length > 0 && <div className="origin-results"><span>Choose your starting point</span>{candidates.map((point, i) => <button type="button" key={i} onClick={() => chooseOrigin(point)}><Icon name="location_on"/>{point.name}<Icon name="chevron_right"/></button>)}</div>}
        </div>
        <label>Where to?<select value={place.id} onChange={e => {onPlace(places.find(p => p.id === +e.target.value)!); setStopIds(ids => ids.filter(id => id !== +e.target.value));}}>{places.map(p => <option key={p.id} value={p.id}>{p.name}, {p.state}</option>)}</select></label>
        <fieldset className="stop-editor"><legend>Make a little detour <span>Optional · up to 3 stops</span></legend>
          {stops.map((p, i) => <div className="editable-stop" key={p.id}><span className="stop-dot">{i + 1}</span><b>{p.name}</b><div><button type="button" aria-label={`Move ${p.name} earlier`} disabled={i === 0} onClick={() => moveStop(i, -1)}><Icon name="north"/></button><button type="button" aria-label={`Move ${p.name} later`} disabled={i === stops.length - 1} onClick={() => moveStop(i, 1)}><Icon name="south"/></button><button type="button" aria-label={`Remove ${p.name} stop`} onClick={() => setStopIds(ids => ids.filter(id => id !== p.id))}><Icon name="close"/></button></div></div>)}
          {stops.length < 3 && <label className="add-stop-label"><span>Add a stop</span><select aria-label="Add a stop" value="" onChange={e => {if (e.target.value) setStopIds(ids => [...ids, +e.target.value]);}}><option value="">Choose a place along the way</option>{available.map(p => <option key={p.id} value={p.id}>{p.name}, {p.state}</option>)}</select></label>}
          {stops.length === 0 && <div className="suggested-stops"><small>Closest to {place.name}</small>{available.slice(0, 2).map(p => <button type="button" key={p.id} onClick={() => setStopIds(ids => [...ids, p.id])}><Icon name="add"/>{p.name}</button>)}</div>}
        </fieldset>
        <div className="form-row"><label>Start date<input type="date" min={dateToday()} required value={start} onChange={e => setStart(e.target.value)}/></label><label>Days<input type="number" min="1" max="14" required value={days} onChange={e => setDays(+e.target.value)}/></label></div>
        <div className="form-row"><label>Travelers<input type="number" min="1" max="12" required value={travelers} onChange={e => setTravelers(+e.target.value)}/></label><label>Total budget (₹)<input type="number" min="500" max="1000000" required value={budget} onChange={e => setBudget(+e.target.value)}/></label></div>
        <label>Travel style<select value={style} onChange={e => setStyle(e.target.value)}>{['Slow travel', 'Adventure', 'Culture'].map(s => <option key={s}>{s}</option>)}</select></label><label>Transport<select value={mode} onChange={e => setMode(e.target.value)}><option value="driving">Road trip</option><option value="transit">Public transport</option><option value="walking">Walking</option></select></label>
        {error && <p className="form-error" role="alert">{error}</p>}<button className="primary full-width" disabled={saving}>{saving ? 'Saving…' : 'Save this trip'}<Icon name="bookmark_add"/></button>
      </form>
      <div className="trip-preview">
        <div className="trip-cover"><img src={place.image_url} alt="Landscape inspiration"/><div><span className="eyebrow">{days} days in {place.state}</span><h2>{place.name}</h2></div></div>
        <TripRoute origin={origin} originPoint={originPoint} stops={stops} destination={place} mode={mode}/>
        <div className="trip-summary"><span><Icon name="group"/>{travelers} travelers</span><span><Icon name="calendar_month"/>{start}</span><span><Icon name="eco"/>{style}</span></div>
        <div className="cost-summary"><div><span className="eyebrow">Estimated local spend</span><h2>{rupees(estimate)}</h2><small>Stay, meals & local activities · extra stops & travel not included</small></div><span className={estimate > budget ? 'over-budget' : 'under-budget'}>{estimate > budget ? `${rupees(estimate - budget)} over budget` : `${rupees(budget - estimate)} remaining`}</span></div>
        <h3>Your suggested itinerary</h3><div className="itinerary">{Array.from({length: Math.min(14, Math.max(1, days))}, (_, i) => <div key={i}><span>{String(i + 1).padStart(2, '0')}</span><div><small>DAY {i + 1}</small><h4>{i === 0 ? 'Arrive. Breathe. Settle in.' : i === days - 1 ? 'One last look, then the road home.' : place.activities[(i + (style === 'Adventure' ? 1 : style === 'Culture' ? 2 : 0)) % place.activities.length]}</h4><p>{i === 0 ? 'Meet your host, get your bearings, and take a gentle walk.' : i === days - 1 ? 'Leave time for a slow morning and your onward journey.' : 'Set aside an unhurried day. Ask a local guide about access and the best time to go.'}</p></div></div>)}</div>
        <small className="route-note">This itinerary is a planning suggestion, with estimates rather than booking prices.</small><Weather key={place.id} id={place.id} full/>
      </div>
    </div>
  </section>;
}
