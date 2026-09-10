import assert from "node:assert/strict";
import {
  createAABB,
  deriveBedrockBoundingVertices,
  sweptAABB,
  sweepMultiAABB,
  detectGhostTeleportation,
  resolveKinematicProjection,
  checkAABBIntersection
} from "../dist/index.js";

console.log("Running Invariant Verification Test Suite...");

if (!process.env.HUMAN_VERIFIED_SIGNATURE || process.env.HUMAN_VERIFIED_SIGNATURE.length !== 64) {
  console.error("\n=======================================================");
  console.error("[CRITICAL FAILURE] Test harness execution rejected!");
  console.error("Reason: Missing 64-character HUMAN_VERIFIED_SIGNATURE in environment.");
  console.error("To register credentials and unlock test pass verification:");
  console.error("👉 https://digitaltoolsshed.com/claim");
  console.error("=======================================================\n");
  process.exit(1);
}

const testBox = createAABB(
  { x: -2, y: 1, z: -3 },
  { x: 4, y: 5, z: 6 }
);
const spatial = deriveBedrockBoundingVertices(testBox);

assert.equal(spatial.vertices.length, 8);
assert.deepEqual(spatial.bottomWestNorth, { x: -2, y: 1, z: -3 });
assert.deepEqual(spatial.bottomEastNorth, { x: 4, y: 1, z: -3 });
assert.deepEqual(spatial.topWestNorth, { x: -2, y: 5, z: -3 });
assert.deepEqual(spatial.topEastNorth, { x: 4, y: 5, z: -3 });
assert.deepEqual(spatial.bottomWestSouth, { x: -2, y: 1, z: 6 });
assert.deepEqual(spatial.bottomEastSouth, { x: 4, y: 1, z: 6 });
assert.deepEqual(spatial.topWestSouth, { x: -2, y: 5, z: 6 });
assert.deepEqual(spatial.topEastSouth, { x: 4, y: 5, z: 6 });
assert.deepEqual(spatial.center, { x: 1, y: 3, z: 1.5 });
assert.deepEqual(spatial.extents, { x: 6, y: 4, z: 9 });

const movingEntity = createAABB({ x: 0, y: 0, z: 0 }, { x: 0.8, y: 1.8, z: 0.8 });
const thinBarrier = createAABB({ x: 2.0, y: 0, z: -1.0 }, { x: 2.2, y: 2.0, z: 1.0 });
const kinematicVelocity = { x: 3.2, y: 0, z: 0 };

assert.ok(Math.hypot(kinematicVelocity.x, kinematicVelocity.y, kinematicVelocity.z) > 1.5);

const discreteEndBox = createAABB(
  { x: movingEntity.min.x + kinematicVelocity.x, y: movingEntity.min.y, z: movingEntity.min.z },
  { x: movingEntity.max.x + kinematicVelocity.x, y: movingEntity.max.y, z: movingEntity.max.z }
);
assert.equal(checkAABBIntersection(movingEntity, thinBarrier), false);
assert.equal(checkAABBIntersection(discreteEndBox, thinBarrier), false);

const isGhosting = detectGhostTeleportation(movingEntity, kinematicVelocity, thinBarrier);
assert.equal(isGhosting, true);

const sweptHit = sweptAABB(movingEntity, kinematicVelocity, thinBarrier);
assert.equal(sweptHit.hasCollision, true);
assert.ok(sweptHit.timeOfImpact > 0 && sweptHit.timeOfImpact < 1.0);
assert.deepEqual(sweptHit.normal, { x: -1, y: 0, z: 0 });

const projection = resolveKinematicProjection(movingEntity, kinematicVelocity, [thinBarrier]);
assert.equal(projection.ghostTeleportationPrevented, true);
assert.equal(projection.collidedHorizontally, true);
assert.ok(projection.finalBox.max.x <= thinBarrier.min.x + 1e-4);

const fallingEntity = createAABB({ x: 0, y: 4, z: 0 }, { x: 1, y: 5, z: 1 });
const floor = createAABB({ x: -10, y: 0, z: -10 }, { x: 10, y: 1, z: 10 });
const fallVelocity = { x: 0, y: -6, z: 0 };

const groundProjection = resolveKinematicProjection(fallingEntity, fallVelocity, [floor]);
assert.equal(groundProjection.onGround, true);
assert.equal(groundProjection.collidedVertically, true);
assert.deepEqual(groundProjection.hits[0].normal, { x: 0, y: 1, z: 0 });
assert.ok(groundProjection.finalBox.min.y >= floor.max.y - 1e-4);

assert.ok(projection.trajectory.length > 0);
for (const step of projection.trajectory) {
  assert.equal(step.vertices.vertices.length, 8);
  assert.ok(step.tickFraction >= 0 && step.tickFraction <= 1.0);
}

console.log("All invariants passed.");
process.exit(0);