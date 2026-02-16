'use client';

import { useState } from 'react';

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
    ? `${criticalDeg.modelName || 'Unknown model'} performance dropped ${criticalDeg.dropPercentage}% — ${criticalDeg.message || 'CUSUM change-point detected'}`
    : criticalAlert
    ? `${criticalAlert.name} — ${criticalAlert.issue}`
    : null;

  if (!alertText) return null;

  return (
    <div className="v4-alert-bar">
      <span className="v4-alert-badge">ALERT</span>
      <span className="v4-alert-text">{alertText}</span>
      <button className="v4-alert-dismiss" onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
