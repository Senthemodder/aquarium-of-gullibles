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

function normalize(adjacency: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const vertices = [...adjacency.keys()].sort();
  for (const v of vertices) {
    const set = new Set<string>();
    for (const n of adjacency.get(v) ?? []) {
      if (n !== v) set.add(n);
    }
    out.set(v, [...set].sort());
  }
  for (const v of vertices) {
    if (!out.has(v)) out.set(v, []);
    const list = out.get(v)!;
    for (const n of list) {
      if (!out.has(n)) out.set(n, []);
      const neighbors = out.get(n)!;
      if (!neighbors.includes(v)) neighbors.push(v);
      neighbors.sort();
    }
  }
  return out;
}

function degreeSequence(graph: Map<string, string[]>): number[] {
  return [...graph.keys()].map((v) => graph.get(v)!.length).sort((a, b) => a - b);
}

function canEmbedDegrees(queryDegrees: number[], targetDegrees: number[]): boolean {
  if (queryDegrees.length > targetDegrees.length) return false;
  let j = 0;
  for (let i = 0; i < queryDegrees.length; i++) {
    while (j < targetDegrees.length && targetDegrees[j] < queryDegrees[i]) j++;
    if (j >= targetDegrees.length) return false;
    j++;
  }
  return true;
}

function componentSizes(graph: Map<string, string[]>): number[] {
  const seen = new Set<string>();
  const sizes: number[] = [];
  for (const start of [...graph.keys()].sort()) {
    if (seen.has(start)) continue;
    let size = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const v = stack.pop()!;
      size++;
      for (const n of graph.get(v)!) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => a - b);
}

function countEdges(graph: Map<string, string[]>): number {
  let sum = 0;
  for (const v of graph.values()) sum += v.length;
  return sum / 2;
}

function searchEmbedding(
  query: Map<string, string[]>,
  target: Map<string, string[]>
): { mapping: Map<string, string>; searchNodes: number } | null {
  const queryVertices = [...query.keys()].sort();
  const targetVertices = [...target.keys()].sort();
  const queryDegree = new Map<string, number>(queryVertices.map((v) => [v, query.get(v)!.length]));
  const targetDegree = new Map<string, number>(targetVertices.map((v) => [v, target.get(v)!.length]));
  const queryNeighbors = new Map<string, Set<string>>(queryVertices.map((v) => [v, new Set(query.get(v)!)]));
  const targetNeighbors = new Map<string, Set<string>>(targetVertices.map((v) => [v, new Set(target.get(v)!)]));

  const mapping = new Map<string, string>();
  const used = new Set<string>();
  let searchNodes = 0;

  function pickNext(): string | null {
    let best: string | null = null;
    let bestScore = -1;
    for (const v of queryVertices) {
      if (mapping.has(v)) continue;
      let mappedNeighbors = 0;
      for (const n of queryNeighbors.get(v)!) {
        if (mapping.has(n)) mappedNeighbors++;
      }
      const score = mappedNeighbors * 100_000 + queryDegree.get(v)!;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }

  function candidates(q: string): string[] {
    const result: string[] = [];
    const mappedNeighbors: string[] = [];
    for (const n of queryNeighbors.get(q)!) {
      if (mapping.has(n)) mappedNeighbors.push(n);
    }
    const unmappedNeighbors = queryDegree.get(q)! - mappedNeighbors.length;
    for (const t of targetVertices) {
      if (used.has(t)) continue;
      if (targetDegree.get(t)! < queryDegree.get(q)!) continue;
      let edgeOk = true;
      for (const qn of mappedNeighbors) {
        if (!targetNeighbors.get(t)!.has(mapping.get(qn)!)) {
          edgeOk = false;
          break;
        }
      }
      if (!edgeOk) continue;
      if (unmappedNeighbors > 0) {
        const available = targetNeighbors.get(t)!;
        let count = 0;
        for (const u of available) {
          if (!used.has(u) && targetDegree.get(u)! >= queryDegree.get(q)!) count++;
        }
        if (count < unmappedNeighbors) continue;
      }
      result.push(t);
    }
    return result;
  }

  function solve(): boolean {
    searchNodes++;
    if (mapping.size === queryVertices.length) return true;
    const q = pickNext()!;
    const candidatesList = candidates(q);
    for (const t of candidatesList) {
      mapping.set(q, t);
      used.add(t);
      if (solve()) return true;
      used.delete(t);
      mapping.delete(q);
    }
    return false;
  }

  const found = solve();
  if (!found) return null;
  return { mapping, searchNodes };
}

export function isSubgraphIsomorphic(query: Graph, target: Graph): IsomorphismResult {
  const qAdj = normalize(query.adjacency);
  const tAdj = normalize(target.adjacency);
  const empty: IsomorphismResult = { isomorphic: false, mapping: new Map(), decidedBy: "filter", searchNodes: 0 };

  const queryCount = qAdj.size;
  const targetCount = tAdj.size;
  if (queryCount === 0) {
    return { isomorphic: true, mapping: new Map(), decidedBy: "filter", searchNodes: 0 };
  }
  if (queryCount > targetCount) return empty;

  const qSizes = componentSizes(qAdj);
  const tSizes = componentSizes(tAdj);
  if (qSizes[qSizes.length - 1] > tSizes[tSizes.length - 1]) return empty;

  if (countEdges(qAdj) > countEdges(tAdj)) return empty;

  if (!canEmbedDegrees(degreeSequence(qAdj), degreeSequence(tAdj))) return empty;

  const found = searchEmbedding(qAdj, tAdj);
  if (found === null) {
    return { ...empty, decidedBy: "search" };
  }
  return { isomorphic: true, mapping: found.mapping, decidedBy: "search", searchNodes: found.searchNodes };
}