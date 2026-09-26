import {useRef, useState} from 'react';
import type {Destination} from '../api/destinations';
import {dateToday, type Entry} from '../api/travel';
import {Icon} from './UI';

export default function VisitForm({place, entry, busy, onSubmit}: {place: Destination; entry?: Entry; busy: boolean; onSubmit: (entry: Partial<Entry>) => Promise<void>}) {
  const [date, setDate] = useState(entry?.visit_date || dateToday());
  const [notes, setNotes] = useState(entry?.notes || '');
  const [rating, setRating] = useState(entry?.rating || 5);
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const dateInput = useRef<HTMLInputElement>(null);
  return <form className="visit-form" noValidate onSubmit={async event => {
    event.preventDefault();
    if (pending.current) return;
    if (!date || date > dateToday() || !dateInput.current?.validity.valid) {setDateError('Choose a valid visit date on or before today.'); dateInput.current?.focus(); return;}
    setDateError(''); setError(''); pending.current = true; setSubmitting(true);
    try {await onSubmit({visit_date: date, notes, rating});}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Your memory could not be saved. Please try again.');}
    finally {pending.current = false; setSubmitting(false);}
  }}>
    <div className="journal-steps" aria-label="Visit progress"><span><Icon name="check_circle"/>01 · Place chosen</span><span aria-current="step">02 · Keep the memory</span></div>
    <div className="form-emblem"><Icon name="auto_stories"/></div><span className="eyebrow">A NEW PAGE IN YOUR PASSPORT</span>
    <h2>{entry?.status === 'Visited' ? 'Keep the memory alive.' : 'You were here.'}</h2><p>{place.name} · {place.state}</p>
    <label>When did you visit?<input ref={dateInput} type="date" required max={dateToday()} value={date} aria-invalid={!!dateError} aria-describedby={dateError ? 'visit-date-error' : undefined} onChange={event => {setDate(event.target.value); setDateError('');}}/></label>
    {dateError && <p id="visit-date-error" className="inline-error" role="alert">{dateError}</p>}
    <label>Your experience<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{'★'.repeat(value)} · {value} / 5</option>)}</select></label>
    <label>A moment to remember <span>(optional)</span><textarea maxLength={3000} rows={4} placeholder="The view, the people, the tiny unexpected moment…" value={notes} onChange={event => setNotes(event.target.value)}/><span className="journal-count">{notes.length.toLocaleString()} / 3,000</span></label>
    <div className="xp-note"><Icon name="workspace_premium"/>150 XP per hidden gem · 250 XP for a new state</div>
    {error && <p className="inline-error" role="alert">{error} Your memory is still here. Try saving again.</p>}
    <button className="primary full-width" disabled={busy || submitting}>{busy || submitting ? 'Saving your story…' : error ? 'Retry saving memory' : entry?.status === 'Visited' ? 'Update memory' : 'Stamp my passport'}<Icon name="verified"/></button>
  </form>;
}
