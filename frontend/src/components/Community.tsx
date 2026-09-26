import {useEffect, useState, type ReactNode} from 'react';
import {api, isGuestPassport, type Passport} from '../api/travel';
import {catalog} from '../api/destinations';
import {Icon} from './UI';
import StoryEditor from './StoryEditor';

export type Story = {id: number; title: string; subtitle: string; body?: string; place_id: number | null; destination: string; state: string; category: string; status: 'draft'|'published'|'unlisted'|'archived'; hidden: boolean; version: number; updated_at: string; author: {username: string; display_name: string}};
type Profile = {user_id: number; username: string; display_name: string; bio: string; home_region: string; interests: string; is_public: boolean};
type Feed = {items: Story[]; next: number | null};
type Navigate = (path: string) => void;
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function CommunityLink({to, go, children, className}: {to: string; go: Navigate; children: ReactNode; className?: string}) {
  return <a href={to} className={className} onClick={event => {if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {event.preventDefault(); go(to);}}}>{children}</a>;
}

function StoryCard({story, go, mine = false}: {story: Story; go: Navigate; mine?: boolean}) {
  return <article className="community-card">
    <div className="community-card-top"><span className="eyebrow">{mine ? story.hidden ? 'Hidden by moderation' : story.status : 'Community story'}</span><Icon name="auto_stories"/></div>
    <p className="community-place">{story.destination || 'A journey in the making'}{story.state && ` · ${story.state}`}</p>
    <h3><CommunityLink to={mine ? `/write/${story.id}` : `/blogs/${story.id}`} go={go}>{story.title || 'Untitled field notes'}</CommunityLink></h3>
    <p>{story.subtitle || (mine ? 'Keep a little of the journey. Continue your story.' : 'An experience shared by a fellow Wanderer.')}</p>
    <div className="community-card-bottom"><CommunityLink to={`/u/${encodeURIComponent(story.author.username)}`} go={go}>{story.author.display_name}</CommunityLink><CommunityLink to={mine ? `/write/${story.id}` : `/blogs/${story.id}`} go={go} className="text-button">{mine ? 'Edit story' : 'Read story'} <Icon name="arrow_forward"/></CommunityLink></div>
  </article>;
}

export function StoryFeed({go, placeId, username, mine = false, compact = false}: {go: Navigate; placeId?: number; username?: string; mine?: boolean; compact?: boolean}) {
  const [feed, setFeed] = useState<Feed>({items: [], next: null});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [before, setBefore] = useState<number>();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (placeId) params.set('place_id', String(placeId));
      if (username) params.set('username', username);
      if (before) params.set('before', String(before));
      if (query) params.set('q', query);
      if (category) params.set('category', category);
      if (state) params.set('state', state);
      api<Feed>(`/blogs${mine ? '/mine' : ''}?${params}`, {signal: controller.signal}).then(data => {
        if (active) setFeed(previous => ({...data, items: before ? [...previous.items, ...data.items] : data.items}));
      }).catch(e => {if (active) setError(message(e));}).finally(() => {if (active) setLoading(false);});
    }, query ? 250 : 0);
    return () => {active = false; clearTimeout(timer); controller.abort();};
  }, [placeId, username, mine, before, query, category, state, retry]);
  return <div className="community-feed">
    {!compact && !mine && <div className="community-filters"><label>Search stories<input type="search" value={query} maxLength={160} placeholder="A place, a memory…" onChange={e => {setQuery(e.target.value); setBefore(undefined);}}/></label><label>State<select value={state} onChange={e => {setState(e.target.value); setBefore(undefined);}}><option value="">All states</option>{[...new Set(catalog.map(place => place.state))].sort().map(value => <option key={value}>{value}</option>)}</select></label><label>Travel interest<select value={category} onChange={e => {setCategory(e.target.value); setBefore(undefined);}}><option value="">All interests</option>{[...new Set(catalog.map(place => place.group))].map(value => <option key={value}>{value}</option>)}</select></label></div>}
    {error && <div className="form-error" role="alert">{error} <button className="text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {(!loading || before) && <div className="community-grid">{feed.items.slice(0, compact ? 3 : undefined).map(story => <StoryCard key={story.id} story={story} go={go} mine={mine}/>)}</div>}
    {loading && <p className="community-status" role="status">Opening the field journal…</p>}
    {!loading && !error && !feed.items.length && <div className="community-empty"><span className="community-emblem"><Icon name="auto_stories"/></span><h3>{query || state || category ? 'No stories on this trail yet.' : mine ? 'Your next journey deserves a page.' : 'Every place starts with a story.'}</h3><p>{mine ? 'Start a draft. Take your time. Share it when you are ready.' : 'Share the small discoveries, local kindness, and unexpected turns that made a place yours.'}</p><CommunityLink to="/write" go={go} className="primary">Write a story <Icon name="edit"/></CommunityLink></div>}
    {!compact && feed.next && !error && <button className="secondary community-load" disabled={loading} onClick={() => setBefore(feed.next!)}>Load more stories <Icon name="south"/></button>}
  </div>;
}

export function CommunityHighlight({go, placeId}: {go: Navigate; placeId?: number}) {
  return <section className="community-highlight"><div className="section-line"><div><span className="eyebrow">From the Wanderer community</span><h2>{placeId ? 'Stories from this place.' : 'Real places. Personal stories.'}</h2></div><CommunityLink to="/community" go={go} className="text-button">All stories <Icon name="arrow_forward"/></CommunityLink></div><StoryFeed key={placeId || 'home'} go={go} placeId={placeId} compact/></section>;
}

export function CommunityProfileSettings({go}: {go: Navigate}) {
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {let active = true; setError(''); api<Profile>('/profiles/me').then(data => {if (active) setProfile(data);}).catch(e => {if (active) setError(message(e));}); return () => {active = false;};}, [retry]);
  return <section className="community-profile-settings settings-panel"><div className="section-line"><div><span className="eyebrow">Your public side</span><h2>A little more you.</h2></div><Icon name="person"/></div><p>Your Passport, travel dates, saved places, and trips stay private. Only the details you choose below appear on your community profile.</p>
    {error && <p className="form-error" role="alert">{error} {!profile && <button onClick={() => setRetry(value => value + 1)}>Try again</button>}</p>}
    {!profile && !error && <p role="status">Opening profile settings…</p>}
    {profile && <form className="community-form" onSubmit={async event => {event.preventDefault(); setBusy(true); setError(''); setSaved(''); try {const {username, user_id, ...fields} = profile; setProfile(await api<Profile>('/profiles/me', {method: 'PATCH', body: JSON.stringify(fields)})); setSaved('Community profile saved.');} catch (e) {setError(message(e));} finally {setBusy(false);}}}>
      <fieldset disabled={busy}><div className="community-two"><label>Display name<input value={profile.display_name} maxLength={80} onChange={e => {setSaved(''); setProfile({...profile, display_name: e.target.value});}}/></label><label>Home region · optional<input value={profile.home_region} maxLength={80} placeholder="For example, Himachal Pradesh" onChange={e => {setSaved(''); setProfile({...profile, home_region: e.target.value});}}/></label></div>
      <label>Bio<textarea value={profile.bio} rows={3} maxLength={500} onChange={e => {setSaved(''); setProfile({...profile, bio: e.target.value});}}/></label><label>Travel interests<input value={profile.interests} maxLength={300} placeholder="Mountains, food, slow travel…" onChange={e => {setSaved(''); setProfile({...profile, interests: e.target.value});}}/></label>
      <label className="community-toggle"><input type="checkbox" checked={profile.is_public} onChange={e => {setSaved(''); setProfile({...profile, is_public: e.target.checked});}}/><span><b>Make my community profile public</b><small>Lets people see this profile and your published stories. Turning this off also hides your stories, including unlisted links.</small></span></label>
      <div className="community-actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save community profile'}</button>{profile.is_public && <CommunityLink className="text-button" to={`/u/${encodeURIComponent(profile.username)}`} go={go}>View profile <Icon name="north_east"/></CommunityLink>}</div></fieldset><p role="status">{saved}</p>
    </form>}
  </section>;
}

function PublicProfilePage({username, go}: {username: string; go: Navigate}) {
  const [profile, setProfile] = useState<Profile>(); const [error, setError] = useState('');
  useEffect(() => {let active = true; api<Profile>(`/profiles/u/${encodeURIComponent(username)}`).then(data => {if (active) setProfile(data);}).catch(e => {if (active) setError(message(e));}); return () => {active = false;};}, [username]);
  if (!profile) return <div className="community-empty"><h1>{error ? 'A quieter corner.' : 'Opening this profile…'}</h1><p role={error ? 'alert' : 'status'}>{error}</p><CommunityLink to="/community" go={go} className="secondary">Back to the community</CommunityLink></div>;
  return <><header className="community-profile"><span className="community-avatar">{(profile.display_name || profile.username).slice(0, 2).toUpperCase()}</span><span className="eyebrow">@{profile.username}</span><h1>{profile.display_name || profile.username}</h1><p>{profile.bio || 'Collecting moments across India.'}</p>{profile.home_region && <p><Icon name="location_on"/>{profile.home_region}</p>}{profile.interests && <p className="community-interests">{profile.interests}</p>}</header><h2 className="community-section-title">Field notes from the journey.</h2><StoryFeed go={go} username={username}/></>;
}

export function StoryBody({body}: {body: string}) {
  // A small, text-only Markdown subset. React escapes all content, including HTML.
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : part);
  return <div className="community-prose">{body.split(/\n\s*\n/).map((block, index) => {
    if (block.startsWith('## ')) return <h3 key={index}>{inline(block.slice(3))}</h3>;
    if (block.startsWith('# ')) return <h2 key={index}>{inline(block.slice(2))}</h2>;
    if (block.startsWith('> ')) return <blockquote key={index}>{inline(block.slice(2))}</blockquote>;
    if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={index}>{block.split('\n').map((line, i) => <li key={i}>{inline(line.slice(2))}</li>)}</ul>;
    return <p key={index}>{inline(block)}</p>;
  })}</div>;
}

function StoryPage({id, go, onAuth, member}: {id: number; go: Navigate; onAuth: () => void; member: boolean}) {
  const [story, setStory] = useState<Story>(); const [error, setError] = useState(''); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('Spam'); const [detail, setDetail] = useState(''); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {let active = true; api<Story>(`/blogs/${id}`).then(data => {if (active) setStory(data);}).catch(e => {if (active) setError(message(e));}); return () => {active = false;};}, [id]);
  if (!story) return <div className="community-empty"><h1>{error ? 'This page of the journey is unavailable.' : 'Opening the story…'}</h1><p role={error ? 'alert' : 'status'}>{error}</p><CommunityLink to="/community" go={go} className="secondary">Browse stories</CommunityLink></div>;
  return <article className="community-story"><CommunityLink to="/community" go={go} className="text-button">← All stories</CommunityLink><header><span className="eyebrow">Community story · {story.destination}, {story.state}</span><h1>{story.title}</h1><p className="community-subtitle">{story.subtitle}</p><CommunityLink to={`/u/${encodeURIComponent(story.author.username)}`} go={go}>By {story.author.display_name}</CommunityLink>{story.status === 'unlisted' && <p>Unlisted · Anyone with this link can read this story.</p>}</header><StoryBody body={story.body || ''}/><div className="community-story-foot"><p>A traveler’s personal experience. Community stories are not verified travel or safety guidance.</p><div className="community-actions"><CommunityLink to={`/places/${story.place_id}`} go={go} className="primary">Explore {story.destination} <Icon name="map"/></CommunityLink><button className="secondary" onClick={async () => {try {await navigator.clipboard.writeText(location.href); setStatus('Story link copied.');} catch {setStatus('Copy the story link from your browser’s address bar.');}}}>Share story</button><button className="text-button" onClick={() => member ? setReporting(!reporting) : onAuth()}>Report story</button></div>
      {reporting && <form className="community-form" onSubmit={async event => {event.preventDefault(); setBusy(true); try {await api(`/blogs/${id}/report`, {method: 'POST', body: JSON.stringify({reason, detail})}); setStatus('Report received for review. Reporting does not automatically remove a story.'); setReporting(false);} catch (e) {setStatus(message(e));} finally {setBusy(false);}}}><label>Reason<select value={reason} onChange={e => setReason(e.target.value)}>{['Spam', 'Harassment', 'Misleading travel information', 'Unsafe advice', 'Copyright concern', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Details · optional<textarea maxLength={1000} value={detail} onChange={e => setDetail(e.target.value)}/></label><button className="secondary" disabled={busy}>Submit report</button></form>}
      <p role="status">{status}</p></div></article>;
}

export default function Community({page, route, passport, connected, go, onAuth}: {page: string; route: string; passport: Passport; connected: boolean; go: Navigate; onAuth: () => void}) {
  const member = connected && !isGuestPassport(passport);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (page === 'PublicProfile') return <section className="community-page"><PublicProfilePage username={decodeURIComponent(route.split('/')[2])} go={go}/></section>;
  if (page === 'Story') return <StoryPage id={Number(route.split('/')[2])} go={go} onAuth={onAuth} member={member}/>;
  if (page === 'Guidelines') return <section className="community-page community-guidelines"><span className="eyebrow">Leave a place better than you found it</span><h1>A good traveler.<br/>A good neighbour.</h1><p>Wanderer is a place to share honest experiences and help others explore responsibly.</p>{[['Respect the people who call it home.', 'Be kind to other travelers and local communities. Harassment, impersonation, and hate have no place here.'], ['Tell your own story.', 'Share original writing and photographs you have permission to use. Disclose sponsorships. Do not invent visits, ratings, or recommendations.'], ['Keep fragile places protected.', 'Avoid sharing precise locations of sensitive habitats or sacred spaces where publicity could cause harm. Respect local access rules.'], ['Be careful with travel advice.', 'Label personal experience clearly. Do not pass guesses about roads, weather, or safety off as verified guidance.'], ['Help keep the community useful.', 'Report spam, stolen content, and misleading or unsafe advice using Report story. Reports are reviewed; a report alone does not remove content.']].map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<CommunityLink to="/community" go={go} className="primary">Back to the community</CommunityLink></section>;
  if (page === 'Write' && !member) return <section className="community-page"><div className="community-empty"><span className="community-emblem"><Icon name="edit"/></span><h1>Your journey, in your words.</h1><p>Create an account or sign in to keep your drafts and share stories. Your existing guest Passport comes with you when you register.</p><button className="primary" onClick={onAuth}>Join the community</button></div></section>;
  if (page === 'Write' && /^\/write\/\d+$/.test(route)) return <StoryEditor id={Number(route.split('/')[2])} go={go}/>;
  return <section className="community-page"><header className="community-hero"><div><span className="eyebrow">{page === 'Write' ? 'Your field journal' : 'The Wanderer community'}</span><h1>{page === 'Write' ? <>Keep a little<br/>of the <em>journey.</em></> : <>The places stay.<br/>The <em>stories</em> travel.</>}</h1><p>{page === 'Write' ? 'Half a thought. A road-side conversation. A place you cannot forget. Start here, share when you are ready.' : 'Field notes from the lesser-known India. Told by the people who took the turn, stayed a little longer, and came back with a story.'}</p><div className="community-actions">{page === 'Write' ? <button className="primary" disabled={busy} onClick={async () => {setBusy(true); setError(''); try {const story = await api<Story>('/blogs', {method: 'POST'}); go(`/write/${story.id}`);} catch (e) {setError(message(e));} finally {setBusy(false);}}}>Start a story <Icon name="edit"/></button> : <CommunityLink to="/write" go={go} className="primary">Write a story <Icon name="edit"/></CommunityLink>}<CommunityLink to={page === 'Write' ? '/profile' : '/community-guidelines'} go={go} className="text-button">{page === 'Write' ? 'Profile & privacy' : 'Our community guidelines'} <Icon name="north_east"/></CommunityLink></div>{error && <p className="form-error" role="alert">{error}</p>}</div><aside className="community-note"><span className="eyebrow">A note from the trail</span><Icon name="auto_stories"/><p>Good stories<br/>take the<br/><em>scenic route.</em></p><span>DISCOVER / EXPERIENCE / SHARE</span></aside></header><div className="community-feed-heading"><h2>{page === 'Write' ? 'Your stories & drafts' : 'Fresh from the journey'}</h2><span>{page === 'Write' ? 'Private until you choose to publish' : 'Latest community stories'}</span></div><StoryFeed go={go} mine={page === 'Write'}/></section>;
}
