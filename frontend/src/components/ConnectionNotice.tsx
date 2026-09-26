import {Icon} from './UI';
import JourneyLoading from './JourneyLoading';

export interface ConnectionProblem {kind: 'session' | 'connection'; message: string}
export default function ConnectionNotice({loading, problem, onRetry, onSignIn, onGuest}: {
  loading: boolean; problem?: ConnectionProblem; onRetry: () => void; onSignIn: () => void; onGuest: () => void;
}) {
  if (loading) return <JourneyLoading label="Refreshing your passport…" compact/>;
  if (!problem) return null;
  const expired = problem.kind === 'session';
  return <div className="connection-note connection-recovery" role="status">
    <Icon name={expired ? 'lock' : 'cloud'}/>
    <div><b>{expired ? 'Your passport needs a fresh sign-in.' : 'Your passport could not connect.'}</b>
      <p>{expired ? 'Sign in to restore your saved journeys, or start a new guest passport. Existing records stay with their original passport.' : problem.message}</p>
      <div className="connection-actions">{expired ? <><button className="primary" onClick={onSignIn}>Sign in again <Icon name="arrow_forward"/></button><button className="secondary" onClick={onGuest}>Start a new guest passport</button></> : <button className="secondary" onClick={onRetry}>Try again <Icon name="arrow_forward"/></button>}</div>
    </div>
  </div>;
}
