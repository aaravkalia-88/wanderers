import {Icon} from './UI';
import './NotFound.css';

export default function NotFound({onNavigate}: {onNavigate: (page: string) => void}) {
  return <section className="detour-page">
    <div className="detour-topline"><span className="eyebrow">WANDERER / A SMALL DETOUR</span><span><i/>OFF THE GRID</span></div>
    <div className="detour-main">
      <div className="detour-copy">
        <span className="detour-status"><Icon name="location_on"/>Destination not found</span>
        <h1>This page took<br/>a <em>side quest.</em></h1>
        <p>The link may have moved, or the trail never existed. Either way, your next great discovery is still out there.</p>
        <div className="detour-actions"><button className="primary" onClick={() => onNavigate('Explore')}>Find a new adventure <Icon name="arrow_forward"/></button><button className="secondary" onClick={() => onNavigate('Home')}><Icon name="home"/>Back home</button></div>
        <span className="detour-aside">Wrong turn. Excellent plot development.</span>
      </div>
      <div className="detour-art" aria-label="Error 404: page not found" role="img">
        <div className="detour-grid"/>
        <span className="detour-coordinate">UNMAPPED TERRITORY</span>
        <span className="detour-number">4<span className="detour-zero"><Icon name="explore"/></span>4</span>
        <div className="detour-trail"/>
        <span className="detour-pin"><Icon name="location_on"/></span>
        <span className="detour-sticker"><Icon name="luggage"/>BRB, WANDERING</span>
        <span className="detour-art-note">RECALCULATING THE VIBES ↗</span>
      </div>
    </div>
    <div className="detour-bottom"><span className="eyebrow">LET’S GET YOU SOMEWHERE GOOD</span><div className="detour-shortcuts">
      <button onClick={() => onNavigate('Passport')}><span className="detour-shortcut-icon"><Icon name="auto_stories"/></span><span><b>Your passport</b><small>All your little big adventures</small></span><Icon name="north_east"/></button>
      <button onClick={() => onNavigate('Planner')}><span className="detour-shortcut-icon"><Icon name="route"/></span><span><b>Plan a trip</b><small>Turn “we should go” into a plan</small></span><Icon name="north_east"/></button>
      <button onClick={() => onNavigate('Map')}><span className="detour-shortcut-icon"><Icon name="map"/></span><span><b>Open the map</b><small>Find a place beyond the usual</small></span><Icon name="north_east"/></button>
    </div></div>
  </section>;
}
