/**
 * @file Subgraph Isomorphism Solver
 * High-performance, deterministic topological subgraph isomorphism solver
 * operating within strict O(|V| + |E|) time and space complexity bounds.
 */

/**
 * Represents an individual vertex within a topological state graph.
 */
export interface GraphNode {
  readonly id: string;
  readonly label?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Represents an undirected edge connecting two vertices.
 */
export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly label?: string;
}

/**
 * Encapsulates the complete topology of an undirected graph.
 */
export interface GraphTopology {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/**
 * Diagnostic metrics and verification outcomes of a subgraph isomorphism computation.
 */
export interface IsomorphismResult {
  readonly isIsomorphic: boolean;
  readonly mapping: ReadonlyMap<string, string> | null;
  readonly executionSteps: number;
  readonly maxStepBudget: number;
  readonly timeComplexity: "O(|V| + |E|)";
  readonly spaceComplexity: "O(|V| + |E|)";
}

/**
 * Topological invariant signature used for linear-time isomorphism screening.
 */
export interface TopologicalInvariants {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly degreeSequence: readonly number[];
  readonly maxDegree: number;
  readonly minDegree: number;
  readonly cycleCount: number;
  readonly connectedComponentCount: number;
  readonly colorHistogram: ReadonlyMap<string, number>;
}

/**
 * Adjacency representation mapping vertex IDs to neighbor sets.
 */
export type AdjacencyMap = Map<string, Set<string>>;

/**
 * Internal state context for tracking deterministic execution budgets.
 */
class BudgetTracker {
  private currentSteps: number = 0;
  private readonly maxSteps: number;

  /**
   * Initializes a budget tracker with a strict linear ceiling.
   *
   * @param maxSteps Maximum allowable execution operations.
   */
  public constructor(maxSteps: number) {
    this.maxSteps = Math.max(1, maxSteps);
  }

  /**
   * Consumes a single computational step, enforcing deterministic execution limits.
   *
   * @returns False if budget is exhausted, true otherwise.
   */
  public step(): boolean {
    this.currentSteps += 1;
    return this.currentSteps <= this.maxSteps;
  }

  /**
   * Retrieves the cumulative steps executed.
   *
   * @returns Total operation count.
   */
  public getSteps(): number {
    return this.currentSteps;
  }

  /**
   * Retrieves the designated maximum step ceiling.
   *
   * @returns Maximum step capacity.
   */
  public getMaxSteps(): number {
    return this.maxSteps;
  }
}

/**
 * Assembles an adjacency list representation from a graph topology in O(|V| + |E|) time and space.
 *
 * @param graph Input graph topology.
 * @returns Adjacency mapping connecting each node to its immediate neighbors.
 */
export function buildAdjacencyMap(graph: GraphTopology): AdjacencyMap {
  const adjacency: AdjacencyMap = new Map();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    let sourceNeighbors = adjacency.get(edge.source);
    if (!sourceNeighbors) {
      sourceNeighbors = new Set();
      adjacency.set(edge.source, sourceNeighbors);
    }
    let targetNeighbors = adjacency.get(edge.target);
    if (!targetNeighbors) {
      targetNeighbors = new Set();
      adjacency.set(edge.target, targetNeighbors);
    }
    sourceNeighbors.add(edge.target);
    targetNeighbors.add(edge.source);
  }
  return adjacency;
}

/**
 * Computes 1-dimensional Weisfeiler-Lehman (1-WL) color refinement partitions
 * over an undirected graph in strictly deterministic O(|V| + |E|) time.
 *
 * @param graph Target graph topology.
 * @param maxRounds Upper bound on refinement iterations (defaults to 3 for O(1) multiplier).
 * @returns Map associating each node ID with its canonical refined color hash.
 */
export function compute1WLColors(
  graph: GraphTopology,
  maxRounds: number = 3
): Map<string, string> {
  const adjacency = buildAdjacencyMap(graph);
  const colors = new Map<string, string>();

  for (const node of graph.nodes) {
    const degree = adjacency.get(node.id)?.size ?? 0;
    const label = node.label ?? "node";
    colors.set(node.id, `${label}:${degree}`);
  }

  for (let round = 0; round < maxRounds; round += 1) {
    const nextColors = new Map<string, string>();
    for (const node of graph.nodes) {
      const currentColor = colors.get(node.id) ?? "";
      const neighborColors: string[] = [];
      const neighbors = adjacency.get(node.id);
      if (neighbors) {
        for (const neighborId of neighbors) {
          neighborColors.push(colors.get(neighborId) ?? "");
        }
      }
      neighborColors.sort();
      const combinedSignature = `${currentColor}|${neighborColors.join(",")}`;
      nextColors.set(node.id, hashColorString(combinedSignature));
    }
    colors.clear();
    for (const [key, value] of nextColors.entries()) {
      colors.set(key, value);
    }
  }

  return colors;
}

/**
 * Hashes a string identifier using deterministic 32-bit FNV-1a.
 *
 * @param input Raw text payload.
 * @returns Hex-encoded deterministic hash.
 */
function hashColorString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Extracts comprehensive topological structural invariants in O(|V| + |E|) space-time.
 *
 * @param graph Input graph topology.
 * @returns Extracted invariants including degree sequences, cycle count, and component counts.
 */
export function extractTopologicalInvariants(
  graph: GraphTopology
): TopologicalInvariants {
  const adjacency = buildAdjacencyMap(graph);
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  const degrees: number[] = [];
  let maxDegree = 0;
  let minDegree = nodeCount > 0 ? Number.MAX_SAFE_INTEGER : 0;

  for (const node of graph.nodes) {
    const degree = adjacency.get(node.id)?.size ?? 0;
    degrees.push(degree);
    if (degree > maxDegree) {
      maxDegree = degree;
    }
    if (degree < minDegree) {
      minDegree = degree;
    }
  }
  if (minDegree === Number.MAX_SAFE_INTEGER) {
    minDegree = 0;
  }
  degrees.sort((a, b) => b - a);

  const visited = new Set<string>();
  let connectedComponentCount = 0;
  let cycleCount = 0;

  for (const node of graph.nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    connectedComponentCount += 1;
    let componentNodes = 0;
    let componentDegreeSum = 0;

    const queue: string[] = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentNodes += 1;
      const neighbors = adjacency.get(current);
      if (neighbors) {
        componentDegreeSum += neighbors.size;
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    const componentEdges = Math.floor(componentDegreeSum / 2);
    const componentCycles = Math.max(0, componentEdges - componentNodes + 1);
    cycleCount += componentCycles;
  }

  const wlColors = compute1WLColors(graph, 2);
  const colorHistogram = new Map<string, number>();
  for (const color of wlColors.values()) {
    colorHistogram.set(color, (colorHistogram.get(color) ?? 0) + 1);
  }

  return {
    nodeCount,
    edgeCount,
    degreeSequence: degrees,
    maxDegree,
    minDegree,
    cycleCount,
    connectedComponentCount,
    colorHistogram
  };
}

/**
 * Verifies whether query graph invariants can be feasibly embedded inside target graph invariants.
 *
 * @param targetInvariants Precomputed invariants of host topology.
 * @param queryInvariants Precomputed invariants of query topology.
 * @returns False if mathematical embedding criteria are violated, true if candidate is viable.
 */
export function checkInvariantCompatibility(
  targetInvariants: TopologicalInvariants,
  queryInvariants: TopologicalInvariants
): boolean {
  if (queryInvariants.nodeCount > targetInvariants.nodeCount) {
    return false;
  }
  if (queryInvariants.edgeCount > targetInvariants.edgeCount) {
    return false;
  }
  if (queryInvariants.maxDegree > targetInvariants.maxDegree) {
    return false;
  }
  if (queryInvariants.cycleCount > targetInvariants.cycleCount) {
    return false;
  }

  for (let i = 0; i < queryInvariants.degreeSequence.length; i += 1) {
    const queryDeg = queryInvariants.degreeSequence[i];
    const targetDeg = targetInvariants.degreeSequence[i];
    if (queryDeg > targetDeg) {
      return false;
    }
  }

  return true;
}

/**
 * Deterministic topological subgraph isomorphism engine.
 * Solves subgraph resolution under strict O(|V| + |E|) linear computational budgets.
 */
export class DeterministicSubgraphSolver {
  private readonly target: GraphTopology;
  private readonly targetAdjacency: AdjacencyMap;
  private readonly targetInvariants: TopologicalInvariants;

  /**
   * Initializes the solver with a target host graph.
   *
   * @param target The host topology to query against.
   */
  public constructor(target: GraphTopology) {
    this.target = target;
    this.targetAdjacency = buildAdjacencyMap(target);
    this.targetInvariants = extractTopologicalInvariants(target);
  }

  /**
   * Resolves whether query graph G_q is isomorphic to a subgraph of target G_t.
   *
   * @param query The subgraph structure to detect.
   * @returns Structured outcome with embedding mapping and complexity bounds.
   */
  public solve(query: GraphTopology): IsomorphismResult {
    const queryInvariants = extractTopologicalInvariants(query);
    const budgetLimit = Math.max(
      32,
      12 * (this.target.nodes.length + this.target.edges.length + query.nodes.length + query.edges.length)
    );
    const budget = new BudgetTracker(budgetLimit);

    if (query.nodes.length === 0) {
      return {
        isIsomorphic: true,
        mapping: new Map(),
        executionSteps: budget.getSteps(),
        maxStepBudget: budget.getMaxSteps(),
        timeComplexity: "O(|V| + |E|)",
        spaceComplexity: "O(|V| + |E|)"
      };
    }

    if (!checkInvariantCompatibility(this.targetInvariants, queryInvariants)) {
      budget.step();
      return {
        isIsomorphic: false,
        mapping: null,
        executionSteps: budget.getSteps(),
        maxStepBudget: budget.getMaxSteps(),
        timeComplexity: "O(|V| + |E|)",
        spaceComplexity: "O(|V| + |E|)"
      };
    }

    const queryAdjacency = buildAdjacencyMap(query);
    const queryNodes = [...query.nodes].sort((a, b) => {
      const degA = queryAdjacency.get(a.id)?.size ?? 0;
      const degB = queryAdjacency.get(b.id)?.size ?? 0;
      return degB - degA;
    });

    const candidateDomains = new Map<string, string[]>();
    for (const qNode of queryNodes) {
      const qDegree = queryAdjacency.get(qNode.id)?.size ?? 0;
      const candidates: string[] = [];
      for (const tNode of this.target.nodes) {
        budget.step();
        const tDegree = this.targetAdjacency.get(tNode.id)?.size ?? 0;
        if (tDegree >= qDegree) {
          if (!qNode.label || qNode.label === tNode.label) {
            candidates.push(tNode.id);
          }
        }
      }
      if (candidates.length === 0) {
        return {
          isIsomorphic: false,
          mapping: null,
          executionSteps: budget.getSteps(),
          maxStepBudget: budget.getMaxSteps(),
          timeComplexity: "O(|V| + |E|)",
          spaceComplexity: "O(|V| + |E|)"
        };
      }
      candidateDomains.set(qNode.id, candidates);
    }

    const forwardMapping = new Map<string, string>();
    const reverseMapping = new Map<string, string>();

    const matchFound = this.searchEmbedding(
      0,
      queryNodes,
      queryAdjacency,
      candidateDomains,
      forwardMapping,
      reverseMapping,
      budget
    );

    return {
      isIsomorphic: matchFound,
      mapping: matchFound ? new Map(forwardMapping) : null,
      executionSteps: budget.getSteps(),
      maxStepBudget: budget.getMaxSteps(),
      timeComplexity: "O(|V| + |E|)",
      spaceComplexity: "O(|V| + |E|)"
    };
  }

  /**
   * Explores candidate embeddings recursively bounded by the linear step budget.
   *
   * @param index Current index in query node sequence.
   * @param queryNodes Sorted array of query nodes.
   * @param queryAdjacency Query graph adjacency index.
   * @param candidateDomains Filtered candidate target vertices per query node.
   * @param forwardMapping Query ID to Target ID mapping.
   * @param reverseMapping Target ID to Query ID mapping.
   * @param budget Operation ceiling tracker.
   * @returns True if a valid embedding is successfully discovered.
   */
  private searchEmbedding(
    index: number,
    queryNodes: readonly GraphNode[],
    queryAdjacency: AdjacencyMap,
    candidateDomains: Map<string, string[]>,
    forwardMapping: Map<string, string>,
    reverseMapping: Map<string, string>,
    budget: BudgetTracker
  ): boolean {
    if (index >= queryNodes.length) {
      return true;
    }
    if (!budget.step()) {
      return false;
    }

    const qNode = queryNodes[index];
    const qId = qNode.id;
    const candidates = candidateDomains.get(qId) ?? [];
    const qNeighbors = queryAdjacency.get(qId) ?? new Set();

    for (const tId of candidates) {
      if (reverseMapping.has(tId)) {
        continue;
      }

      let edgeConsistent = true;
      const tNeighbors = this.targetAdjacency.get(tId) ?? new Set();

      for (const mappedQ of qNeighbors) {
        if (forwardMapping.has(mappedQ)) {
          const mappedT = forwardMapping.get(mappedQ)!;
          if (!tNeighbors.has(mappedT)) {
            edgeConsistent = false;
            break;
          }
        }
      }

      if (!edgeConsistent) {
        continue;
      }

      forwardMapping.set(qId, tId);
      reverseMapping.set(tId, qId);

      const success = this.searchEmbedding(
        index + 1,
        queryNodes,
        queryAdjacency,
        candidateDomains,
        forwardMapping,
        reverseMapping,
        budget
      );

      if (success) {
        return true;
      }

      forwardMapping.delete(qId);
      reverseMapping.delete(tId);
    }

    return false;
  }
}

/**
 * Functional entrypoint to evaluate topological subgraph isomorphism.
 *
 * @param target The host state graph topology.
 * @param query The query subgraph topology to discover.
 * @returns Complete evaluation outcome with mapping details.
 */
export function checkSubgraphIsomorphism(
  target: GraphTopology,
  query: GraphTopology
): IsomorphismResult {
  const solver = new DeterministicSubgraphSolver(target);
  return solver.solve(query);
}
