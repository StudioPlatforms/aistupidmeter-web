import type { ReactNode } from 'react';
import Link from 'next/link';
import { RdCode, RdFacts, highlightCode } from '@/components/landing/Reading';
import { boardLabel, topOfBoard, type SeoBoards } from '@/lib/seo-data';
import {
  CATEGORY_LABEL, CATEGORY_ORDER, MODES, integrationLabel, integrationPath, integrationsOf,
  type Code, type CodeLang, type FaqEntry, type ModeId, type Step, type Trouble,
} from '@/lib/integrations';
import { RichText } from './RichText';

/**
 * The blocks of an integration page (components/seo/integrations/IntegrationPage.tsx) and the
 * hub: the hero's settings card, the numbered setup steps, the routing-mode rows with the live
 * top of each board, the troubleshooting rows, the FAQ and the list of the other tools. Server
 * components on reading.css's rows and the landing's code card; the few extra rules are in
 * styles/seo-integrations.css (.in-*).
 */

const LANG_LABEL: Record<CodeLang, string> = { bash: 'Shell', text: 'Settings', yaml: 'YAML', json: 'JSON', python: 'Python', ts: 'TypeScript' };

/** The compact settings card in the hero: the landing's code card without the reveal class. */
export function SettingsCard({ code, name }: { code: Code; name: string }) {
  return (
    <div className="lp-codecard in-settings">
      <div className="lp-cc-head"><b>{code.title ?? name}</b><span>{LANG_LABEL[code.lang]}</span></div>
      <pre className="lp-code">{highlightCode(code.src)}</pre>
    </div>
  );
}

/** The numbered setup steps: heading, body, an optional button and an optional code card. */
export function Steps({ steps, name, cta }: { steps: Step[]; name: string; cta: string }) {
  return (
    <ol className="in-steps lp-up">
      {steps.map((s, i) => (
        <li key={s.heading} className="in-step">
          <p className="in-step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</p>
          <div className="in-step-body">
            <h3>{s.heading}</h3>
            <p><RichText text={s.body} /></p>
            {s.link && (
              <a className="lp-btn lp-btn-ghost in-step-link" href={s.link.href} data-cta={`${cta}-step-${i + 1}`}>
                {s.link.label} <span className="lp-ar" aria-hidden="true">→</span>
              </a>
            )}
            {s.code && <RdCode title={s.code.title ?? name} label={LANG_LABEL[s.code.lang]} code={s.code.src} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * One row per routing mode: the id, the docs' definition, and for the quality modes the model at
 * the top of the board they read, over the last 24 hours, with the leaderboard's statistical tie.
 * Model names appear only here, read from the boards at render time; nothing is typed.
 */
export function ModeRows({ modes, boards }: { modes: ModeId[]; boards: SeoBoards | null }) {
  const rows: [ReactNode, ReactNode][] = modes.map((id) => {
    const m = MODES[id];
    const top = boards && m.board ? topOfBoard(boards, m.board, 1)[0] : undefined;
    const label = m.board ? boardLabel(m.board) : null;
    return [
      <code key={`${id}-k`}>{m.id}</code>,
      <span key={`${id}-v`}>
        <b>{m.label}.</b> <RichText text={m.desc} />{/[.!?]$/.test(m.desc) ? '' : '.'}
        {top && label && top.placement.kind === 'ranked' && (
          <span className="in-live">
            Top of the {label} board in the last 24 hours: <Link href={`/models/${top.row.slug}`}>{top.row.label}</Link>
            {top.placement.joint ? ', in a statistical tie for first place,' : ','} of {top.placement.rankedCount} ranked models.
          </span>
        )}
      </span>,
    ];
  });
  return <RdFacts rows={rows} />;
}

/** The troubleshooting rows: problem on the left, the docs' fix on the right. */
export function TroubleRows({ rows }: { rows: Trouble[] }) {
  return <RdFacts rows={rows.map((r): [ReactNode, ReactNode] => [r.problem, <RichText key={r.problem} text={r.fix} />])} />;
}

/** The visible FAQ, on reading.css's disclosure rows; the same strings feed faqLd(). */
export function IntegrationFaq({ items }: { items: FaqEntry[] }) {
  if (!items.length) return null;
  return (
    <div className="rd-qas lp-up">
      {items.map((it, i) => (
        <details key={it.q} className="rd-qa" open={i === 0}>
          <summary>{it.q}</summary>
          <div className="rd-qa-a">
            {it.a.split(/\n{2,}/).map((p, j) => <p key={j}><RichText text={p} /></p>)}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Every other integration page, grouped by category, as the reading pages' tag lists. */
export function OtherTools({ current }: { current?: string }) {
  return (
    <div className="in-others lp-up">
      {CATEGORY_ORDER.map((c) => {
        const list = integrationsOf(c).filter((i) => i.slug !== current);
        if (!list.length) return null;
        return (
          <div key={c} className="in-group">
            <h3>{CATEGORY_LABEL[c]}</h3>
            <ul className="rd-tags">
              {list.map((i) => <li key={i.slug}><Link href={integrationPath(i.slug)}>{integrationLabel(i)}</Link></li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
