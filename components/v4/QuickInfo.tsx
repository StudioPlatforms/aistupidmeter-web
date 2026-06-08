'use client';

interface QuickInfoProps {
  recommendations: any;
  degradations?: any[];
}

function formatModelName(name: string): string {
  return name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function QuickInfo({ recommendations, degradations }: QuickInfoProps) {
  if (!recommendations) return null;

  const items: Array<{ label: string; value: string; detail: string; danger?: boolean; color: string }> = [];

  if (recommendations.bestForCode?.name) {
    items.push({
      label: 'BEST FOR CODE',
      value: formatModelName(recommendations.bestForCode.name),
      detail: `${recommendations.bestForCode.correctness ? Math.round(recommendations.bestForCode.correctness) + '% correct' : recommendations.bestForCode.score ? Math.round(recommendations.bestForCode.score) + 'pts' : 'Top performer'}`,
      color: 'var(--phosphor-green)',
    });
  }

  if (recommendations.mostReliable?.name) {
    items.push({
      label: 'MOST RELIABLE',
      value: formatModelName(recommendations.mostReliable.name),
      detail: recommendations.mostReliable.reason || 'Consistent performance',
      color: 'var(--phosphor-green)',
    });
  }

  if (recommendations.fastestResponse?.name) {
    items.push({
      label: 'BEST VALUE',
      value: formatModelName(recommendations.fastestResponse.name),
      detail: recommendations.fastestResponse.reason || 'Fast response',
      color: 'var(--amber-warning)',
    });
  }

  // 4th card: Avoid Now — check recommendations.avoidNow first, then fall back to degradations
  const avoidItem = recommendations.avoidNow?.[0];
  const firstDegradation = (!avoidItem?.name && degradations?.length) ? degradations[0] : null;

  if (avoidItem?.name) {
    items.push({
      label: 'AVOID NOW',
      value: formatModelName(avoidItem.name),
      detail: avoidItem.reason || 'Performance issues',
      danger: true,
      color: 'var(--red-alert)',
    });
  } else if (firstDegradation?.modelName) {
    items.push({
      label: 'AVOID NOW',
      value: formatModelName(firstDegradation.modelName),
      detail: firstDegradation.message || `Severity: ${firstDegradation.severity || 'detected'}`,
      danger: true,
      color: 'var(--red-alert)',
    });
  } else {
    items.push({
      label: 'AVOID NOW',
      value: 'None Flagged',
      detail: 'All models performing well',
      danger: false,
      color: 'var(--phosphor-green)',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="v4-quick-info">
      <div className="v4-section-divider" style={{ borderTop: 'none' }}>QUICK RECOMMENDATIONS</div>
      <div className="v4-quick-info-grid">
        {items.map((item, i) => (
          <div key={i} className={`v4-qi-card ${item.danger ? 'danger' : ''}`}>
            <div className="v4-qi-label" style={item.danger ? { color: 'var(--red-alert)' } : undefined}>
              {item.label}
            </div>
            <div className="v4-qi-value" style={{ color: item.color }}>{item.value}</div>
            <div className="v4-qi-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
