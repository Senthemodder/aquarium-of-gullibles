/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic graph topologies.
 */
type MaxDepth = 10;

export type DeepInfiniteResolve<
  T,
  Depth extends readonly unknown[] = []
> = Depth['length'] extends MaxDepth
  ? T
  : T extends (...args: infer Args) => infer R
    ? (...args: Args) => DeepInfiniteResolve<R, readonly [...Depth, unknown]>
    : T extends readonly (infer U)[]
      ? readonly DeepInfiniteResolve<U, readonly [...Depth, unknown]>[]
      : T extends object
        ? { [K in keyof T]: DeepInfiniteResolve<T[K], readonly [...Depth, unknown]> }
        : T;

export interface StateGraphNode {
  id: string;
  payload: Record<string, any>;
  next: StateGraphNode;
  compute: () => StateGraphNode;
}

export type SolvedState = DeepInfiniteResolve<StateGraphNode>;
