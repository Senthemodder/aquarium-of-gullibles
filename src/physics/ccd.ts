import {
  AABB,
  BedrockSpatialVertices,
  KinematicProjectionResult,
  KinematicTrajectoryPoint,
  ProjectionOptions,
  SweptHit,
  Vector3
} from "./types.js";
import {
  checkAABBIntersection,
  computeSweptBroadphaseAABB,
  deriveBedrockBoundingVertices,
  interpolateAABB,
  translateAABB
} from "./aabb.js";

const DEFAULT_MAX_ITERATIONS = 4;
const DEFAULT_SKIN_WIDTH = 1e-4;
const DEFAULT_CLIENT_SUBSTEPS = 4;
const EPSILON = 1e-7;

/**
 * Derives surface normal to separate two initially overlapping AABBs along the axis of minimum penetration.
 *
 * @param box Moving entity box.
 * @param obstacle Static obstacle box.
 * @returns Normal vector directed outwards from obstacle.
 */
function deriveSeparationNormal(box: AABB, obstacle: AABB): Vector3 {
  const overlapX1 = obstacle.max.x - box.min.x;
  const overlapX2 = box.max.x - obstacle.min.x;
  const minOverlapX = Math.min(overlapX1, overlapX2);

  const overlapY1 = obstacle.max.y - box.min.y;
  const overlapY2 = box.max.y - obstacle.min.y;
  const minOverlapY = Math.min(overlapY1, overlapY2);

  const overlapZ1 = obstacle.max.z - box.min.z;
  const overlapZ2 = box.max.z - obstacle.min.z;
  const minOverlapZ = Math.min(overlapZ1, overlapZ2);

  if (minOverlapX <= minOverlapY && minOverlapX <= minOverlapZ) {
    return { x: overlapX1 < overlapX2 ? 1 : -1, y: 0, z: 0 };
  }
  if (minOverlapY <= minOverlapZ) {
    return { x: 0, y: overlapY1 < overlapY2 ? 1 : -1, z: 0 };
  }
  return { x: 0, y: 0, z: overlapZ1 < overlapZ2 ? 1 : -1 };
}

/**
 * Calculates spatial contact coordinates between colliding box and obstacle.
 *
 * @param box Entity bounding box at impact.
 * @param obstacle Impacted obstacle bounding box.
 * @param normal Surface normal of collision.
 * @returns Spatial 3D contact coordinates.
 */
function deriveContactPoint(box: AABB, obstacle: AABB, normal: Vector3): Vector3 {
  let cx: number;
  let cy: number;
  let cz: number;

  if (normal.x === -1) {
    cx = obstacle.min.x;
  } else if (normal.x === 1) {
    cx = obstacle.max.x;
  } else {
    cx = (Math.max(box.min.x, obstacle.min.x) + Math.min(box.max.x, obstacle.max.x)) / 2;
  }

  if (normal.y === -1) {
    cy = obstacle.min.y;
  } else if (normal.y === 1) {
    cy = obstacle.max.y;
  } else {
    cy = (Math.max(box.min.y, obstacle.min.y) + Math.min(box.max.y, obstacle.max.y)) / 2;
  }

  if (normal.z === -1) {
    cz = obstacle.min.z;
  } else if (normal.z === 1) {
    cz = obstacle.max.z;
  } else {
    cz = (Math.max(box.min.z, obstacle.min.z) + Math.min(box.max.z, obstacle.max.z)) / 2;
  }

  return { x: cx, y: cy, z: cz };
}

/**
 * Evaluates continuous collision detection between moving bounding box and static obstacle over 1 tick.
 *
 * @param box Moving entity bounding box.
 * @param velocity Kinematic displacement per tick.
 * @param obstacle Static obstacle bounding box.
 * @returns Swept continuous collision outcome.
 */
export function sweptAABB(box: AABB, velocity: Vector3, obstacle: AABB): SweptHit {
  if (checkAABBIntersection(box, obstacle)) {
    const normal = deriveSeparationNormal(box, obstacle);
    const contactPoint = deriveContactPoint(box, obstacle, normal);
    return {
      hasCollision: true,
      timeOfImpact: 0,
      normal,
      contactPoint,
      boxAtImpact: box,
      initialOverlap: true
    };
  }

  const broadphase = computeSweptBroadphaseAABB(box, velocity);
  if (
    broadphase.max.x <= obstacle.min.x ||
    broadphase.min.x >= obstacle.max.x ||
    broadphase.max.y <= obstacle.min.y ||
    broadphase.min.y >= obstacle.max.y ||
    broadphase.max.z <= obstacle.min.z ||
    broadphase.min.z >= obstacle.max.z
  ) {
    return {
      hasCollision: false,
      timeOfImpact: 1.0,
      normal: { x: 0, y: 0, z: 0 },
      contactPoint: { x: 0, y: 0, z: 0 },
      boxAtImpact: translateAABB(box, velocity),
      initialOverlap: false
    };
  }

  let xEntry: number;
  let xExit: number;
  if (Math.abs(velocity.x) < EPSILON) {
    if (box.max.x <= obstacle.min.x || box.min.x >= obstacle.max.x) {
      return {
        hasCollision: false,
        timeOfImpact: 1.0,
        normal: { x: 0, y: 0, z: 0 },
        contactPoint: { x: 0, y: 0, z: 0 },
        boxAtImpact: translateAABB(box, velocity),
        initialOverlap: false
      };
    }
    xEntry = -Infinity;
    xExit = Infinity;
  } else if (velocity.x > 0) {
    xEntry = (obstacle.min.x - box.max.x) / velocity.x;
    xExit = (obstacle.max.x - box.min.x) / velocity.x;
  } else {
    xEntry = (obstacle.max.x - box.min.x) / velocity.x;
    xExit = (obstacle.min.x - box.max.x) / velocity.x;
  }

  let yEntry: number;
  let yExit: number;
  if (Math.abs(velocity.y) < EPSILON) {
    if (box.max.y <= obstacle.min.y || box.min.y >= obstacle.max.y) {
      return {
        hasCollision: false,
        timeOfImpact: 1.0,
        normal: { x: 0, y: 0, z: 0 },
        contactPoint: { x: 0, y: 0, z: 0 },
        boxAtImpact: translateAABB(box, velocity),
        initialOverlap: false
      };
    }
    yEntry = -Infinity;
    yExit = Infinity;
  } else if (velocity.y > 0) {
    yEntry = (obstacle.min.y - box.max.y) / velocity.y;
    yExit = (obstacle.max.y - box.min.y) / velocity.y;
  } else {
    yEntry = (obstacle.max.y - box.min.y) / velocity.y;
    yExit = (obstacle.min.y - box.max.y) / velocity.y;
  }

  let zEntry: number;
  let zExit: number;
  if (Math.abs(velocity.z) < EPSILON) {
    if (box.max.z <= obstacle.min.z || box.min.z >= obstacle.max.z) {
      return {
        hasCollision: false,
        timeOfImpact: 1.0,
        normal: { x: 0, y: 0, z: 0 },
        contactPoint: { x: 0, y: 0, z: 0 },
        boxAtImpact: translateAABB(box, velocity),
        initialOverlap: false
      };
    }
    zEntry = -Infinity;
    zExit = Infinity;
  } else if (velocity.z > 0) {
    zEntry = (obstacle.min.z - box.max.z) / velocity.z;
    zExit = (obstacle.max.z - box.min.z) / velocity.z;
  } else {
    zEntry = (obstacle.max.z - box.min.z) / velocity.z;
    zExit = (obstacle.min.z - box.max.z) / velocity.z;
  }

  const entryTime = Math.max(xEntry, yEntry, zEntry);
  const exitTime = Math.min(xExit, yExit, zExit);

  if (entryTime > exitTime || exitTime < 0 || entryTime > 1.0) {
    return {
      hasCollision: false,
      timeOfImpact: 1.0,
      normal: { x: 0, y: 0, z: 0 },
      contactPoint: { x: 0, y: 0, z: 0 },
      boxAtImpact: translateAABB(box, velocity),
      initialOverlap: false
    };
  }

  if (xEntry < 0 && yEntry < 0 && zEntry < 0) {
    return {
      hasCollision: false,
      timeOfImpact: 1.0,
      normal: { x: 0, y: 0, z: 0 },
      contactPoint: { x: 0, y: 0, z: 0 },
      boxAtImpact: translateAABB(box, velocity),
      initialOverlap: false
    };
  }

  const effectiveToi = Math.max(0, Math.min(1.0, entryTime));

  let normal: Vector3;
  if (entryTime === xEntry) {
    normal = { x: velocity.x > 0 ? -1 : 1, y: 0, z: 0 };
  } else if (entryTime === yEntry) {
    normal = { x: 0, y: velocity.y > 0 ? -1 : 1, z: 0 };
  } else {
    normal = { x: 0, y: 0, z: velocity.z > 0 ? -1 : 1 };
  }

  const boxAtImpact = translateAABB(box, {
    x: velocity.x * effectiveToi,
    y: velocity.y * effectiveToi,
    z: velocity.z * effectiveToi
  });

  const contactPoint = deriveContactPoint(boxAtImpact, obstacle, normal);

  return {
    hasCollision: true,
    timeOfImpact: effectiveToi,
    normal,
    contactPoint,
    boxAtImpact,
    initialOverlap: false
  };
}

/**
 * Evaluates swept collision against multiple obstacle candidates, returning the earliest impact.
 *
 * @param box Moving entity bounding box.
 * @param velocity Kinematic displacement per tick.
 * @param obstacles Collection of static obstacles.
 * @returns Earliest swept collision record.
 */
export function sweepMultiAABB(
  box: AABB,
  velocity: Vector3,
  obstacles: readonly AABB[]
): SweptHit {
  let earliestHit: SweptHit = {
    hasCollision: false,
    timeOfImpact: 1.0,
    normal: { x: 0, y: 0, z: 0 },
    contactPoint: { x: 0, y: 0, z: 0 },
    boxAtImpact: translateAABB(box, velocity),
    initialOverlap: false
  };

  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    const hit = sweptAABB(box, velocity, obstacle);

    if (hit.hasCollision && hit.timeOfImpact < earliestHit.timeOfImpact) {
      earliestHit = {
        ...hit,
        obstacleIndex: i
      };
    }
  }

  return earliestHit;
}

/**
 * Checks whether discrete collision detection would miss an obstacle traversed along a continuous trajectory.
 *
 * @param startBox Origin bounding box.
 * @param velocity Kinematic displacement per tick.
 * @param obstacle Static obstacle bounding box.
 * @returns True if continuous detection catches a collision that discrete detection drops.
 */
export function detectGhostTeleportation(
  startBox: AABB,
  velocity: Vector3,
  obstacle: AABB
): boolean {
  const endBox = translateAABB(startBox, velocity);
  const startIntersects = checkAABBIntersection(startBox, obstacle);
  const endIntersects = checkAABBIntersection(endBox, obstacle);
  const sweptHit = sweptAABB(startBox, velocity, obstacle);

  return !startIntersects && !endIntersects && sweptHit.hasCollision;
}

/**
 * Resolves high-speed kinematic entity projection (> 1.5 blocks/tick) with continuous collision detection and sliding response.
 *
 * @param initialBox Entity starting bounding box.
 * @param initialVelocity Target velocity displacement per tick.
 * @param obstacles Collection of static obstacles.
 * @param options Kinematic projection configuration.
 * @returns Resolved trajectory and final state.
 */
export function resolveKinematicProjection(
  initialBox: AABB,
  initialVelocity: Vector3,
  obstacles: readonly AABB[],
  options?: ProjectionOptions
): KinematicProjectionResult {
  const maxIterations = options?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const skinWidth = options?.skinWidth ?? DEFAULT_SKIN_WIDTH;
  const substeps = options?.clientInterpolationSubsteps ?? DEFAULT_CLIENT_SUBSTEPS;

  let currentBox = initialBox;
  let remainingVelocity = { ...initialVelocity };
  let remainingTime = 1.0;

  const hits: SweptHit[] = [];
  let onGround = false;
  let collidedHorizontally = false;
  let collidedVertically = false;
  let ghostTeleportationPrevented = false;

  for (let iter = 0; iter < maxIterations && remainingTime > EPSILON; iter++) {
    const stepVelocity: Vector3 = {
      x: remainingVelocity.x * remainingTime,
      y: remainingVelocity.y * remainingTime,
      z: remainingVelocity.z * remainingTime
    };

    if (
      Math.abs(stepVelocity.x) < EPSILON &&
      Math.abs(stepVelocity.y) < EPSILON &&
      Math.abs(stepVelocity.z) < EPSILON
    ) {
      break;
    }

    const hit = sweepMultiAABB(currentBox, stepVelocity, obstacles);

    if (!hit.hasCollision) {
      currentBox = translateAABB(currentBox, stepVelocity);
      remainingTime = 0;
      break;
    }

    hits.push(hit);

    if (hit.obstacleIndex !== undefined) {
      const obstacle = obstacles[hit.obstacleIndex];
      if (detectGhostTeleportation(currentBox, stepVelocity, obstacle)) {
        ghostTeleportationPrevented = true;
      }
    }

    const stepToi = hit.timeOfImpact;
    const advanceFraction = Math.max(0, stepToi - skinWidth);
    const advanceOffset: Vector3 = {
      x: stepVelocity.x * advanceFraction,
      y: stepVelocity.y * advanceFraction,
      z: stepVelocity.z * advanceFraction
    };
    currentBox = translateAABB(currentBox, advanceOffset);

    const elapsed = remainingTime * stepToi;
    remainingTime = Math.max(0, remainingTime - elapsed);

    if (hit.normal.y > 0) {
      onGround = true;
      collidedVertically = true;
      remainingVelocity = { ...remainingVelocity, y: 0 };
    } else if (hit.normal.y < 0) {
      collidedVertically = true;
      remainingVelocity = { ...remainingVelocity, y: 0 };
    }

    if (hit.normal.x !== 0) {
      collidedHorizontally = true;
      remainingVelocity = { ...remainingVelocity, x: 0 };
    }

    if (hit.normal.z !== 0) {
      collidedHorizontally = true;
      remainingVelocity = { ...remainingVelocity, z: 0 };
    }
  }

  const trajectory: KinematicTrajectoryPoint[] = [];
  for (let i = 0; i <= substeps; i++) {
    const fraction = i / substeps;
    const interpolatedBox = interpolateAABB(initialBox, currentBox, fraction);
    const spatialVertices = deriveBedrockBoundingVertices(interpolatedBox);
    trajectory.push({
      tickFraction: fraction,
      position: spatialVertices.center,
      box: interpolatedBox,
      vertices: spatialVertices
    });
  }

  const displacement: Vector3 = {
    x: currentBox.min.x - initialBox.min.x,
    y: currentBox.min.y - initialBox.min.y,
    z: currentBox.min.z - initialBox.min.z
  };

  return {
    initialBox,
    targetVelocity: initialVelocity,
    finalBox: currentBox,
    remainingVelocity,
    displacement,
    hits,
    onGround,
    collidedHorizontally,
    collidedVertically,
    ghostTeleportationPrevented,
    trajectory
  };
}
