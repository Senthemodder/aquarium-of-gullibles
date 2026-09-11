/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic graph topologies.
 * 
 * Fix: Removed `& DeepInfiniteResolve<T>` which caused infinite recursion.
 * Added depth accumulator to safely handle cyclic references.
 */

// Depth-limited recursive resolver to handle cyclic topologies safely
type DeepInfiniteResolve<T, Depth extends any[] = []> = 
  // Limit recursion depth to prevent TS2589 (excessively deep type instantiation)
  Depth["length"] extends 10
    ? T
    : T extends (...args: any[]) => infer R
      ? DeepInfiniteResolve<R, [...Depth, any]>
      : T extends object
        ? { [K in keyof T]: DeepInfiniteResolve<T[K], [...Depth, any]> }
        : T;

export interface StateGraphNode {
  id: string;
  payload: Record<string, any>;
  next: StateGraphNode;
  compute: () => StateGraphNode;
}

export type SolvedState = DeepInfiniteResolve<StateGraphNode>;

// Test type instantiation at compile time
const _testSolvedState: SolvedState = {} as SolvedState;
const _testId: string = _testSolvedState.id;
const _testPayload: Record<string, any> = _testSolvedState.payload;

export { DeepInfiniteResolve };
