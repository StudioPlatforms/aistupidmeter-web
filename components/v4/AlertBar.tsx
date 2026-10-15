'use client';

import { useState } from 'react';
import '../../styles/studio-board.css';

interface AlertBarProps {
  alerts: Array<{
    name: string;
    provider: string;
    issue: string;
    severity: 'warning' | 'critical';
  }>;
  degradations: Array<{
    modelName?: string;
    dropPercentage?: number;
    severity?: string;
    message?: string;
  }>;
}

export default function AlertBar({ alerts, degradations }: AlertBarProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Find the most critical alert to display
  const criticalDeg = degradations.find(d => d.severity === 'critical' && d.dropPercentage && d.dropPercentage > 5);
  const criticalAlert = alerts.find(a => a.severity === 'critical');

  const alertText = criticalDeg
    ? `${criticalDeg.modelName || 'Unknown model'} performance dropped ${criticalDeg.dropPercentage}% — ${criticalDeg.message || 'Page-Hinkley change-point detected'}`
    : criticalAlert
    ? `${criticalAlert.name} — ${criticalAlert.issue}`
    : null;

  if (!alertText) return null;

  // A studio callout in the page's header band (styles/studio-board.css .sb-alert).
  return (
    <div className="sb-alert">
      <span className="st-tag is-bad">Alert</span>
      <p className="sb-alert-t">{alertText}</p>
      <button type="button" className="st-x" aria-label="Dismiss alert" onClick={() => setDismissed(true)}>×</button>
    </div>
  );
}
