/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic graph topologies.
 */
export type DeepInfiniteResolve<T> =
  T extends (...args: infer Args) => infer R
    ? (...args: Args) => DeepInfiniteResolve<R>
    : T extends readonly unknown[]
      ? { [K in keyof T]: DeepInfiniteResolve<T[K]> }
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
