/**
 * Represents a node in a state graph.
 * TState defines the type of the state held by this node.
 */
interface StateGraphNode<TState = any> {
  id: string;
  state: TState;
  children?: { [key: string]: StateGraphNode<any> };
  parent?: StateGraphNode<any>;
  metadata?: Record<string, any>;
}

/**
 * Helper type to check if a type `T` is assignable to any type within a tuple `U`.
 * This is used to detect if a type has already been encountered in the current
 * recursion path, helping to break cycles.
 */
type IsInTuple<T, U extends any[]> = T extends U[number] ? true : false;

/**
 * A deeply recursive type that unwraps the structure of `T`,
 * specifically designed to handle cyclic references within `StateGraphNode` topologies
 * without triggering TypeScript's excessive depth limits.
 *
 * It uses a `Seen` tuple to track types encountered in the current resolution path.
 * If a `StateGraphNode` type is encountered that is already in `Seen`, it returns
 * a minimal representation (just its `id`) to break the cycle.
 *
 * @template T The type to deeply resolve.
 * @template Seen A tuple of types encountered so far in the current recursion path.
 */
type DeepInfiniteResolve<T, Seen extends any[] = []> =
  // Base cases: Primitives, null, undefined, functions are returned as is.
  T extends null | undefined | string | number | boolean | symbol | bigint | ((...args: any[]) => any)
    ? T
    : // Handle Arrays: Recurse on the array's element type.
      T extends (infer U)[]
      ? DeepInfiniteResolve<U, Seen>[]
      : // Handle StateGraphNode: This is the core logic for cycle detection.
        T extends StateGraphNode<infer S>
        ? IsInTuple<T, Seen> extends true
          ? { id: T['id'] } // Cycle detected for this specific StateGraphNode type. Return minimal reference.
          : {
              id: T['id'];
              state: DeepInfiniteResolve<S, [...Seen, T]>;
              children: { [K in keyof T['children']]: DeepInfiniteResolve<T['children'][K], [...Seen, T]> };
              parent: DeepInfiniteResolve<T['parent'], [...Seen, T]>;
              metadata: DeepInfiniteResolve<T['metadata'], [...Seen, T]>;
            }
        : // Handle general Objects: Recurse on properties.
          T extends object
          ? IsInTuple<T, Seen> extends true
            ? T // If a general object type is seen, stop deep resolution for it to prevent infinite loops on generic objects.
            : { [K in keyof T]: DeepInfiniteResolve<T[K], [...Seen, T]> }
          : // Fallback for any other type (e.g., unknown, never, custom classes not handled above).
            T;

export {
  StateGraphNode,
  DeepInfiniteResolve
};
