'use client';

import { Fragment, useState, type ReactNode } from 'react';

export type CodeLang = 'python' | 'js' | 'ts' | 'bash' | 'json' | 'text';

export interface CodeSample {
  /** Tab label: "Python", "Node", "cURL". */
  label: string;
  lang: CodeLang;
  code: string;
}

const KEYWORDS: Record<CodeLang, string[]> = {
  python: ['from', 'import', 'as', 'def', 'return', 'if', 'else', 'elif', 'for', 'in', 'while', 'with', 'async', 'await', 'True', 'False', 'None', 'class', 'try', 'except', 'print', 'lambda', 'and', 'or', 'not'],
  js: ['import', 'from', 'export', 'const', 'let', 'var', 'new', 'await', 'async', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'class', 'default'],
  ts: [],
  bash: ['export', 'curl', 'echo', 'if', 'then', 'fi', 'for', 'do', 'done'],
  json: ['true', 'false', 'null'],
  text: [],
};
KEYWORDS.ts = [...KEYWORDS.js, 'type', 'interface', 'as'];

/**
 * A small highlighter in the landing's code palette (k keyword, s string, c comment, n number,
 * f call). Enough for the setup snippets on these pages; not a parser.
 */
export function highlight(code: string, lang: CodeLang): ReactNode[] {
  if (lang === 'text') return [code];
  const kw = new Set(KEYWORDS[lang]);
  const comment = lang === 'python' || lang === 'bash' ? '#[^\\n]*' : '\\/\\/[^\\n]*';
  const re = new RegExp(
    `(${comment})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)(?=\\s*\\()|([A-Za-z_$][\\w$-]*)`,
    'g',
  );
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [tok, c, s, n, f, w] = m;
    if (c) out.push(<span key={i++} className="c">{c}</span>);
    else if (s) out.push(<span key={i++} className="s">{s}</span>);
    else if (n) out.push(<span key={i++} className="n">{n}</span>);
    else if (f) out.push(kw.has(f) ? <span key={i++} className="k">{f}</span> : <span key={i++} className="f">{f}</span>);
    else if (w && kw.has(w)) out.push(<span key={i++} className="k">{w}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`st-copy${done ? ' is-done' : ''}`}
      onClick={async () => {
        if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1600); }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

/**
 * Code in the landing's code card: a header with language tabs (or a title) and a copy button.
 * One sample → title only; several → tabs.
 */
export default function CodeBlock({ samples, title }: { samples: CodeSample[]; title?: ReactNode }) {
  const [tab, setTab] = useState(0);
  const cur = samples[Math.min(tab, samples.length - 1)];
  return (
    <div className="st-codecard">
      <div className="st-codecard-head">
        {samples.length > 1 ? (
          <div className="st-tabs" role="tablist" aria-label="Language">
            {samples.map((s, i) => (
              <button key={s.label} type="button" role="tab" aria-selected={i === tab} className="st-tab" onClick={() => setTab(i)}>{s.label}</button>
            ))}
          </div>
        ) : (
          <span className="st-codecard-title">{title ?? cur.label}</span>
        )}
        <CopyButton text={cur.code} />
      </div>
      <pre className="st-code">{highlight(cur.code, cur.lang).map((n, i) => <Fragment key={i}>{n}</Fragment>)}</pre>
    </div>
  );
}
