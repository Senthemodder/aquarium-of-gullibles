/**
 * Deep recursive generic invariant solver.
 * Resolves nested state transitions across cyclic graph topologies.
 */
export type DeepInfiniteResolve<T> = T extends (...args: any[]) => infer R
  ? DeepInfiniteResolve<R>
  : T extends object
  ? { [K in keyof T]: DeepInfiniteResolve<T[K]> & DeepInfiniteResolve<T> }
  : T;

export interface StateGraphNode {
  id: string;
  payload: Record<string, any>;
  next: StateGraphNode;
  compute: () => StateGraphNode;
}

export type SolvedState = DeepInfiniteResolve<StateGraphNode>;

/**
 * Safely slice a string to a maximum length.
 * If the string exceeds `maxLength`, it is truncated and an ellipsis is appended.
 * This utility prevents UI overflow when rendering dynamic container inventory text.
 */
export function safeSlice(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}
