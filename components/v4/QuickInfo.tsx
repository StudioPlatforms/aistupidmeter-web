'use client';

/**
 * Quick recommendations (phones and tablets; the desktop shows IntelligencePanel instead).
 *
 * Every card renders one category the API computes from measurements
 * (routes/analytics.ts `/recommendations`), under that category's own name. Until
 * 2026-09-23 the third card printed the FASTEST model under a "BEST VALUE" heading, and
 * "avoid now" held models that were merely priced above $3 per 1M tokens.
 */

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

type Card = { label: string; value: string; detail: string; color: string; danger?: boolean; muted?: boolean };

export default function QuickInfo({ recommendations, degradations }: QuickInfoProps) {
  if (!recommendations) return null;

  const items: Card[] = [];
  const good = 'var(--phosphor-green)';
  const none = (label: string, detail: string): Card => ({ label, value: 'None flagged', detail, color: good, muted: true });

  const code = recommendations.bestForCode;
  if (code?.name) {
    items.push({
      label: 'BEST FOR CODE',
      value: formatModelName(code),
      detail: code.shortReason || (typeof code.correctness === 'number' ? `${Math.round(code.correctness)}% correct` : 'Top coding score'),
      color: good,
    });
  }

  const reliable = recommendations.mostReliable;
  if (reliable?.name) {
    items.push({ label: 'MOST RELIABLE', value: formatModelName(reliable), detail: reliable.shortReason || reliable.reason || '', color: good });
  }

  const fastest = recommendations.fastestResponse;
  if (fastest?.name) {
    items.push({ label: 'FASTEST', value: formatModelName(fastest), detail: fastest.shortReason || fastest.reason || '', color: good });
  }

  const value = recommendations.bestValue;
  if (value?.name) {
    items.push({ label: 'BEST VALUE', value: formatModelName(value), detail: value.shortReason || value.reason || '', color: good });
  }

  // Poor value is a price judgement, not a fault — amber, never the red "avoid" styling.
  const poor = Array.isArray(recommendations.poorValue) ? recommendations.poorValue[0] : null;
  items.push(
    poor?.name
      ? { label: 'POOR VALUE', value: formatModelName(poor), detail: poor.shortReason || poor.reason || '', color: 'var(--amber-warning)' }
      : none('POOR VALUE', 'No model costs far more for less')
  );

  // Avoid now: genuine problems only (a serious degradation or a failing score).
  const avoid = Array.isArray(recommendations.avoidNow) ? recommendations.avoidNow[0] : null;
  const seriousDeg = !avoid?.name
    ? (degradations || []).find((d: any) => d?.modelName && (d.dropPercentage > 10 || d.severity === 'critical' || d.type === 'service_disruption'))
    : null;
  if (avoid?.name) {
    items.push({ label: 'AVOID NOW', value: formatModelName(avoid), detail: avoid.shortReason || avoid.reason || '', color: 'var(--red-alert)', danger: true });
  } else if (seriousDeg) {
    items.push({ label: 'AVOID NOW', value: formatModelName(seriousDeg), detail: seriousDeg.message || 'Serious degradation', color: 'var(--red-alert)', danger: true });
  } else {
    items.push(none('AVOID NOW', 'No model is failing right now'));
  }

  return (
    <div className="v4-quick-info">
      <div className="v4-section-divider" style={{ borderTop: 'none' }}>QUICK RECOMMENDATIONS</div>
      <div className="v4-quick-info-grid">
        {items.map((item, i) => (
          <div key={i} className={`v4-qi-card ${item.danger ? 'danger' : ''}`}>
            <div className="v4-qi-label" style={item.danger ? { color: 'var(--red-alert)' } : undefined}>
              {item.label}
            </div>
            <div className="v4-qi-value" style={{ color: item.muted ? 'var(--phosphor-dim)' : item.color }}>{item.value}</div>
            <div className="v4-qi-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
