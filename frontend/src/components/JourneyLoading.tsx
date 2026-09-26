import {useEffect, useState} from 'react';
import {Icon} from './UI';
import './JourneyLoading.css';

const quips = [
  'The group chat trip becomes real when someone finally books the tickets.',
  'Your camera roll is about to become 87 versions of the same mountain.',
  'Window seat energy hits different when your phone is on airplane mode.',
  'Packing light is a mindset. Your “just in case” outfits disagree.',
  'A chai stop is a perfectly valid itinerary item. Add another.',
  'The best travel companion is the friend who packed extra snacks.',
  'POV: you touched grass and immediately made it your whole personality.',
  'A scenic detour is just your itinerary entering its side quest era.',
  'That “quick photo stop” has officially become a photo shoot.',
  'Collecting memories. And an unreasonable number of screenshots of maps.',
  'Your out-of-office reply deserves a main character moment too.',
  'The souvenir was small. The emotional attachment is carry-on sized.',
];

export default function JourneyLoading({label = 'Finding your next chapter…', compact = false, onExplore}: {label?: string; compact?: boolean; onExplore?: () => void}) {
  const [quip, setQuip] = useState(() => Math.floor(Math.random() * quips.length));
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function nextQuip() {setQuip(current => (current + 1 + Math.floor(Math.random() * (quips.length - 1))) % quips.length);}
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(nextQuip, 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return <section className={`journey-loading${compact ? ' journey-loading-compact' : ''}`} aria-label="Journey loading">
    <div className="journey-loader-art" aria-hidden="true">
      <div className="journey-orbit"/>
      <div className="journey-loader-compass"><Icon name="explore"/></div>
      <span className="journey-orbit-pin"><Icon name="location_on"/></span>
      <span className="journey-orbit-spark">✦</span>
    </div>
    <div className="journey-loader-content">
      <span className="eyebrow">A LITTLE WANDER IN THE MAKING</span>
      <h2 role="status" aria-live="polite">{label}</h2>
      <div className="journey-loading-track" aria-hidden="true"><span/></div>
      <div className="journey-fact" aria-live="off">
        <span className="journey-fact-label"><Icon name="auto_stories"/>Unofficial travel facts <small>(just vibes)</small></span>
        <p>{quips[quip]}</p>
        <div className="journey-fact-controls">
          <button type="button" onClick={nextQuip}>Another one <Icon name="arrow_forward"/></button>
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Resume automatic facts' : 'Pause automatic facts'}>{paused ? 'Resume' : 'Pause'}</button>
        </div>
      </div>
      {onExplore && <button type="button" className="text-button journey-explore" onClick={onExplore}>Explore while you wait <Icon name="north_east"/></button>}
    </div>
  </section>;
}
