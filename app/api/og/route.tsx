import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Dynamic Open Graph card — the image X, Telegram, Slack, Discord and LinkedIn
 * render when aistupidlevel.info is shared.
 *
 * ── WHY THIS RUNS ON THE NODE RUNTIME ──────────────────────────────────────
 * It used to be `runtime = 'edge'`. We self-host (systemd unit aistupid-web,
 * `next start`), so there is no edge network to gain anything from, and the node
 * runtime lets us read the real Roboto faces and the ASL wordmark off disk once
 * at module load instead of refetching them per request.
 *
 * ── THE BUG THIS FILE EXISTS TO NOT REPEAT ─────────────────────────────────
 * From 2025-10-16 until 2026-09-03 this route served nothing but its own error
 * card. The cause:
 *
 *     const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000'
 *     await fetch(`${apiUrl}/dashboard/cached?...`)
 *
 * In production that is a RELATIVE url. Server-side fetch has no origin to
 * resolve against, so it threw "URL is malformed" on every single request, the
 * catch swallowed it, and every share of this site for ~11 months showed a black
 * "DATA TEMPORARILY UNAVAILABLE" panel. The `''` trick is correct in a 'use
 * client' component (the browser resolves it against the origin) and wrong in
 * every server context. Keep API_BASE absolute.
 *
 * 127.0.0.1 and not localhost: /etc/hosts maps localhost to both ::1 and
 * 127.0.0.1, but the API binds IPv4 only. Node happens to cope, nginx did not —
 * that mismatch caused a real outage on this box. Use the literal.
 */

export const runtime = 'nodejs';
// Regenerate at most once a minute; scores only move hourly.
export const revalidate = 60;

const API_BASE = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

// A crawler must never be left hanging, but the fallback card is the worse
// outcome, so this is deliberately generous. Measured on this box: ~150ms warm,
// but 4.3-4.8s on a cold SQLite cache (the first hit after an API restart, and
// the dashboard routes do ~4s of event-loop-blocking work on a cache miss).
// 2.5s was too tight and produced fallback cards for real, recoverable slowness.
// Still far inside nginx's 60s proxy_read_timeout and any crawler's patience.
const FETCH_TIMEOUT_MS = 6000;

const WIDTH = 1200;
const HEIGHT = 630;

/* Column geometry, shared by ColumnHeader and the rows. Defined once because
   the first cut hardcoded the widths in both places, they disagreed, and the
   header rendered as "SCORETREND". */
const RANK_W = 54;
const SCORE_W = 92;
const TREND_W = 64;

/* ── design tokens, mirrored from styles/vintage.css :root ─────────────────
   Kept as literals because satori has no CSS custom-property support. If the
   site's palette moves, move these with it. */
const CANVAS = '#f6f8fc'; // --terminal-black : page ground
const SURFACE = '#ffffff'; // --terminal-dark  : card fill
const INK = '#202124'; // --phosphor-green : primary ink (slate, not green)
const INK_DIM = '#5f6368'; // --phosphor-dim   : secondary ink
const BORDER = '#e3e6ea'; // --metal-silver   : the one hairline weight
const ACCENT = '#1a73e8'; // --accent         : identity / interactive only
const ACCENT_BG = '#e8f0fe'; // --accent-bg
const GOOD = '#1e8e3e';
const WARN = '#b06000';
const BAD = '#d93025';
const BAD_BG = '#fce8e6';

/** The leaderboard's own rule — V4Leaderboard.tsx:31. Never paint a score blue. */
function scoreColor(score: number): string {
  if (score >= 70) return GOOD;
  if (score >= 50) return WARN;
  return BAD;
}

/** Vendor brand colours — V4Leaderboard.tsx:16-19. */
const PROVIDER_COLOR: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  xai: '#111111',
  google: '#4285f4',
  glm: '#e91e63',
  zai: '#e91e63',
  deepseek: '#4d6bfe',
  kimi: '#ff6b35',
  moonshot: '#ff6b35',
};

/** The live UI capitalizes the raw vendor slug, which renders "Openai". Do it properly. */
const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  deepseek: 'DeepSeek',
  glm: 'Z.AI',
  zai: 'Z.AI',
  kimi: 'Moonshot',
  moonshot: 'Moonshot',
};

const providerLabel = (v: string) =>
  PROVIDER_LABEL[(v || '').toLowerCase()] || (v ? v[0].toUpperCase() + v.slice(1) : 'Unknown');
const providerColor = (v: string) => PROVIDER_COLOR[(v || '').toLowerCase()] || INK_DIM;

/* ── assets, loaded once per process ───────────────────────────────────────
   Vendored rather than fetched: this box has no CDN and outbound calls at
   render time are one more thing that can fail in front of a crawler. */
function loadAsset(relPath: string): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), relPath));
  } catch {
    return null;
  }
}

const FONT_REGULAR = loadAsset('app/api/og/fonts/Roboto-400.ttf');
const FONT_MEDIUM = loadAsset('app/api/og/fonts/Roboto-500.ttf');
const FONT_BOLD = loadAsset('app/api/og/fonts/Roboto-700.ttf');

const LOGO = loadAsset('public/asl-mark.png');
const LOGO_SRC = LOGO ? `data:image/png;base64,${LOGO.toString('base64')}` : null;

function fonts() {
  const out: any[] = [];
  if (FONT_REGULAR) out.push({ name: 'Roboto', data: FONT_REGULAR, weight: 400, style: 'normal' });
  if (FONT_MEDIUM) out.push({ name: 'Roboto', data: FONT_MEDIUM, weight: 500, style: 'normal' });
  if (FONT_BOLD) out.push({ name: 'Roboto', data: FONT_BOLD, weight: 700, style: 'normal' });
  return out;
}

/** Every card renders through here so the headers can never drift apart. */
function png(node: React.ReactElement) {
  return new ImageResponse(node, {
    width: WIDTH,
    height: HEIGHT,
    fonts: fonts(),
    headers: {
      // ImageResponse defaults to `immutable, max-age=31536000` — a year, for an
      // image whose whole point is that it changes. Five minutes at the edge,
      // with a stale window so a crawler burst never stampedes the renderer.
      'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

type ModelRow = {
  id?: string;
  name: string;
  vendor?: string;
  provider?: string;
  currentScore?: number;
  score?: number;
  trend?: string;
};

/** Absolute URL + hard timeout. Returns null rather than throwing. */
async function getJSON(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'User-Agent': 'aistupidlevel-og', Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`[OG] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[OG] ${path} failed:`, err?.message || err);
    return null;
  }
}

/**
 * Rankings come from /dashboard/scores (~7KB), NOT /dashboard/cached (~855KB).
 * The old route pulled the big one and used 1% of it: 99% of that payload is
 * `historyMap`, which no card has ever rendered.
 */
async function getModels(): Promise<ModelRow[]> {
  const json = await getJSON('/dashboard/scores?period=latest&sortBy=combined');
  const rows = json?.data;
  if (!Array.isArray(rows)) return [];
  return rows.filter((m: any) => m && typeof m.name === 'string');
}

async function getDegradations(): Promise<any[]> {
  const json = await getJSON('/analytics/degradations?period=latest');
  const rows = Array.isArray(json?.data) ? json.data : [];
  // The feed can carry the same model more than once (one entry per detection
  // window), which reads as a rendering bug on a card that only shows four
  // rows. Keep the worst drop per model.
  const worstByModel = new Map<string, any>();
  for (const d of rows) {
    const key = String(d?.modelName || '');
    if (!key) continue;
    const prev = worstByModel.get(key);
    if (!prev || (d?.dropPercentage ?? 0) > (prev?.dropPercentage ?? 0)) {
      worstByModel.set(key, d);
    }
  }
  return Array.from(worstByModel.values()).sort(
    (a, b) => (b?.dropPercentage ?? 0) - (a?.dropPercentage ?? 0)
  );
}

const scoreOf = (m: ModelRow) =>
  typeof m.currentScore === 'number' ? m.currentScore : typeof m.score === 'number' ? m.score : null;

function formatUpdated(rows: ModelRow[]): string {
  const stamp = (rows as any[]).map((m) => m?.lastUpdated).find(Boolean);
  const d = stamp ? new Date(stamp) : new Date();
  if (Number.isNaN(d.getTime())) return 'updated hourly';
  const day = d.getUTCDate();
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `Updated ${day} ${mon} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** Long ids like claude-sonnet-4-5-20250929 must not shove the score off the card. */
function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ── shared chrome ─────────────────────────────────────────────────────── */

function Header({ right }: { right?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 26,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {LOGO_SRC ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={LOGO_SRC} width={155} height={33} alt="ASL" />
        ) : (
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: ACCENT, letterSpacing: -0.5 }}>ASL</div>
        )}
        <div
          style={{ display: 'flex',
            marginLeft: 16,
            paddingLeft: 16,
            borderLeft: `1px solid ${BORDER}`,
            fontSize: 19,
            color: INK_DIM,
          }}
        >
          aistupidlevel.info
        </div>
      </div>
      {right ? <div style={{ display: 'flex', fontSize: 17, color: INK_DIM }}>{right}</div> : null}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: CANVAS,
        padding: '40px 44px',
        fontFamily: 'Roboto',
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** The site's column-header strip: 11-12px/600 uppercase dim ink, the one surviving uppercase. */
function ColumnHeader({ cols }: { cols: { label: string; width?: number; align?: string }[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 22px',
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {cols.map((c, i) => {
        // Build the style object conditionally. Handing satori an explicit
        // `undefined` for a property makes it throw
        // "Cannot read properties of undefined (reading 'trim')" — it assumes
        // any present key holds a string it can parse. Omit the key instead.
        const style: Record<string, any> = {
          display: 'flex',
          justifyContent:
            c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start',
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: 0.6,
          color: INK_DIM,
        };
        if (c.width) style.width = c.width;
        else style.flex = 1;
        return (
          <div key={i} style={style}>
            {c.label}
          </div>
        );
      })}
    </div>
  );
}

/** Rank 1-3 get the accent circle, exactly like the leaderboard. */
function Rank({ n }: { n: number }) {
  const top = n <= 3;
  return (
    <div style={{ display: 'flex', width: RANK_W, alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 17,
          background: top ? ACCENT_BG : 'transparent',
          color: top ? ACCENT : INK_DIM,
          fontSize: 17,
          fontWeight: top ? 700 : 500,
        }}
      >
        {n}
      </div>
    </div>
  );
}

function ProviderTile({ vendor }: { vendor: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        marginRight: 14,
      }}
    >
      <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: providerColor(vendor) }} />
    </div>
  );
}

/**
 * Trend marker as an inline SVG polygon.
 *
 * NOT the classic zero-width/transparent-border CSS triangle: satori paints
 * that as a solid rectangle, so the first render showed coloured blocks in the
 * trend column. And NOT a ▲/▼ glyph either — the vendored Roboto is the latin
 * subset and would render tofu. SVG is the one approach with no font or
 * box-model dependency.
 */
function Trend({ dir }: { dir?: string }) {
  const up = dir === 'up';
  const down = dir === 'down';
  return (
    <div style={{ display: 'flex', width: TREND_W, justifyContent: 'center', alignItems: 'center' }}>
      {up || down ? (
        <svg width="15" height="11" viewBox="0 0 15 11">
          <polygon
            points={up ? '7.5,0 15,11 0,11' : '0,0 15,0 7.5,11'}
            fill={up ? GOOD : BAD}
          />
        </svg>
      ) : (
        <div style={{ display: 'flex', width: 14, height: 2, background: INK_DIM }} />
      )}
    </div>
  );
}

function ModelRowView({ m, rank, last }: { m: ModelRow; rank: number; last: boolean }) {
  const s = scoreOf(m);
  const vendor = m.vendor || m.provider || '';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // flex rather than a fixed height so the rows always fill the card
        // exactly, whatever the row count — otherwise a short list leaves a
        // dead white band at the bottom of the panel.
        flex: 1,
        padding: '0 22px',
        borderBottom: last ? 'none' : `1px solid ${BORDER}`,
      }}
    >
      <Rank n={rank} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', minWidth: 0 }}>
        <ProviderTile vendor={vendor} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 23, fontWeight: 500, color: INK, letterSpacing: -0.2 }}>
            {truncate(m.name, 30)}
          </div>
          <div style={{ display: 'flex', fontSize: 15, color: INK_DIM, marginTop: 2 }}>{providerLabel(vendor)}</div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          width: SCORE_W,
          justifyContent: 'flex-end',
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: -0.5,
          color: s === null ? INK_DIM : scoreColor(s),
        }}
      >
        {s === null ? 'N/A' : s}
      </div>
      <Trend dir={m.trend} />
    </div>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', marginTop: 20, fontSize: 17, color: INK_DIM }}>{text}</div>
  );
}

/* ── cards ─────────────────────────────────────────────────────────────── */

/**
 * The fallback. On-brand so a bad minute never looks like a broken site, but
 * visibly a degraded state (no rows, explicit wording) so we can tell from a
 * timeline screenshot that the backend was unreachable.
 */
function fallbackCard() {
  return png(
    <Frame>
      <Header />
      <Card>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 500, color: INK, letterSpacing: -0.5 }}>
            Live AI model benchmarks
          </div>
          <div style={{ display: 'flex', marginTop: 14, fontSize: 22, color: INK_DIM }}>
            Independent hourly scoring across 20+ models
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              padding: '8px 18px',
              borderRadius: 999,
              background: CANVAS,
              border: `1px solid ${BORDER}`,
              fontSize: 17,
              color: INK_DIM,
            }}
          >
            Scores refreshing — see the live leaderboard
          </div>
        </div>
      </Card>
      <Footer text="aistupidlevel.info" />
    </Frame>
  );
}

function rankingsCard(models: ModelRow[]) {
  const rows = models.slice(0, 5);
  return png(
    <Frame>
      <Header right={`${models.length} models tracked`} />
      <Card>
        <ColumnHeader
          cols={[
            { label: 'RANK', width: RANK_W },
            { label: 'MODEL' },
            { label: 'SCORE', width: SCORE_W, align: 'right' },
            { label: 'TREND', width: TREND_W, align: 'center' },
          ]}
        />
        {rows.map((m, i) => (
          <ModelRowView key={m.id || m.name} m={m} rank={i + 1} last={i === rows.length - 1} />
        ))}
      </Card>
      <Footer text={formatUpdated(models)} />
    </Frame>
  );
}

/**
 * "Winner" — one model, big. Used by ShareButton's winner share, and the right
 * card whenever the interesting fact is who is on top rather than the spread.
 */
function winnerCard(models: ModelRow[]) {
  const top = models[0];
  const s = scoreOf(top);
  const rest = models.slice(1, 4);
  return png(
    <Frame>
      <Header right={`${models.length} models tracked`} />
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '30px 34px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                padding: '5px 13px',
                borderRadius: 999,
                background: ACCENT_BG,
                color: ACCENT,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 0.6,
              }}
            >
              #1 RIGHT NOW
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
            <ProviderTile vendor={top.vendor || top.provider || ''} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: INK, letterSpacing: -1.4 }}>
                {truncate(top.name, 26)}
              </div>
              <div style={{ display: 'flex', fontSize: 20, color: INK_DIM, marginTop: 4 }}>
                {providerLabel(top.vendor || top.provider || '')}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: -3,
                color: s === null ? INK_DIM : scoreColor(s),
              }}
            >
              {s === null ? 'N/A' : s}
            </div>
          </div>
          {/* Supporting line. Also does layout work: without it the hero left a
              dead ~150px white band above the runners-up strip. */}
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              fontSize: 21,
              lineHeight: 1.45,
              color: INK_DIM,
              maxWidth: 860,
            }}
          >
            {`Ranked first of ${models.length} models on the combined benchmark — coding, reasoning and tool use, re-scored every hour.`}
          </div>
          {/* Explicit spacer rather than `marginTop: 'auto'` — satori's margin
              handling does not take 'auto', and it takes the whole render down. */}
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', borderTop: `1px solid ${BORDER}`, paddingTop: 18 }}>
            {rest.map((m, i) => {
              const rs = scoreOf(m);
              return (
                <div
                  key={m.id || m.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    paddingLeft: i === 0 ? 0 : 20,
                    marginLeft: i === 0 ? 0 : 20,
                    borderLeft: i === 0 ? 'none' : `1px solid ${BORDER}`,
                  }}
                >
                  <div style={{ display: 'flex', fontSize: 15, color: INK_DIM, letterSpacing: 0.5 }}>{`#${i + 2}`}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 4 }}>
                    <div style={{ display: 'flex', fontSize: 21, fontWeight: 500, color: INK, flex: 1 }}>
                      {truncate(m.name, 18)}
                    </div>
                    <div
                      style={{ display: 'flex',
                        fontSize: 21,
                        fontWeight: 700,
                        color: rs === null ? INK_DIM : scoreColor(rs),
                      }}
                    >
                      {rs === null ? 'N/A' : rs}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <Footer text={formatUpdated(models)} />
    </Frame>
  );
}

/**
 * "Index" — the spread across the fleet. globalIndex is null in the live payload,
 * so the headline number is DERIVED from the scores we actually have and labelled
 * as such. Never print a hardcoded figure.
 */
function indexCard(models: ModelRow[]) {
  const scores = models.map(scoreOf).filter((s): s is number => s !== null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.max(...scores) : null;
  const worst = scores.length ? Math.min(...scores) : null;
  const below = scores.filter((s) => s < 50).length;

  const tiles = [
    { label: 'FLEET AVERAGE', value: avg, color: avg === null ? INK_DIM : scoreColor(avg) },
    { label: 'BEST', value: best, color: best === null ? INK_DIM : scoreColor(best) },
    { label: 'WEAKEST', value: worst, color: worst === null ? INK_DIM : scoreColor(worst) },
    { label: 'BELOW 50', value: below, color: below > 0 ? BAD : INK },
  ];

  return png(
    <Frame>
      <Header right={`${models.length} models tracked`} />
      <Card>
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
          {tiles.map((t, i) => (
            <div
              key={t.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                padding: '24px 26px',
                borderLeft: i === 0 ? 'none' : `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, letterSpacing: 0.7, color: INK_DIM }}>
                {t.label}
              </div>
              <div
                style={{ display: 'flex',
                  fontSize: 54,
                  fontWeight: 700,
                  letterSpacing: -1.6,
                  color: t.color,
                  marginTop: 6,
                }}
              >
                {t.value === null ? 'N/A' : t.value}
              </div>
            </div>
          ))}
        </div>
        <ColumnHeader
          cols={[
            { label: 'RANK', width: RANK_W },
            { label: 'MODEL' },
            { label: 'SCORE', width: SCORE_W, align: 'right' },
            { label: 'TREND', width: TREND_W, align: 'center' },
          ]}
        />
        {models.slice(0, 3).map((m, i) => (
          <ModelRowView key={m.id || m.name} m={m} rank={i + 1} last={i === 2} />
        ))}
      </Card>
      <Footer text={formatUpdated(models)} />
    </Frame>
  );
}

/**
 * "Alert" — degradations. ShareButton writes tweet copy about a drop, so the
 * card has to actually show the drop. If nothing is degraded we do NOT fake an
 * alert; we fall through to the rankings card.
 */
function alertCard(models: ModelRow[], degradations: any[]) {
  const rows = degradations.slice(0, 4);
  return png(
    <Frame>
      <Header right={`${degradations.length} flagged`} />
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '18px 22px',
            borderBottom: `1px solid ${BORDER}`,
            background: BAD_BG,
          }}
        >
          <div style={{ display: 'flex', width: 4, height: 26, background: BAD, marginRight: 14 }} />
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: BAD, letterSpacing: -0.3 }}>
            Performance degradation detected
          </div>
        </div>
        {rows.map((d: any, i: number) => {
          const drop = typeof d?.dropPercentage === 'number' ? d.dropPercentage : null;
          const cur = typeof d?.currentScore === 'number' ? d.currentScore : null;
          const base = typeof d?.baselineScore === 'number' ? d.baselineScore : null;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                padding: '0 22px',
                borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${BORDER}`,
              }}
            >
              <ProviderTile vendor={d?.provider || ''} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, color: INK, letterSpacing: -0.2 }}>
                  {truncate(String(d?.modelName || 'Unknown model'), 28)}
                </div>
                <div style={{ display: 'flex', fontSize: 15, color: INK_DIM, marginTop: 2 }}>
                  {base !== null && cur !== null ? `${base} → ${cur}` : providerLabel(d?.provider || '')}
                </div>
              </div>
              {drop !== null ? (
                <div
                  style={{
                    display: 'flex',
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: BAD_BG,
                    color: BAD,
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                  }}
                >
                  {`-${drop}%`}
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
      <Footer text={formatUpdated(models)} />
    </Frame>
  );
}

export async function GET(request: NextRequest) {
  try {
    const type = (new URL(request.url).searchParams.get('type') || 'rankings').toLowerCase();

    // 'alert' is the only card that needs the degradations feed, so only it pays
    // for the second request.
    const [models, degradations] = await Promise.all([
      getModels(),
      type === 'alert' ? getDegradations() : Promise.resolve([] as any[]),
    ]);

    if (!models.length) return fallbackCard();

    if (type === 'alert' && degradations.length) return alertCard(models, degradations);
    if (type === 'winner') return winnerCard(models);
    if (type === 'index') return indexCard(models);

    // rankings, alert-with-nothing-degraded, and any unrecognised ?type= from
    // the unbounded /share/[type] segment all land here. Never error on input.
    return rankingsCard(models);
  } catch (error) {
    console.error('[OG] generation failed:', error);
    // Still a valid 200 image — a crawler that gets a 500 caches the failure.
    return fallbackCard();
  }
}
