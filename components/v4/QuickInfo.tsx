'use client';

/**
 * Quick recommendations (phones and tablets; the desktop shows IntelligencePanel instead).
 *
 * Every card renders one category the API computes from measurements
 * (routes/analytics.ts `/recommendations`), under that category's own name. Until
 * 2026-09-23 the third card printed the FASTEST model under a "BEST VALUE" heading, and
 * "avoid now" held models that were merely priced above $3 per 1M tokens.
 */

import '../../styles/studio-boards.css';

interface QuickInfoProps {
  recommendations: any;
  degradations?: any[];
}

function formatModelName(item: any): string {
  if (item?.displayName) return item.displayName;
  const name: string = item?.name || item?.modelName || '';
  return name
    .split('-')
    .map((w: string) => (w === 'gpt' ? 'GPT' : w === 'glm' ? 'GLM' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

type Tone = 'good' | 'warn' | 'bad';
type Card = { label: string; value: string; detail: string; tone: Tone; muted?: boolean };

export default function QuickInfo({ recommendations, degradations }: QuickInfoProps) {
  if (!recommendations) return null;

  const items: Card[] = [];
  const none = (label: string, detail: string): Card => ({ label, value: 'None flagged', detail, tone: 'good', muted: true });

  const code = recommendations.bestForCode;
  if (code?.name) {
    items.push({
      label: 'Best for code',
      value: formatModelName(code),
      detail: code.shortReason || (typeof code.correctness === 'number' ? `${Math.round(code.correctness)}% correct` : 'Top coding score'),
      tone: 'good',
    });
  }

  const reliable = recommendations.mostReliable;
  if (reliable?.name) {
    items.push({ label: 'Most reliable', value: formatModelName(reliable), detail: reliable.shortReason || reliable.reason || '', tone: 'good' });
  }

  const fastest = recommendations.fastestResponse;
  if (fastest?.name) {
    items.push({ label: 'Fastest', value: formatModelName(fastest), detail: fastest.shortReason || fastest.reason || '', tone: 'good' });
  }

  const value = recommendations.bestValue;
  if (value?.name) {
    items.push({ label: 'Best value', value: formatModelName(value), detail: value.shortReason || value.reason || '', tone: 'good' });
  }

  // Poor value is a price judgement, not a fault — amber, never the red "avoid" styling.
  const poor = Array.isArray(recommendations.poorValue) ? recommendations.poorValue[0] : null;
  items.push(
    poor?.name
      ? { label: 'Poor value', value: formatModelName(poor), detail: poor.shortReason || poor.reason || '', tone: 'warn' }
      : none('Poor value', 'No model costs far more for less')
  );

  // Avoid now: genuine problems only (a serious degradation or a failing score).
  const avoid = Array.isArray(recommendations.avoidNow) ? recommendations.avoidNow[0] : null;
  const seriousDeg = !avoid?.name
    ? (degradations || []).find((d: any) => d?.modelName && (d.dropPercentage > 10 || d.severity === 'critical' || d.type === 'service_disruption'))
    : null;
  if (avoid?.name) {
    items.push({ label: 'Avoid now', value: formatModelName(avoid), detail: avoid.shortReason || avoid.reason || '', tone: 'bad' });
  } else if (seriousDeg) {
    items.push({ label: 'Avoid now', value: formatModelName(seriousDeg), detail: seriousDeg.message || 'Serious degradation', tone: 'bad' });
  } else {
    items.push(none('Avoid now', 'No model is failing right now'));
  }

  return (
    <section className="v4-quick-info sl-pane st-up" aria-label="Quick recommendations">
      <h3 className="sl-pane-t">Quick recommendations</h3>
      <div className="sl-qi-grid">
        {items.map((item, i) => (
          <div key={i} className={`sl-qi${!item.muted && item.tone !== 'good' ? ` is-${item.tone}` : ''}`}>
            <div className="sl-qi-label">{item.label}</div>
            <div className={`sl-qi-value${item.muted ? ' is-muted' : ''}`}>{item.value}</div>
            <div className="sl-qi-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
