import { AABB, BedrockSpatialVertices, Vector3 } from "./types.js";

/**
 * Creates a three-dimensional vector.
 *
 * @param x Coordinate on the X axis (positive East).
 * @param y Coordinate on the Y axis (positive Up).
 * @param z Coordinate on the Z axis (positive South).
 * @returns Immutable Vector3 instance.
 */
export function createVector3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

/**
 * Creates an axis-aligned bounding box from explicit spatial bounds.
 *
 * @param min Bottom-West-North minimal coordinates.
 * @param max Top-East-South maximal coordinates.
 * @returns Normalized AABB instance.
 */
export function createAABB(min: Vector3, max: Vector3): AABB {
  return {
    min: {
      x: Math.min(min.x, max.x),
      y: Math.min(min.y, max.y),
      z: Math.min(min.z, max.z)
    },
    max: {
      x: Math.max(min.x, max.x),
      y: Math.max(min.y, max.y),
      z: Math.max(min.z, max.z)
    }
  };
}

/**
 * Constructs an AABB from position and dimensions.
 *
 * @param position Reference origin coordinates.
 * @param width Extent along East-West X axis.
 * @param height Extent along Up-Down Y axis.
 * @param depth Extent along South-North Z axis (defaults to width).
 * @param isFeetOrigin True if position is feet center, false if volume center.
 * @returns Structured AABB instance.
 */
export function createAABBFromPosition(
  position: Vector3,
  width: number,
  height: number,
  depth?: number,
  isFeetOrigin: boolean = true
): AABB {
  const d = depth ?? width;
  const halfW = width / 2;
  const halfD = d / 2;

  if (isFeetOrigin) {
    return {
      min: {
        x: position.x - halfW,
        y: position.y,
        z: position.z - halfD
      },
      max: {
        x: position.x + halfW,
        y: position.y + height,
        z: position.z + halfD
      }
    };
  }

  const halfH = height / 2;
  return {
    min: {
      x: position.x - halfW,
      y: position.y - halfH,
      z: position.z - halfD
    },
    max: {
      x: position.x + halfW,
      y: position.y + halfH,
      z: position.z + halfD
    }
  };
}

/**
 * Derives all 8 spatial bounding vertices following Bedrock coordinate space (+X East, +Y Up, +Z South).
 *
 * @param box Target axis-aligned bounding box.
 * @returns Spatial vertices mapped to cardinal Bedrock directions.
 */
export function deriveBedrockBoundingVertices(box: AABB): BedrockSpatialVertices {
  const bottomWestNorth: Vector3 = { x: box.min.x, y: box.min.y, z: box.min.z };
  const bottomEastNorth: Vector3 = { x: box.max.x, y: box.min.y, z: box.min.z };
  const topWestNorth: Vector3 = { x: box.min.x, y: box.max.y, z: box.min.z };
  const topEastNorth: Vector3 = { x: box.max.x, y: box.max.y, z: box.min.z };
  const bottomWestSouth: Vector3 = { x: box.min.x, y: box.min.y, z: box.max.z };
  const bottomEastSouth: Vector3 = { x: box.max.x, y: box.min.y, z: box.max.z };
  const topWestSouth: Vector3 = { x: box.min.x, y: box.max.y, z: box.max.z };
  const topEastSouth: Vector3 = { x: box.max.x, y: box.max.y, z: box.max.z };

  const vertices: readonly [
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3
  ] = [
    bottomWestNorth,
    bottomEastNorth,
    topWestNorth,
    topEastNorth,
    bottomWestSouth,
    bottomEastSouth,
    topWestSouth,
    topEastSouth
  ];

  const center: Vector3 = {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2
  };

  const extents: Vector3 = {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z
  };

  return {
    bottomWestNorth,
    bottomEastNorth,
    topWestNorth,
    topEastNorth,
    bottomWestSouth,
    bottomEastSouth,
    topWestSouth,
    topEastSouth,
    vertices,
    center,
    extents
  };
}

/**
 * Computes broadphase swept bounding box enclosing start position and displacement vector.
 *
 * @param box Initial bounding box.
 * @param velocity Kinematic displacement per tick.
 * @returns Swept envelope AABB.
 */
export function computeSweptBroadphaseAABB(box: AABB, velocity: Vector3): AABB {
  return {
    min: {
      x: Math.min(box.min.x, box.min.x + velocity.x),
      y: Math.min(box.min.y, box.min.y + velocity.y),
      z: Math.min(box.min.z, box.min.z + velocity.z)
    },
    max: {
      x: Math.max(box.max.x, box.max.x + velocity.x),
      y: Math.max(box.max.y, box.max.y + velocity.y),
      z: Math.max(box.max.z, box.max.z + velocity.z)
    }
  };
}

/**
 * Evaluates discrete spatial intersection between two AABB volumes.
 *
 * @param a First bounding box.
 * @param b Second bounding box.
 * @param epsilon Tolerance margin for boundary touches.
 * @returns True if boxes overlap in 3D volume.
 */
export function checkAABBIntersection(
  a: AABB,
  b: AABB,
  epsilon: number = 1e-7
): boolean {
  return (
    a.min.x < b.max.x - epsilon &&
    a.max.x > b.min.x + epsilon &&
    a.min.y < b.max.y - epsilon &&
    a.max.y > b.min.y + epsilon &&
    a.min.z < b.max.z - epsilon &&
    a.max.z > b.min.z + epsilon
  );
}

/**
 * Translates an AABB by a displacement vector.
 *
 * @param box Target bounding box.
 * @param offset Spatial translation.
 * @returns Translated AABB.
 */
export function translateAABB(box: AABB, offset: Vector3): AABB {
  return {
    min: {
      x: box.min.x + offset.x,
      y: box.min.y + offset.y,
      z: box.min.z + offset.z
    },
    max: {
      x: box.max.x + offset.x,
      y: box.max.y + offset.y,
      z: box.max.z + offset.z
    }
  };
}

/**
 * Linearly interpolates between two bounding boxes across sub-tick intervals.
 *
 * @param start Origin bounding box at alpha = 0.
 * @param end Destination bounding box at alpha = 1.
 * @param alpha Normalized progression in range [0, 1].
 * @returns Interpolated AABB.
 */
export function interpolateAABB(start: AABB, end: AABB, alpha: number): AABB {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return {
    min: {
      x: start.min.x + (end.min.x - start.min.x) * clampedAlpha,
      y: start.min.y + (end.min.y - start.min.y) * clampedAlpha,
      z: start.min.z + (end.min.z - start.min.z) * clampedAlpha
    },
    max: {
      x: start.max.x + (end.max.x - start.max.x) * clampedAlpha,
      y: start.max.y + (end.max.y - start.max.y) * clampedAlpha,
      z: start.max.z + (end.max.z - start.max.z) * clampedAlpha
    }
  };
}
