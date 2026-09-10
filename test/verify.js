console.log("Running Invariant Verification Test Suite...");

import {
  createAABB,
  getBoundingVertices,
  sweptAABB,
  resolveSweptMotion,
} from "../src/physics/ccd.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function approxPoint(p, q, eps = 1e-6) {
  return approx(p[0], q[0], eps) && approx(p[1], q[1], eps) && approx(p[2], q[2], eps);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log("\n[1/4] 8 spatial bounding vertices (Bedrock space: +X East, +Y Up, +Z South)");
test("derives all 8 corners of a unit AABB", () => {
  const box = createAABB([0, 0, 0], [1, 1, 1]);
  const vertices = getBoundingVertices(box);
  assert(vertices.length === 8, "expected 8 vertices");
  const expected = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];
  for (const v of expected) {
    assert(
      vertices.some((u) => approxPoint(u, v)),
      `missing vertex ${JSON.stringify(v)}`
    );
  }
});

test("vertices cover every min/max combination exactly once", () => {
  const box = createAABB([-2, 0, 5], [3, 4, 9]);
  const vertices = getBoundingVertices(box);
  const key = (v) => v.join(",");
  const keys = new Set(vertices.map(key));
  assert(keys.size === 8, "vertices must be unique");
  const allCombos = [];
  for (const x of [-2, 3])
    for (const y of [0, 4])
      for (const z of [5, 9]) allCombos.push(key([x, y, z]));
  for (const k of allCombos) {
    assert(keys.has(k), `missing vertex combo ${k}`);
  }
});

console.log("\n[2/4] swept AABB CCD catches high-speed ghost teleportation");
test("detects a hit the discrete end-state test misses (> 1.5 blocks/tick)", () => {
  const mover = createAABB([0, 0, 0], [0.4, 0.4, 0.4]);
  const obstacle = createAABB([0.9, 0, 0], [1.1, 0.5, 0.5]);
  const velocity = [2, 0, 0];

  const endState = createAABB(
    [0 + velocity[0], 0, 0],
    [0.4 + velocity[0], 0.4, 0.4]
  );
  const discreteOverlap =
    endState.max[0] > obstacle.min[0] &&
    endState.min[0] < obstacle.max[0] &&
    endState.max[1] > obstacle.min[1] &&
    endState.min[1] < obstacle.max[1] &&
    endState.max[2] > obstacle.min[2] &&
    endState.min[2] < obstacle.max[2];
  assert(!discreteOverlap, "precondition: discrete overlap check must miss this collision");

  const hit = sweptAABB(mover, velocity, obstacle);
  assert(hit !== null, "swept CCD must find the collision");
  assert(hit.time >= 0 && hit.time <= 1, `time ${hit.time} must be within the tick`);
  assert(approx(hit.time, 0.25), `expected first-contact time 0.25, got ${hit.time}`);
  assert(approxPoint(hit.point, [0.7, 0.2, 0.2]), `contact point wrong: ${JSON.stringify(hit.point)}`);
  assert(approxPoint(hit.normal, [-1, 0, 0]), `normal wrong: ${JSON.stringify(hit.normal)}`);
});

test("moving toward +X East and +Z South collides in Bedrock orientation", () => {
  const mover = createAABB([0, 0, 0], [0.5, 0.5, 0.5]);
  const wallEast = createAABB([2, -1, -1], [2.25, 2, 2]);
  const hitEast = sweptAABB(mover, [1.9, 0, 0], wallEast);
  assert(hitEast !== null, "eastward sweep should hit the wall");
  assert(approxPoint(hitEast.normal, [-1, 0, 0]), "eastward hit normal should face west");

  const wallSouth = createAABB([-1, -1, 2], [2, 2, 2.25]);
  const hitSouth = sweptAABB(mover, [0, 0, 1.9], wallSouth);
  assert(hitSouth !== null, "southward sweep should hit the wall");
  assert(approxPoint(hitSouth.normal, [0, 0, -1]), "southward hit normal should face north");
});

test("falling along -Y (down, away from +Y up) stops on a floor", () => {
  const mover = createAABB([0, 5, 0], [1, 6, 1]);
  const floor = createAABB([-2, 0, -2], [2, 0.25, 2]);
  const hit = sweptAABB(mover, [0, -4.8, 0], floor);
  assert(hit !== null, "downward sweep should hit the floor");
  assert(approxPoint(hit.normal, [0, 1, 0]), "floor hit normal should point up");
  assert(hit.time >= 0 && hit.time <= 1, "floor contact must land inside the tick");
});

test("no collision when moving away or clear of geometry", () => {
  const mover = createAABB([0, 0, 0], [0.5, 0.5, 0.5]);
  const obstacle = createAABB([3, 0, 0], [3.5, 1, 1]);
  assert(sweptAABB(mover, [-2, 0, 0], obstacle) === null, "moving away must miss");
  assert(sweptAABB(mover, [0, 0, 2], obstacle) === null, "parallel offset must miss");
});

test("zero-velocity overlap resolves as an immediate contact at time 0", () => {
  const mover = createAABB([0, 0, 0], [1, 1, 1]);
  const obstacle = createAABB([0.5, 0.5, 0.5], [2, 2, 2]);
  const hit = sweptAABB(mover, [0, 0, 0], obstacle);
  assert(hit !== null, "overlapping boxes must contact");
  assert(approx(hit.time, 0), "overlap must resolve at time 0");
});

test("high-speed motion stops short of a far obstacle (no tunneling)", () => {
  const mover = createAABB([0, 0, 0], [0.4, 0.4, 0.4]);
  const obstacle = createAABB([1.8, 0, 0], [2.2, 1, 1]);
  const hit = sweptAABB(mover, [2.4, 0, 0], obstacle);
  assert(hit !== null, "must not tunnel through the far wall");
  assert(hit.time > 0 && hit.time < 1, "contact must occur mid-tick");
});

console.log("\n[3/4] multi-obstacle resolution");
test("resolveSweptMotion returns the earliest contact", () => {
  const mover = createAABB([0, 0, 0], [0.4, 0.4, 0.4]);
  const near = createAABB([0.8, 0, 0], [0.9, 1, 1]);
  const far = createAABB([1.5, 0, 0], [1.6, 1, 1]);
  const hit = resolveSweptMotion(mover, [2, 0, 0], [far, near]);
  assert(hit !== null, "expected a contact");
  assert(hit.obstacle === near, "must pick the nearer obstacle");
  assert(approx(hit.time, 0.2), `expected time 0.2, got ${hit.time}`);
});

test("resolveSweptMotion returns null on an unobstructed path", () => {
  const mover = createAABB([0, 0, 0], [0.4, 0.4, 0.4]);
  const hit = resolveSweptMotion(mover, [2, 0, 0], [createAABB([5, 0, 0], [6, 1, 1])]);
  assert(hit === null, "clear path must yield no contact");
});

console.log("\n[4/4] summary");
if (failed > 0) {
  console.error(`\n[CRITICAL FAILURE] ${failed} invariant(s) failed; ${passed} passed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${passed} invariants passed.`);
  process.exit(0);
}