import type { ReactNode } from 'react';

/**
 * The Provider Listing Agreement's text (Phase 3 plan §9.1), from the API's small Markdown subset: `# ` the title
 * or an annex, `## ` a section, `### ` a sub-heading, `- ` a bullet, blank-line separated paragraphs. Every other
 * character is text, rendered as React text only (never HTML), the same rules the PDF renderer reads.
 */
type Block = { kind: 'h1' | 'h2' | 'h3' | 'p' | 'ul'; text: string; items?: string[] };

export function agreementBlocks(md: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; }
    if (list) { out.push({ kind: 'ul', text: '', items: list }); list = null; }
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('# ')) { flush(); out.push({ kind: 'h1', text: line.slice(2).trim() }); continue; }
    if (line.startsWith('## ')) { flush(); out.push({ kind: 'h2', text: line.slice(3).trim() }); continue; }
    if (line.startsWith('### ')) { flush(); out.push({ kind: 'h3', text: line.slice(4).trim() }); continue; }
    if (line.startsWith('- ')) { if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; } (list ??= []).push(line.slice(2).trim()); continue; }
    if (list) { out.push({ kind: 'ul', text: '', items: list }); list = null; }
    para.push(line.trim());
  }
  flush();
  return out;
}

/** The text, as headings, paragraphs and lists; the first title is dropped when the page shows its own. */
export default function AgreementText({ body, dropTitle = true }: { body: string; dropTitle?: boolean }) {
  const blocks = agreementBlocks(body);
  const nodes: ReactNode[] = [];
  blocks.forEach((b, i) => {
    if (dropTitle && i === 0 && b.kind === 'h1') return;
    if (b.kind === 'h1') nodes.push(<h2 key={i} className="mp-ag-annex">{b.text}</h2>);
    else if (b.kind === 'h2') nodes.push(<h3 key={i} className="mp-ag-h">{b.text}</h3>);
    else if (b.kind === 'h3') nodes.push(<h4 key={i} className="mp-ag-h3">{b.text}</h4>);
    else if (b.kind === 'ul') nodes.push(<ul key={i}>{(b.items ?? []).map((t, j) => <li key={j}>{t}</li>)}</ul>);
    else nodes.push(<p key={i}>{b.text}</p>);
  });
  return <div className="mp-agreement-text">{nodes}</div>;
}
