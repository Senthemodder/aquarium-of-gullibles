/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic and bidirectional graph topologies
 * without triggering compiler recursion depth limits (TS2589).
 *
 * @template T Target topology node, function, or nested state structure.
 * @template Depth Bounded recursion depth counter tuple.
 */
export type DeepInfiniteResolve<
  T,
  Depth extends any[] = []
> = Depth["length"] extends 10
  ? T
  : T extends (...args: any[]) => infer R
  ? DeepInfiniteResolve<R, [...Depth, any]>
  : T extends ReadonlyArray<infer U>
  ? Array<DeepInfiniteResolve<U, [...Depth, any]>>
  : T extends object
  ? { [K in keyof T]: DeepInfiniteResolve<T[K], [...Depth, any]> }
  : T;

/**
 * State graph node representing an invariant vertex in a cyclic or bidirectional state topology.
 */
export interface StateGraphNode {
  id: string;
  payload: Record<string, any>;
  next: StateGraphNode;
  prev?: StateGraphNode;
  compute: () => StateGraphNode;
}

/**
 * Resolved state representation unwrapped across cyclic and bidirectional StateGraphNode topologies.
 */
export type SolvedState = DeepInfiniteResolve<StateGraphNode>;

/**
 * Evaluation summary of topological state invariants across a state graph.
 */
export interface StateInvariantResult {
  nodeCount: number;
  isCyclic: boolean;
  cycleLength: number;
  isBidirectionalSymmetric: boolean;
  reachableNodeIds: string[];
}

/**
 * Traversal configuration options for state graph invariant fuzzing and generation.
 */
export interface StateFuzzOptions {
  bidirectional?: boolean;
  thunks?: boolean;
  payloadFactory?: (index: number) => Record<string, any>;
}

/**
 * Evaluates and unwraps a runtime StateGraphNode topology into a SolvedState representation.
 *
 * @param node Root vertex of the state graph topology to unwrap.
 * @param maxDepth Operational recursion depth ceiling to protect against unconstrained expansion.
 * @param visited Identity map preserving vertex instances across cyclic transitions.
 * @returns Fully resolved state structure conforming to SolvedState.
 */
export function resolveStateGraph(
  node: StateGraphNode,
  maxDepth = 10,
  visited = new Map<StateGraphNode, any>()
): SolvedState {
  if (!node || typeof node !== "object") {
    return node as unknown as SolvedState;
  }

  if (visited.has(node)) {
    return visited.get(node);
  }

  if (maxDepth <= 0) {
    return node as unknown as SolvedState;
  }

  const resolved: any = {
    id: node.id,
    payload: { ...node.payload },
    next: undefined,
    prev: undefined,
    compute: undefined
  };
  visited.set(node, resolved);

  if (node.next) {
    resolved.next = resolveStateGraph(node.next, maxDepth - 1, visited);
  }

  if (node.prev) {
    resolved.prev = resolveStateGraph(node.prev, maxDepth - 1, visited);
  }

  if (typeof node.compute === "function") {
    const computedOutcome = node.compute();
    resolved.compute = resolveStateGraph(computedOutcome, maxDepth - 1, visited);
  } else if (node.compute) {
    resolved.compute = resolveStateGraph(node.compute, maxDepth - 1, visited);
  }

  return resolved as SolvedState;
}

/**
 * Evaluates cyclic and structural invariants across a state graph topology.
 *
 * @param root Initial entry vertex of the state graph.
 * @returns Invariant metrics detailing cyclicity, symmetry, and reachable vertex IDs.
 */
export function verifyStateInvariants(root: StateGraphNode | SolvedState): StateInvariantResult {
  const visited = new Set<StateGraphNode | SolvedState>();
  const path: (StateGraphNode | SolvedState)[] = [];
  const reachableNodeIds: string[] = [];

  let current: (StateGraphNode | SolvedState) | undefined = root;
  let isCyclic = false;
  let cycleLength = 0;
  let isBidirectionalSymmetric = true;

  while (current && !visited.has(current)) {
    visited.add(current);
    path.push(current);
    reachableNodeIds.push(current.id);

    if (current.next && current.next.prev && current.next.prev !== current) {
      isBidirectionalSymmetric = false;
    }

    current = current.next;
    if (current && visited.has(current)) {
      isCyclic = true;
      const cycleStartIndex = path.indexOf(current);
      cycleLength = path.length - cycleStartIndex;
      break;
    }
  }

  return {
    nodeCount: visited.size,
    isCyclic,
    cycleLength,
    isBidirectionalSymmetric,
    reachableNodeIds
  };
}

/**
 * Generates synthetic cyclic state topologies for invariant fuzz testing.
 *
 * @param nodeCount Total count of vertices to synthesize.
 * @param options Topology construction configurations.
 * @returns Root node of the synthesized cyclic state graph.
 */
export function fuzzStateTopology(
  nodeCount: number,
  options?: StateFuzzOptions
): StateGraphNode {
  if (nodeCount <= 0) {
    throw new Error("Node count must be greater than zero.");
  }

  const nodes: StateGraphNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const payload = options?.payloadFactory
      ? options.payloadFactory(i)
      : { index: i, active: true };

    nodes.push({
      id: `state_node_${i}`,
      payload,
      next: null as unknown as StateGraphNode,
      compute: null as unknown as () => StateGraphNode
    });
  }

  for (let i = 0; i < nodeCount; i++) {
    const nextIdx = (i + 1) % nodeCount;
    const prevIdx = (i - 1 + nodeCount) % nodeCount;

    nodes[i].next = nodes[nextIdx];

    if (options?.bidirectional) {
      nodes[i].prev = nodes[prevIdx];
    }

    if (options?.thunks) {
      nodes[i].compute = () => nodes[nextIdx];
    } else {
      nodes[i].compute = () => nodes[i];
    }
  }

  return nodes[0];
}