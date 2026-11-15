'use client';

/**
 * A workspace's or a project's servers (R5, staff only), loaded the way the Providers page loads an
 * account's own endpoints: only a 200 shows anything. The API answers 404 to every workspace that
 * endpoints are not switched on for, so those pages stay exactly as they were; 503 means the endpoint
 * code is not available right now. A 404 on a later reload hides the pane again, any other failure on
 * a reload keeps what is shown.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiRequestError, teamEndpointsApi, type Endpoint, type TeamEndpoint, type TeamEndpointList } from '@/lib/api-client';

export type ServersState =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'unavailable' }
  | { kind: 'error'; text: string }
  | { kind: 'ok'; list: TeamEndpointList };

/** `enabled` false: nothing is read and the state stays `off` (someone the servers are not shown to). */
export function useTeamServers(projectId?: number, enabled = true) {
  const api = useMemo(() => teamEndpointsApi(projectId), [projectId]);
  const [state, setState] = useState<ServersState>(enabled ? { kind: 'loading' } : { kind: 'off' });
  const reload = useCallback(async () => {
    try {
      setState({ kind: 'ok', list: await api.list() });
    } catch (err) {
      const status = err instanceof ApiRequestError ? err.status : 0;
      if (status === 404) setState({ kind: 'off' });
      else setState(s => (s.kind === 'ok' ? s : status === 503 ? { kind: 'unavailable' } : { kind: 'error', text: err instanceof Error ? err.message : 'Could not load the servers.' }));
    }
  }, [api]);
  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  return { api, state, reload };
}

/** A server a request can be routed to now: on, within the plan, a tested model turned on, not quarantined. */
export const serverReady = (e: Endpoint) => e.active && !e.overPlanLimit && (e.enabledModelCount ?? 0) > 0 && e.healthState !== 'quarantined';

/** The ready servers in a loaded list (a project's list holds its own and the workspace's shared with it). */
export const readyServers = (s: ServersState): TeamEndpoint[] | null => (s.kind === 'ok' ? s.list.endpoints.filter(serverReady) : null);

/**
 * The caller's own endpoints, for "Copy from your endpoints…" (owner on the workspace page, a manager
 * on a project). Read only when `enabled`; null while unknown, when endpoints are off for the caller
 * (404) or the read failed: then the copy button is simply not offered.
 */
export function useOwnEndpoints(enabled: boolean): Endpoint[] | null {
  const [own, setOwn] = useState<Endpoint[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    apiClient.getEndpoints().then(l => { if (live) setOwn(Array.isArray(l.endpoints) ? l.endpoints : []); }).catch(() => { if (live) setOwn(null); });
    return () => { live = false; };
  }, [enabled]);
  return enabled ? own : null;
}
