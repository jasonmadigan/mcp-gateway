import { useEffect, useRef } from 'react';
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { COLOURS } from '../flows/types';

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
}: EdgeProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const source = (data?.source as string) ?? '';
  const stepType = (data?.stepType as string) ?? 'request';
  const summary = (data?.summary as string) ?? '';
  const isReject = typeof label === 'string' && label.includes('401');

  let stroke: string;
  if (isReject) {
    stroke = '#ef5350';
  } else if (stepType === 'response') {
    stroke = '#78909c';
  } else {
    stroke = COLOURS[source] ?? '#78909c';
  }

  const isDashed = stepType === 'response' && !isReject;
  const isInternal = stepType === 'internal';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // position label to avoid overlapping nodes
  const nodeRects = (data?.nodeRects as Array<{x:number;y:number;w:number;h:number}>) ?? [];
  const labelW = 280;
  const labelH = 70;

  function overlapsAny(cx: number, cy: number): number {
    const lx = cx - labelW / 2;
    const ly = cy - labelH / 2;
    let total = 0;
    for (const r of nodeRects) {
      const ox = Math.max(0, Math.min(lx + labelW, r.x + r.w) - Math.max(lx, r.x));
      const oy = Math.max(0, Math.min(ly + labelH, r.y + r.h) - Math.max(ly, r.y));
      total += ox * oy;
    }
    return total;
  }

  const edgeDx = targetX - sourceX;
  const edgeDy = targetY - sourceY;
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
  const normPx = -edgeDy / edgeLen;
  const normPy = edgeDx / edgeLen;

  // test candidates: perpendicular both sides at varying distances
  let bestX = 0;
  let bestY = 0;
  let bestOverlap = Infinity;
  for (const dist of [80, 120, 160]) {
    for (const sign of [1, -1]) {
      const cx = labelX + normPx * dist * sign;
      const cy = labelY + normPy * dist * sign;
      const overlap = overlapsAny(cx, cy);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestX = cx;
        bestY = cy;
      }
      if (overlap === 0) break;
    }
    if (bestOverlap === 0) break;
  }

  const perpX = bestX - labelX;
  const perpY = bestY - labelY;

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();

    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    const anim = path.animate(
      [{ strokeDashoffset: `${len}` }, { strokeDashoffset: '0' }],
      { duration: 600, easing: 'linear', fill: 'forwards' },
    );

    anim.onfinish = () => {
      path.style.strokeDashoffset = '0';
      if (isDashed) {
        path.style.strokeDasharray = '8,5';
      } else if (isInternal) {
        path.style.strokeDasharray = '4,4';
      } else {
        path.style.strokeDasharray = 'none';
      }
    };

    return () => anim.cancel();
  }, [edgePath, isDashed, isInternal]);

  return (
    <>
      <g className="animated-edge">
        <defs>
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
          </marker>
        </defs>
        <path
          ref={pathRef}
          d={edgePath}
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          markerEnd={`url(#arrow-${id})`}
          className="animated-edge__path"
        />
      </g>
      {label && (
        <EdgeLabelRenderer>
          <div
            className="edge-annotation"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + perpX}px, ${labelY + perpY}px)`,
              pointerEvents: 'none',
            }}
          >
            <div className="edge-annotation__label" style={{ color: stroke }}>
              {label as string}
            </div>
            {summary && (
              <div className="edge-annotation__summary">{summary}</div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
