import {Navigation, Theme, usePreferences} from '../preferences';
import {Icon} from './UI';

export default function Settings({onProfile}: {onProfile: () => void}) {
  const {preferences, updatePreferences, storageError} = usePreferences();
  return <section className="settings-page">
    <span className="eyebrow">A little more you</span>
    <h1>Your space to wander.</h1>
    <p className="page-intro">Set the mood. Keep your favourite corners within reach.</p>
    <section className="settings-panel">
      <div className="settings-heading"><span className="settings-icon"><Icon name="sunny"/></span><div><h2>Appearance</h2><p>From a sunlit morning to one more late-night plan.</p></div></div>
      <div className="preference-options" role="group" aria-label="Colour theme">
        {([['light', 'Light', 'Soft white & coral', 'sunny'], ['dark', 'Dark', 'Charcoal & coral', 'dark_mode'], ['system', 'System', 'Follow your device', 'desktop']] as const).map(([value, label, description, icon]) =>
          <button key={value} className={'preference-card ' + (preferences.theme === value ? 'selected' : '')} aria-pressed={preferences.theme === value} onClick={() => updatePreferences({theme: value as Theme})}>
            <span className={'theme-preview preview-' + value}><i/><span><i/><i/><i/></span></span>
            <span className="preference-title"><Icon name={icon}/>{label}<span className="choice-check">{preferences.theme === value && <Icon name="check_circle"/>}</span></span>
            <small>{description}</small>
          </button>)}
      </div>
    </section>
    <section className="settings-panel">
      <div className="settings-heading"><span className="settings-icon"><Icon name="tune"/></span><div><h2>Navigation</h2><p>Choose where your shortcuts live on desktop.</p></div></div>
      <div className="preference-options" role="group" aria-label="Navigation position">
        {([['top', 'At the top', 'A familiar header'], ['bottom', 'At the bottom', 'A floating bar, always close'], ['both', 'Top & bottom', 'The best of both worlds']] as const).map(([value, label, description]) =>
          <button key={value} className={'preference-card ' + (preferences.navigation === value ? 'selected' : '')} aria-pressed={preferences.navigation === value} onClick={() => updatePreferences({navigation: value as Navigation})}>
            <span className={'navigation-preview preview-' + value}><i className="preview-header"/><span className="preview-content"/><i className="preview-dock"/></span>
            <span className="preference-title">{label}<span className="choice-check">{preferences.navigation === value && <Icon name="check_circle"/>}</span></span><small>{description}</small>
          </button>)}
      </div>
      <p className="settings-note"><Icon name="info"/>On phones, the bottom bar keeps everything a thumb’s reach away.</p>
    </section>
    <div className="settings-account"><div><h3>Your passport & account</h3><p>Return to your memories, saved places and upcoming trips.</p></div><button className="secondary" onClick={onProfile}>Open profile <Icon name="arrow_forward"/></button></div>
    <p className="settings-saved" role="status"><Icon name={storageError ? 'info' : 'check_circle'}/>{storageError ? 'Preferences apply for this session. Allow browser storage to keep them after a reload.' : 'Your preferences are saved automatically on this device.'}</p>
  </section>;
}
