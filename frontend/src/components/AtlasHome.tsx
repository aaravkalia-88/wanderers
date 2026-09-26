import {motion, useReducedMotion} from 'framer-motion';
import type {Destination} from '../api/destinations';
import type {Entry} from '../api/travel';
import Atlas from './atlas/Atlas';
import {Icon} from './UI';

export default function AtlasHome({places, entries, onOpen, onMap, onJourney}: {places: Destination[]; entries: Entry[]; onOpen: (place: Destination) => void; onMap: () => void; onJourney: () => void}) {
  const reduced = useReducedMotion();
  return <>
    <section className="atlas-hero">
      <div className="atlas-hero-copy">
        <span className="editorial-kicker"><span>THE ART OF GETTING A LITTLE LOST</span><i/></span>
        <h1>Somewhere<br/>less <em>ordinary.</em><span className="hero-asterisk" aria-hidden="true">✳</span></h1>
        <p>Beyond the guidebooks. Away from the crowds.<br/>Find the India that feels like a discovery.</p>
        <div className="atlas-hero-actions"><button className="primary" onClick={onJourney}>Begin the scroll journey <Icon name="arrow_forward"/></button><button className="text-button" onClick={onMap}>Open the atlas <Icon name="north_east"/></button></div>
        <motion.div className="field-note" initial={false} whileInView={reduced ? {} : {y: [12, 0], opacity: [0, 1]}} viewport={{once: true, amount: .2}} transition={{duration: .65}}><span className="field-note-number">01 /</span><div><b>Let curiosity choose the route.</b><p>Turn the map. Follow a pin. There’s a story<br/>waiting where you least expect it.</p></div><Icon name="explore"/></motion.div>
        <div className="hero-edition"><span>FIELD GUIDE TO A DIFFERENT INDIA</span><span>EST. 2026</span></div>
      </div>
      <Atlas places={places} entries={entries} onOpen={onOpen}/>
    </section>
    <div className="atlas-index-strip"><span><b>{String(places.length).padStart(2, '0')}</b> handpicked places</span><span><b>{String(new Set(places.map(place => place.state)).size).padStart(2, '0')}</b> states to fall for</span><span><Icon name="eco"/>Small footprints. Lasting stories.</span><span className="atlas-strip-end">SCROLL TO FIND YOUR ELSEWHERE <Icon name="south"/></span></div>
  </>;
}
