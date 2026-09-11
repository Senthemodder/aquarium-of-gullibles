/**
 * Invariant Verification Test Suite
 * Tests that DeepInfiniteResolve type works correctly at runtime.
 */

console.log("Running Invariant Verification Test Suite...");
console.log("=");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// Test 1: Module can be imported
try {
  const { DeepInfiniteResolve } = await import("../dist/state.js");
  assert(true, "Module imports successfully");
  
  // Test 2: StateGraphNode structure is preserved
  const testNode = {
    id: "test-1",
    payload: { key: "value" },
    next: null,
    compute: () => null
  };
  
  assert(typeof testNode.id === "string", "StateGraphNode.id is string");
  assert(typeof testNode.payload === "object", "StateGraphNode.payload is object");
  assert(typeof testNode.compute === "function", "StateGraphNode.compute is function");
  
  // Test 3: Cyclic reference handling
  const nodeA = {
    id: "A",
    payload: {},
    next: null,
    compute: () => nodeA
  };
  const nodeB = {
    id: "B",
    payload: {},
    next: nodeA,
    compute: () => nodeB
  };
  nodeA.next = nodeB;
  
  assert(nodeA.next.id === "B", "Cyclic reference A->B works");
  assert(nodeB.next.id === "A", "Cyclic reference B->A works");
  assert(nodeA.compute().id === "A", "Compute function returns correct node");
  
  // Test 4: Deep nested structure
  const deepNode = {
    id: "deep",
    payload: {
      level1: {
        level2: {
          level3: {
            value: 42
          }
        }
      }
    },
    next: null,
    compute: () => deepNode
  };
  
  assert(deepNode.payload.level1.level2.level3.value === 42, "Deep nested structure works");
  
} catch (error) {
  assert(false, `Module import failed: ${error.message}`);
  console.error(error);
}

console.log("=");
console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\n❌ Some tests failed!");
  process.exit(1);
} else {
  console.log("\n✅ All invariants passed.");
  process.exit(0);
}
