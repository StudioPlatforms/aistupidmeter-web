'use client';

interface QuickInfoProps {
  recommendations: any;
}

export default function QuickInfo({ recommendations }: QuickInfoProps) {
  if (!recommendations) return null;

  const items: Array<{ label: string; value: string; detail: string; danger?: boolean; color: string }> = [];

  if (recommendations.bestForCode?.name) {
    items.push({
      label: 'BEST FOR CODE',
      value: recommendations.bestForCode.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      detail: `${recommendations.bestForCode.correctness ? Math.round(recommendations.bestForCode.correctness) + '% correct' : recommendations.bestForCode.score ? Math.round(recommendations.bestForCode.score) + 'pts' : 'Top performer'}`,
      color: 'var(--phosphor-green)',
    });
  }

  if (recommendations.mostReliable?.name) {
    items.push({
      label: 'MOST RELIABLE',
      value: recommendations.mostReliable.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      detail: recommendations.mostReliable.reason || 'Consistent performance',
      color: 'var(--phosphor-green)',
    });
  }

  if (recommendations.fastestResponse?.name) {
    items.push({
      label: 'BEST VALUE',
      value: recommendations.fastestResponse.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      detail: recommendations.fastestResponse.reason || 'Fast response',
      color: 'var(--amber-warning)',
    });
  }

  if (recommendations.avoidNow?.[0]?.name) {
    items.push({
      label: 'AVOID NOW',
      value: recommendations.avoidNow[0].name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      detail: recommendations.avoidNow[0].reason || 'Performance issues',
      danger: true,
      color: 'var(--red-alert)',
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
