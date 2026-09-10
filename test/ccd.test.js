import test from "node:test";
import assert from "node:assert/strict";
import {
  createAABB,
  createAABBFromPosition,
  deriveBedrockBoundingVertices,
  checkAABBIntersection,
  computeSweptBroadphaseAABB,
  translateAABB,
  interpolateAABB,
  sweptAABB,
  sweepMultiAABB,
  detectGhostTeleportation,
  resolveKinematicProjection
} from "../dist/index.js";

test("deriveBedrockBoundingVertices accurately maps all 8 vertices in Bedrock coordinate space (+X East, +Y Up, +Z South)", () => {
  const box = createAABB(
    { x: -1, y: 0, z: -2 },
    { x: 3, y: 4, z: 5 }
  );

  const spatial = deriveBedrockBoundingVertices(box);

  assert.deepEqual(spatial.bottomWestNorth, { x: -1, y: 0, z: -2 });
  assert.deepEqual(spatial.bottomEastNorth, { x: 3, y: 0, z: -2 });
  assert.deepEqual(spatial.topWestNorth, { x: -1, y: 4, z: -2 });
  assert.deepEqual(spatial.topEastNorth, { x: 3, y: 4, z: -2 });
  assert.deepEqual(spatial.bottomWestSouth, { x: -1, y: 0, z: 5 });
  assert.deepEqual(spatial.bottomEastSouth, { x: 3, y: 0, z: 5 });
  assert.deepEqual(spatial.topWestSouth, { x: -1, y: 4, z: 5 });
  assert.deepEqual(spatial.topEastSouth, { x: 3, y: 4, z: 5 });

  assert.equal(spatial.vertices.length, 8);
  assert.deepEqual(spatial.vertices[0], spatial.bottomWestNorth);
  assert.deepEqual(spatial.vertices[1], spatial.bottomEastNorth);
  assert.deepEqual(spatial.vertices[2], spatial.topWestNorth);
  assert.deepEqual(spatial.vertices[3], spatial.topEastNorth);
  assert.deepEqual(spatial.vertices[4], spatial.bottomWestSouth);
  assert.deepEqual(spatial.vertices[5], spatial.bottomEastSouth);
  assert.deepEqual(spatial.vertices[6], spatial.topWestSouth);
  assert.deepEqual(spatial.vertices[7], spatial.topEastSouth);

  assert.deepEqual(spatial.center, { x: 1, y: 2, z: 1.5 });
  assert.deepEqual(spatial.extents, { x: 4, y: 4, z: 7 });
});

test("sweptAABB detects continuous collision and prevents dropout when moving on single axis with zero velocity on other axes", () => {
  const entity = createAABB(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 }
  );
  const wall = createAABB(
    { x: 3, y: 0, z: 0 },
    { x: 4, y: 1, z: 1 }
  );
  const velocity = { x: 4, y: 0, z: 0 };

  const hit = sweptAABB(entity, velocity, wall);

  assert.equal(hit.hasCollision, true);
  assert.equal(hit.timeOfImpact, 0.5);
  assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 });
  assert.equal(hit.initialOverlap, false);
  assert.deepEqual(hit.boxAtImpact.min, { x: 2, y: 0, z: 0 });
  assert.deepEqual(hit.boxAtImpact.max, { x: 3, y: 1, z: 1 });
});

test("detectGhostTeleportation confirms discrete collision drops out while swept CCD intercepts high-speed projection (> 1.5 blocks/tick)", () => {
  const entity = createAABB(
    { x: 0, y: 0, z: 0 },
    { x: 0.6, y: 1.8, z: 0.6 }
  );
  const thinWall = createAABB(
    { x: 2.0, y: 0, z: 0 },
    { x: 2.2, y: 2.0, z: 1.0 }
  );
  const highSpeedVelocity = { x: 3.5, y: 0, z: 0 };

  const startOverlaps = checkAABBIntersection(entity, thinWall);
  const endBox = translateAABB(entity, highSpeedVelocity);
  const endOverlaps = checkAABBIntersection(endBox, thinWall);

  assert.equal(startOverlaps, false);
  assert.equal(endOverlaps, false);

  const isGhosting = detectGhostTeleportation(entity, highSpeedVelocity, thinWall);
  assert.equal(isGhosting, true);

  const hit = sweptAABB(entity, highSpeedVelocity, thinWall);
  assert.equal(hit.hasCollision, true);
  assert.ok(hit.timeOfImpact > 0 && hit.timeOfImpact < 1.0);
  assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 });
});

test("resolveKinematicProjection halts high-speed entity at obstacle surface and prevents ghost teleportation", () => {
  const entity = createAABB(
    { x: 0, y: 0, z: 0 },
    { x: 0.6, y: 1.8, z: 0.6 }
  );
  const obstacles = [
    createAABB({ x: 2.0, y: 0, z: -1.0 }, { x: 2.2, y: 2.0, z: 2.0 })
  ];
  const highSpeedVelocity = { x: 4.0, y: 0, z: 0 };

  const result = resolveKinematicProjection(entity, highSpeedVelocity, obstacles);

  assert.equal(result.ghostTeleportationPrevented, true);
  assert.equal(result.collidedHorizontally, true);
  assert.equal(result.onGround, false);
  assert.ok(result.finalBox.max.x <= 2.0 + 1e-4);
  assert.ok(result.hits.length > 0);
  assert.equal(result.hits[0].normal.x, -1);
});

test("sweptAABB detects falling collision with ground (+Y Up normal) and sets onGround", () => {
  const entity = createAABB(
    { x: 0, y: 5, z: 0 },
    { x: 1, y: 7, z: 1 }
  );
  const ground = createAABB(
    { x: -10, y: 0, z: -10 },
    { x: 10, y: 1, z: 10 }
  );
  const downwardVelocity = { x: 0, y: -8, z: 0 };

  const result = resolveKinematicProjection(entity, downwardVelocity, [ground]);

  assert.equal(result.onGround, true);
  assert.equal(result.collidedVertically, true);
  assert.ok(result.finalBox.min.y >= 1.0 - 1e-4);
  assert.deepEqual(result.hits[0].normal, { x: 0, y: 1, z: 0 });
});

test("client-interpolated hitboxes derive all 8 bounding vertices across trajectory substeps", () => {
  const entity = createAABB(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 1 }
  );
  const velocity = { x: 2, y: 1, z: 3 };

  const result = resolveKinematicProjection(entity, velocity, [], {
    clientInterpolationSubsteps: 4
  });

  assert.equal(result.trajectory.length, 5);

  for (let i = 0; i < result.trajectory.length; i++) {
    const point = result.trajectory[i];
    assert.equal(point.tickFraction, i / 4);
    assert.equal(point.vertices.vertices.length, 8);
    assert.equal(typeof point.vertices.bottomWestNorth.x, "number");
    assert.equal(typeof point.vertices.topEastSouth.z, "number");
  }

  const finalPoint = result.trajectory[result.trajectory.length - 1];
  assert.deepEqual(finalPoint.box, result.finalBox);
});

test("sweptAABB handles initial overlap at t=0 by reporting immediate collision and pushout normal", () => {
  const boxA = createAABB({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
  const boxB = createAABB({ x: 1.5, y: 0, z: 0 }, { x: 3, y: 2, z: 2 });
  const velocity = { x: 1, y: 0, z: 0 };

  const hit = sweptAABB(boxA, velocity, boxB);

  assert.equal(hit.hasCollision, true);
  assert.equal(hit.timeOfImpact, 0);
  assert.equal(hit.initialOverlap, true);
  assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 });
});

test("sweepMultiAABB selects earliest obstacle hit when multiple barriers are along the path", () => {
  const entity = createAABB({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
  const firstBarrier = createAABB({ x: 3, y: 0, z: 0 }, { x: 4, y: 1, z: 1 });
  const secondBarrier = createAABB({ x: 6, y: 0, z: 0 }, { x: 7, y: 1, z: 1 });
  const velocity = { x: 10, y: 0, z: 0 };

  const hit = sweepMultiAABB(entity, velocity, [secondBarrier, firstBarrier]);

  assert.equal(hit.hasCollision, true);
  assert.equal(hit.obstacleIndex, 1);
  assert.equal(hit.timeOfImpact, 0.2);
});
