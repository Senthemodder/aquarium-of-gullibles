export interface AABB {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export function calculateSweptAABB(start: AABB, end: AABB, velocity: { x: number; y: number; z: number }): AABB {
  return {
    min: {
      x: Math.min(start.min.x, end.min.x),
      y: Math.min(start.min.y, end.min.y),
      z: Math.min(start.min.z, end.min.z)
    },
    max: {
      x: Math.max(start.max.x, end.max.x),
      y: Math.max(start.max.y, end.max.y),
      z: Math.max(start.max.z, end.max.z)
    }
  };
}

export function getSpatialVertices(aabb: AABB) {
  return [
    { x: aabb.min.x, y: aabb.min.y, z: aabb.min.z },
    { x: aabb.max.x, y: aabb.min.y, z: aabb.min.z },
    { x: aabb.min.x, y: aabb.max.y, z: aabb.min.z },
    { x: aabb.max.x, y: aabb.max.y, z: aabb.min.z },
    { x: aabb.min.x, y: aabb.min.y, z: aabb.max.z },
    { x: aabb.max.x, y: aabb.min.y, z: aabb.max.z },
    { x: aabb.min.x, y: aabb.max.y, z: aabb.max.z },
    { x: aabb.max.x, y: aabb.max.y, z: aabb.max.z }
  ];
}