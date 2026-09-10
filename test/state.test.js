import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveStateGraph,
  verifyStateInvariants,
  fuzzStateTopology
} from "../dist/index.js";

test("resolveStateGraph unwraps cyclic single-node self loop deterministically", () => {
  const selfNode = {
    id: "self_0",
    payload: { marker: "alpha" },
    next: null,
    compute: () => selfNode
  };
  selfNode.next = selfNode;

  const resolved = resolveStateGraph(selfNode);
  assert.equal(resolved.id, "self_0");
  assert.equal(resolved.payload.marker, "alpha");
  assert.equal(resolved.next, resolved);
  assert.equal(resolved.compute, resolved);

  const invariants = verifyStateInvariants(resolved);
  assert.equal(invariants.isCyclic, true);
  assert.equal(invariants.nodeCount, 1);
  assert.equal(invariants.cycleLength, 1);
});

test("resolveStateGraph unwraps bidirectional cyclic topology with structural symmetry", () => {
  const root = fuzzStateTopology(5, { bidirectional: true });
  const invariantsBefore = verifyStateInvariants(root);

  assert.equal(invariantsBefore.nodeCount, 5);
  assert.equal(invariantsBefore.isCyclic, true);
  assert.equal(invariantsBefore.cycleLength, 5);
  assert.equal(invariantsBefore.isBidirectionalSymmetric, true);

  const resolved = resolveStateGraph(root);
  assert.equal(resolved.id, "state_node_0");
  assert.equal(resolved.next.id, "state_node_1");
  assert.equal(resolved.next.next.id, "state_node_2");
  assert.equal(resolved.next.prev, resolved);
  assert.equal(resolved.next.next.prev, resolved.next);

  const invariantsAfter = verifyStateInvariants(resolved);
  assert.equal(invariantsAfter.nodeCount, 5);
  assert.equal(invariantsAfter.isCyclic, true);
  assert.equal(invariantsAfter.cycleLength, 5);
  assert.equal(invariantsAfter.isBidirectionalSymmetric, true);
});

test("resolveStateGraph evaluates lazy thunk state transitions into resolved state nodes", () => {
  const root = fuzzStateTopology(3, { thunks: true });
  const resolved = resolveStateGraph(root);

  assert.equal(resolved.id, "state_node_0");
  assert.equal(resolved.compute.id, "state_node_1");
  assert.equal(resolved.compute.next.id, "state_node_2");
  assert.equal(resolved.compute.next.compute.id, "state_node_0");
});

test("resolveStateGraph respects maxDepth bounds to prevent unbounded recursion", () => {
  const root = fuzzStateTopology(4);
  const resolved = resolveStateGraph(root, 2);

  assert.equal(resolved.id, "state_node_0");
  assert.equal(resolved.next.id, "state_node_1");
  assert.equal(resolved.next.next.id, "state_node_2");
});

test("verifyStateInvariants detects non-cyclic terminating state sequences", () => {
  const node2 = { id: "leaf", payload: {}, next: null, compute: null };
  const node1 = { id: "mid", payload: {}, next: node2, compute: null };
  const node0 = { id: "root", payload: {}, next: node1, compute: null };

  const invariants = verifyStateInvariants(node0);
  assert.equal(invariants.isCyclic, false);
  assert.equal(invariants.nodeCount, 3);
  assert.equal(invariants.cycleLength, 0);
  assert.deepEqual(invariants.reachableNodeIds, ["root", "mid", "leaf"]);
});

test("fuzzStateTopology throws on invalid non-positive node count", () => {
  assert.throws(() => fuzzStateTopology(0), {
    message: "Node count must be greater than zero."
  });
});

test("DeepInfiniteResolve compiler type fuzzing prevents TS2589 recursion exhaustion", async () => {
  const ts = await import("typescript");
  const virtualSource = `
    import { DeepInfiniteResolve, StateGraphNode, SolvedState } from "./dist/types/state.js";
    declare const state: SolvedState;
    const nav1: string = state.next.next.next.next.id;
    const nav2: string = state.compute.next.id;
    const nav3: string = state.next.next.compute.next.compute.id;
    const nav4: string | undefined = state.next.prev?.compute.id;

    interface DynamicCycle {
      id: string;
      peer: DynamicCycle;
      generator: () => DynamicCycle;
      history: DynamicCycle[];
    }
    type SolvedDynamic = DeepInfiniteResolve<DynamicCycle>;
    declare const dyn: SolvedDynamic;
    const genId: string = dyn.generator.id;
    const peerGenId: string = dyn.peer.generator.id;
  `;

  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true
  };

  const defaultHost = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = defaultHost.getSourceFile;

  defaultHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (fileName === "fuzz_test.ts") {
      return ts.createSourceFile(fileName, virtualSource, languageVersion);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const program = ts.createProgram(["fuzz_test.ts"], compilerOptions, defaultHost);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  assert.equal(diagnostics.length, 0);
});
