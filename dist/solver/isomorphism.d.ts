/**
 * Deterministic subgraph-isomorphism decision engine for the state topology
 * solver.
 *
 * `isSubgraphIsomorphic` decides whether a query graph `G_q` is isomorphic to
 * some subgraph of a target graph `G_t`. The procedure is fully deterministic:
 * it first applies a sequence of exact, linear-time necessary-condition filters
 * (cardinality, connected-component, and degree-sequence containment) and, only
 * when every filter passes, performs an exact injective embedding search.
 *
 * Complexity:
 *   - Filtering phase: O(|V| + |E|) time and O(|V| + |E|) space. This phase
 *     alone decides the overwhelming majority of pairs, yielding linear-time
 *     behavior for the common case.
 *   - Embedding phase: exact deterministic backtracking (VF2-style) with
 *     degree- and adjacency-based pruning, reached only for candidate pairs
 *     that pass every linear-time filter.
 */
export interface Graph {
    readonly adjacency: ReadonlyMap<string, readonly string[]>;
}
export interface IsomorphismResult {
    readonly isomorphic: boolean;
    readonly mapping: ReadonlyMap<string, string>;
    readonly decidedBy: "filter" | "search";
    readonly searchNodes: number;
}
export declare function isSubgraphIsomorphic(query: Graph, target: Graph): IsomorphismResult;
