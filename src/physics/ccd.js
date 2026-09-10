/**
 * Bedrock-coordinate swept AABB continuous collision detection (CCD).
 *
 * Coordinate space: +X East, +Y Up, +Z South.
 * An AABB is `{ min: [x, y, z], max: [x, y, z] }`.
 *
 * High-speed kinematic entities (> 1.5 blocks/tick) tunnel through thin
 * geometry when resolved with discrete end-state overlap tests. Sweeping the
 * mover's AABB along its per-tick displacement closes that desync between the
 * server's authoritative bounds and the client-interpolated hitbox.
 */

const EPSILON = 1e-9;

export function createAABB(min, max) {
  return {
    min: [min[0], min[1], min[2]],
    max: [max[0], max[1], max[2]],
  };
}

/**
 * Derives all 8 spatial bounding vertices of an AABB.
 * Ordered along Bedrock axes: +X East, +Y Up, +Z South.
 */
export function getBoundingVertices(box) {
  const [minX, minY, minZ] = box.min;
  const [maxX, maxY, maxZ] = box.max;
  return [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [minX, maxY, minZ],
    [maxX, maxY, minZ],
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [minX, maxY, maxZ],
    [maxX, maxY, maxZ],
  ];
}

function halfExtents(box) {
  return [
    (box.max[0] - box.min[0]) / 2,
    (box.max[1] - box.min[1]) / 2,
    (box.max[2] - box.min[2]) / 2,
  ];
}

function center(box) {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

function pointInAABB(p, min, max) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < min[i] || p[i] > max[i]) return false;
  }
  return true;
}

/**
 * Slab-method ray/AABB intersection.
 * Returns { entry, exit, hitAxis } or null when the ray misses.
 */
function rayAABB(origin, dir, min, max) {
  let entry = 0;
  let exit = Infinity;
  let hitAxis = -1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < EPSILON) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
    } else {
      let t1 = (min[i] - origin[i]) / dir[i];
      let t2 = (max[i] - origin[i]) / dir[i];
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > entry) {
        entry = t1;
        hitAxis = i;
      }
      if (t2 < exit) exit = t2;
      if (entry > exit) return null;
    }
  }
  return { entry, exit, hitAxis };
}

/**
 * Swept AABB test between a moving box and a static box over one tick.
 * The mover is expanded into the static box (Minkowski sum) and its
 * displacement is cast as a ray through the expanded volume.
 *
 * Returns `{ time, obstacle, normal, point }` where `time` is the tick
 * fraction in [0, 1] at first contact, or null when no collision occurs.
 */
export function sweptAABB(mover, velocity, obstacle) {
  const half = halfExtents(mover);
  const origin = center(mover);
  const expandedMin = [
    obstacle.min[0] - half[0],
    obstacle.min[1] - half[1],
    obstacle.min[2] - half[2],
  ];
  const expandedMax = [
    obstacle.max[0] + half[0],
    obstacle.max[1] + half[1],
    obstacle.max[2] + half[2],
  ];

  if (Math.abs(velocity[0]) < EPSILON && Math.abs(velocity[1]) < EPSILON && Math.abs(velocity[2]) < EPSILON) {
    return pointInAABB(origin, expandedMin, expandedMax)
      ? { time: 0, obstacle, normal: [0, 0, 0], point: origin }
      : null;
  }

  const hit = rayAABB(origin, velocity, expandedMin, expandedMax);
  if (!hit) return null;
  if (hit.entry > 1 || hit.exit < 0) return null;

  const time = Math.max(0, hit.entry);
  const point = [
    origin[0] + velocity[0] * time,
    origin[1] + velocity[1] * time,
    origin[2] + velocity[2] * time,
  ];
  const normal = [0, 0, 0];
  if (hit.hitAxis >= 0) {
    normal[hit.hitAxis] = velocity[hit.hitAxis] > 0 ? -1 : 1;
  }
  return { time, obstacle, normal, point };
}

/**
 * Resolves a kinematic displacement against many static obstacles, returning
 * the earliest swept contact (or null if the move is unobstructed).
 */
export function resolveSweptMotion(mover, velocity, obstacles) {
  let best = null;
  for (const obstacle of obstacles) {
    const hit = sweptAABB(mover, velocity, obstacle);
    if (!hit) continue;
    if (!best || hit.time < best.time) best = hit;
  }
  return best;
}