import {lazy, Suspense, useState} from 'react';
import {Destination} from '../api/destinations';
import {Entry, Passport, Trip, rupees, isGuestPassport} from '../api/travel';
import DestinationCard from './DestinationCard';
import {Icon, Modal} from './UI';
import './PassportPage.css';
import referenceArtwork from '../data/passport-art.json';
const passportArtwork: Record<string, string> = referenceArtwork;

const TravelMap = lazy(() => import('./TravelMap'));
const categories: Record<string, string> = {Mountains: 'landscape', Forests: 'forest', 'Water & coast': 'water', Heritage: 'temple_hindu', Wildlife: 'pets', Mystery: 'dark_mode'};
const sections = [['Stamps', 'auto_stories'], ['Saved', 'bookmark_border'], ['Trips', 'luggage'], ['Map', 'map'], ['Achievements', 'workspace_premium']] as const;
type Section = typeof sections[number][0];

interface Props {
  passport: Passport;
  trips: Trip[];
  places: Destination[];
  busy: boolean;
  connected: boolean;
  profile: boolean;
  onNavigate: (page: string) => void;
  onOpen: (place: Destination) => void;
  onVisit: (place: Destination) => void;
  onSave: (place: Destination) => void;
  onTrip: (trip: Trip) => void;
  onAuth: (mode: 'login' | 'register') => void;
  onExport: () => void;
  onSignOut: () => void;
}

export default function PassportPage({passport, trips, places, busy, connected, profile, onNavigate, onOpen, onVisit, onSave, onTrip, onAuth, onExport, onSignOut}: Props) {
  const [section, setSection] = useState<Section>('Stamps');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('All states');
  const [sort, setSort] = useState('gazette');
  const [stampStatus, setStampStatus] = useState('All');
  const [group, setGroup] = useState('All sectors');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [mapStatus, setMapStatus] = useState('Visited');
  const [logging, setLogging] = useState(false);
  const [visitPlace, setVisitPlace] = useState('');
  const guest = isGuestPassport(passport) || !connected;
  const name = guest ? 'Fellow Wanderer' : passport.username;
  const byId = new Map(places.map(p => [p.id, p]));
  const visited = passport.entries.filter(e => e.status === 'Visited');
  const catalogVisits = visited.filter(entry => byId.has(entry.place_id)).length;
  const completion = places.length ? Math.round(catalogVisits / places.length * 100) : 0;
  const saved = passport.entries.filter(e => e.status === 'Saved' || e.status === 'Want To Visit');
  const collection = places.filter(place => section !== 'Saved' || saved.some(entry => entry.place_id === place.id)).map(place => ({place,
    entry: passport.entries.find(entry => entry.place_id === place.id) || {place_id: place.id, status: 'Not Visited', visit_date: null, notes: '', rating: 0, stamp_id: null},
  }));
  const states = [...new Set(collection.map(({place}) => place.state))].sort();
  const filtered = collection.filter(({place, entry}) => (state === 'All states' || place.state === state)
    && (section === 'Saved' || stampStatus === 'All' || (entry.status === 'Visited') === (stampStatus === 'Visited'))
    && (section === 'Saved' || group === 'All sectors' || place.group === group)
    && `${place.name} ${place.state} ${place.category} ${place.group} ${entry.notes}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'gazette') return a.place.id - b.place.id;
    if (sort === 'name') return a.place.name.localeCompare(b.place.name);
    if (sort === 'rating') return b.entry.rating - a.entry.rating;
    return sort === 'oldest' ? (a.entry.visit_date || '').localeCompare(b.entry.visit_date || '') : (b.entry.visit_date || '').localeCompare(a.entry.visit_date || '');
  });
  const achievements = passport.achievements.length ? passport.achievements : [
    {name: 'First Journey', count: 0, target: 1, unlocked: false},
    {name: 'Hidden Gem Hunter', count: 0, target: 5, unlocked: false},
    {name: 'State Hopper', count: 0, target: 5, unlocked: false},
  ];
  const unlocked = achievements.filter(a => a.unlocked).length;
  const counts: Partial<Record<Section, number>> = {Stamps: visited.length, Saved: saved.length, Trips: trips.length, Achievements: unlocked};
  const mapPlaces = places.filter(p => mapStatus === 'All places' || (mapStatus === 'Saved' ? saved : visited).some(e => e.place_id === p.id));

  function openSection(next: Section) {setSection(next); setSearch(''); setState('All states'); setSort(next === 'Saved' ? 'name' : 'gazette'); setGroup('All sectors'); setStampStatus('All');}
  function logVisit() {setVisitPlace(''); setLogging(true);}

  return <section className="passport-hub" aria-label="Your travel passport">
    <header className="ledger-heading"><div><span className="eyebrow">BHARAT EXPEDITION JOURNAL</span><h1>{profile ? `The journal of ${name}` : 'Wanderer’s Passport'}</h1></div><div className="ledger-holder"><Icon name="workspace_premium"/><span>{name}<small>{passport.tier}</small></span></div></header>
    <div className="ledger-registry"><span><i/>{connected ? 'REGISTRY LEDGER ACTIVE' : 'REGISTRY OFFLINE'} · FIELD SEASON {new Date().getFullYear()}</span><span>INDIA · A PERSONAL RECORD OF DISCOVERY</span></div>
    <div className="ledger-spread">
      <article className="ledger-certificate">
        <div className="ledger-certificate-top"><span className="eyebrow"><Icon name="explore"/>EXPLORER FIELD CERTIFICATE</span><div className="ledger-seal" aria-hidden="true"><span>WANDERER</span><Icon name="explore"/><small>FIELD JOURNAL</small></div></div>
        <h2>Wanderer Expedition Passport</h2><p>Archival survey of {places.length} hidden sanctuaries, heritage sites & highlands.</p>
        <dl className="ledger-identity"><div><dt>FIELD VOYAGER</dt><dd>{name}</dd><small>{guest ? 'GUEST EDITION' : 'PERSONAL EXPEDITION RECORD'}</small></div><div><dt>JOURNAL AUTHORITY</dt><dd>Republic of Wanderers</dd><small>Independent travel archive</small></div><div><dt>VOYAGER STANDING</dt><dd><Icon name="shield"/>{passport.tier}</dd><small>{passport.xp.toLocaleString()} TRAVEL XP</small></div></dl>
        <div className="ledger-fold"><span>FOLD ALONG ARCHIVAL PERFORATION</span><Icon name="content_cut"/></div>
        <span className="eyebrow">FIELD SPECIALIZATIONS CONFERRED</span>
        <div className="ledger-specializations">{achievements.filter(a => a.unlocked).length ? achievements.filter(a => a.unlocked).map(a => <span key={a.name}><Icon name="verified"/>{a.name}</span>) : <span><Icon name="landscape"/>Your first discovery begins the collection</span>}</div>
      </article>
      <article className="ledger-progress">
        <div><span className="eyebrow">EXPEDITION LEDGER PROGRESS</span><b>{catalogVisits} / {places.length} STAMPED</b></div>
        <p className="ledger-percentage"><strong>{completion}%</strong><span>Completed</span></p>
        <progress aria-label="Expedition completion" max={places.length || 1} value={catalogVisits}/>
        <div className="ledger-counts"><div><span>LOGGED DISCOVERIES</span><strong>{visited.length} Places</strong><small>{passport.states} states explored</small></div><div><span>AWAITING SURVEY</span><strong>{Math.max(0, places.length - catalogVisits)} Sites</strong><small>One unforgettable country</small></div></div>
        <div className="ledger-actions"><button className="secondary" onClick={onExport}><Icon name="picture_as_pdf"/>Export ledger PDF</button><button className="primary" disabled={busy || !places.length} onClick={logVisit}><Icon name="edit"/>Claim field stamp</button></div>
      </article>
    </div>

    <div className="ph-stats">
      {[[visited.length, 'Places visited', 'auto_stories', 'Stamps'], [passport.states, 'States explored', 'public', 'Map'], [saved.length, 'Saved for later', 'bookmark_border', 'Saved'], [trips.length, 'Trips in the making', 'route', 'Trips']].map(([value, label, icon, target]) => <button key={label} onClick={() => openSection(target as Section)}><span className="ph-stat-icon"><Icon name={String(icon)}/></span><span><strong>{value}</strong><small>{label}</small></span><Icon name="north_east"/></button>)}
    </div>

    {guest ? <div className="ph-account"><span className="ph-account-icon"><Icon name="lock"/></span><div><h3>Good stories deserve a forever home.</h3><p>Create an account to keep your stamps and pick up on another device.</p></div><button className="text-button" onClick={() => onAuth('login')}>Sign in</button><button className="secondary" onClick={() => onAuth('register')}>Make it yours <Icon name="arrow_forward"/></button></div> : <div className="ph-account ph-account-member"><span className="ph-account-icon"><Icon name="check_circle"/></span><div><h3>Your story, all in one place.</h3><p>Signed in as {name}. Your passport is ready when you are.</p></div><button className="text-button" onClick={() => onNavigate('Settings')}><Icon name="settings"/>Account settings</button><button className="secondary" onClick={() => onAuth('login')}>Switch account</button><button className="text-button" onClick={onSignOut}>Sign out</button></div>}

    <nav className="ph-tabs" aria-label="Passport sections">{sections.map(([label, icon]) => <button key={label} className={section === label ? 'active' : ''} aria-pressed={section === label} onClick={() => openSection(label)}><Icon name={icon}/>{label}{counts[label] !== undefined && <span>{counts[label]}</span>}</button>)}</nav>

    <div className="ph-content" key={section}>
      {(section === 'Stamps' || section === 'Saved') && <>
        <div className="ph-section-heading"><div><span className="eyebrow">{section === 'Stamps' ? 'THE COLLECTOR’S GAZETTE' : 'FOR YOUR NEXT “LET’S JUST GO”'}</span><h2>{section === 'Stamps' ? 'Expedition Philatelic Index' : 'Still on your mind'}<span>.</span></h2></div><span className="ph-count">Showing {filtered.length} of {collection.length} {section === 'Stamps' ? 'stamps' : 'saved places'}</span></div>
        {collection.length > 0 && <div className="ph-toolbar">
          <label className="ph-search"><Icon name="search"/><input aria-label={section === 'Stamps' ? 'Search stamps' : 'Search saved places'} placeholder={section === 'Stamps' ? 'Filter destination, state, or terrain…' : 'Find a saved place…'} value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}><Icon name="close"/></button>}</label>
          <select aria-label="Filter by state" value={state} onChange={e => setState(e.target.value)}><option>All states</option>{states.map(s => <option key={s}>{s}</option>)}</select>
          <select aria-label="Sort collection" value={sort} onChange={e => setSort(e.target.value)}>{section === 'Stamps' && <><option value="gazette">Original gazette</option><option value="newest">Newest visits</option><option value="oldest">Oldest visits</option><option value="rating">Highest rated</option></>}<option value="name">Name A–Z</option></select>
          {section === 'Stamps' && <div className="ph-view"><button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid_view"/></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="auto_stories"/></button></div>}
        </div>}
        {section === 'Stamps' && <div className="ledger-filters"><div role="group" aria-label="Stamp status">{['All', 'Visited', 'Unvisited'].map(value => <button key={value} aria-pressed={stampStatus === value} onClick={() => setStampStatus(value)}>{value} ({value === 'All' ? places.length : value === 'Visited' ? catalogVisits : places.length - catalogVisits})</button>)}</div><div role="group" aria-label="Stamp sector">{['All sectors', ...new Set(places.map(p => p.group))].map(value => <button key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{value} ({value === 'All sectors' ? places.length : places.filter(p => p.group === value).length})</button>)}</div></div>}
        {filtered.length > 0 ? section === 'Saved' ? <div className="destination-grid">{filtered.map(({place, entry}) => <DestinationCard key={place.id} p={place} e={entry} busy={busy} onOpen={onOpen} onSave={onSave}/>)}</div> : <div className={'postage-grid postage-' + view}>{filtered.map(({place, entry}) => <article className={'postage-stamp ' + (entry.status === 'Visited' ? 'stamped' : 'awaiting')} key={place.id}>
          <button className="postage-open" onClick={() => onOpen(place)} aria-label={'Explore ' + place.name}>
            <div className="postage-face"><span>BHARAT EXPEDITION</span><b>IN–{String(place.id).padStart(2, '0')}</b></div>
            <div className="postage-image"><img src={passportArtwork[place.id] || place.image_url} alt={'Illustration of ' + place.name} loading="lazy" onError={event => {event.currentTarget.onerror = null; event.currentTarget.src = '/landscape.svg';}}/><span className="postage-postmark"><span>{entry.status === 'Visited' ? 'VISITED' : 'AWAITING'}</span><Icon name={entry.status === 'Visited' ? 'verified' : categories[place.group] || 'explore'}/><b>{entry.visit_date || 'DISCOVERY'}</b><small>{place.latitude.toFixed(2)}° N</small></span></div>
            <div className="postage-description"><span>{place.state}</span><h3>{place.name}</h3><p>{entry.status === 'Visited' && entry.notes ? entry.notes : place.description}</p></div>
          </button>
          <button className="postage-claim" onClick={() => onVisit(place)} disabled={busy}><Icon name={entry.status === 'Visited' ? 'edit' : 'add'}/>{entry.status === 'Visited' ? 'Edit field memory' : 'Claim this stamp'}<Icon name="north_east"/></button>
        </article>)}</div> : <div className="ph-empty">
          <div className="ph-empty-emblem"><Icon name={collection.length ? 'search' : section === 'Stamps' ? 'auto_stories' : 'bookmark_border'}/><span><Icon name={collection.length ? 'explore' : 'add'}/></span></div>
          <span className="eyebrow">{collection.length ? 'LET’S LOOK A LITTLE WIDER' : section === 'Stamps' ? 'PAGE ONE STARTS WITH YOU' : 'A LITTLE INSPIRATION GOES A LONG WAY'}</span>
          <h3>{collection.length ? 'No places match just yet.' : section === 'Stamps' ? 'Big main character energy. Zero stamps yet.' : 'Your next obsession belongs here.'}</h3>
          <p>{collection.length ? 'Try another place, memory, or state.' : section === 'Stamps' ? 'That mountain morning. That chai stop. Give the places you’ve been a little space in your story.' : 'Tap the bookmark on a place you love. We’ll keep it here until “someday” becomes a date.'}</p>
          {collection.length ? <button className="secondary" onClick={() => {setSearch(''); setState('All states'); setStampStatus('All'); setGroup('All sectors');}}>Clear filters <Icon name="close"/></button> : <div className="ph-empty-actions"><button className="primary" onClick={section === 'Stamps' ? logVisit : () => onNavigate('Explore')}>{section === 'Stamps' ? 'Collect your first stamp' : 'Find a place to love'}<Icon name="arrow_forward"/></button>{section === 'Stamps' && <button className="text-button" onClick={() => onNavigate('Explore')}>Get inspired <Icon name="north_east"/></button>}</div>}
        </div>}
        {!collection.length && <div className="ph-inspiration"><div><span className="eyebrow">A FEW PLACES TO FALL FOR</span><h3>The group chat needs a destination.</h3></div><div>{places.slice(0, 3).map(place => <button key={place.id} onClick={() => onOpen(place)}><img src={place.image_url} alt="" loading="lazy" onError={e => {e.currentTarget.onerror = null; e.currentTarget.src = '/landscape.svg';}}/><span><b>{place.name}</b><small>{place.state}</small></span><Icon name="north_east"/></button>)}</div></div>}
      </>}

      {section === 'Trips' && <><div className="ph-section-heading"><div><span className="eyebrow">TURN “WE SHOULD GO” INTO A PLAN</span><h2>Your next chapters<span>.</span></h2></div><button className="secondary" onClick={() => onNavigate('Planner')}><Icon name="add"/>Plan a trip</button></div>{trips.length ? <div className="ph-trips">{trips.map((trip, index) => {const place = byId.get(trip.place_id); return <button key={trip.id ?? index} onClick={() => onTrip(trip)} disabled={!place}><img src={place?.image_url || '/landscape.svg'} alt="" loading="lazy" onError={e => {e.currentTarget.onerror = null; e.currentTarget.src = '/landscape.svg';}}/><span className="ph-trip-info"><span className="eyebrow">{place?.state || 'Saved itinerary'}</span><strong>{place?.name || 'Destination unavailable'}</strong><span><Icon name="calendar_month"/>{trip.start} · {trip.days} days</span><small>From {trip.origin} · {trip.travelers} {trip.travelers === 1 ? 'traveller' : 'travellers'}</small></span><span className="ph-trip-budget"><b>{rupees(trip.budget)}</b><small>Trip budget</small></span><Icon name="north_east"/></button>;})}</div> : <div className="ph-empty"><div className="ph-empty-emblem"><Icon name="luggage"/></div><span className="eyebrow">IT STARTS WITH A “WHAT IF”</span><h3>Take the plan out of the group chat.</h3><p>Choose a destination, build your route, and save the details here. Future you says thanks.</p><button className="primary" onClick={() => onNavigate('Planner')}>Plan your first trip <Icon name="route"/></button></div>}</>}

      {section === 'Map' && <><div className="ph-section-heading"><div><span className="eyebrow">YOUR INDIA, ONE PLACE AT A TIME</span><h2>Map of discoveries<span>.</span></h2></div><span className="ph-count">{passport.states} states explored</span></div><div className="ph-map-options">{['Visited', 'Saved', 'All places'].map(value => <button className={mapStatus === value ? 'selected' : ''} aria-pressed={mapStatus === value} key={value} onClick={() => setMapStatus(value)}>{value === 'Visited' ? 'My stamps' : value === 'Saved' ? 'Saved places' : value}</button>)}<button className="text-button" onClick={() => onNavigate('Map')}>Open full map <Icon name="north_east"/></button></div>{mapPlaces.length ? <div className="ph-map"><Suspense fallback={<div className="loading" role="status">Unfolding your journey…</div>}><TravelMap places={mapPlaces} entries={passport.entries} onSelect={onOpen}/></Suspense></div> : <div className="ph-empty"><div className="ph-empty-emblem"><Icon name="map"/></div><h3>{mapStatus === 'Visited' ? 'Your map is waiting for its first pin.' : 'Pin a little possibility.'}</h3><p>{mapStatus === 'Visited' ? 'Log a visit to see your journey take shape, or explore all the places waiting for you.' : 'Save a destination to see it on your map.'}</p><button className="secondary" onClick={() => setMapStatus('All places')}>Show all places <Icon name="map"/></button></div>}</>}

      {section === 'Achievements' && <><div className="ph-section-heading"><div><span className="eyebrow">SMALL DETOURS. BIG EXPLORER ENERGY.</span><h2>A little further, every time<span>.</span></h2></div><span className="ph-count">{unlocked} / {achievements.length} unlocked</span></div><div className="ph-achievements">{achievements.map(achievement => <article className={achievement.unlocked ? 'unlocked' : ''} key={achievement.name}><span className="ph-achievement-icon"><Icon name={achievement.unlocked ? 'workspace_premium' : 'lock'}/></span><span className="eyebrow">{achievement.unlocked ? 'YOU DID THAT' : 'YOUR NEXT SIDE QUEST'}</span><h3>{achievement.name}</h3><p>{achievement.unlocked ? 'Achievement unlocked. A story well earned.' : `${achievement.count} / ${achievement.target} ${achievement.name === 'Elite Wanderer' ? 'XP' : achievement.name.includes('State') || achievement.name === 'India Explorer' ? 'states' : 'discoveries'}`}</p><progress aria-label={achievement.name + ' progress'} max={achievement.target} value={Math.min(achievement.count, achievement.target)}/></article>)}</div><div className="ph-tier-guide"><div><span className="eyebrow">THE JOURNEY UP</span><h3>Every detour adds up.</h3><p>150 XP per hidden gem. 250 XP for each new state.</p></div><div>{[['Tier III', 0], ['Tier II', 1000], ['Tier I', 3000], ['Elite', 7500]].map(([tier, xp]) => <span className={passport.xp >= Number(xp) ? 'reached' : ''} key={tier}><Icon name="shield"/><b>{tier}</b><small>{Number(xp).toLocaleString()} XP</small></span>)}</div></div></>}
    </div>

    {logging && <Modal title="Choose a place to stamp" onClose={() => setLogging(false)}><form className="visit-form" onSubmit={event => {event.preventDefault(); const place = byId.get(Number(visitPlace)); if (place) {setLogging(false); onVisit(place);}}}><div className="form-emblem"><Icon name="auto_stories"/></div><span className="eyebrow">A NEW PAGE IN YOUR PASSPORT</span><h2>Where have you been?</h2><p>Pick a place, then add the date and a memory worth keeping.</p><label>Choose your destination<select autoFocus required value={visitPlace} onChange={e => setVisitPlace(e.target.value)}><option value="" disabled>Select a place…</option>{[...places].sort((a, b) => a.name.localeCompare(b.name)).map(place => <option key={place.id} value={place.id}>{place.name} · {place.state}{visited.some(e => e.place_id === place.id) ? ' · Already stamped' : ''}</option>)}</select></label><button className="primary full-width" disabled={!visitPlace || busy}>Continue to your memory <Icon name="arrow_forward"/></button></form></Modal>}
  </section>;
}
