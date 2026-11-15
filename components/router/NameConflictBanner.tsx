'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient, ApiRequestError } from '@/lib/api-client';
import type { EndpointList } from '@/lib/api-client';
import { routerProvider } from '@/lib/router-providers';
import { Note } from '@/components/studio';
import { articleFor } from '@/components/router/EndpointsPane';
import '@/styles/studio-endpoints.css';
import '@/styles/studio-endpoint-health.css';

/**
 * The banner at the top of the Providers page (R6; plan "Private endpoints" R6 "Web", D43): while
 * one of the account's turned-on endpoint models holds a bare-name claim on a name a cloud model now
 * also has, requests for that bare name fail with model_name_conflict. The banner says so in the
 * model row's own words, lets the name go from here (the same PATCH as the Models dialog's button),
 * and jumps to the endpoint.
 *
 * It reads `nameConflicts` from GET /router/endpoints (R6). An older API sends none, so nothing
 * shows (D45). Unclaimed conflicts need no banner: their bare name simply goes to the cloud vendor.
 *
 * R6 review: at most SHOWN items at first ("Show N more" lists the rest), so several conflicts at once
 * (gemma sizes, D43) do not push the page down by thousands of pixels; "Show <endpoint>" only for a row
 * that is on the page (a Free account's pane lists none); a PATCH that answers but keeps the claim says
 * so; after a name is let go, focus moves to the line that says it was, not to the page's top.
 */

const vendorName = (v: string) => routerProvider(v)?.name ?? (v === 'xai' ? 'xAI' : v ? v.charAt(0).toUpperCase() + v.slice(1) : 'a cloud provider');
/** Items listed before "Show N more". */
const SHOWN = 3;

export default function NameConflictBanner({ list, reload }: { list: EndpointList; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // A name let go: checked against the next list (the PATCH answered, the list must no longer have it).
  const [pending, setPending] = useState<{ key: string; model: string; vendor: string } | null>(null);
  const [onPage, setOnPage] = useState<string>('');
  const doneRef = useRef<HTMLParagraphElement>(null);

  const items = list.endpoints.flatMap(e => (Array.isArray(e.nameConflicts) ? e.nameConflicts : [])
    .filter(c => c && c.claim === true && typeof c.model === 'string' && c.model && typeof c.vendor === 'string' && c.vendor && Number.isInteger(c.modelRowId))
    .map(c => ({ e, c, key: `${e.id}:${c.modelRowId}` })));
  const keys = items.map(i => i.key).join(',');

  // Which endpoints' rows are on the page (the pane renders them below; a Free account's lists none).
  useEffect(() => {
    const ids = Array.from(new Set(items.map(i => i.e.id))).filter(id => !!document.getElementById(`endpoint-${id}`)).join(',');
    setOnPage(prev => (prev === ids ? prev : ids));
  });

  // The list after a name was let go: still there means the API kept the claim.
  useEffect(() => {
    if (!pending) return;
    if (keys.split(',').includes(pending.key)) {
      setErrors(r => ({ ...r, [pending.key]: `Not changed: requests for the bare name ${pending.model} still fail with model_name_conflict. Try again.` }));
    } else {
      setDone(`Done: requests for the bare name ${pending.model} now go to ${pending.vendor}.`);
    }
    setPending(null);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  // The line that says a name was let go takes the focus (the button that had it is gone).
  useEffect(() => {
    if (done && doneRef.current) doneRef.current.focus({ preventScroll: true });
  }, [done]);

  if (!items.length && !done) return null;
  if (!items.length) {
    return (
      <div className="eh-banner">
        <Note tone="good" title="No name conflicts left">
          <p className="eh-done" role="status" tabIndex={-1} ref={doneRef}>{done}</p>
        </Note>
      </div>
    );
  }

  const letGo = async (endpointId: string, modelRowId: number, key: string, model: string, vendor: string) => {
    setBusy(key);
    setDone(null);
    setErrors(({ [key]: _gone, ...rest }) => rest);
    try {
      const res = await apiClient.updateEndpointModel(endpointId, modelRowId, { bareNameClaim: false });
      // The PATCH answered with the model still claiming the name: nothing changed, and the list would say the same.
      if (res && res.model && res.model.bareNameClaim === true) {
        setErrors(r => ({ ...r, [key]: `Not changed: requests for the bare name ${model} still fail with model_name_conflict. Try again.` }));
        return;
      }
      setPending({ key, model, vendor });
      await reload();
    } catch (err) {
      setPending(null);
      const own = err instanceof ApiRequestError && err.message && !/^Request failed with status \d+$/.test(err.message) ? err.message : null;
      setErrors(r => ({ ...r, [key]: own ?? 'Not changed. Try again.' }));
    } finally {
      setBusy(null);
    }
  };

  /** The endpoint's row in "Your endpoints" (EndpointsPane gives it the id endpoint-<public id>). */
  const show = (endpointId: string) => {
    const row = document.getElementById(`endpoint-${endpointId}`);
    if (!row) return;
    // Only a row jumped to is marked (a click on a row focuses it too, and must not paint it).
    row.setAttribute('data-jumped', '');
    row.addEventListener('blur', () => row.removeAttribute('data-jumped'), { once: true });
    row.scrollIntoView({ block: 'center' });
    row.focus({ preventScroll: true });
  };

  const reachable = new Set(onPage ? onPage.split(',') : []);
  const first = items[0].c;
  const firstVendor = vendorName(first.vendor);
  const title = items.length === 1
    ? `${first.model} now also names ${articleFor(firstVendor)} ${firstVendor} model`
    : `${items.length} of your model names now also name cloud models`;
  const visible = expanded ? items : items.slice(0, SHOWN);
  const hidden = items.length - visible.length;

  return (
    <div className="eh-banner">
      <Note tone="warn" title={title}>
        {done && <p className="eh-done" role="status" tabIndex={-1} ref={doneRef}>{done}</p>}
        <ul className="eh-conflicts" id="eh-conflicts">
          {visible.map(({ e, c, key }) => {
            const vendor = vendorName(c.vendor);
            const id = `ep/${e.slug}/${c.model}`;
            return (
              <li key={key}>
                <p className="eh-conflict-t">
                  {articleFor(vendor, true)} {vendor} model named {c.model} now exists. Requests for the bare name {c.model} now fail with model_name_conflict, so
                  nothing goes to {vendor} by surprise. Use <code className="ep-id is-long">{id}</code>, or let the bare name go to {vendor}.
                </p>
                <div className="eh-act">
                  <button type="button" className="st-btn is-sm" onClick={() => void letGo(e.id, c.modelRowId, key, c.model, vendor)} disabled={busy === key}>
                    {busy === key ? 'Letting it go…' : `Let ${c.model} go to ${vendor}`}
                  </button>
                  {reachable.has(e.id) && <button type="button" className="st-btn is-sm is-quiet" onClick={() => show(e.id)}>Show {e.name}</button>}
                </div>
                {errors[key] && <p className="st-error" role="alert">{errors[key]}</p>}
              </li>
            );
          })}
        </ul>
        {items.length > SHOWN && (
          <div className="eh-more">
            <button type="button" className="ep-linkbtn" aria-expanded={expanded} aria-controls="eh-conflicts" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Show fewer' : `Show ${hidden} more`}
            </button>
          </div>
        )}
      </Note>
    </div>
  );
}
