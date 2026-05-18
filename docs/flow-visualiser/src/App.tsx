import { useMemo, useEffect, useCallback, useState } from 'react';
import { ReactFlow } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';

import { ComponentNode } from './components/ComponentNode';
import { AnimatedEdge } from './components/AnimatedEdge';
import { FlowTabs } from './components/FlowTabs';
import { PlaybackControls } from './components/PlaybackControls';
import { StepList } from './components/StepList';
import { DetailPanel } from './components/DetailPanel';
import { usePlayback } from './hooks/usePlayback';

import { initialize } from './flows/initialize';
import { toolsList } from './flows/tools-list';
import { toolsCall } from './flows/tools-call';
import { auth } from './flows/auth';
import { registration } from './flows/registration';

import type { FlowDefinition, ComponentNodeData } from './flows/types';

const FLOWS: Record<string, FlowDefinition> = {
  initialize,
  'tools-list': toolsList,
  'tools-call': toolsCall,
  auth,
  registration,
};

const TABS = Object.entries(FLOWS).map(([id, flow]) => ({ id, title: flow.title }));

const nodeTypes = { component: ComponentNode };
const edgeTypes = { animated: AnimatedEdge };

export default function App() {
  const [flowId, setFlowId] = useState('initialize');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const flow = FLOWS[flowId]!;

  const [playback, controls] = usePlayback(flow.steps.length);
  const { currentStepIndex } = playback;

  // which nodes are active at this step
  const activeNodeIds = useMemo(() => {
    if (currentStepIndex < 0) return new Set<string>();
    const step = flow.steps[currentStepIndex];
    return new Set([step.from, step.to]);
  }, [flow, currentStepIndex]);

  // compute node state
  const nodes: Node<ComponentNodeData>[] = useMemo(() => {
    return flow.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        state: currentStepIndex < 0
          ? 'default'
          : activeNodeIds.has(n.id)
            ? 'active'
            : 'dimmed',
      } as ComponentNodeData,
    }));
  }, [flow.nodes, currentStepIndex, activeNodeIds]);

  // compute which handle side to use based on relative node positions
  const getHandles = useCallback((fromId: string, toId: string) => {
    const fromNode = flow.nodes.find(n => n.id === fromId);
    const toNode = flow.nodes.find(n => n.id === toId);
    if (!fromNode || !toNode) return {};

    const dx = toNode.position.x - fromNode.position.x;
    const dy = toNode.position.y - fromNode.position.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // horizontal dominant
      if (dx >= 0) {
        return { sourceHandle: 'right', targetHandle: 'left-t' };
      }
      return { sourceHandle: 'left', targetHandle: 'right-t' };
    }
    // vertical dominant
    if (dy >= 0) {
      return { sourceHandle: 'bottom', targetHandle: 'top-t' };
    }
    return { sourceHandle: 'top', targetHandle: 'bottom-t' };
  }, [flow.nodes]);

  // show only the current step's edge
  const edges: Edge[] = useMemo(() => {
    if (currentStepIndex < 0) return [];
    const step = flow.steps[currentStepIndex];
    const handles = getHandles(step.from, step.to);
    return [{
      id: `e-${currentStepIndex}`,
      source: step.from,
      target: step.to,
      type: 'animated',
      label: step.label,
      data: {
        source: step.from,
        stepType: step.type,
        summary: step.detail.summary,
        nodeRects: flow.nodes.map(n => ({
          x: n.position.x, y: n.position.y, w: 140, h: 50,
        })),
      },
      animated: false,
      ...handles,
    }];
  }, [flow.steps, currentStepIndex, getHandles]);

  const currentStep = currentStepIndex >= 0 ? flow.steps[currentStepIndex] : null;

  const handleFlowChange = useCallback((id: string) => {
    controls.restart();
    setFlowId(id);
  }, [controls]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          controls.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          controls.jumpToStep(Math.min(currentStepIndex + 1, flow.steps.length - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          controls.jumpToStep(Math.max(currentStepIndex - 1, 0));
          break;
        case 'r':
          controls.restart();
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controls, currentStepIndex, flow.steps.length]);

  // apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">MCP Gateway Flow Visualiser</h1>
        <div className="app__header-right">
          <FlowTabs tabs={TABS} activeId={flowId} onSelect={handleFlowChange} />
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>
      <div className="app__body">
        <div className="app__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          />
        </div>
        <aside className="app__sidebar">
          <PlaybackControls
            isPlaying={playback.isPlaying}
            speed={playback.speed}
            isLooping={playback.isLooping}
            onTogglePlay={controls.togglePlay}
            onRestart={controls.restart}
            onCycleSpeed={controls.cycleSpeed}
            onToggleLoop={controls.toggleLoop}
          />
          <StepList
            steps={flow.steps}
            currentIndex={currentStepIndex}
            onSelect={controls.jumpToStep}
          />
          <DetailPanel step={currentStep} />
        </aside>
      </div>
    </div>
  );
}
