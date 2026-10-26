import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { profileService } from '../services/profileService';
import { jdService } from '../services/jdService';
import { resultsService } from '../services/resultsService';
import { getDataMode, onDataModeChange } from '../services/mode';
import { readJson, writeJson, removeKey, KEYS } from '../services/storage';

const AppDataContext = createContext(null);

const emptyCollection = { items: [], loading: true, error: null };

function useCollection(loader) {
  const [state, setState] = useState(emptyCollection);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const items = await loader();
      setState({ items, loading: false, error: null });
      return items;
    } catch (error) {
      setState({ items: [], loading: false, error });
      return [];
    }
  }, [loader]);
  return [state, reload];
}

const loadProfiles = () => profileService.list();
const loadJds = () => jdService.list();
const loadResults = () => resultsService.list();

export function AppDataProvider({ children }) {
  const [mode, setMode] = useState(getDataMode());
  const [profiles, reloadProfiles] = useCollection(loadProfiles);
  const [jds, reloadJds] = useCollection(loadJds);
  const [results, reloadResults] = useCollection(loadResults);
  const [activeProfileId, setActiveProfileIdState] = useState(() => readJson(KEYS.activeProfile, null));
  const [activeJdId, setActiveJdIdState] = useState(() => readJson(KEYS.activeJd, null));
  const [resumeDraft, setResumeDraftState] = useState(() => readJson(KEYS.resumeDraft, null));

  const refreshAll = useCallback(
    () => Promise.all([reloadProfiles(), reloadJds(), reloadResults()]),
    [reloadProfiles, reloadJds, reloadResults],
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll, mode]);

  useEffect(() => onDataModeChange((m) => setMode(m)), []);

  const setActiveProfileId = useCallback((id) => {
    setActiveProfileIdState(id);
    try {
      if (id) writeJson(KEYS.activeProfile, id);
      else removeKey(KEYS.activeProfile);
    } catch {
      /* context still works without persistence */
    }
  }, []);

  const setActiveJdId = useCallback((id) => {
    setActiveJdIdState(id);
    try {
      if (id) writeJson(KEYS.activeJd, id);
      else removeKey(KEYS.activeJd);
    } catch {
      /* ignore */
    }
  }, []);

  // Parsed resume handed from Resume Parsing to Profile Builder.
  const setResumeDraft = useCallback((draft) => {
    setResumeDraftState(draft);
    try {
      if (draft) writeJson(KEYS.resumeDraft, draft);
      else removeKey(KEYS.resumeDraft);
    } catch {
      /* ignore */
    }
  }, []);

  const activeProfile = profiles.items.find((p) => p.profile_id === activeProfileId) || null;
  const activeJd = jds.items.find((j) => j.jd_id === activeJdId) || null;

  const value = useMemo(
    () => ({
      mode,
      profiles,
      jds,
      results,
      reloadProfiles,
      reloadJds,
      reloadResults,
      refreshAll,
      activeProfileId,
      activeProfile,
      setActiveProfileId,
      activeJdId,
      activeJd,
      setActiveJdId,
      resumeDraft,
      setResumeDraft,
    }),
    [
      mode,
      profiles,
      jds,
      results,
      reloadProfiles,
      reloadJds,
      reloadResults,
      refreshAll,
      activeProfileId,
      activeProfile,
      setActiveProfileId,
      activeJdId,
      activeJd,
      setActiveJdId,
      resumeDraft,
      setResumeDraft,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
