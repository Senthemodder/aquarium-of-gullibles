/**
 * Swept AABB Continuous Collision Detection (CCD)
 * 
 * Bedrock Coordinate Space:
 * - +X = East
 * - +Y = Up
 * - +Z = South
 * 
 * Problem: At high velocities (> 1.5 blocks/tick), discrete AABB sampling
 * allows entities to tunnel through collision volumes. Desync occurs because
 * the server uses point-in-time checks while the client interpolates hits
 * over the tick duration.
 * 
 * Solution: Swept AABB continuous collision detection that casts the entity's
 * bounding box along its movement vector and finds the earliest collision time.
 */

/**
 * @typedef {Object} Vec3
 * @property {number} x - East component
 * @property {number} y - Up component
 * @property {number} z - South component
 */

/**
 * @typedef {Object} AABBSize
 * @property {number} halfWidth - Half width in X and Z (blocks)
 * @property {number} halfHeight - Half height in Y (blocks)
 */

/**
 * @typedef {Object} AABB
 * @property {number} minX - Minimum X (West)
 * @property {number} maxX - Maximum X (East)
 * @property {number} minY - Minimum Y (Down)
 * @property {number} maxY - Maximum Y (Up)
 * @property {number} minZ - Minimum Z (North)
 * @property {number} maxZ - Maximum Z (South)
 */

/**
 * @typedef {Object} CollisionResult
 * @property {boolean} collided - Whether a collision occurred
 * @property {number} hitTime - Time of collision (0.0 to 1.0, fraction of movement)
 * @property {Vec3} hitPoint - Point of collision
 * @property {Vec3} hitNormal - Surface normal of collision
 * @property {Vec3} resolvedPos - Resolved position after collision
 */

// ============================================================
// Vector Math Utilities
// ============================================================

/**
 * Add two vectors.
 * @param {Vec3} a 
 * @param {Vec3} b 
 * @returns {Vec3}
 */
function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Subtract vector b from a.
 * @param {Vec3} a 
 * @param {Vec3} b 
 * @returns {Vec3}
 */
function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Scale a vector by a scalar.
 * @param {Vec3} v 
 * @param {number} s 
 * @returns {Vec3}
 */
function vecScale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Dot product of two vectors.
 * @param {Vec3} a 
 * @param {Vec3} b 
 * @returns {number}
 */
function vecDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Length (magnitude) of a vector.
 * @param {Vec3} v 
 * @returns {number}
 */
function vecLength(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize a vector to unit length.
 * @param {Vec3} v 
 * @returns {Vec3}
 */
function vecNormalize(v) {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// ============================================================
// AABB Vertex Derivation
// ============================================================

/**
 * Derive all 8 spatial bounding vertices of an AABB relative to center.
 * 
 * Bedrock Coordinate Space:
 * - +X = East, -X = West
 * - +Y = Up, -Y = Down
 * - +Z = South, -Z = North
 * 
 * Vertex order (min to max in each axis):
 * 0: (minX, minY, minZ) - West-Down-North
 * 1: (maxX, minY, minZ) - East-Down-North
 * 2: (minX, maxY, minZ) - West-Up-North
 * 3: (maxX, maxY, minZ) - East-Up-North
 * 4: (minX, minY, maxZ) - West-Down-South
 * 5: (maxX, minY, maxZ) - East-Down-South
 * 6: (minX, maxY, maxZ) - West-Up-South
 * 7: (maxX, maxY, maxZ) - East-Up-South
 * 
 * @param {number} x - Center X (East-West)
 * @param {number} y - Center Y (Up-Down)
 * @param {number} z - Center Z (South-North)
 * @param {AABBSize} size - Entity dimensions
 * @returns {Array<Vec3>} 8 vertices in Bedrock coordinate space
 */
function getVertices(x, y, z, size) {
  const hw = size.halfWidth;
  const hh = size.halfHeight;
  // For Bedrock, X and Z use halfWidth, Y uses halfHeight
  const hx = hw;
  const hz = hw;
  const hy = hh;

  return [
    { x: x - hx, y: y - hy, z: z - hz }, // 0: West-Down-North
    { x: x + hx, y: y - hy, z: z - hz }, // 1: East-Down-North
    { x: x - hx, y: y + hy, z: z - hz }, // 2: West-Up-North
    { x: x + hx, y: y + hy, z: z - hz }, // 3: East-Up-North
    { x: x - hx, y: y - hy, z: z + hz }, // 4: West-Down-South
    { x: x + hx, y: y - hy, z: z + hz }, // 5: East-Down-South
    { x: x - hx, y: y + hy, z: z + hz }, // 6: West-Up-South
    { x: x + hx, y: y + hy, z: z + hz }, // 7: East-Up-South
  ];
}

/**
 * Get AABB (axis-aligned bounding box) from center position and size.
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 * @param {AABBSize} size 
 * @returns {AABB}
 */
function getAABB(x, y, z, size) {
  const hw = size.halfWidth;
  const hh = size.halfHeight;
  return {
    minX: x - hw,
    maxX: x + hw,
    minY: y - hh,
    maxY: y + hh,
    minZ: z - hw,
    maxZ: z + hw,
  };
}

// ============================================================
// Swept AABB Continuous Collision Detection
// ============================================================

/**
 * Check if two AABBs overlap.
 * @param {AABB} a 
 * @param {AABB} b 
 * @returns {boolean}
 */
function aabbOverlap(a, b) {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX &&
    a.minY <= b.maxY && a.maxY >= b.minY &&
    a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

/**
 * Swept AABB collision detection between a moving entity and a static obstacle.
 * 
 * Uses the slab method (Kay-Kajiya) for ray-box intersection, extended
 * for swept volumes by expanding the obstacle by the entity's half-extents.
 * 
 * @param {Vec3} prevPos - Position at start of tick (t=0)
 * @param {Vec3} nextPos - Position at end of tick (t=1)
 * @param {AABBSize} size - Entity bounding box dimensions
 * @param {AABB} obstacle - Static obstacle bounding box
 * @returns {CollisionResult}
 */
function sweptAABBSingle(prevPos, nextPos, size, obstacle) {
  const delta = vecSub(nextPos, prevPos);
  const deltaLen = vecLength(delta);

  // No movement - check static overlap
  if (deltaLen < 1e-8) {
    const entityAABB = getAABB(prevPos.x, prevPos.y, prevPos.z, size);
    if (aabbOverlap(entityAABB, obstacle)) {
      return {
        collided: true,
        hitTime: 0,
        hitPoint: { ...prevPos },
        hitNormal: { x: 0, y: 1, z: 0 },
        resolvedPos: { ...prevPos },
      };
    }
    return {
      collided: false,
      hitTime: 1,
      hitPoint: { ...nextPos },
      hitNormal: { x: 0, y: 0, z: 0 },
      resolvedPos: { ...nextPos },
    };
  }

  // Expand obstacle by entity half-extents (Minkowski sum)
  const hw = size.halfWidth;
  const hh = size.halfHeight;
  const expanded = {
    minX: obstacle.minX - hw,
    maxX: obstacle.maxX + hw,
    minY: obstacle.minY - hh,
    maxY: obstacle.maxY + hh,
    minZ: obstacle.minZ - hw,
    maxZ: obstacle.maxZ + hw,
  };

  // Slab method for ray-box intersection
  let tMin = 0;
  let tMax = 1;
  let hitNormal = { x: 0, y: 0, z: 0 };

  // X slab (East-West)
  if (Math.abs(delta.x) < 1e-8) {
    if (prevPos.x < expanded.minX || prevPos.x > expanded.maxX) {
      return noCollision(nextPos);
    }
  } else {
    const t1 = (expanded.minX - prevPos.x) / delta.x;
    const t2 = (expanded.maxX - prevPos.x) / delta.x;
    const tNear = Math.min(t1, t2);
    const tFar = Math.max(t1, t2);
    
    if (tNear > tMin) {
      tMin = tNear;
      hitNormal = { x: delta.x > 0 ? -1 : 1, y: 0, z: 0 };
    }
    tMax = Math.min(tMax, tFar);
  }

  // Y slab (Up-Down)
  if (Math.abs(delta.y) < 1e-8) {
    if (prevPos.y < expanded.minY || prevPos.y > expanded.maxY) {
      return noCollision(nextPos);
    }
  } else {
    const t1 = (expanded.minY - prevPos.y) / delta.y;
    const t2 = (expanded.maxY - prevPos.y) / delta.y;
    const tNear = Math.min(t1, t2);
    const tFar = Math.max(t1, t2);
    
    if (tNear > tMin) {
      tMin = tNear;
      hitNormal = { x: 0, y: delta.y > 0 ? -1 : 1, z: 0 };
    }
    tMax = Math.min(tMax, tFar);
  }

  // Z slab (South-North)
  if (Math.abs(delta.z) < 1e-8) {
    if (prevPos.z < expanded.minZ || prevPos.z > expanded.maxZ) {
      return noCollision(nextPos);
    }
  } else {
    const t1 = (expanded.minZ - prevPos.z) / delta.z;
    const t2 = (expanded.maxZ - prevPos.z) / delta.z;
    const tNear = Math.min(t1, t2);
    const tFar = Math.max(t1, t2);
    
    if (tNear > tMin) {
      tMin = tNear;
      hitNormal = { x: 0, y: 0, z: delta.z > 0 ? -1 : 1 };
    }
    tMax = Math.min(tMax, tFar);
  }

  // Check if ray intersects expanded box
  if (tMin > tMax || tMin > 1 || tMax < 0) {
    return noCollision(nextPos);
  }

  // Clamp hit time to [0, 1]
  const hitTime = Math.max(0, Math.min(1, tMin));
  
  // Calculate hit point and resolved position
  const hitPoint = vecAdd(prevPos, vecScale(delta, hitTime));
  
  // Resolved position: stop just before collision (small epsilon)
  const epsilon = 1e-4;
  const resolvedTime = Math.max(0, hitTime - epsilon);
  const resolvedPos = vecAdd(prevPos, vecScale(delta, resolvedTime));

  return {
    collided: true,
    hitTime,
    hitPoint,
    hitNormal,
    resolvedPos,
  };
}

/**
 * Helper: return no-collision result.
 * @param {Vec3} nextPos 
 * @returns {CollisionResult}
 */
function noCollision(nextPos) {
  return {
    collided: false,
    hitTime: 1,
    hitPoint: { ...nextPos },
    hitNormal: { x: 0, y: 0, z: 0 },
    resolvedPos: { ...nextPos },
  };
}

/**
 * Swept AABB collision detection against multiple obstacles.
 * Returns the earliest collision across all obstacles.
 * 
 * @param {Vec3} prevPos - Position at start of tick
 * @param {Vec3} nextPos - Position at end of tick
 * @param {AABBSize} size - Entity bounding box dimensions
 * @param {Array<AABB>} obstacles - Array of static obstacle bounding boxes
 * @returns {CollisionResult} Earliest collision result
 */
function sweptAABB(prevPos, nextPos, size, obstacles) {
  let earliest = noCollision(nextPos);

  for (const obstacle of obstacles) {
    const result = sweptAABBSingle(prevPos, nextPos, size, obstacle);
    if (result.collided && result.hitTime < earliest.hitTime) {
      earliest = result;
    }
  }

  return earliest;
}

/**
 * High-velocity kinematic entity projection with sub-stepping.
 * 
 * For velocities > 1.5 blocks/tick, subdivides the movement into
 * smaller sub-steps to prevent tunneling through thin collision meshes.
 * 
 * @param {Vec3} prevPos - Position at start of tick
 * @param {Vec3} nextPos - Desired position at end of tick
 * @param {AABBSize} size - Entity bounding box dimensions
 * @param {Array<AABB>} obstacles - Array of static obstacle bounding boxes
 * @param {number} maxSubStep - Maximum sub-step size (blocks), default 0.5
 * @returns {CollisionResult} Final collision result after sub-stepping
 */
function highVelocitySweep(prevPos, nextPos, size, obstacles, maxSubStep = 0.5) {
  const delta = vecSub(nextPos, prevPos);
  const deltaLen = vecLength(delta);

  // If movement is small enough, no sub-stepping needed
  if (deltaLen <= maxSubStep) {
    return sweptAABB(prevPos, nextPos, size, obstacles);
  }

  // Calculate number of sub-steps
  const numSteps = Math.ceil(deltaLen / maxSubStep);
  const stepDelta = vecScale(delta, 1 / numSteps);

  let currentPos = { ...prevPos };
  let finalResult = noCollision(nextPos);

  for (let i = 0; i < numSteps; i++) {
    const stepEnd = vecAdd(currentPos, stepDelta);
    const result = sweptAABB(currentPos, stepEnd, size, obstacles);

    if (result.collided) {
      // Collision found in this sub-step
      return {
        collided: true,
        hitTime: (i + result.hitTime) / numSteps,
        hitPoint: result.hitPoint,
        hitNormal: result.hitNormal,
        resolvedPos: result.resolvedPos,
      };
    }

    currentPos = result.resolvedPos;
  }

  return finalResult;
}

// ============================================================
// Exports
// ============================================================

export {
  // Vector math
  vecAdd,
  vecSub,
  vecScale,
  vecDot,
  vecLength,
  vecNormalize,
  // Vertex derivation
  getVertices,
  getAABB,
  // Collision detection
  aabbOverlap,
  sweptAABBSingle,
  sweptAABB,
  highVelocitySweep,
};

export default {
  getVertices,
  getAABB,
  sweptAABB,
  highVelocitySweep,
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
};
