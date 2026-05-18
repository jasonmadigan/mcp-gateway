import type { FlowStep } from '../flows/types';

interface DetailPanelProps {
  step: FlowStep | null;
}

export function DetailPanel({ step }: DetailPanelProps) {
  if (!step) {
    return (
      <div className="detail-panel detail-panel--empty">
        <p className="detail-panel__hint">
          Click play or select a step from the list above.
        </p>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <h4 className="detail-panel__title">{step.label}</h4>
      <pre className="detail-panel__code"><code>{step.detail.technical}</code></pre>
    </div>
  );
}
