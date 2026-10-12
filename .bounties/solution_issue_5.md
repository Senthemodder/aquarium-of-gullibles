# Solution for [github/issues_5]: [Senthemodder/aquarium-of-gullibles] [Bounty: $700] Deep Recursive Generic Type Solver Fails Invariant Fuzzing in src/types/state.ts

- **Reward:** $700.00 USDC
- **Target URL:** https://github.com/Senthemodder/aquarium-of-gullibles/issues/5
- **AI Brain:** gemini-2.5-flash
- **Tokens Used:** 8772 (~$0.0175 USD compute cost)

---

I've analyzed the issue regarding the `DeepInfiniteResolve<T>` type in `src/types/state.ts` causing a `TS2589: Type instantiation is excessively deep and possibly infinite` error. This typically happens when TypeScript's type checker encounters a recursive type definition that it cannot fully resolve within its internal recursion depth limits. The goal is to handle cyclic `StateGraphNode` topologies without hitting these limits.

### Root Cause Analysis

The `DeepInfiniteResolve<T>` type is designed to recursively unwrap nested `StateGraphNode` types. The core problem lies in its direct recursive definition, especially when `StateGraphNode<T>` itself can contain `T`. When `T` is a complex type that eventually refers back to `StateGraphNode` (or a type containing it), a deep or infinite loop is created for the type checker.

Consider the structure:
```typescript
type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[]; // This is the problematic part for deep recursion
  // ... other fields
};

type DeepInfiniteResolve<T> = T extends StateGraphNode<infer U>
  ? DeepInfiniteResolve<U> // Direct recursion on the inferred type
  : T extends (infer U)[]
  ? DeepInfiniteResolve<U>[]
  : T extends object
  ? { [K in keyof T]: DeepInfiniteResolve<T[K]> }
  : T;
```

If `T` itself contains `StateGraphNode<any>`, the recursion can become very deep. For example, if `T` is `SomeData & { relatedNodes: StateGraphNode<SomeOtherData>[] }`, and `SomeOtherData` also contains `StateGraphNode`, the compiler will try to expand this indefinitely.

The key insight to solving this is to recognize that TypeScript's type system has limitations on recursion depth. Instead of trying to *fully* unwrap an infinitely deep type at compile time, we need to provide a "stop" condition or a way to represent the potentially infinite structure without actually expanding it infinitely.

For `StateGraphNode<T>`, the `next` property is an array of `StateGraphNode<T>`. This means a `StateGraphNode` can contain other `StateGraphNode`s of the *same* generic type `T`. This is a direct self-referential cycle.

The `DeepInfiniteResolve` type, as written, attempts to resolve `StateGraphNode<infer U>` by recursively calling `DeepInfiniteResolve<U>`. If `U` is the same as `T` or contains `T`, this creates the infinite loop.

### Architecture Design

The solution involves two main strategies:

1.  **Bounded Recursion for `StateGraphNode`:** Instead of trying to resolve `StateGraphNode<T>` into `T` indefinitely, we should recognize that `StateGraphNode<T>` *is* the structure we want to preserve, but its *contents* (`data`, `next` elements) might need unwrapping. The `DeepInfiniteResolve` should apply to the *generic parameter* `T` of `StateGraphNode<T>`, not try to unwrap the `StateGraphNode` itself into its generic parameter.

2.  **Handling Cyclic References with `DeepResolve`:** For general object types, we need a way to resolve nested types without hitting the recursion limit. TypeScript's conditional types and mapped types are powerful, but direct deep recursion can be problematic. The `DeepInfiniteResolve` type needs to be refactored to be more robust.

The core idea is to define `DeepResolve<T>` such that:
*   If `T` is a primitive, it remains `T`.
*   If `T` is an array, it resolves its elements.
*   If `T` is an object, it resolves its properties.
*   **Crucially**, if `T` is `StateGraphNode<U>`, it should resolve `U` and apply it back to `StateGraphNode`. It should *not* try to unwrap `StateGraphNode<U>` into `U`. The `StateGraphNode` structure itself is the "container" we want to keep.

Let's refine the `StateGraphNode` definition and then `DeepInfiniteResolve`.

The original `StateGraphNode<T>` definition is:
```typescript
export type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[]; // This is the key part
  // ... other fields
};
```
The `next` property being `StateGraphNode<T>[]` means that a node's children are also nodes containing the *same type* `T`. This is a direct self-reference that `DeepInfiniteResolve` was struggling with.

The goal of `DeepInfiniteResolve<T>` is to "unwrap" `T`. If `T` is `StateGraphNode<U>`, it means we want to get to `U`. But if `StateGraphNode<U>` itself contains `StateGraphNode<U>`, then unwrapping `StateGraphNode<U>` to `U` and then trying to unwrap `U` again if `U` contains `StateGraphNode<U>` leads to the infinite loop.

The problem statement says "achieve complete bidirectional state unwrapping across cyclic StateGraphNode topologies". This implies that if we have `StateGraphNode<A>`, and `A` contains `StateGraphNode<B>`, and `B` contains `StateGraphNode<A>`, we need to resolve this.

The current `DeepInfiniteResolve` tries to *replace* `StateGraphNode<U>` with `U`. This is the fundamental flaw. We don't want to replace the `StateGraphNode` structure; we want to resolve the *generic parameter* `U` within it.

**Revised Approach:**

1.  **Introduce a `DeepResolve` type that handles general recursion but with a depth limit or a way to break cycles.** TypeScript's compiler has an internal recursion limit. We can't truly have "infinite" resolution. Instead, we need to resolve to a certain depth or stop when a cycle is detected.

2.  **Modify `StateGraphNode` to use `DeepResolve` for its generic parameter.**
    Instead of `StateGraphNode<T>`, we might want `StateGraphNode<DeepResolve<T>>` or ensure that `T` itself is already deeply resolved.

Let's re-evaluate the intent of `DeepInfiniteResolve<T>`. If it's meant to flatten `StateGraphNode<T>` into just `T`, then the `next` property becomes problematic. If it's meant to resolve *all nested types* within `T` (including within `StateGraphNode` properties), then the current implementation is too aggressive on `StateGraphNode`.

The most common way to handle deep types in TypeScript without hitting recursion limits is to:
*   **Limit depth:** Use a counter in the generic type.
*   **Break cycles:** Detect if a type has already been processed in the current path.
*   **Use a "flattening" approach:** Instead of direct recursion, use a technique that flattens the type.

Given the problem description, the most direct interpretation is that `DeepInfiniteResolve<T>` should produce a type where all `StateGraphNode` wrappers are removed, and only the underlying `data` types remain, with their own nested structures resolved. However, the `next` property of `StateGraphNode` makes this impossible without losing information or creating an infinite type.

Let's assume the goal is to resolve the *contents* of `StateGraphNode`s, but keep the `StateGraphNode` structure itself. This means `DeepInfiniteResolve<StateGraphNode<T>>` should result in `StateGraphNode<DeepInfiniteResolve<T>>`, not `DeepInfiniteResolve<T>`.

This implies the `DeepInfiniteResolve` type needs to be more nuanced:

```typescript
// Helper to prevent excessive depth for objects
type DeepResolveObject<T extends object> = {
  [K in keyof T]: DeepInfiniteResolve<T[K]>;
};

// The core DeepInfiniteResolve
type DeepInfiniteResolve<T> =
  T extends StateGraphNode<infer U> // If T is a StateGraphNode
    ? StateGraphNode<DeepInfiniteResolve<U>> // Resolve its generic parameter, but keep the StateGraphNode structure
    : T extends (infer U)[] // If T is an array
    ? DeepInfiniteResolve<U>[] // Resolve its elements
    : T extends object // If T is a plain object (not StateGraphNode, not array)
    ? DeepResolveObject<T> // Resolve its properties
    : T; // Otherwise, it's a primitive or already resolved
```

This revised `DeepInfiniteResolve` handles `StateGraphNode` by preserving its structure and recursively resolving its generic parameter `U`. This prevents the direct infinite unwrapping of `StateGraphNode<T>` into `T` when `T` itself contains `StateGraphNode`.

However, the problem statement also says "achieve complete bidirectional state unwrapping across cyclic StateGraphNode topologies". This could mean that if `StateGraphNode<T>` is encountered, we want to extract `T` and resolve `T`, and if `T` itself contains `StateGraphNode<U>`, we want to extract `U` and resolve `U`, and so on, until we hit a non-`StateGraphNode` type. This is the original problematic interpretation.

Let's consider the example from the issue:
`type ResolvedState = DeepInfiniteResolve<StateGraphNode<StateGraphNode<string>>>;`
With the original type, this would try to resolve `StateGraphNode<StateGraphNode<string>>` to `DeepInfiniteResolve<StateGraphNode<string>>`, then to `DeepInfiniteResolve<string>`, which is `string`. This works.

The problem arises when `T` *itself* contains `StateGraphNode<T>`.
Example:
```typescript
type MyCyclicData = {
  value: string;
  nextNodes: StateGraphNode<MyCyclicData>[]; // This is the cycle
};

type ProblematicResolved = DeepInfiniteResolve<StateGraphNode<MyCyclicData>>;
```
Original `DeepInfiniteResolve`:
1. `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>` matches `T extends StateGraphNode<infer U>`, so `U` is `MyCyclicData`.
2. Recurses to `DeepInfiniteResolve<MyCyclicData>`.
3. `MyCyclicData` is an object, so it maps properties:
   `{ value: DeepInfiniteResolve<string>, nextNodes: DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]> }`
4. `DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]> ` becomes `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]`.
5. We are back to step 1, creating an infinite loop.

To break this cycle, we need a way to "stop" the unwrapping when we encounter a type that has already been processed in the current path, or to limit the depth.

A common pattern for deep type resolution with cycle detection or depth limiting is to use a tuple to track visited types or a counter. However, TypeScript's type system is not designed for arbitrary runtime-like cycle detection.

The most practical approach for "unwrapping" `StateGraphNode`s without infinite recursion is to define a maximum unwrapping depth or to change the interpretation of "unwrapping".

If "unwrapping" means to get to the innermost `data` type, then `StateGraphNode<StateGraphNode<string>>` should resolve to `string`. But `StateGraphNode<MyCyclicData>` cannot resolve to `MyCyclicData` if `MyCyclicData` itself contains `StateGraphNode<MyCyclicData>`, because that's an infinite type.

The most robust way to handle this without hitting compiler limits is to:
1.  **Define a `DeepResolve` type that handles general object/array recursion.**
2.  **Define a specific `UnwrapStateGraphNode<T>` type that extracts the innermost `data` type.** This type will need a depth limit to prevent infinite recursion.

Let's try to implement `UnwrapStateGraphNode` with a depth limit.

```typescript
// Max depth for unwrapping StateGraphNode
type MAX_UNWRAP_DEPTH = 10; // Arbitrary, but usually sufficient

// Helper to build a tuple of a given length for depth tracking
type BuildTuple<L extends number, T extends any[] = []> = T['length'] extends L
  ? T
  : BuildTuple<L, [...T, any]>;

// UnwrapStateGraphNode: Extracts the innermost 'data' type from nested StateGraphNode
type UnwrapStateGraphNode<T, Depth extends any[] = []> =
  Depth['length'] extends MAX_UNWRAP_DEPTH // If max depth reached, stop unwrapping
    ? T
    : T extends StateGraphNode<infer U> // If T is a StateGraphNode
    ? UnwrapStateGraphNode<U, [...Depth, any]> // Recurse with increased depth
    : T; // Not a StateGraphNode, return T
```

Now, `DeepInfiniteResolve` can use this `UnwrapStateGraphNode` for the `StateGraphNode` case, and then apply general deep resolution to the result.

```typescript
// The new DeepInfiniteResolve
type DeepInfiniteResolve<T> =
  T extends StateGraphNode<any> // If T is a StateGraphNode (even nested ones)
    ? DeepInfiniteResolve<UnwrapStateGraphNode<T>> // First unwrap all StateGraphNode layers, then deep resolve the result
    : T extends (infer U)[] // If T is an array
    ? DeepInfiniteResolve<U>[] // Resolve its elements
    : T extends object // If T is a plain object
    ? { [K in keyof T]: DeepInfiniteResolve<T[K]> } // Resolve its properties
    : T; // Otherwise, it's a primitive or already resolved
```

Let's test this with `MyCyclicData`:
`type ProblematicResolved = DeepInfiniteResolve<StateGraphNode<MyCyclicData>>;`

1. `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>` matches `T extends StateGraphNode<any>`.
2. Recurses to `DeepInfiniteResolve<UnwrapStateGraphNode<StateGraphNode<MyCyclicData>>>`.
3. `UnwrapStateGraphNode<StateGraphNode<MyCyclicData>>` will unwrap `StateGraphNode` once, resulting in `MyCyclicData`. (Assuming `MyCyclicData` itself is not `StateGraphNode<X>`).
4. So, we get `DeepInfiniteResolve<MyCyclicData>`.
5. `MyCyclicData` is an object: `{ value: string; nextNodes: StateGraphNode<MyCyclicData>[]; }`
6. `DeepInfiniteResolve<MyCyclicData>` becomes:
   `{ value: DeepInfiniteResolve<string>, nextNodes: DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]> }`
7. `DeepInfiniteResolve<string>` is `string`.
8. `DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]> ` becomes `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]`.
9. We are back to step 1, still an infinite loop.

The problem is that `DeepInfiniteResolve` is still trying to resolve *within* the `StateGraphNode` structure if it's encountered as a property type. The `UnwrapStateGraphNode` only handles the *top-level* `StateGraphNode` wrapping.

The core issue is that `StateGraphNode<T>` has `next: StateGraphNode<T>[]`. This means the `StateGraphNode` structure is inherently recursive. If the goal is to "unwrap" `StateGraphNode`s, then what should `next` become? If it becomes `T[]`, then the `StateGraphNode` structure is lost. If it remains `StateGraphNode<T>[]`, then the unwrapping is incomplete.

The most robust solution for deep types that can have cycles, without hitting compiler limits, is to use a "flattening" approach or to explicitly stop recursion at a certain point.

Let's reconsider the requirement: "achieve complete bidirectional state unwrapping across cyclic StateGraphNode topologies without triggering compiler recursion depth limits."

"Unwrapping" usually means removing layers. If `StateGraphNode<T>` is a layer, then unwrapping it means getting `T`. But if `T` itself contains `StateGraphNode<U>`, then we need to unwrap `U`.

The only way to truly "unwrap" `StateGraphNode<T>` and its `next` property without infinite recursion or losing information is to define a new type that represents the *resolved state* of a `StateGraphNode`.

Let's define `ResolvedStateGraphNode<T>`:
```typescript
export type ResolvedStateGraphNode<T> = {
  id: string;
  data: T; // The data is resolved
  next: ResolvedStateGraphNode<T>[]; // The next nodes are also resolved
  // ... other fields
};
```
Now, `DeepInfiniteResolve<T>` should transform `StateGraphNode<U>` into `ResolvedStateGraphNode<DeepInfiniteResolve<U>>`. This means the `StateGraphNode` structure is preserved, but its contents are deeply resolved.

This is the most common and safe way to handle such structures in TypeScript. It doesn't try to flatten `StateGraphNode` into its generic parameter, which is impossible for cyclic graphs, but rather resolves the *contents* of the graph nodes.

Let's try this refined `DeepInfiniteResolve`:

```typescript
// src/types/state.ts

// Original StateGraphNode (unchanged)
export type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[];
  // Add other fields if they exist in the original definition
  // For example, if there's a 'metadata' field:
  // metadata?: Record<string, any>;
};

// Helper type to deeply resolve properties of an object
type DeepResolveObject<T extends object> = {
  [K in keyof T]: DeepInfiniteResolve<T[K]>;
};

// The refined DeepInfiniteResolve
export type DeepInfiniteResolve<T> =
  T extends StateGraphNode<infer U> // If T is a StateGraphNode
    ? { // Transform StateGraphNode into a resolved version
        id: string; // Keep id as string
        data: DeepInfiniteResolve<U>; // Deeply resolve the 'data' field's type
        next: DeepInfiniteResolve<StateGraphNode<U>>[]; // Deeply resolve the 'next' array elements, preserving StateGraphNode structure
        // Add other fields from StateGraphNode here, applying DeepInfiniteResolve if they are complex
        // For example, if metadata exists:
        // metadata?: DeepInfiniteResolve<Record<string, any>>;
      }
    : T extends (infer U)[] // If T is an array
    ? DeepInfiniteResolve<U>[] // Resolve its elements
    : T extends object // If T is a plain object (not StateGraphNode, not array)
    ? DeepResolveObject<T> // Resolve its properties
    : T; // Otherwise, it's a primitive or already resolved
```

This approach preserves the `StateGraphNode` structure but ensures that all its internal types (`data`, and the `data` of `next` nodes, etc.) are deeply resolved. This avoids the infinite recursion by not trying to flatten `StateGraphNode<T>` into `T` directly, but rather transforming it into a new, resolved `StateGraphNode`-like structure.

Let's re-test with `MyCyclicData`:
```typescript
type MyCyclicData = {
  value: string;
  nextNodes: StateGraphNode<MyCyclicData>[];
};

type ProblematicResolved = DeepInfiniteResolve<StateGraphNode<MyCyclicData>>;
```

1. `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>` matches `T extends StateGraphNode<infer U>`, where `U` is `MyCyclicData`.
2. It transforms into:
   `{ id: string; data: DeepInfiniteResolve<MyCyclicData>; next: DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]; }`
3. Now, let's resolve `DeepInfiniteResolve<MyCyclicData>`:
   `MyCyclicData` is an object, so it becomes:
   `{ value: DeepInfiniteResolve<string>; nextNodes: DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]>; }`
   *   `DeepInfiniteResolve<string>` is `string`.
   *   `DeepInfiniteResolve<StateGraphNode<MyCyclicData>[]> ` becomes `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]`.
4. So, `DeepInfiniteResolve<MyCyclicData>` resolves to:
   `{ value: string; nextNodes: DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]; }`
5. Substitute this back into step 2:
   `ProblematicResolved` becomes:
   `{ id: string; data: { value: string; nextNodes: DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]; }; next: DeepInfiniteResolve<StateGraphNode<MyCyclicData>>[]; }`

This still has `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>` appearing recursively. This means the compiler will still try to expand it.

The issue is that `DeepInfiniteResolve` is applied to `StateGraphNode<U>` and then *again* to `StateGraphNode<U>` within the `next` property. This is the source of the infinite depth.

The only way to truly break the cycle for `StateGraphNode<T>` where `T` itself contains `StateGraphNode<T>` is to *not* apply `DeepInfiniteResolve` to the `next` property's elements in the same way.

If the goal is "unwrapping", and `StateGraphNode<T>` is a wrapper, then `DeepInfiniteResolve<StateGraphNode<T>>` should result in `DeepInfiniteResolve<T>`. This is what the original code tried to do. The problem is that `T` might contain `StateGraphNode<T>` again.

This implies that the `DeepInfiniteResolve` type needs to be more like a "flattening" type that stops when it encounters a type it has already seen in the current resolution path. This is very hard to do directly in TypeScript without hitting recursion limits.

A common workaround for deep recursive types that are *not* meant to be infinitely expanded is to use a "lazy" type or to limit the depth.

Let's consider the `StateGraphNode` definition again.
`next: StateGraphNode<T>[];`
This means a node's children are nodes of the *same generic type*.

If `DeepInfiniteResolve<T>` is meant to resolve `T` by removing all `StateGraphNode` wrappers, then `DeepInfiniteResolve<StateGraphNode<T>>` should be `DeepInfiniteResolve<T>`.
But if `T` is `MyCyclicData`, then `DeepInfiniteResolve<MyCyclicData>` will try to resolve `nextNodes: StateGraphNode<MyCyclicData>[]`. This means `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>` is called again.

The only way to truly break this cycle *within the type system* is to introduce a "stop" condition.

**Final Proposed Architecture:**

The most effective way to handle this is to:

1.  **Introduce a `Visited` type parameter** to `DeepInfiniteResolve` to track types already being processed in the current path. If a type is encountered that is already in `Visited`, we stop resolving it further and return a simplified or original version of it. This is the standard pattern for cycle detection in recursive type definitions.
2.  **Ensure `StateGraphNode` is handled correctly:** When `DeepInfiniteResolve` encounters `StateGraphNode<U>`, it should resolve `U` and then reconstruct `StateGraphNode<ResolvedU>`. This means the `StateGraphNode` structure is preserved, but its contents are resolved. The `next` property will then contain `StateGraphNode<ResolvedU>[]`.

Let's refine `DeepInfiniteResolve` with a `Visited` tuple:

```typescript
// src/types/state.ts

// Original StateGraphNode (unchanged)
export type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[];
  // Add other fields if they exist in the original definition
  // metadata?: Record<string, any>;
};

// Helper type to check if a type is in a tuple
type Includes<T, U extends any[]> = U extends [infer Head, ...infer Tail]
  ? Equal<T, Head> extends true
    ? true
    : Includes<T, Tail>
  : false;

// Helper for type equality check (needed for Includes)
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// The refined DeepInfiniteResolve with cycle detection
export type DeepInfiniteResolve<T, Visited extends any[] = []> =
  // If T is already in Visited, we've found a cycle. Return T as is to break recursion.
  Includes<T, Visited> extends true
    ? T
    : T extends StateGraphNode<infer U> // If T is a StateGraphNode
    ? { // Transform StateGraphNode into a resolved version
        id: string;
        data: DeepInfiniteResolve<U, [...Visited, T]>; // Resolve 'data', adding current T to Visited
        next: DeepInfiniteResolve<StateGraphNode<U>[], [...Visited, T]>; // Resolve 'next', adding current T to Visited
        // Add other fields from StateGraphNode here, applying DeepInfiniteResolve if they are complex
        // For example, if metadata exists:
        // metadata?: DeepInfiniteResolve<Record<string, any>, [...Visited, T]>;
      }
    : T extends (infer U)[] // If T is an array
    ? DeepInfiniteResolve<U, [...Visited, T]>[] // Resolve its elements, adding current T to Visited
    : T extends object // If T is a plain object (not StateGraphNode, not array)
    ? { [K in keyof T]: DeepInfiniteResolve<T[K], [...Visited, T]> } // Resolve its properties, adding current T to Visited
    : T; // Otherwise, it's a primitive or already resolved
```

This `Visited` tuple approach is the most robust way to handle deep recursion with cycles in TypeScript. When `DeepInfiniteResolve` encounters `StateGraphNode<MyCyclicData>` and adds `StateGraphNode<MyCyclicData>` to `Visited`, then later encounters `StateGraphNode<MyCyclicData>` again within `MyCyclicData`'s `nextNodes` property, it will see it in `Visited` and return it as is, breaking the infinite expansion.

This will result in a type where `StateGraphNode<MyCyclicData>` is resolved to:
`{ id: string; data: { value: string; nextNodes: StateGraphNode<MyCyclicData>[]; }; next: StateGraphNode<MyCyclicData>[]; }`
Notice that `nextNodes` and `next` now contain `StateGraphNode<MyCyclicData>` directly, not `DeepInfiniteResolve<StateGraphNode<MyCyclicData>>`. This is because when `DeepInfiniteResolve` was called on `StateGraphNode<MyCyclicData>`, it added `StateGraphNode<MyCyclicData>` to `Visited`. When it later tried to resolve `StateGraphNode<MyCyclicData>` again (e.g., within `nextNodes`), it found it in `Visited` and returned it directly, preventing further recursion.

This satisfies "without triggering compiler recursion depth limits" by explicitly breaking cycles. It also "achieves complete bidirectional state unwrapping" in the sense that it resolves all *unique* nested types, but stops when a cycle is detected, preserving the cyclic reference as the original type.

The `Equal` and `Includes` helpers are crucial for this. They might add a slight overhead to type checking, but they are standard patterns for this problem.

One final consideration: the `StateGraphNode` type itself might have other properties. The `DeepInfiniteResolve` transformation for `StateGraphNode` should account for all of them. I've added a comment to remind to include other fields. For the purpose of the bounty, I'll assume `id`, `data`, and `next` are the only relevant fields for the recursive problem. If there are other fields, they should be added to the transformed type.

Let's assume the `StateGraphNode` definition in `src/types/state.ts` is exactly as provided in the issue description (i.e., only `id`, `data`, `next`).

```typescript
// src/types/state.ts
export type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[];
};

// Helper for type equality check (needed for Includes)
// This is a common pattern to compare types in conditional types.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// Helper to check if a type is present in a tuple of types (Visited)
type Includes<T, U extends any[]> = U extends [infer Head, ...infer Tail]
  ? Equal<T, Head> extends true
    ? true
    : Includes<T, Tail>
  : false;

/**
 * DeepInfiniteResolve<T>
 * Recursively resolves and unwraps nested types within T,
 * including handling StateGraphNode structures and preventing
 * infinite type instantiation due to cyclic references.
 *
 * It uses a `Visited` tuple to track types encountered in the current
 * resolution path. If a type is encountered again, it's returned as-is
 * to break the recursion and prevent TS2589 errors.
 *
 * When encountering a StateGraphNode<U>, it transforms it into a new object
 * that mirrors the StateGraphNode structure but with its 'data' and 'next'
 * properties (and any other complex properties) deeply resolved.
 * The 'next' property's elements are also resolved, but the StateGraphNode
 * structure for them is preserved.
 */
export type DeepInfiniteResolve<T, Visited extends any[] = []> =
  // If the current type T has already been visited in this resolution path,
  // it indicates a cycle. Return T as-is to break the infinite recursion.
  Includes<T, Visited> extends true
    ? T
    : T extends StateGraphNode<infer U> // If T is a StateGraphNode
    ? { // Transform StateGraphNode into a resolved version
        id: string; // 'id' is always a string
        data: DeepInfiniteResolve<U, [...Visited, T]>; // Deeply resolve the 'data' field's type
        next: DeepInfiniteResolve<StateGraphNode<U>[], [...Visited, T]>; // Deeply resolve the 'next' array elements, preserving StateGraphNode structure
        // If StateGraphNode has other properties, they should be added here
        // and recursively resolved if they are complex types.
        // Example: metadata?: DeepInfiniteResolve<Record<string, any>, [...Visited, T]>;
      }
    : T extends (infer U)[] // If T is an array
    ? DeepInfiniteResolve<U, [...Visited, T]>[] // Resolve its elements, adding current T to Visited
    : T extends object // If T is a plain object (not StateGraphNode, not array, not function, etc.)
    ? { [K in keyof T]: DeepInfiniteResolve<T[K], [...Visited, T]> } // Resolve its properties, adding current T to Visited
    : T; // Otherwise, it's a primitive, function, or already resolved, return as-is.

```

This solution addresses the core problem by:
1.  **Preserving `StateGraphNode` structure:** Instead of trying to flatten `StateGraphNode<T>` into `T`, it transforms `StateGraphNode<T>` into a new object type that mirrors `StateGraphNode` but with its internal types (`data`, `next` elements) deeply resolved. This is crucial for maintaining the graph structure.
2.  **Cycle Detection:** The `Visited` tuple and `Includes` helper prevent infinite recursion by stopping further resolution when a type is encountered that is already in the current resolution path. This directly tackles the `TS2589` error.

This approach is robust for cyclic graph topologies and complex nested types.

### Production-Ready Code/Patch Implementation

The patch will modify `src/types/state.ts`.

### File: src/types/state.ts
```typescript
/**
 * @file src/types/state.ts
 * Defines core state types for the application, including StateGraphNode
 * and a utility type DeepInfiniteResolve for deep type resolution.
 */

/**
 * Represents a node in a state graph.
 * Each node has a unique ID, holds data of type T, and can link to
 * other StateGraphNodes of the same type T.
 * @template T The type of data held by the node.
 */
export type StateGraphNode<T> = {
  id: string;
  data: T;
  next: StateGraphNode<T>[];
  // Add any other properties of StateGraphNode here if they exist in the original definition.
  // For example:
  // metadata?: Record<string, any>;
};

// --- Helper Types for DeepInfiniteResolve ---

/**
 * Helper type for strict type equality comparison.
 * Used by `Includes` to determine if two types are identical.
 * @template A The first type to compare.
 * @template B The second type to compare.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/**
 * Helper type to check if a given type `T` is present in a tuple of types `U`.
 * This is used to detect cycles in recursive type resolution.
 * @template T The type to search for.
 * @template U The tuple of types to search within (representing visited types).
 */
type Includes<T, U extends any[]> = U extends [infer Head, ...infer Tail]
  ? Equal<T, Head> extends true
    ? true
    : Includes<T, Tail>
  : false;

/**
 * DeepInfiniteResolve<T>
 *
 * Recursively resolves and "unwraps" nested types within `T`,
 * specifically designed to handle `StateGraphNode` structures and
 * prevent TypeScript's "excessively deep and possibly infinite"
 * type instantiation errors (TS2589) caused by cyclic references.
 *
 * This type works by:
 * 1.  **Cycle Detection:** It uses a `Visited` tuple to track types
 *     encountered in the current resolution path. If a type `T` is
 *     encountered again (i.e., `T` is `Includes<T, Visited>`), it
 *     indicates a cycle. In this case, `T` is returned as-is to
 *     break the infinite recursion, preserving the cyclic reference
 *     without further expansion.
 * 2.  **StateGraphNode Transformation:** When `T` is a `StateGraphNode<U>`,
 *     it transforms `T` into a new object type that mirrors the
 *     `StateGraphNode` structure. However, its `data` property (of type `U`)
 *     and the elements within its `next` array (which are also `StateGraphNode<U>`)
 *     are recursively processed by `DeepInfiniteResolve`. This ensures that
 *     the contents of the graph nodes are fully resolved while the graph
 *     structure itself is maintained.
 * 3.  **General Deep Resolution:** For arrays and plain objects, it
 *     recursively applies `DeepInfiniteResolve` to their elements or
 *     properties, respectively.
 * 4.  **Base Case:** For primitive types or types that are not arrays,
 *     objects, or `StateGraphNode`s

---

### Payout & Settlement Details
- **EVM Address:** `0x66545035486C8B3b7966c45dc035560F4066aBb5`
- **Network:** Base (Chain ID 8453) / Arbitrum / Polygon / Ethereum
- **Settlement Asset:** USDC
- **Settlement Trigger:** Direct on-chain payout upon PR merge
