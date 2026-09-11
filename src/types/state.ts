/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic graph topologies.
 *
 * Bidirectional unwrapping:
 * - Functions → recursively resolve return types
 * - Objects / arrays → recursively resolve each property
 *
 * Cyclic `StateGraphNode` references are safe: property mapping is deferred
 * by the compiler, so self-referential topologies expand lazily without
 * hitting TS2589 (excessively deep instantiation).
 */
export type DeepInfiniteResolve<T> = T extends (...args: any[]) => infer R
  ? DeepInfiniteResolve<R>
  : T extends readonly any[]
    ? { [I in keyof T]: DeepInfiniteResolve<T[I]> }
    : T extends object
      ? { [K in keyof T]: DeepInfiniteResolve<T[K]> }
      : T;

export interface StateGraphNode {
  id: string;
  payload: Record<string, any>;
  next: StateGraphNode;
  compute: () => StateGraphNode;
}

export type SolvedState = DeepInfiniteResolve<StateGraphNode>;

/** Compile-time invariant: cyclic expansion remains usable. */
type _AssertSolvedId = SolvedState["id"];
type _AssertSolvedNext = SolvedState["next"]["next"]["id"];
type _AssertSolvedCompute = SolvedState["compute"] extends { id: string }
  ? true
  : never;
const _invariant: [_AssertSolvedId, _AssertSolvedNext, _AssertSolvedCompute] = [
  "" as string,
  "" as string,
  true,
];
void _invariant;
