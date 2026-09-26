import {lazy, Suspense, useCallback, useMemo, useRef, useState, type CSSProperties} from 'react';
import {motion, useInView, useReducedMotion, useScroll, useTransform} from 'framer-motion';
import {buildJourney, corridors} from '../data/state-journey';
import type {Destination} from '../api/destinations';
import {rupees, type Entry} from '../api/travel';
import {usePreferences} from '../preferences';
import {AtlasBoundary} from './atlas/Atlas';
import {Icon} from './UI';
import './StateJourney.css';
const ModernIndiaMap3D = lazy(() => import('./atlas/ModernIndiaMap3D'));

export default function StateJourney({places, entries, onOpen, onNavigate}: {places: Destination[]; entries: Entry[]; onOpen: (place: Destination) => void; onNavigate: (page: string) => void}) {
  const root = useRef<HTMLDivElement>(null);
  const {dark} = usePreferences();
  const reduced = !!useReducedMotion();
  const {scrollYProgress} = useScroll({target: root, offset: ['start start', 'end end']});
  const stage = useRef<HTMLDivElement>(null);
  const visible = useInView(stage);
  const [enabled, setEnabled] = useState(() => matchMedia('(min-width: 761px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const unavailable = useCallback(() => setFailed(true), []);
  const chapters = useMemo(() => buildJourney(places), [places]);
  const stops = useMemo(() => chapters.map(chapter => chapter.place), [chapters]);
  const progress = useTransform(scrollYProgress, value => Math.max(.015, value));
  if (!chapters.length) return <div className="empty-state"><h1>The journey is taking shape.</h1><button className="primary" onClick={() => onNavigate('Explore')}>Explore destinations</button></div>;
  const current = chapters[Math.min(active, chapters.length - 1)];
  function jump(index: number) {setActive(index); document.getElementById('journey-chapter-' + index)?.scrollIntoView({behavior: reduced ? 'instant' : 'smooth', block: 'start'});}
  const fallback = <div className="journey-map-fallback"><img src="/india-atlas.svg" width="600" height="620" alt="India state atlas"/><p>Keep scrolling to discover each state.</p><button className="secondary" onClick={() => {setFailed(false); setAttempt(value => value + 1);}}>Retry 3D map</button></div>;
  return <div className="state-journey" style={{'--chapter-accent': current.color} as CSSProperties}>
    <div ref={root} className="journey-scroll" style={{'--chapters': chapters.length} as CSSProperties}>
      <div ref={stage} className="journey-stage">
        <div className="journey-grain" aria-hidden="true"/>
        <header className="journey-header"><a href="/" onClick={event => {event.preventDefault(); onNavigate('Home');}}><Icon name="explore"/>wanderer<span>.</span></a><span>{places.length} DISCOVERIES · ONE EXTRAORDINARY COUNTRY</span><nav aria-label="Journey navigation"><button onClick={() => onNavigate('About')}><Icon name="info"/>About us</button><button onClick={() => onNavigate('Explore')}>All places</button><button onClick={() => onNavigate('Map')}>Map</button><button onClick={() => onNavigate('Passport')}>My passport <Icon name="north_east"/></button></nav></header>
        <div className="journey-cartography" aria-label={'3D map highlighting ' + current.state}>
          <div className="journey-map-rings" aria-hidden="true"/>
          {!enabled ? <div className="journey-map-fallback"><img src="/india-atlas.svg" width="600" height="620" alt="India atlas"/><button className="secondary" onClick={() => setEnabled(true)}>Enable 3D atlas</button></div> : failed ? fallback : visible && <AtlasBoundary key={attempt} fallback={fallback}><Suspense fallback={<div className="journey-map-fallback"><img src="/india-atlas.svg" width="600" height="620" alt="India atlas"/><p role="status">Preparing your journey…</p></div>}><ModernIndiaMap3D places={stops} entries={entries} selected={current.place.id} onSelect={place => {jump(stops.findIndex(stop => stop.id === place.id)); onOpen(place);}} dark={dark} reduced={reduced} onUnavailable={unavailable} journey={{stops, active}}/></Suspense></AtlasBoundary>}
          <span className="journey-map-caption">{current.place.latitude.toFixed(2)}° N &nbsp; {current.place.longitude.toFixed(2)}° E <i/> {current.state}</span>
        </div>
        <div className="journey-position"><span className="journey-current-number">{String(active + 1).padStart(2, '0')}</span><span> / {String(chapters.length).padStart(2, '0')}<br/>FIELD NOTES</span></div>
        <nav className="journey-dots" aria-label="Jump to a corridor">{corridors.map((corridor, index) => {
          const first = chapters.findIndex(chapter => chapter.corridor === index);
          return first < 0 ? null : <button key={corridor.name} title={corridor.name} aria-label={'Go to ' + corridor.name} aria-current={current.corridor === index ? 'step' : undefined} onClick={() => jump(first)}><span/>{current.corridor === index && <b>{corridor.name}</b>}</button>;
        })}</nav>
        <div className="journey-bottom"><span><Icon name="south"/>{active === chapters.length - 1 ? 'YOUR NEXT STORY IS UP TO YOU' : 'SCROLL TO WANDER'}</span><label><span className="sr-only">Jump to destination</span><select aria-label="Jump to destination" value={active} onChange={event => jump(Number(event.target.value))}>{chapters.map((chapter, index) => <option key={chapter.place.id} value={index}>{String(index + 1).padStart(2, '0')} · {chapter.place.name}</option>)}</select></label><div className="journey-footer-links"><button onClick={() => onNavigate('About')}>About us</button><button onClick={() => onNavigate('Terms')}>Terms</button><a href="https://github.com/india-in-data/india-states-2019" target="_blank" rel="noreferrer" title="2019 boundary dataset; stylized regional elevation">Boundary source</a></div></div>
        <motion.div className="journey-progress" style={{scaleX: progress}}/>
      </div>
      <div className="journey-chapters">{chapters.map((chapter, index) => <section key={chapter.place.id} id={'journey-chapter-' + index} className="journey-chapter" aria-labelledby={'journey-title-' + index}>
        <motion.div className="journey-story" initial={false} whileInView={reduced ? {} : {opacity: [0, 1], y: [28, 0]}} onViewportEnter={() => setActive(index)} viewport={{amount: .55}} transition={{duration: .7, ease: 'easeOut'}}>
          <span className="journey-region"><i/> {chapter.region}</span>
          <p className="journey-state-name">{chapter.state}</p>
          {index === 0 ? <h1 id={'journey-title-' + index}>{(index === 0 ? 'India, beyond\nthe ordinary.' : chapter.title).split('\n').map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}</span>)}</h1> : <h2 id={'journey-title-' + index}>{chapter.title.split('\n').map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}</span>)}</h2>}
          <p className="journey-description">{chapter.description}</p>
          {index === 0 && <button className="mission-pill" onClick={() => onNavigate('About')}>Our mission to show the world the hidden side of India <Icon name="arrow_forward"/></button>}
          <dl className="journey-facts"><div><dt>FIELD NOTE</dt><dd>{chapter.place.category}</dd></div><div><dt>LANDSCAPE</dt><dd>{chapter.place.group}</dd></div></dl>
          <button className="journey-discovery" onClick={() => onOpen(chapter.place)}><img src={chapter.place.image_url} alt="" width="72" height="80" loading="lazy" onError={event => {event.currentTarget.onerror = null; event.currentTarget.src = '/landscape.svg';}}/><span><small>EXPLORE PLACE · OPEN FIELD NOTES</small><b>{chapter.place.name}</b><span>{chapter.place.duration} days suggested · {rupees(chapter.place.budget_per_day)}/day est.</span></span><Icon name="north_east"/></button>
          <span className="journey-source">{entries.find(entry => entry.place_id === chapter.place.id)?.status || 'Awaiting discovery'} · {chapter.place.difficulty} terrain</span>
        </motion.div>
      </section>)}</div>
    </div>
    <section className="journey-end"><span className="eyebrow">THE MAP ENDS. YOUR STORY DOESN’T.</span><h2>Where will you<br/><em>wander next?</em></h2><p>{chapters.length} discoveries. A whole country still waiting.</p><div className="journey-end-actions"><button className="primary" onClick={() => onNavigate('Explore')}>Find my next escape <Icon name="arrow_forward"/></button><button className="secondary" onClick={() => onNavigate('About')}>Read our mission <Icon name="info"/></button></div><button className="text-button" onClick={() => jump(0)}>Take the journey again <Icon name="north"/></button></section>
  </div>;
}
