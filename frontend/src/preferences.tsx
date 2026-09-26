import {createContext, ReactNode, useContext, useEffect, useState} from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Navigation = 'top' | 'bottom' | 'both';
interface Preferences {theme: Theme; navigation: Navigation}
const defaults: Preferences = {theme: 'system', navigation: 'both'};
const key = 'wanderer-preferences';

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      theme: ['light', 'dark', 'system'].includes(saved?.theme) ? saved.theme : defaults.theme,
      navigation: ['top', 'bottom', 'both'].includes(saved?.navigation) ? saved.navigation : defaults.navigation,
    };
  } catch {return defaults;}
}

const PreferencesContext = createContext<{
  preferences: Preferences;
  dark: boolean;
  updatePreferences: (change: Partial<Preferences>) => void;
  storageError: boolean;
} | null>(null);

export function PreferencesProvider({children}: {children: ReactNode}) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [storageError, setStorageError] = useState(false);
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && systemDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {if (event.key === key || event.key === null) setPreferences(readPreferences());};
    media.addEventListener('change', change);
    window.addEventListener('storage', sync);
    return () => {media.removeEventListener('change', change); window.removeEventListener('storage', sync);};
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#11131b' : '#f9f9ff');
  }, [dark]);
  function updatePreferences(change: Partial<Preferences>) {
    const next = {...preferences, ...change};
    setPreferences(next);
    try {localStorage.setItem(key, JSON.stringify(next)); setStorageError(false);}
    catch {setStorageError(true);}
  }
  return <PreferencesContext.Provider value={{preferences, dark, updatePreferences, storageError}}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing');
  return context;
}
