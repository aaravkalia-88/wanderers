import {useEffect, useRef, useState, KeyboardEvent} from 'react';
import {Destination} from '../api/destinations';
import {token, ensureSession} from '../api/travel';
import {ResearchCategory, ResearchInput, ResearchResult, defaultCheckout, researchKey, startResearch, getResearch, cancelResearch} from '../api/research';
import {Icon} from './UI';
import './TripResearch.css';

const pending = (result?: ResearchResult) => !!result && ['STARTING', 'RUNNING'].includes(result.status);
const checked = (seconds: number) => new Date(seconds * 1000).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'});
const slots: [ResearchCategory, string?][] = [['essentials'], ['stays'], ['experiences'], ['stays', 'booking'], ['stays', 'makemytrip'], ['experiences', 'thrillophilia'], ['experiences', 'official']];

export default function TripResearch({place, start, days, travelers, style}: {place: Destination; start: string; days: number; travelers: number; style: string}) {
  const [tab, setTab] = useState<'essentials' | 'compare'>('essentials');
  const [adults, setAdults] = useState(travelers);
  const [rooms, setRooms] = useState(1);
  const [checkout, setCheckout] = useState(() => defaultCheckout(start, days));
  const [results, setResults] = useState<Record<string, ResearchResult>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const version = useRef(0);
  const requests = useRef(new Map<string, AbortController>());
  const latest = useRef(results); latest.current = results;
  const base = {place_id: place.id, start, days, travelers, style, adults, rooms, checkout};
  const context = JSON.stringify(base);
  const valid = Number.isInteger(adults) && adults >= 1 && adults <= 12 && Number.isInteger(rooms) && rooms >= 1 && rooms <= adults && checkout > start && checkout <= defaultCheckout(start, 31);

  useEffect(() => {setAdults(travelers); setRooms(1);}, [travelers]);
  useEffect(() => {setCheckout(defaultCheckout(start, days));}, [start, days]);

  useEffect(() => {
    const current = ++version.current;
    setResults({}); setErrors({}); setBusy({}); latest.current = {};
    requests.current.forEach(controller => controller.abort()); requests.current.clear();
    const controller = new AbortController();
    const identity = token();
    if (identity && valid) {
      for (const [category, source] of slots) {
        const input: ResearchInput = {...base, category, mode: source ? 'live' : 'discovery', ...(source ? {source} : {})};
        const slot = category + ':' + (source || 'discovery');
        (async () => {
          try {
            const key = await researchKey(input, identity);
            const id = sessionStorage.getItem(key);
            if (!id || !/^[\w-]{1,128}$/.test(id)) return;
            const result = await getResearch(id, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
            if (version.current === current && token() === identity && (pending(result) || result.status === 'UNKNOWN' || (result.expires_at || 0) > Date.now() / 1000)) {
              setResults(previous => ({...previous, [slot]: result}));
            }
          } catch { /* Expired or inaccessible jobs can be researched again. */ }
        })();
      }
    }
    return () => {version.current++; controller.abort(); requests.current.forEach(request => request.abort()); requests.current.clear();};
  }, [context]);

  useEffect(() => {
    const current = version.current;
    const identity = token();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (stopped) return;
      if (!document.hidden && token() === identity) {
        await Promise.all(Object.entries(latest.current).filter(([, result]) => pending(result) && result.id).map(async ([slot, result]) => {
          try {
            const update = await getResearch(result.id!, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
            if (!stopped && version.current === current && token() === identity) {
              setResults(previous => pending(previous[slot]) ? {...previous, [slot]: update} : previous);
              setErrors(previous => ({...previous, [slot]: ''}));
            }
          } catch {
            if (!stopped && version.current === current) setErrors(previous => ({...previous, [slot]: 'Status could not be checked. We’ll retry while this panel is open.'}));
          }
        }));
      }
      if (!stopped) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => {stopped = true; clearTimeout(timer); controller.abort();};
  }, [context]);

  async function run(category: ResearchCategory, source?: string) {
    if (!valid) return;
    const slot = category + ':' + (source || 'discovery');
    if (requests.current.has(slot) || pending(latest.current[slot])) return;
    const current = version.current;
    const controller = new AbortController(); requests.current.set(slot, controller);
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(previous => ({...previous, [slot]: true})); setErrors(previous => ({...previous, [slot]: ''}));
    try {
      await ensureSession();
      const identity = token();
      const input: ResearchInput = {...base, category, mode: source ? 'live' : 'discovery', ...(source ? {source} : {})};
      const result = await startResearch(input, controller.signal);
      if (version.current !== current || token() !== identity) return;
      setResults(previous => ({...previous, [slot]: result}));
      if (result.id) {
        try {sessionStorage.setItem(await researchKey(input, identity), result.id);} catch { /* Research still works with storage blocked. */ }
      }
    } catch (error) {
      if (version.current === current) setErrors(previous => ({...previous, [slot]: controller.signal.aborted ? 'Loading stopped. Retry to recover the same check.' : error instanceof Error ? error.message : 'Research is unavailable. Please try again.'}));
    } finally {
      clearTimeout(timeout);
      if (requests.current.get(slot) === controller) requests.current.delete(slot);
      if (version.current === current) setBusy(previous => ({...previous, [slot]: false}));
    }
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'essentials' : event.key === 'End' ? 'compare' : tab === 'essentials' ? 'compare' : 'essentials';
    setTab(next); document.getElementById(next + '-tab')?.focus();
  }

  async function cancel(slot: string) {
    requests.current.get(slot)?.abort();
    const result = results[slot];
    if (!result?.id || !pending(result)) return;
    const current = version.current, identity = token();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const update = await cancelResearch(result.id, controller.signal);
      if (version.current === current && token() === identity) setResults(previous => ({...previous, [slot]: update}));
    } catch {
      if (version.current === current) setErrors(previous => ({...previous, [slot]: 'Cancellation is not confirmed. Retry cancel or use the supplier link.'}));
    } finally {clearTimeout(timeout);}
  }

  function panel(category: ResearchCategory, title: string) {
    const discovery = results[category + ':discovery'];
    const related = Object.entries(results).filter(([, result]) => result.category === category);
    const cards = related.flatMap(([, result]) => result.cards.map(card => ({...card, live: result.mode === 'live'})))
      .sort((a, b) => Number(b.live) - Number(a.live)).filter((card, index, all) => all.findIndex(other => other.url === card.url) === index).slice(0, 5);
    const status = related.some(([, result]) => pending(result)) || Object.entries(busy).some(([slot, loading]) => slot.startsWith(category + ':') && loading);
    return <section className="research-category" aria-label={title}>
      <div className="research-heading"><h4>{title}</h4><button type="button" className="secondary" disabled={!valid || busy[category + ':discovery']} onClick={() => run(category)}><Icon name="search"/>{discovery ? 'Check sources' : 'Find sources'}</button></div>
      {status && <div className="research-loading"><progress aria-label={'Researching ' + title}/><span role="status">Checking sources. This may take a little while…</span></div>}
      {Object.entries(busy).filter(([slot, loading]) => slot.startsWith(category + ':') && loading).map(([slot]) => <button key={slot} type="button" className="text-button" onClick={() => cancel(slot)}>Stop loading</button>)}
      {related.map(([slot, result]) => <div key={slot} className="research-status">
        {result.notice && <p role="status">{result.notice}</p>}
        {pending(result) && <button type="button" className="text-button" onClick={() => cancel(slot)}>Cancel check</button>}
      </div>)}
      {Object.entries(errors).filter(([slot, error]) => slot.startsWith(category + ':') && error).map(([slot, error]) => <div key={slot} className="research-error" role="alert"><p>{error}</p><button type="button" className="text-button" disabled={!valid || busy[slot]} onClick={() => run(category, slot.split(':')[1] === 'discovery' ? undefined : slot.split(':')[1])}>Retry</button></div>)}
      <div className="research-cards">{cards.map(card => <article key={card.url}>
        <div className="research-card-meta"><span>{card.date_checked ? 'Date-checked offer' : 'Discovery · availability not confirmed'}</span><span>{card.source === 'official' ? 'Official source' : card.source}</span></div>
        <h5><a href={card.url} target="_blank" rel="noreferrer">{card.title}<Icon name="open_in_new"/></a></h5>
        <p>{card.description}</p>
        {card.price ? <div className="research-price"><strong>{card.price.currency} {Number(card.price.amount).toLocaleString('en-IN')}</strong><span>{card.price.basis}</span><small>Taxes: {card.price.taxes || 'Not confirmed'}</small><small>Cancellation: {card.price.cancellation || 'Not confirmed'}</small></div> : category !== 'essentials' && <p className="research-unconfirmed">Price: Not confirmed</p>}
        {category !== 'essentials' && <p className="research-unconfirmed">Availability: {card.availability === 'not_confirmed' ? 'Not confirmed' : card.availability}</p>}
        {card.excerpt && <details><summary>Read source excerpt</summary><p>{card.excerpt}</p></details>}
        {card.checked_at && <small className="research-checked">Source checked {checked(card.checked_at)}</small>}
      </article>)}</div>
      {!cards.length && !status && <p className="research-empty">{category === 'essentials' ? 'Find current visitor information, access details and local suggestions.' : 'Discover a shortlist, then check a supplier for your dates. Prices can change before booking.'}</p>}
      {discovery && <div className="research-sources"><span>Continue with a source</span>{discovery.sources.map(source => <div key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<Icon name="open_in_new"/></a>{source.live_enabled && <button type="button" className="text-button" disabled={!valid || busy[category + ':' + source.id] || pending(results[category + ':' + source.id])} onClick={() => run(category, source.id)}>Check live options</button>}</div>)}</div>}
    </section>;
  }

  return <section className="trip-research" aria-labelledby="research-title">
    <div className="research-title"><div><span className="eyebrow">A little research, a better journey</span><h3 id="research-title">Research this trip<em>.</em></h3></div><Icon name="travel_explore"/></div>
    <p className="research-intro">Explore {place.name} with source-backed information and options for your trip.</p>
    <div className="research-tabs" role="tablist" aria-label="Trip research"><button type="button" role="tab" id="essentials-tab" aria-selected={tab === 'essentials'} aria-controls="essentials-panel" tabIndex={tab === 'essentials' ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab('essentials')}>Trip essentials</button><button type="button" role="tab" id="compare-tab" aria-selected={tab === 'compare'} aria-controls="compare-panel" tabIndex={tab === 'compare' ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab('compare')}>Stays & experiences</button></div>
    <div id="essentials-panel" role="tabpanel" aria-labelledby="essentials-tab" hidden={tab !== 'essentials'}>{panel('essentials', 'Know before you go')}</div>
    <div id="compare-panel" role="tabpanel" aria-labelledby="compare-tab" hidden={tab !== 'compare'}>
      <div className="research-occupancy"><label>Adults<input type="number" min="1" max="12" value={adults} onChange={event => setAdults(+event.target.value)}/></label><label>Rooms<input type="number" min="1" max={adults} value={rooms} onChange={event => setRooms(+event.target.value)}/></label><label>Check-out<input type="date" min={defaultCheckout(start, 1)} max={defaultCheckout(start, 31)} value={checkout} onChange={event => setCheckout(event.target.value)}/></label></div>
      <p className="research-note">Arrival: {start} · Adult-only pricing. Choose dates and room counts before checking live options.</p>
      {!valid && <p className="form-error" role="alert">Choose 1–12 adults, at least one adult per room, and a check-out after arrival.</p>}
      {panel('stays', 'Somewhere to settle in')}{panel('experiences', 'Make room for an experience')}
    </div>
  </section>;
}
