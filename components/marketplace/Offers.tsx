import { RdProse } from '@/components/landing/Reading';
import { longDay, safeHttps, type OfferDTO } from '@/lib/marketplace-public';

const PROVIDER_REL = 'nofollow ugc noopener noreferrer';

/**
 * A host's offers on its public pages (Phase 3 plan §4.5 block 7, §8.7; M8): what each one is, its code (plain text,
 * never applied for anyone), its end, its terms link and the disclosure line, then the block's own line. Display only:
 * never inside a score block, a ranking, a popup or a banner, and shown to paid accounts like everyone else.
 */
export default function Offers({ offers, providerName }: { offers: OfferDTO[]; providerName: string }) {
  return (
    <RdProse>
      <ul className="mp-offers">
        {offers.map(o => {
          const terms = safeHttps(o.termsUrl);
          return (
            <li key={o.id}>
              <p><b>{o.title}</b> · {o.kindLabel}{o.percent != null ? `: ${o.percent}%` : ''}</p>
              {o.details && <p>{o.details}</p>}
              <p>
                {o.code && <>Code <code>{o.code}</code>, entered at {providerName}. </>}
                {o.endsAt ? `Ends ${longDay(o.endsAt)}. ` : ''}
                {terms && <a href={terms} rel={PROVIDER_REL} target="_blank">Terms ↗</a>}
              </p>
              <p className="mp-caption">{o.disclosure}</p>
            </li>
          );
        })}
      </ul>
      <p className="mp-caption">Offers are set by {providerName} and never change rankings or routing.</p>
    </RdProse>
  );
}
