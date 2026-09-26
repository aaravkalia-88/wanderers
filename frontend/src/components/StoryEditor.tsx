import {useEffect, useRef, useState} from 'react';
import {api, token} from '../api/travel';
import {catalog} from '../api/destinations';
import {CommunityLink, StoryBody, type Story} from './Community';
import {Icon} from './UI';

type Fields = {title: string; subtitle: string; body: string; place_id: number | null};
const fieldsOf = (story: Story): Fields => ({title: story.title, subtitle: story.subtitle, body: story.body || '', place_id: story.place_id});
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not save. Your writing is still here.';

export default function StoryEditor({id, go}: {id: number; go: (path: string) => void}) {
  const [story, setStory] = useState<Story>(); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {let active = true; setError(''); api<Story>(`/blogs/${id}/edit`).then(data => {if (active) setStory(data);}).catch(e => {if (active) setError(errorMessage(e));}); return () => {active = false;};}, [id, retry]);
  if (!story) return <section className="community-page"><p role={error ? 'alert' : 'status'}>{error || 'Opening your draft…'}</p>{error && <button className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</button>}</section>;
  return <Editor key={story.id} story={story} go={go}/>;
}

function Editor({story, go}: {story: Story; go: (path: string) => void}) {
  const key = `wanderer-story:${story.author.username}:${story.id}`;
  const version = useRef(story.version);
  const session = useRef(token());
  const saved = useRef(JSON.stringify(fieldsOf(story)));
  const serverStatus = useRef(story.status);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [recovery] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value && JSON.stringify(value.fields) === JSON.stringify(fieldsOf(story))) return null;
      if (value && typeof value.version === 'number' && value.fields && ['title', 'subtitle', 'body'].every(field => typeof value.fields[field] === 'string') && (value.fields.place_id === null || Number.isInteger(value.fields.place_id))) return value as {fields: Fields; version: number};
    } catch { /* Storage may be unavailable; server draft still opens. */ }
    return null;
  });
  const [fields, setFields] = useState<Fields>(recovery?.fields || fieldsOf(story));
  const latest = useRef(fields);
  const [conflict] = useState(!!recovery && recovery.version !== story.version);
  const [storageError, setStorageError] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(conflict ? 'Another tab saved a newer version. Download your recovered writing before reloading.' : recovery ? 'Recovered your writing from this device.' : `Saved as ${story.status}.`);
  const [visibility, setVisibility] = useState<Story['status']>(story.status === 'draft' ? 'published' : story.status);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function backup(value: Fields) {
    try {localStorage.setItem(key, JSON.stringify({fields: value, version: version.current})); setStorageError(false);}
    catch {setStorageError(true);}
  }
  function change(value: Fields) {latest.current = value; setFields(value); backup(value); setStatus('Unsaved changes'); setError('');}
  async function save(nextStatus: Story['status']) {
    if (inFlight.current || conflict) return;
    if (token() !== session.current) {setError('Your account changed. Download your writing before signing in again.'); return;}
    inFlight.current = true; setBusy(true); setError(''); setStatus('Saving…');
    const snapshot = {...latest.current};
    try {
      const result = await api<Story>(`/blogs/${story.id}`, {method: 'PATCH', body: JSON.stringify({...snapshot, status: nextStatus, version: version.current})});
      if (!mounted.current || token() !== session.current) return;
      version.current = result.version; serverStatus.current = result.status; saved.current = JSON.stringify(snapshot);
      if (JSON.stringify(latest.current) === saved.current) {
        try {localStorage.removeItem(key);} catch { /* Server save succeeded; an older local recovery remains. */ }
        setStatus(result.status === 'draft' ? 'Draft saved automatically.' : result.status === 'published' ? 'Story published.' : `Story saved as ${result.status}.`);
      } else {backup(latest.current); setStatus('Your newest changes are waiting to save.');}
    } catch (e) {if (mounted.current) {setError(errorMessage(e)); setStatus('Not saved to your account. Your writing is still in this editor.');}}
    finally {inFlight.current = false; if (mounted.current) setBusy(false);}
  }
  useEffect(() => {
    if (busy || error || conflict || serverStatus.current !== 'draft' || JSON.stringify(fields) === saved.current) return;
    const timer = setTimeout(() => save('draft'), 900);
    return () => clearTimeout(timer);
  }, [fields, busy, error, conflict]);
  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {if (JSON.stringify(latest.current) !== saved.current) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => {mounted.current = false; window.removeEventListener('beforeunload', warn);};
  }, []);
  function format(before: string, after = '') {
    const el = textarea.current; if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    change({...fields, body: fields.body.slice(0, start) + before + fields.body.slice(start, end) + after + fields.body.slice(end)});
    requestAnimationFrame(() => {el.focus(); el.setSelectionRange(start + before.length, end + before.length);});
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`${fields.title}\n${fields.subtitle}\n\n${fields.body}`], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `wanderer-story-${story.id}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="community-page story-editor"><div className="community-actions"><CommunityLink to="/write" go={go} className="text-button">← Your stories</CommunityLink><button className="text-button" onClick={download}>Download writing <Icon name="download"/></button></div><header><span className="eyebrow">Your field journal / {String(story.id).padStart(3, '0')}</span><h1>A story only<br/><em>you can tell.</em></h1><p>Drafts auto-save to your account. This device also keeps a recovery copy while you write.</p></header>
    <div className="editor-save-state" role="status"><Icon name={busy ? 'schedule' : 'auto_stories'}/>{status}</div>
    {(error || conflict || storageError) && <div className="form-error" role="alert">{error || (conflict ? 'A newer saved version exists. Automatic saving is paused to protect it. Download this recovery copy, then reload to open the saved version.' : 'Browser recovery storage is unavailable. Keep this page open until your account save completes, or download your writing.')} {!conflict && <button className="text-button" disabled={busy} onClick={() => save(serverStatus.current)}>Retry save</button>}</div>}
    {story.hidden && <p className="form-error">This story is hidden by moderation. Editing or publishing it will not make it public.</p>}
    <div className="community-form"><label>Story title<input value={fields.title} maxLength={160} placeholder="The turn we almost didn’t take" onChange={e => change({...fields, title: e.target.value})}/></label><label>Subtitle<input value={fields.subtitle} maxLength={300} placeholder="A little context for the road ahead" onChange={e => change({...fields, subtitle: e.target.value})}/></label><label>Destination<select value={fields.place_id || ''} onChange={e => change({...fields, place_id: e.target.value ? Number(e.target.value) : null})}><option value="">Choose a destination</option>{catalog.map(place => <option key={place.id} value={place.id}>{place.name} · {place.state}</option>)}</select></label>
    <div className="editor-toolbar" role="group" aria-label="Story formatting"><button type="button" disabled={preview} onClick={() => format('# ')}>Heading</button><button type="button" disabled={preview} onClick={() => format('**', '**')}><b>Bold</b></button><button type="button" disabled={preview} onClick={() => format('*', '*')}><em>Italic</em></button><button type="button" disabled={preview} onClick={() => format('> ')}>Quote</button><button type="button" disabled={preview} onClick={() => format('- ')}>List</button><button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Keep writing' : 'Preview'}</button></div>
    {preview ? <div className="editor-preview"><StoryBody body={fields.body || 'Your story will appear here.'}/></div> : <label>Your story<textarea ref={textarea} className="editor-body" value={fields.body} maxLength={50000} rows={16} placeholder="Start with a moment. What made this place stay with you?" onChange={e => change({...fields, body: e.target.value})}/><small>Separate paragraphs, headings, and quotes with a blank line. {fields.body.length.toLocaleString()} / 50,000 characters</small></label>}
    <section className="editor-publish"><div><h2>Choose who gets to read it.</h2><p>Publishing shares these words with the community. Your personal Passport and travel dates stay private.</p><CommunityLink to="/profile" go={go} className="text-button">Profile & privacy <Icon name="arrow_forward"/></CommunityLink></div><label>Story visibility<select value={visibility} onChange={e => setVisibility(e.target.value as Story['status'])}><option value="published">Public · listed in the community</option><option value="unlisted">Unlisted · anyone with the link</option><option value="draft">Draft · only you</option><option value="archived">Archived · only you</option></select></label><div className="community-actions"><button className="primary" disabled={busy || conflict} onClick={() => save(visibility)}>{busy ? 'Saving…' : visibility === 'published' ? 'Publish story' : 'Save story'}</button><button className="secondary" disabled={busy || conflict} onClick={() => save('draft')}>Save as private draft</button>{['published', 'unlisted'].includes(serverStatus.current) && <CommunityLink className="text-button" to={`/blogs/${story.id}`} go={go}>View story <Icon name="north_east"/></CommunityLink>}</div></section>
    <div className="editor-delete">{deleting ? <><p>Delete this story permanently? Download your writing first if you want a copy.</p><button className="secondary" disabled={busy} onClick={async () => {setBusy(true); try {await api(`/blogs/${story.id}`, {method: 'DELETE'}); try {localStorage.removeItem(key);} catch {} saved.current = JSON.stringify(latest.current); go('/write');} catch (e) {setError(errorMessage(e)); setBusy(false);}}}>Delete permanently</button><button className="text-button" onClick={() => setDeleting(false)}>Keep story</button></> : <button className="text-button" disabled={busy} onClick={() => setDeleting(true)}>Delete story</button>}</div></div>
  </section>;
}
