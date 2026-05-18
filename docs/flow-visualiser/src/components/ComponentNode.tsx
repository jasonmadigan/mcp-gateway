import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ComponentNodeData } from '../flows/types';

export function ComponentNode({ data }: NodeProps) {
  const { label, colour, state = 'default' } = data as ComponentNodeData;

  return (
    <div
      className={`component-node component-node--${state}`}
      style={{
        '--node-colour': colour,
        borderColor: colour,
      } as React.CSSProperties}
    >
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left-t" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right-t" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Top} id="top-t" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Bottom} id="bottom-t" />
      <span>{label}</span>
    </div>
  );
}
