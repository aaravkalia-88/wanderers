import {Component, lazy, Suspense, useCallback, useRef, useState, type ReactNode} from 'react';
import {motion, useInView, useReducedMotion, useScroll, useTransform} from 'framer-motion';
import type {Destination} from '../../api/destinations';
import type {Entry} from '../../api/travel';
import {usePreferences} from '../../preferences';
import {Icon} from '../UI';
const ModernIndiaMap3D = lazy(() => import('./ModernIndiaMap3D'));

export class AtlasBoundary extends Component<{children: ReactNode; fallback: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() {return {failed: true};}
  render() {return this.state.failed ? this.props.fallback : this.props.children;}
}

export default function Atlas({places, entries, onOpen, compact = false}: {places: Destination[]; entries: Entry[]; onOpen: (place: Destination) => void; compact?: boolean}) {
  const root = useRef<HTMLDivElement>(null);
  const near = useInView(root, {once: true, margin: '120px'});
  const reduced = !!useReducedMotion();
  const {dark} = usePreferences();
  const [enabled, setEnabled] = useState(() => matchMedia('(min-width: 761px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(2);
  const active = places.find(place => place.id === selected) || places[0];
  const unavailable = useCallback(() => setFailed(true), []);
  const {scrollYProgress} = useScroll({target: root, offset: ['start end', 'end start']});
  const y = useTransform(scrollYProgress, [0, 1], [14, -14]);
  const fallback = <div className="atlas-loading"><span>Continue exploring with the place list.</span><button className="text-button" onClick={() => {setFailed(false); setAttempt(value => value + 1);}}>Retry 3D map <Icon name="arrow_forward"/></button></div>;
  return <div ref={root} className={'atlas ' + (compact ? 'atlas-compact' : '')} aria-label="India discovery atlas">
    <div className="atlas-topline"><span><i/> THE WANDERER ATLAS</span><span>IND / 01</span></div>
    <span className="atlas-ocean atlas-ocean-west" aria-hidden="true">ARABIAN<br/>SEA</span><span className="atlas-ocean atlas-ocean-east" aria-hidden="true">BAY OF<br/>BENGAL</span>
    <div className="atlas-north" aria-hidden="true">N<Icon name="north"/></div>
    <motion.div className="atlas-stage" style={{y: reduced ? 0 : y}}>
      {(!near || !enabled || failed) && <img className="atlas-static" src="/india-atlas.svg" alt="Relief-style atlas of India’s states" width="600" height="620"/>}
      {failed ? fallback : near && enabled ? <AtlasBoundary key={attempt} fallback={fallback}><Suspense fallback={<><img className="atlas-static" src="/india-atlas.svg" alt="India atlas" width="600" height="620"/><div className="atlas-loading" role="status">Unfolding India…</div></>}><ModernIndiaMap3D places={places} entries={entries} selected={active?.id} onSelect={place => {setSelected(place.id); onOpen(place);}} dark={dark} reduced={reduced} onUnavailable={unavailable}/></Suspense></AtlasBoundary> : <button className="atlas-enable secondary" onClick={() => setEnabled(true)}>Explore in 3D <Icon name="north_east"/></button>}
    </motion.div>
    <div className="atlas-bottom">
      <span className="atlas-instruction">{enabled && !failed ? 'Drag to turn. Pick a pin. Find your elsewhere.' : 'A whole country of possibilities.'}</span>
      <div className="atlas-place-picker"><label><span className="eyebrow">CHOOSE A DISCOVERY</span><select aria-label="Choose an atlas destination" value={active?.id ?? ''} onChange={event => setSelected(Number(event.target.value))}>{places.length ? places.map(place => <option key={place.id} value={place.id}>{place.name} · {place.state}</option>) : <option value="">No places in this collection</option>}</select></label>{active && <button aria-label={'Explore ' + active.name + ' from atlas'} onClick={() => onOpen(active)}><Icon name="north_east"/></button>}</div>
      <div className="atlas-key"><span><i/>Discover</span><span><i/>Saved</span><span><i/>Visited</span><a href="https://github.com/india-in-data/india-states-2019" target="_blank" rel="noreferrer" title="2019 boundary dataset; stylized regional elevation">Boundary source</a></div>
    </div>
  </div>;
}
