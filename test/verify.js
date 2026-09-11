/**
 * Swept AABB Continuous Collision Detection Test Suite
 * 
 * Issue #2: Bedrock Physics - 1-Tick Kinematic Ghost Teleportation and Swept AABB Dropout
 * 
 * Tests cover:
 * 1. Vertex derivation correctness (8 vertices, Bedrock coordinate space)
 * 2. AABB calculation
 * 3. Vector math utilities
 * 4. Swept AABB collision detection (static, moving, no-collision)
 * 5. High-velocity tunneling prevention (> 1.5 blocks/tick)
 * 6. Collision time and normal calculation
 * 7. Multi-obstacle earliest collision
 */

import {
  getVertices,
  getAABB,
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
  vecNormalize,
  aabbOverlap,
  sweptAABB,
  highVelocitySweep,
} from '../src/physics/swept-aabb.js';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  ❌ ${message}`);
  }
}

function approxEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) < epsilon;
}

function vecApproxEqual(a, b, epsilon = 1e-6) {
  return approxEqual(a.x, b.x, epsilon) &&
         approxEqual(a.y, b.y, epsilon) &&
         approxEqual(a.z, b.z, epsilon);
}

console.log('='.repeat(70));
console.log('Swept AABB CCD Test Suite - Issue #2');
console.log('='.repeat(70));
console.log('');

// ============================================================
// Test 1: Vertex Derivation
// ============================================================
console.log('Test 1: Vertex Derivation (8 vertices, Bedrock coordinate space)');

const size = { halfWidth: 0.5, halfHeight: 1.0 };
const vertices = getVertices(0, 0, 0, size);

assert(vertices.length === 8, 'Returns exactly 8 vertices');
assert(vecApproxEqual(vertices[0], { x: -0.5, y: -1.0, z: -0.5 }), 'Vertex 0: West-Down-North (-X, -Y, -Z)');
assert(vecApproxEqual(vertices[1], { x: 0.5, y: -1.0, z: -0.5 }), 'Vertex 1: East-Down-North (+X, -Y, -Z)');
assert(vecApproxEqual(vertices[2], { x: -0.5, y: 1.0, z: -0.5 }), 'Vertex 2: West-Up-North (-X, +Y, -Z)');
assert(vecApproxEqual(vertices[3], { x: 0.5, y: 1.0, z: -0.5 }), 'Vertex 3: East-Up-North (+X, +Y, -Z)');
assert(vecApproxEqual(vertices[4], { x: -0.5, y: -1.0, z: 0.5 }), 'Vertex 4: West-Down-South (-X, -Y, +Z)');
assert(vecApproxEqual(vertices[5], { x: 0.5, y: -1.0, z: 0.5 }), 'Vertex 5: East-Down-South (+X, -Y, +Z)');
assert(vecApproxEqual(vertices[6], { x: -0.5, y: 1.0, z: 0.5 }), 'Vertex 6: West-Up-South (-X, +Y, +Z)');
assert(vecApproxEqual(vertices[7], { x: 0.5, y: 1.0, z: 0.5 }), 'Vertex 7: East-Up-South (+X, +Y, +Z)');

// Test with offset center
const offsetVertices = getVertices(10, 20, 30, size);
assert(vecApproxEqual(offsetVertices[0], { x: 9.5, y: 19.0, z: 29.5 }), 'Offset center: Vertex 0 correct');
assert(vecApproxEqual(offsetVertices[7], { x: 10.5, y: 21.0, z: 30.5 }), 'Offset center: Vertex 7 correct');

console.log('');

// ============================================================
// Test 2: AABB Calculation
// ============================================================
console.log('Test 2: AABB Calculation');

const aabb = getAABB(0, 0, 0, size);
assert(approxEqual(aabb.minX, -0.5), 'minX correct');
assert(approxEqual(aabb.maxX, 0.5), 'maxX correct');
assert(approxEqual(aabb.minY, -1.0), 'minY correct');
assert(approxEqual(aabb.maxY, 1.0), 'maxY correct');
assert(approxEqual(aabb.minZ, -0.5), 'minZ correct');
assert(approxEqual(aabb.maxZ, 0.5), 'maxZ correct');

console.log('');

// ============================================================
// Test 3: Vector Math Utilities
// ============================================================
console.log('Test 3: Vector Math Utilities');

const a = { x: 1, y: 2, z: 3 };
const b = { x: 4, y: 5, z: 6 };

assert(vecApproxEqual(vecAdd(a, b), { x: 5, y: 7, z: 9 }), 'vecAdd correct');
assert(vecApproxEqual(vecSub(b, a), { x: 3, y: 3, z: 3 }), 'vecSub correct');
assert(vecApproxEqual(vecScale(a, 2), { x: 2, y: 4, z: 6 }), 'vecScale correct');
assert(approxEqual(vecLength({ x: 3, y: 4, z: 0 }), 5), 'vecLength correct (3-4-5 triangle)');
assert(vecApproxEqual(vecNormalize({ x: 3, y: 4, z: 0 }), { x: 0.6, y: 0.8, z: 0 }), 'vecNormalize correct');

console.log('');

// ============================================================
// Test 4: AABB Overlap
// ============================================================
console.log('Test 4: AABB Overlap Detection');

const box1 = { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 };
const box2 = { minX: 1, maxX: 3, minY: 1, maxY: 3, minZ: 1, maxZ: 3 };
const box3 = { minX: 5, maxX: 6, minY: 5, maxY: 6, minZ: 5, maxZ: 6 };

assert(aabbOverlap(box1, box2) === true, 'Overlapping boxes detected');
assert(aabbOverlap(box1, box3) === false, 'Non-overlapping boxes not detected');
assert(aabbOverlap(box1, box1) === true, 'Box overlaps with itself');

console.log('');

// ============================================================
// Test 5: Swept AABB - No Collision
// ============================================================
console.log('Test 5: Swept AABB - No Collision');

const entitySize = { halfWidth: 0.5, halfHeight: 0.5 };
const farObstacle = { minX: 10, maxX: 11, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };

const noCollisionResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  entitySize,
  [farObstacle]
);

assert(noCollisionResult.collided === false, 'No collision when obstacle is far');
assert(approxEqual(noCollisionResult.hitTime, 1), 'hitTime is 1.0 when no collision');
assert(vecApproxEqual(noCollisionResult.resolvedPos, { x: 2, y: 0, z: 0 }), 'resolvedPos is nextPos when no collision');

console.log('');

// ============================================================
// Test 6: Swept AABB - Direct Collision
// ============================================================
console.log('Test 6: Swept AABB - Direct Collision');

const wallObstacle = { minX: 2, maxX: 3, minY: -1, maxY: 2, minZ: -1, maxZ: 2 };

const directCollisionResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  entitySize,
  [wallObstacle]
);

assert(directCollisionResult.collided === true, 'Collision detected when moving into wall');
assert(directCollisionResult.hitTime > 0 && directCollisionResult.hitTime < 1, 'hitTime between 0 and 1');
assert(approxEqual(directCollisionResult.hitTime, 0.3, 0.01), 'hitTime ~0.3 (entity half-width 0.5, wall at x=2)');
assert(directCollisionResult.hitNormal.x < 0, 'hitNormal points West (-X) when hitting East-facing wall');
assert(directCollisionResult.resolvedPos.x < 2, 'resolvedPos is before the wall');

console.log('');

// ============================================================
// Test 7: Swept AABB - Static Overlap
// ============================================================
console.log('Test 7: Swept AABB - Static Overlap (no movement)');

const overlappingObstacle = { minX: -0.2, maxX: 0.2, minY: -0.2, maxY: 0.2, minZ: -0.2, maxZ: 0.2 };

const staticResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  entitySize,
  [overlappingObstacle]
);

assert(staticResult.collided === true, 'Static overlap detected');
assert(approxEqual(staticResult.hitTime, 0), 'hitTime is 0 for static overlap');

console.log('');

// ============================================================
// Test 8: High-Velocity Tunneling Prevention
// ============================================================
console.log('Test 8: High-Velocity Tunneling Prevention (> 1.5 blocks/tick)');

// Thin wall that would be tunneled through with discrete detection
const thinWall = { minX: 3, maxX: 3.1, minY: -10, maxY: 10, minZ: -10, maxZ: 10 };

// High velocity movement (5 blocks in one tick)
const highVelResult = highVelocitySweep(
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  entitySize,
  [thinWall],
  0.5 // max sub-step 0.5 blocks
);

assert(highVelResult.collided === true, 'High-velocity collision detected (no tunneling)');
assert(highVelResult.hitTime > 0 && highVelResult.hitTime < 1, 'hitTime between 0 and 1');
assert(highVelResult.resolvedPos.x < 3, 'resolvedPos is before thin wall');

// Verify that without sub-stepping, discrete detection would miss
const discreteResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  entitySize,
  [thinWall]
);
// Note: swept AABB should still catch it, but this verifies our implementation
assert(discreteResult.collided === true, 'Swept AABB also catches thin wall (continuous detection)');

console.log('');

// ============================================================
// Test 9: Multi-Obstacle Earliest Collision
// ============================================================
console.log('Test 9: Multi-Obstacle Earliest Collision');

const nearWall = { minX: 1, maxX: 1.5, minY: -10, maxY: 10, minZ: -10, maxZ: 10 };
const farWall = { minX: 4, maxX: 4.5, minY: -10, maxY: 10, minZ: -10, maxZ: 10 };

const multiResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
  entitySize,
  [farWall, nearWall] // far wall first in array
);

assert(multiResult.collided === true, 'Collision detected with multiple obstacles');
assert(multiResult.resolvedPos.x < 1.5, 'Earliest collision is with near wall (x~1)');

console.log('');

// ============================================================
// Test 10: Bedrock Coordinate Space Compliance
// ============================================================
console.log('Test 10: Bedrock Coordinate Space Compliance (+X East, +Y Up, +Z South)');

// Test collision from South (+Z direction)
const southWall = { minX: -10, maxX: 10, minY: -10, maxY: 10, minZ: 2, maxZ: 3 };

const southCollision = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 5 },
  entitySize,
  [southWall]
);

assert(southCollision.collided === true, 'Collision detected when moving South (+Z)');
assert(southCollision.hitNormal.z < 0, 'hitNormal points North (-Z) when hitting South-facing wall');

// Test collision from Up (+Y direction)
const ceiling = { minX: -10, maxX: 10, minY: 2, maxY: 3, minZ: -10, maxZ: 10 };

const upCollision = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 5, z: 0 },
  entitySize,
  [ceiling]
);

assert(upCollision.collided === true, 'Collision detected when moving Up (+Y)');
assert(upCollision.hitNormal.y < 0, 'hitNormal points Down (-Y) when hitting ceiling');

console.log('');

// ============================================================
// Test 11: Grazing Collision (edge case)
// ============================================================
console.log('Test 11: Grazing Collision (edge case)');

// Moving parallel to wall, should not collide
const parallelWall = { minX: 2, maxX: 3, minY: -10, maxY: 10, minZ: -10, maxZ: 10 };

const parallelResult = sweptAABB(
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 5, z: 0 }, // moving Up, parallel to wall in X
  entitySize,
  [parallelWall]
);

assert(parallelResult.collided === false, 'No collision when moving parallel to wall');

console.log('');

// ============================================================
// Summary
// ============================================================
console.log('');
console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log('');

if (failed > 0) {
  console.error('Failed tests:');
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.log('');
  process.exit(1);
} else {
  console.log('✅ All tests passed! Swept AABB CCD implementation verified.');
  console.log('   - 8 vertex derivation in Bedrock coordinate space (+X East, +Y Up, +Z South)');
  console.log('   - Continuous collision detection via slab method');
  console.log('   - High-velocity tunneling prevention with sub-stepping');
  console.log('   - Collision time, point, and normal calculation');
  console.log('   - Multi-obstacle earliest collision detection');
  process.exit(0);
}
