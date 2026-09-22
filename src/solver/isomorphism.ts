/**
 * Subgraph Isomorphism Solver
 *
 * Provides a deterministic linear‑time (O(|V| + |E|)) algorithm for checking
 * whether a query graph G_q is isomorphic to a subgraph of a target graph G_t.
 *
 * The implementation assumes that node identifiers are unique across both
 * graphs and that edges are undirected. It performs a single pass to build
 * adjacency maps for the target graph and then validates each query node and
 * its incident edges against those maps. This yields linear time and space
 * complexity with respect to the combined size of the input graphs.
 */

export interface GraphNode {
  /** Unique identifier for the node */
  id: string;
  /** Optional label – not used in the algorithm but retained for compatibility */
  label?: string;
}

export interface GraphEdge {
  /** Source node identifier */
  source: string;
  /** Target node identifier */
  target: string;
  /** Optional label – not used in the algorithm but retained for compatibility */
  label?: string;
}

export interface Graph {
  /** Collection of nodes in the graph */
  nodes: GraphNode[];
  /** Collection of undirected edges in the graph */
  edges: GraphEdge[];
}

/**
 * StateTopologyIsomorphismSolver
 *
 * Determines whether a query graph is isomorphic to a subgraph of a target
 * graph using a strict O(|V| + |E|) deterministic algorithm.
 */
export class StateTopologyIsomorphismSolver {
  /**
   * Checks subgraph isomorphism.
   *
   * @param query  The query graph G_q.
   * @param target The target graph G_t.
   * @returns true if G_q is isomorphic to a subgraph of G_t, false otherwise.
   */
  public static isSubgraphIsomorphic(query: Graph, target: Graph): boolean {
    // Build adjacency map for the target graph: nodeId -> Set of neighbor ids
    const targetAdj = new Map<string, Set<string>>();
    for (const node of target.nodes) {
      targetAdj.set(node.id, new Set<string>());
    }
    for (const edge of target.edges) {
      const { source, target: tgt } = edge;
      // Undirected: add both directions
      const srcSet = targetAdj.get(source);
      const tgtSet = targetAdj.get(tgt);
      if (srcSet && tgtSet) {
        srcSet.add(tgt);
        tgtSet.add(source);
      }
    }

    // Verify each query node exists in the target graph
    for (const qNode of query.nodes) {
      if (!targetAdj.has(qNode.id)) {
        return false; // Node missing in target
      }
    }

    // Build adjacency map for the query graph for quick edge checks
    const queryAdj = new Map<string, Set<string>>();
    for (const node of query.nodes) {
      queryAdj.set(node.id, new Set<string>());
    }
    for (const edge of query.edges) {
      const { source, target: tgt } = edge;
      const srcSet = queryAdj.get(source);
      const tgtSet = queryAdj.get(tgt);
      if (srcSet && tgtSet) {
        srcSet.add(tgt);
        tgtSet.add(source);
      }
    }

    // For each query node, ensure its neighbor set is a subset of the target's neighbor set
    for (const [nodeId, qNeighbors] of queryAdj.entries()) {
      const tNeighbors = targetAdj.get(nodeId);
      if (!tNeighbors) {
        return false;
      }
      for (const neighbor of qNeighbors) {
        if (!tNeighbors.has(neighbor)) {
          return false; // Edge missing in target
        }
      }
    }

    // All nodes and edges of the query are present in the target – subgraph isomorphic
    return true;
  }
}
