import type { Node } from '@xyflow/react';

export interface StepDetail {
  summary: string;
  technical: string;
}

export interface FlowStep {
  from: string;
  to: string;
  label: string;
  type: 'request' | 'response' | 'internal';
  detail: StepDetail;
}

export interface FlowDefinition {
  title: string;
  nodes: Node[];
  steps: FlowStep[];
}

export const COLOURS: Record<string, string> = {
  client: '#4fc3f7',
  envoy: '#ab47bc',
  router: '#66bb6a',
  broker: '#ffa726',
  auth: '#ef5350',
  authorino: '#ef5350',
  cache: '#78909c',
  server1: '#26c6da',
  server2: '#26c6da',
  server3: '#26c6da',
  authserver: '#ffd54f',
  controller: '#ffee58',
  k8sapi: '#ffee58',
  secret: '#78909c',
};

export interface ComponentNodeData {
  label: string;
  colour: string;
  state?: 'default' | 'active' | 'dimmed';
  [key: string]: unknown;
}

function node(id: string, label: string, x: number, y: number): Node<ComponentNodeData> {
  return {
    id,
    type: 'component',
    position: { x, y },
    data: { label, colour: COLOURS[id] ?? '#78909c' },
  };
}

// standard layouts reused across flows
export const DATAPLANE_NODES: Node<ComponentNodeData>[] = [
  node('client', 'Client', 0, 250),
  node('envoy', 'Envoy', 200, 250),
  node('router', 'Router', 450, 100),
  node('cache', 'Cache', 450, 250),
  node('broker', 'Broker', 450, 400),
  node('auth', 'Auth', 450, 530),
  node('authorino', 'Authorino', 650, 530),
  node('server1', 'Server 1', 850, 100),
  node('server2', 'Server 2', 850, 250),
  node('server3', 'Server 3', 850, 400),
  node('authserver', 'Auth Server', 850, 530),
];

export const CONTROLPLANE_NODES: Node<ComponentNodeData>[] = [
  node('controller', 'Controller', 0, 200),
  node('k8sapi', 'K8s API', 300, 100),
  node('secret', 'Secret', 300, 300),
  node('broker', 'Broker', 600, 150),
  node('router', 'Router', 600, 300),
  node('server1', 'Server 1', 850, 200),
];
