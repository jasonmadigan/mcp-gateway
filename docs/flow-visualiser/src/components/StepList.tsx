import { useEffect, useRef } from 'react';
import type { FlowStep } from '../flows/types';

interface StepListProps {
  steps: FlowStep[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function StepList({ steps, currentIndex, onSelect }: StepListProps) {
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentIndex]);

  return (
    <div className="step-list">
      <h3 className="step-list__heading">Steps</h3>
      <ol className="step-list__items">
        {steps.map((step, i) => (
          <li
            key={i}
            ref={i === currentIndex ? activeRef : null}
            className={`step-list__item ${i === currentIndex ? 'step-list__item--active' : ''}`}
            onClick={() => onSelect(i)}
          >
            <span className="step-list__number">{i + 1}.</span>
            {step.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
