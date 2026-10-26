import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async action and tracks idle / loading / success / error state.
// Ignores results that resolve after the component unmounts.
export function useAsyncTask() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (fn) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await fn();
      if (mounted.current) setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      if (mounted.current) setState((s) => ({ ...s, status: 'error', error }));
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle', data: null, error: null }), []);

  return { ...state, loading: state.status === 'loading', run, reset, setData: (data) => setState({ status: 'success', data, error: null }) };
}
