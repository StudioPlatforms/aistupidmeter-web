'use client';

/**
 * Endpoints (phase3-plan §2.8; M4): the provider variant of the endpoint pane the Providers page uses
 * (components/router/EndpointsPane.tsx), over /account/provider/endpoints. https only, always a key, the host on
 * one of the account's verified domains; "Replace key and re-test listed models" is the Edit dialog's key field.
 * Its models are listed on /account/provider/models.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader, Note } from '@/components/studio';
import EndpointsPane from '@/components/router/EndpointsPane';
import { ProviderHead, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { chosenProvider, type ProviderSummary } from '@/lib/provider-account';
import { ApiRequestError, providerEndpointsApi, type ProviderEndpointList } from '@/lib/api-client';

export default function EndpointsClient({ initial }: { initial: ProviderSummary }) {
  const { status } = useSession();
  const [s] = useProviderSummary(initial);
  const pick = s.provider?.publicId ?? chosenProvider();
  const api = useMemo(() => providerEndpointsApi(pick), [pick]);
  const [list, setList] = useState<ProviderEndpointList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setList(await api.list()); setError(null); } catch (err) {
      setError(err instanceof ApiRequestError && typeof err.body?.message === 'string' ? err.body.message : 'The endpoints could not be loaded. Try again in a moment.');
    }
  }, [api]);
  useEffect(() => { if (status === 'authenticated') void reload(); }, [status, reload]);

  return (
    <>
      <ProviderHead
        summary={s}
        title="Endpoints"
        lead={<>The APIs your models are served from. Test them here, then list their models on <Link href="/account/provider/models">Models</Link>.</>}
      />
      <div className="st-body sw-body">
        {error && <Note tone="bad" title="Not loaded">{error}</Note>}
        {!list && !error && <Loader label="Loading your endpoints" />}
        {list && (
          <EndpointsPane
            list={{ endpoints: list.endpoints, shared: [], limits: list.limits, egress: list.egress, canManage: list.canManage } as never}
            reload={reload}
            scope={{ kind: 'provider', hostRule: list.hostRule, verifiedDomains: list.verifiedDomains }}
            api={api}
          />
        )}
        {list && list.hostRule === 'verified' && list.verifiedDomains.length === 0 && (
          <Note tone="warn" title="No verified domain yet">
            An endpoint&rsquo;s host must be on one of your verified domains. <Link href="/account/provider/domains">Verify a domain</Link> first.
          </Note>
        )}
      </div>
    </>
  );
}
